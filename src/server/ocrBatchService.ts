import { getDbPool } from './db.ts';
import { OcrProviderRegistry } from './ocrProvider.ts';
import { OcrService } from './ocrService.ts';

type JobState = { status: 'RUNNING' | 'COMPLETE' | 'PARTIAL_FAILURE'; startedAt: string; finishedAt?: string; retryFailed: boolean };

export class OcrBatchService {
  private static jobs = new Map<string, JobState>();

  public static async getProgress(documentId: string) {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable.');
    const result = await pool.query(
      `SELECT p.page_number, p.page_metadata, o.processing_status
       FROM document_pages p
       LEFT JOIN ocr_records o ON o.page_id = p.id
       WHERE p.document_id = $1 ORDER BY p.page_number;`, [documentId]
    );
    const totalPages = result.rows.length;
    let completedPages = 0;
    let processingPages = 0;
    let failedPages = 0;
    for (const row of result.rows) {
      const dbStatus = String(row.processing_status || '').toUpperCase();
      const pageStatus = String(row.page_metadata?.ocrStatus || '').toUpperCase();
      if (['OCR_COMPLETE', 'NEEDS_REVIEW', 'VERIFIED', 'CORRECTED'].includes(dbStatus)) completedPages++;
      else if (pageStatus === 'PROCESSING' || dbStatus === 'PROCESSING') processingPages++;
      else if (pageStatus === 'FAILED' || dbStatus === 'FAILED') failedPages++;
    }
    const pendingPages = Math.max(0, totalPages - completedPages - processingPages - failedPages);
    const provider = OcrProviderRegistry.getProvider('tesseract-archival') as (ReturnType<typeof OcrProviderRegistry.getProvider> & { configurationIssue?: () => string | null }) | null;
    const configurationIssue = provider && 'configurationIssue' in provider && typeof provider.configurationIssue === 'function'
      ? provider.configurationIssue() : 'Tesseract OCR is not configured.';
    const job = this.jobs.get(documentId);
    let status = job?.status || (totalPages > 0 && completedPages === totalPages ? 'COMPLETE' : failedPages > 0 ? 'PARTIAL_FAILURE' : 'PENDING');
    if (!configurationIssue && !job && pendingPages > 0) status = 'READY';
    if (configurationIssue && pendingPages > 0 && !job) status = 'CONFIGURATION_REQUIRED';
    return {
      documentId, totalPages, completedPages, processingPages, pendingPages, failedPages,
      percentComplete: totalPages ? Math.round((completedPages / totalPages) * 10000) / 100 : 0,
      status, providerId: 'tesseract-archival', providerConfigured: !configurationIssue,
      configurationIssue: configurationIssue || undefined,
      startedAt: job?.startedAt, finishedAt: job?.finishedAt, retryFailed: job?.retryFailed,
    };
  }

  public static async start(documentId: string, retryFailed = false): Promise<{ started: boolean; progress: any }> {
    const active = this.jobs.get(documentId);
    if (active?.status === 'RUNNING') return { started: false, progress: await this.getProgress(documentId) };
    const progress = await this.getProgress(documentId);
    if (!progress.totalPages) throw new Error('This document has no extracted page records.');
    if (!progress.providerConfigured) throw new Error(progress.configurationIssue || 'OCR provider is not configured.');
    if (!progress.pendingPages && !(retryFailed && progress.failedPages)) {
      return { started: false, progress };
    }
    const job: JobState = { status: 'RUNNING', startedAt: new Date().toISOString(), retryFailed };
    this.jobs.set(documentId, job);
    void this.run(documentId, retryFailed, job);
    return { started: true, progress: await this.getProgress(documentId) };
  }

  private static async run(documentId: string, retryFailed: boolean, job: JobState): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;
    try {
      const pages = await pool.query(
        `SELECT p.id, p.page_number, p.page_metadata, o.processing_status
         FROM document_pages p LEFT JOIN ocr_records o ON o.page_id = p.id
         WHERE p.document_id = $1 ORDER BY p.page_number;`, [documentId]
      );
      for (const page of pages.rows) {
        const status = String(page.processing_status || page.page_metadata?.ocrStatus || '').toUpperCase();
        const complete = ['OCR_COMPLETE', 'NEEDS_REVIEW', 'VERIFIED', 'CORRECTED'].includes(String(page.processing_status || '').toUpperCase());
        if (complete) continue;
        if (status === 'FAILED' && !retryFailed) continue;
        try {
          await OcrService.processPageOCR(page.id, { providerId: 'tesseract-archival' });
        } catch (error) {
          console.warn(`[OCR batch] Page ${page.page_number} failed: ${error instanceof Error ? error.message : 'OCR processing error'}`);
        }
      }
      const final = await this.getProgress(documentId);
      job.status = final.failedPages > 0 ? 'PARTIAL_FAILURE' : final.completedPages === final.totalPages ? 'COMPLETE' : 'PARTIAL_FAILURE';
      job.finishedAt = new Date().toISOString();
    } catch (error) {
      console.error('[OCR batch] Job stopped:', error instanceof Error ? error.message : 'unknown error');
      job.status = 'PARTIAL_FAILURE';
      job.finishedAt = new Date().toISOString();
    }
  }
}
