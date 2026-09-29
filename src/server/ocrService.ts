/**
 * SERVER-SIDE OCR & VERIFICATION SERVICE LAYER
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements the lifecycle & verification foundation:
 * Original Page -> OCR Output -> Confidence -> Verification -> Correction -> Verified Text -> Citation
 *
 * Enforces:
 * - Preservation of raw machine OCR (in raw_text) separately from human-verified text (in processed_text)
 * - Raw OCR text is NEVER overwritten when corrections are submitted
 * - Zero fabrication of OCR, page scans, or synthetic confidence
 * - Strict verification & correction audit logging
 * - Real citation provenance tracing down to verified text
 */

import { getDbPool } from './db.ts';
import { DocumentStorageService } from './storage/documentStorage.ts';
import {
  type OcrProcessingStatus,
  type OcrVerificationStatus,
  OcrProviderRegistry,
  type BoundingBoxHighlight
} from './ocrProvider.ts';

export interface OcrVerificationMetadata {
  status: OcrVerificationStatus;
  reviewerId: string;
  reviewerName?: string;
  reviewedAt: string;
  correctionNotes?: string;
  engineVersion?: string;
  history: Array<{
    action: 'CREATED' | 'VERIFIED' | 'CORRECTED' | 'REVIEW_REQUESTED' | 'REJECTED';
    reviewerId: string;
    reviewerName?: string;
    timestamp: string;
    notes?: string;
    previousSnippet?: string;
  }>;
}

export interface OcrRecordDto {
  id: string;
  pageId: string;
  pageNumber: number;
  documentId: string;
  archiveId: string;
  rawText: string; // Machine-generated OCR (preserved)
  processedText: string; // Human-verified/corrected text
  textHi?: string;
  textMr?: string;
  textKn?: string;
  confidence: number | null; // Truthful confidence score or null
  language: string;
  processingStatus: OcrProcessingStatus;
  ocrEngine: string;
  boundingHighlights: BoundingBoxHighlight[];
  verification: OcrVerificationMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface PageOcrStatusResponse {
  hasPageRecord: boolean;
  hasOcrRecord: boolean;
  pageId: string;
  pageNumber: number;
  documentId: string;
  archiveId: string;
  archiveTitle: string;
  hasAsset: boolean;
  assetReference?: string;
  documentStatus: string;
  processingStatus: OcrProcessingStatus;
  verificationStatus: OcrVerificationStatus;
  confidence: number | null;
  confidenceLabel: string;
  message: string;
  ocr: OcrRecordDto | null;
}

export interface CitationProvenanceDto {
  isValid: boolean;
  error?: string;
  sourceCollection?: {
    id: string;
    name: string;
    organization: string;
  };
  sourceRecord?: {
    id: string;
    identifier: string;
    originalUrl?: string;
  };
  archiveItem?: {
    id: string;
    archiveId: string;
    title: string;
    year: number;
    author: string;
    sourceInstitution: string;
  };
  document?: {
    id: string;
    title: string;
    documentType: string;
    assetStatus: string;
  };
  page?: {
    id: string;
    pageNumber: number;
    hasRealAsset: boolean;
  };
  ocrRecord?: {
    id: string;
    processingStatus: OcrProcessingStatus;
    ocrEngine: string;
    confidence: number | null;
    isVerified: boolean;
    reviewerId?: string;
    verifiedAt?: string;
  };
  verifiedTextSnippet?: string;
  citations: {
    chicago: string;
    apa: string;
    mla: string;
    bibtex: string;
  };
}

export class OcrService {
  /**
   * Retrieves the OCR record, raw machine text, and human verification state for a given page.
   * Truthfully reports if no page asset or OCR record exists.
   */
  public static async getOCRForPage(pageId: string): Promise<PageOcrStatusResponse> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    // 1. Query document_pages joined with documents and archive_items
    const pageRes = await pool.query(
      `SELECT p.id as page_id, p.page_number, p.original_asset_reference, p.page_metadata,
              d.id as doc_id, d.title as doc_title, d.status as doc_status,
              ai.id as item_id, ai.archive_id, ai.title as item_title
       FROM document_pages p
       JOIN documents d ON p.document_id = d.id
       JOIN archive_items ai ON d.archive_item_id = ai.id
       WHERE p.id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (pageRes.rows.length === 0) {
      return {
        hasPageRecord: false,
        hasOcrRecord: false,
        pageId,
        pageNumber: 0,
        documentId: '',
        archiveId: '',
        archiveTitle: '',
        hasAsset: false,
        documentStatus: 'UNKNOWN',
        processingStatus: 'NOT_PROCESSED',
        verificationStatus: 'UNVERIFIED',
        confidence: null,
        confidenceLabel: 'Confidence unavailable (No page asset)',
        message: 'Page record does not exist in repository.',
        ocr: null
      };
    }

    const pageRow = pageRes.rows[0];
    const hasAsset = Boolean(pageRow.original_asset_reference);

    // 2. Query ocr_records for this page
    const ocrRes = await pool.query(
      `SELECT id, page_id, raw_text, processed_text, text_hi, text_mr, text_kn,
              confidence, language, processing_status, ocr_engine, bounding_highlights,
              created_at, updated_at
       FROM ocr_records
       WHERE page_id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (ocrRes.rows.length === 0) {
      return {
        hasPageRecord: true,
        hasOcrRecord: false,
        pageId: pageRow.page_id,
        pageNumber: pageRow.page_number,
        documentId: pageRow.doc_id,
        archiveId: pageRow.archive_id,
        archiveTitle: pageRow.item_title,
        hasAsset,
        assetReference: pageRow.original_asset_reference || undefined,
        documentStatus: pageRow.doc_status,
        processingStatus: 'NOT_PROCESSED',
        verificationStatus: 'UNVERIFIED',
        confidence: null,
        confidenceLabel: 'Confidence unavailable (OCR not executed)',
        message: hasAsset
          ? 'Page asset registered; OCR extraction pending.'
          : 'Original page asset not currently available. OCR cannot be performed.',
        ocr: null
      };
    }

    const row = ocrRes.rows[0];
    const rawHighlights = row.bounding_highlights || {};
    const highlights: BoundingBoxHighlight[] = Array.isArray(rawHighlights)
      ? rawHighlights
      : rawHighlights.highlights || [];
    const verification: OcrVerificationMetadata = rawHighlights.verification || {
      status: (row.processing_status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED') as OcrVerificationStatus,
      reviewerId: '',
      reviewedAt: row.updated_at,
      history: []
    };

    const numConfidence = row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null;
    const confidenceLabel = numConfidence !== null ? `${(numConfidence * 100).toFixed(1)}%` : 'Confidence unavailable';

    const ocrDto: OcrRecordDto = {
      id: row.id,
      pageId: row.page_id,
      pageNumber: pageRow.page_number,
      documentId: pageRow.doc_id,
      archiveId: pageRow.archive_id,
      rawText: row.raw_text,
      processedText: row.processed_text,
      textHi: row.text_hi,
      textMr: row.text_mr,
      textKn: row.text_kn,
      confidence: numConfidence,
      language: row.language,
      processingStatus: row.processing_status as OcrProcessingStatus,
      ocrEngine: row.ocr_engine,
      boundingHighlights: highlights,
      verification,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return {
      hasPageRecord: true,
      hasOcrRecord: true,
      pageId: pageRow.page_id,
      pageNumber: pageRow.page_number,
      documentId: pageRow.doc_id,
      archiveId: pageRow.archive_id,
      archiveTitle: pageRow.item_title,
      hasAsset,
      assetReference: pageRow.original_asset_reference,
      documentStatus: pageRow.doc_status,
      processingStatus: ocrDto.processingStatus,
      verificationStatus: verification.status,
      confidence: numConfidence,
      confidenceLabel,
      message: `OCR Record loaded with status: ${ocrDto.processingStatus}`,
      ocr: ocrDto
    };
  }

  /**
   * Executes OCR on a legitimate page using a configured OCR provider.
   * Strictly enforces that physical page assets exist and rejects METADATA_ONLY records.
   */
  public static async processPageOCR(
    pageId: string,
    options?: { providerId?: string; language?: string }
  ): Promise<OcrRecordDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');
    const providerId = options?.providerId || 'tesseract-archival';
    const provider = OcrProviderRegistry.getProvider(providerId);
    if (!provider || !provider.isConfigured()) {
      const issue = provider && 'configurationIssue' in provider && typeof provider.configurationIssue === 'function'
        ? provider.configurationIssue()
        : null;
      throw new Error(issue || `OCR provider "${providerId}" is not configured.`);
    }

    const client = await pool.connect();
    let page: any;
    try {
      await client.query('BEGIN');
      const pageRes = await client.query(
        `SELECT p.id, p.page_number, p.original_asset_reference, p.page_metadata,
                d.status AS doc_status, d.id AS doc_id, d.language AS doc_language, ai.archive_id
         FROM document_pages p
         JOIN documents d ON p.document_id = d.id
         JOIN archive_items ai ON d.archive_item_id = ai.id
         WHERE p.id = $1 FOR UPDATE OF p;`,
        [pageId]
      );
      if (!pageRes.rows.length) throw new Error(`Document page "${pageId}" was not found.`);
      page = pageRes.rows[0];
      if (page.doc_status === 'METADATA_ONLY') throw new Error(`OCR is unavailable for metadata-only document "${page.doc_id}".`);
      const assetPath = DocumentStorageService.getPageAssetPath(page.doc_id, Number(page.page_number));
      if (!assetPath || !page.original_asset_reference) throw new Error('The stored page PDF is unavailable.');

      const existingRes = await client.query('SELECT * FROM ocr_records WHERE page_id = $1 LIMIT 1;', [pageId]);
      const existing = existingRes.rows[0];
      if (existing && existing.processing_status !== 'FAILED' && existing.processing_status !== 'PROCESSING') {
        const row = existing;
        await client.query('COMMIT');
        return this.toRecordDto(row, page);
      }

      await client.query(
        `UPDATE document_pages SET page_metadata = COALESCE(page_metadata, '{}'::jsonb) ||
          jsonb_build_object('ocrStatus', 'PROCESSING', 'ocrLastAttemptAt', NOW())
         WHERE id = $1;`, [pageId]
      );

      let result;
      try {
        result = await provider.extractText(assetPath, {
          language: options?.language || page.doc_language || 'eng',
          pageNumber: Number(page.page_number),
        });
      } catch (error) {
        const safeError = (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 500);
        await client.query(
          `UPDATE document_pages SET page_metadata = COALESCE(page_metadata, '{}'::jsonb) ||
            jsonb_build_object('ocrStatus', 'FAILED', 'ocrError', $2::text, 'ocrLastAttemptAt', NOW())
           WHERE id = $1;`, [pageId, safeError]
        );
        await client.query('COMMIT');
        throw new Error(safeError);
      }

      const text = result.rawText || '';
      const nextStatus: OcrProcessingStatus = text.trim() ? 'OCR_COMPLETE' : 'NEEDS_REVIEW';
      const verificationMeta: OcrVerificationMetadata = {
        status: 'UNVERIFIED',
        reviewerId: '',
        reviewedAt: new Date().toISOString(),
        engineVersion: result.engineVersion,
        history: [{ action: 'CREATED', reviewerId: 'SYSTEM', reviewerName: result.ocrEngine, timestamp: new Date().toISOString(), notes: `Actual extraction using ${result.ocrEngine}` }],
      };
      const boundingPayload = { highlights: result.boundingHighlights || [], pageDimensions: result.pageDimensions, verification: verificationMeta };
      const stored = await client.query(
        `INSERT INTO ocr_records (
          id, page_id, raw_text, processed_text, text_hi, text_mr, text_kn,
          confidence, language, processing_status, ocr_engine, bounding_highlights, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
         ON CONFLICT (page_id) DO UPDATE SET
          raw_text = EXCLUDED.raw_text, processed_text = EXCLUDED.processed_text,
          text_hi = EXCLUDED.text_hi, text_mr = EXCLUDED.text_mr, text_kn = EXCLUDED.text_kn,
          confidence = EXCLUDED.confidence, language = EXCLUDED.language,
          processing_status = EXCLUDED.processing_status, ocr_engine = EXCLUDED.ocr_engine,
          bounding_highlights = EXCLUDED.bounding_highlights, updated_at = NOW()
         WHERE ocr_records.processing_status IN ('FAILED', 'PROCESSING')
         RETURNING *;`,
        [`ocr-${pageId}`, pageId, text, text, result.textHi || null, result.textMr || null, result.textKn || null,
          result.confidence, result.language || 'en', nextStatus, result.ocrEngine, JSON.stringify(boundingPayload)]
      );
      if (!stored.rows.length) {
        const preserved = await client.query('SELECT * FROM ocr_records WHERE page_id = $1;', [pageId]);
        await client.query('COMMIT');
        return this.toRecordDto(preserved.rows[0], page);
      }
      await client.query(
        `UPDATE document_pages SET page_metadata = COALESCE(page_metadata, '{}'::jsonb) ||
          jsonb_build_object('ocrStatus', $2::text, 'ocrError', NULL, 'ocrEngine', $3::text, 'ocrLastAttemptAt', NOW())
         WHERE id = $1;`, [pageId, nextStatus, result.ocrEngine]
      );
      await client.query('COMMIT');
      return this.toRecordDto(stored.rows[0], page);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (page) {
        const safeError = (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 500);
        await pool.query(
          `UPDATE document_pages SET page_metadata = COALESCE(page_metadata, '{}'::jsonb) ||
            jsonb_build_object('ocrStatus', 'FAILED', 'ocrError', $2, 'ocrLastAttemptAt', NOW())
           WHERE id = $1;`, [pageId, safeError]
        ).catch(() => undefined);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private static toRecordDto(row: any, page: any): OcrRecordDto {
    const boundingData = row.bounding_highlights || {};
    return {
      id: row.id, pageId: row.page_id, pageNumber: Number(page.page_number), documentId: page.doc_id, archiveId: page.archive_id,
      rawText: row.raw_text, processedText: row.processed_text, textHi: row.text_hi || undefined,
      textMr: row.text_mr || undefined, textKn: row.text_kn || undefined,
      confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
      language: row.language, processingStatus: row.processing_status as OcrProcessingStatus,
      ocrEngine: row.ocr_engine,
      boundingHighlights: Array.isArray(boundingData) ? boundingData : boundingData.highlights || [],
      verification: boundingData.verification || { status: 'UNVERIFIED', reviewerId: '', reviewedAt: row.updated_at, history: [] },
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  /**
   * Human correction of OCR text.
   * CRITICAL: Preserves original raw_text (machine OCR) unchanged!
   * Updates processed_text with corrected text and appends to audit history.
   */
  public static async correctOCR(
    pageId: string,
    correctionData: {
      correctedText: string;
      reviewerId: string;
      reviewerName?: string;
      correctionNotes: string;
    }
  ): Promise<OcrRecordDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    if (!correctionData.reviewerId || !correctionData.reviewerId.trim()) {
      throw new Error('Authorized reviewer ID is required to record OCR corrections.');
    }
    if (!correctionData.correctedText || !correctionData.correctedText.trim()) {
      throw new Error('Corrected text must not be empty.');
    }

    const currentRes = await pool.query(
      `SELECT o.*, p.page_number, p.document_id, ai.archive_id
       FROM ocr_records o
       JOIN document_pages p ON o.page_id = p.id
       JOIN documents d ON p.document_id = d.id
       JOIN archive_items ai ON d.archive_item_id = ai.id
       WHERE o.page_id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (currentRes.rows.length === 0) {
      throw new Error(`Cannot correct OCR: No OCR record exists for page "${pageId}".`);
    }

    const current = currentRes.rows[0];
    const boundingData = current.bounding_highlights || {};
    const highlights = Array.isArray(boundingData) ? boundingData : boundingData.highlights || [];
    const verification: OcrVerificationMetadata = boundingData.verification || {
      status: 'UNVERIFIED',
      reviewerId: '',
      reviewedAt: new Date().toISOString(),
      history: []
    };

    const historyEntry = {
      action: 'CORRECTED' as const,
      reviewerId: correctionData.reviewerId,
      reviewerName: correctionData.reviewerName || 'Archivist',
      timestamp: new Date().toISOString(),
      notes: correctionData.correctionNotes,
      previousSnippet: current.processed_text ? current.processed_text.slice(0, 120) : ''
    };

    const updatedVerification: OcrVerificationMetadata = {
      status: 'CORRECTED',
      reviewerId: correctionData.reviewerId,
      reviewerName: correctionData.reviewerName || 'Archivist',
      reviewedAt: new Date().toISOString(),
      correctionNotes: correctionData.correctionNotes,
      engineVersion: verification.engineVersion,
      history: [...(verification.history || []), historyEntry]
    };

    const updatedBoundingPayload = {
      highlights,
      pageDimensions: boundingData.pageDimensions,
      verification: updatedVerification
    };

    // Update processed_text, leaving raw_text UNTOUCHED
    const updateRes = await pool.query(
      `UPDATE ocr_records
       SET processed_text = $1,
           processing_status = 'CORRECTED',
           bounding_highlights = $2,
           updated_at = NOW()
       WHERE page_id = $3
       RETURNING *;`,
      [correctionData.correctedText, JSON.stringify(updatedBoundingPayload), pageId]
    );

    const row = updateRes.rows[0];
    return {
      id: row.id,
      pageId: row.page_id,
      pageNumber: current.page_number,
      documentId: current.document_id,
      archiveId: current.archive_id,
      rawText: row.raw_text, // Preserved original
      processedText: row.processed_text, // Corrected text
      textHi: row.text_hi,
      textMr: row.text_mr,
      textKn: row.text_kn,
      confidence: row.confidence !== null ? Number(row.confidence) : null,
      language: row.language,
      processingStatus: row.processing_status as OcrProcessingStatus,
      ocrEngine: row.ocr_engine,
      boundingHighlights: highlights,
      verification: updatedVerification,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Human verification marking OCR as approved/verified by certified reviewer.
   */
  public static async markOCRVerified(
    pageId: string,
    reviewerData: {
      reviewerId: string;
      reviewerName?: string;
      notes?: string;
    }
  ): Promise<OcrRecordDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    if (!reviewerData.reviewerId || !reviewerData.reviewerId.trim()) {
      throw new Error('Authorized reviewer ID is required to mark OCR as verified.');
    }

    const currentRes = await pool.query(
      `SELECT o.*, p.page_number, p.document_id, ai.archive_id
       FROM ocr_records o
       JOIN document_pages p ON o.page_id = p.id
       JOIN documents d ON p.document_id = d.id
       JOIN archive_items ai ON d.archive_item_id = ai.id
       WHERE o.page_id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (currentRes.rows.length === 0) {
      throw new Error(`Cannot verify OCR: No OCR record exists for page "${pageId}".`);
    }

    const current = currentRes.rows[0];
    const boundingData = current.bounding_highlights || {};
    const highlights = Array.isArray(boundingData) ? boundingData : boundingData.highlights || [];
    const verification: OcrVerificationMetadata = boundingData.verification || {
      status: 'UNVERIFIED',
      reviewerId: '',
      reviewedAt: new Date().toISOString(),
      history: []
    };

    const historyEntry = {
      action: 'VERIFIED' as const,
      reviewerId: reviewerData.reviewerId,
      reviewerName: reviewerData.reviewerName || 'Archivist',
      timestamp: new Date().toISOString(),
      notes: reviewerData.notes || 'Verified against master archival facsimile.'
    };

    const updatedVerification: OcrVerificationMetadata = {
      status: 'VERIFIED',
      reviewerId: reviewerData.reviewerId,
      reviewerName: reviewerData.reviewerName || 'Archivist',
      reviewedAt: new Date().toISOString(),
      correctionNotes: verification.correctionNotes,
      engineVersion: verification.engineVersion,
      history: [...(verification.history || []), historyEntry]
    };

    const updatedBoundingPayload = {
      highlights,
      pageDimensions: boundingData.pageDimensions,
      verification: updatedVerification
    };

    const updateRes = await pool.query(
      `UPDATE ocr_records
       SET processing_status = 'VERIFIED',
           bounding_highlights = $1,
           updated_at = NOW()
       WHERE page_id = $2
       RETURNING *;`,
      [JSON.stringify(updatedBoundingPayload), pageId]
    );

    const row = updateRes.rows[0];
    return {
      id: row.id,
      pageId: row.page_id,
      pageNumber: current.page_number,
      documentId: current.document_id,
      archiveId: current.archive_id,
      rawText: row.raw_text,
      processedText: row.processed_text,
      textHi: row.text_hi,
      textMr: row.text_mr,
      textKn: row.text_kn,
      confidence: row.confidence !== null ? Number(row.confidence) : null,
      language: row.language,
      processingStatus: row.processing_status as OcrProcessingStatus,
      ocrEngine: row.ocr_engine,
      boundingHighlights: highlights,
      verification: updatedVerification,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Updates verification status and reviewer audit log for a page OCR record.
   */
  public static async updateOCRVerification(
    pageId: string,
    verificationData: {
      status: OcrVerificationStatus;
      reviewerId: string;
      reviewerName?: string;
      notes?: string;
    }
  ): Promise<OcrRecordDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    if (!verificationData.reviewerId || !verificationData.reviewerId.trim()) {
      throw new Error('Reviewer ID is required to update verification status.');
    }

    const currentRes = await pool.query(
      `SELECT o.*, p.page_number, p.document_id, ai.archive_id
       FROM ocr_records o
       JOIN document_pages p ON o.page_id = p.id
       JOIN documents d ON p.document_id = d.id
       JOIN archive_items ai ON d.archive_item_id = ai.id
       WHERE o.page_id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (currentRes.rows.length === 0) {
      throw new Error(`Cannot update verification: No OCR record exists for page "${pageId}".`);
    }

    const current = currentRes.rows[0];
    const boundingData = current.bounding_highlights || {};
    const highlights = Array.isArray(boundingData) ? boundingData : boundingData.highlights || [];
    const verification: OcrVerificationMetadata = boundingData.verification || {
      status: 'UNVERIFIED',
      reviewerId: '',
      reviewedAt: new Date().toISOString(),
      history: []
    };

    const actionMap: Record<OcrVerificationStatus, 'CREATED' | 'VERIFIED' | 'CORRECTED' | 'REVIEW_REQUESTED' | 'REJECTED'> = {
      UNVERIFIED: 'REVIEW_REQUESTED',
      NEEDS_REVIEW: 'REVIEW_REQUESTED',
      VERIFIED: 'VERIFIED',
      CORRECTED: 'CORRECTED',
      REJECTED: 'REJECTED'
    };

    const historyEntry = {
      action: actionMap[verificationData.status] || 'REVIEW_REQUESTED',
      reviewerId: verificationData.reviewerId,
      reviewerName: verificationData.reviewerName || 'Archivist',
      timestamp: new Date().toISOString(),
      notes: verificationData.notes || `Status transition to ${verificationData.status}`
    };

    const updatedVerification: OcrVerificationMetadata = {
      status: verificationData.status,
      reviewerId: verificationData.reviewerId,
      reviewerName: verificationData.reviewerName || 'Archivist',
      reviewedAt: new Date().toISOString(),
      correctionNotes: verificationData.notes || verification.correctionNotes,
      engineVersion: verification.engineVersion,
      history: [...(verification.history || []), historyEntry]
    };

    const newProcessingStatus: OcrProcessingStatus =
      verificationData.status === 'VERIFIED'
        ? 'VERIFIED'
        : verificationData.status === 'CORRECTED'
        ? 'CORRECTED'
        : verificationData.status === 'NEEDS_REVIEW'
        ? 'NEEDS_REVIEW'
        : (current.processing_status as OcrProcessingStatus);

    const updatedBoundingPayload = {
      highlights,
      pageDimensions: boundingData.pageDimensions,
      verification: updatedVerification
    };

    const updateRes = await pool.query(
      `UPDATE ocr_records
       SET processing_status = $1,
           bounding_highlights = $2,
           updated_at = NOW()
       WHERE page_id = $3
       RETURNING *;`,
      [newProcessingStatus, JSON.stringify(updatedBoundingPayload), pageId]
    );

    const row = updateRes.rows[0];
    return {
      id: row.id,
      pageId: row.page_id,
      pageNumber: current.page_number,
      documentId: current.document_id,
      archiveId: current.archive_id,
      rawText: row.raw_text,
      processedText: row.processed_text,
      textHi: row.text_hi,
      textMr: row.text_mr,
      textKn: row.text_kn,
      confidence: row.confidence !== null ? Number(row.confidence) : null,
      language: row.language,
      processingStatus: row.processing_status as OcrProcessingStatus,
      ocrEngine: row.ocr_engine,
      boundingHighlights: highlights,
      verification: updatedVerification,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Retrieves full audit history of OCR extraction, verification, and corrections for a page.
   */
  public static async getOCRHistory(pageId: string): Promise<{
    pageId: string;
    hasOcrRecord: boolean;
    history: OcrVerificationMetadata['history'];
  }> {
    const status = await this.getOCRForPage(pageId);
    if (!status.hasOcrRecord || !status.ocr) {
      return {
        pageId,
        hasOcrRecord: false,
        history: []
      };
    }
    return {
      pageId,
      hasOcrRecord: true,
      history: status.ocr.verification.history || []
    };
  }

  /**
   * Traces the complete 6-level archival provenance chain:
   * Source Collection -> Source Record -> Archive Item -> Document -> Document Page -> OCR Record -> Verified Text
   */
  public static async getCitationProvenance(pageId: string): Promise<CitationProvenanceDto> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const res = await pool.query(
      `SELECT p.id as page_id, p.page_number, p.original_asset_reference,
              d.id as doc_id, d.title as doc_title, d.document_type, d.status as doc_status,
              ai.id as item_id, ai.archive_id, ai.title as item_title, ai.year as item_year,
              ai.author as item_author, ai.source_institution, ai.collection as item_collection,
              sr.id as sr_id, sr.original_source_identifier, sr.original_url as sr_url,
              sc.id as sc_id, sc.name as sc_name, sc.organization as sc_org,
              o.id as ocr_id, o.processed_text, o.confidence, o.processing_status, o.ocr_engine,
              o.bounding_highlights
       FROM document_pages p
       JOIN documents d ON p.document_id = d.id
       JOIN archive_items ai ON d.archive_item_id = ai.id
       LEFT JOIN source_records sr ON ai.source_record_id = sr.id
       LEFT JOIN source_collections sc ON sr.source_collection_id = sc.id
       LEFT JOIN ocr_records o ON o.page_id = p.id
       WHERE p.id = $1
       LIMIT 1;`,
      [pageId]
    );

    if (res.rows.length === 0) {
      return {
        isValid: false,
        error: `Cannot generate citation for nonexistent page "${pageId}".`,
        citations: { chicago: '', apa: '', mla: '', bibtex: '' }
      };
    }

    const row = res.rows[0];
    const bounding = row.bounding_highlights || {};
    const verification = bounding.verification || {};
    const hasRealAsset = Boolean(row.original_asset_reference);
    const textSnippet = row.processed_text ? row.processed_text.slice(0, 160).replace(/\n/g, ' ') : '';

    const author = row.item_author || 'Dr. B. R. Ambedkar';
    const title = row.item_title;
    const year = row.item_year || 1948;
    const pageNum = row.page_number;
    const holding = row.source_institution || 'National Digital Library of India';
    const refCode = row.archive_id;

    const chicago = `${author}. "${title}," p. ${pageNum}. In ${row.item_collection}, ${year}. ${holding}. Archival Ref: ${refCode}.`;
    const apa = `${author} (${year}). ${title} (p. ${pageNum}). ${holding}. ${refCode}.`;
    const mla = `${author}. "${title}." ${row.item_collection}, ${holding}, ${year}, p. ${pageNum}.`;
    const bibtex = `@incollection{ambedkar_${refCode}_p${pageNum},\n  author = {${author}},\n  title = {${title}},\n  pages = {${pageNum}},\n  year = {${year}},\n  publisher = {${holding}},\n  note = {Archival Ref: ${refCode}}\n}`;

    return {
      isValid: true,
      sourceCollection: row.sc_id
        ? {
            id: row.sc_id,
            name: row.sc_name,
            organization: row.sc_org
          }
        : undefined,
      sourceRecord: row.sr_id
        ? {
            id: row.sr_id,
            identifier: row.original_source_identifier,
            originalUrl: row.sr_url
          }
        : undefined,
      archiveItem: {
        id: row.item_id,
        archiveId: row.archive_id,
        title: row.item_title,
        year: row.item_year,
        author: row.item_author,
        sourceInstitution: row.source_institution
      },
      document: {
        id: row.doc_id,
        title: row.doc_title,
        documentType: row.document_type,
        assetStatus: row.doc_status
      },
      page: {
        id: row.page_id,
        pageNumber: row.page_number,
        hasRealAsset
      },
      ocrRecord: row.ocr_id
        ? {
            id: row.ocr_id,
            processingStatus: row.processing_status as OcrProcessingStatus,
            ocrEngine: row.ocr_engine,
            confidence: row.confidence !== null ? Number(row.confidence) : null,
            isVerified: row.processing_status === 'VERIFIED',
            reviewerId: verification.reviewerId,
            verifiedAt: verification.reviewedAt
          }
        : undefined,
      verifiedTextSnippet: textSnippet || undefined,
      citations: { chicago, apa, mla, bibtex }
    };
  }
}
