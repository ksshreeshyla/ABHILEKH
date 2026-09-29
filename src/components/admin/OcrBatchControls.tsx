import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, Play, RotateCcw, ScanText } from 'lucide-react';

interface Progress {
  documentId: string; totalPages: number; completedPages: number; processingPages: number;
  pendingPages: number; failedPages: number; percentComplete: number; status: string;
  providerConfigured: boolean; configurationIssue?: string;
}

export const OcrBatchControls: React.FC<{ documentId: string; title: string }> = ({ documentId, title }) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/ocr/documents/${encodeURIComponent(documentId)}/progress`);
      const result = await response.json();
      if (response.ok && result.ok) { setProgress(result.data); setError(''); }
      else setError(result.message || 'OCR progress could not be loaded.');
    } catch { setError('OCR progress service is unavailable.'); }
  }, [documentId]);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 2500); return () => window.clearInterval(timer); }, [load]);

  const start = async (retryFailed: boolean) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/ocr/documents/${encodeURIComponent(documentId)}/${retryFailed ? 'retry-failed' : 'start'}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'OCR could not start.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'OCR could not start.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-xl border border-stone-300 bg-white p-5 shadow-xs" aria-labelledby="ocr-batch-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-700"><ScanText className="h-5 w-5" /></div>
        <div><h2 id="ocr-batch-title" className="font-serif text-lg font-bold text-stone-900">Real OCR batch processing</h2><p className="mt-0.5 text-xs text-stone-600">{title} · {progress?.totalPages ?? '…'} pages · page results persist as they finish</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !progress?.providerConfigured || progress.pendingPages === 0 || ['RUNNING','PROCESSING'].includes(progress.status)} onClick={() => void start(false)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-3.5 w-3.5" />{progress?.completedPages ? 'Resume OCR' : 'Start OCR'}</button>
        <button type="button" disabled={busy || !progress?.providerConfigured || progress.failedPages === 0 || ['RUNNING','PROCESSING'].includes(progress.status)} onClick={() => void start(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Retry failed</button>
      </div>
    </div>
    {progress && <>
      <div className="mt-5 flex items-center justify-between text-xs"><span className="font-semibold text-stone-800">{progress.completedPages} / {progress.totalPages} completed</span><span className="font-mono text-stone-600">{progress.percentComplete}% · {progress.status.replaceAll('_',' ')}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label="OCR completion" aria-valuemin={0} aria-valuemax={progress.totalPages} aria-valuenow={progress.completedPages}><div className="h-full bg-amber-500 transition-[width]" style={{ width: `${progress.percentComplete}%` }} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div className="rounded-md bg-stone-50 p-2"><span className="text-stone-500">Pending</span><strong className="ml-2 text-stone-900">{progress.pendingPages}</strong></div><div className="rounded-md bg-stone-50 p-2"><span className="text-stone-500">Processing</span><strong className="ml-2 text-stone-900">{progress.processingPages}</strong></div><div className="rounded-md bg-stone-50 p-2"><span className="text-stone-500">Completed</span><strong className="ml-2 text-stone-900">{progress.completedPages}</strong></div><div className="rounded-md bg-stone-50 p-2"><span className="text-stone-500">Failed</span><strong className="ml-2 text-stone-900">{progress.failedPages}</strong></div></div>
    </>}
    {!progress?.providerConfigured && progress?.configurationIssue && <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>OCR cannot start in this environment.</strong><p className="mt-1">{progress.configurationIssue}</p><p className="mt-1">Install Tesseract OCR and a supported PDF renderer (Poppler/pdftoppm or MuPDF/mutool), then set TESSERACT_ENABLED=true, TESSERACT_PATH, PDF_RENDERER_PATH, and PDF_RENDERER_TOOL in the server environment.</p></div></div>}
    {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-red-700">{busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{error}</p>}
  </section>;
};
