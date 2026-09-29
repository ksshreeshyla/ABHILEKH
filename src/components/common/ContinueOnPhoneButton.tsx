import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, LoaderCircle, QrCode, X } from 'lucide-react';
import type { ShareContext } from '../../server/shareSessionService';

export const ContinueOnPhoneButton: React.FC<{ context: ShareContext; className?: string }> = ({ context, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);

  const createShare = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/share-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ context }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Could not create a continuation link.');
      const continuationUrl = new URL(`/continue/${encodeURIComponent(result.data.token)}`, window.location.origin).toString();
      const qr = await QRCode.toDataURL(continuationUrl, { errorCorrectionLevel: 'M', margin: 2, width: 280, color: { dark: '#111827', light: '#ffffff' } });
      setUrl(continuationUrl);
      setQrDataUrl(qr);
      setExpiresAt(result.data.expiresAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a continuation link.');
    } finally {
      setBusy(false);
    }
  };

  const show = () => {
    setOpen(true);
    if (!url && !busy) void createShare();
  };

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError('Copy is unavailable here. You can select and copy the link below.'); }
  };

  return <>
    <button type="button" onClick={show} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${className}`} aria-label="Continue on my Phone">
      <QrCode className="h-4 w-4" /> Continue on my Phone
    </button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="continue-phone-title" className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0b1222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="continue-phone-title" className="font-serif text-xl font-bold">Continue on my Phone</h2><p className="mt-1 text-xs text-slate-400">Scan this code with your phone’s camera to continue this ABHILEKH context.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-300 hover:bg-white/10" aria-label="Close QR dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl bg-white p-3">
          {busy && <LoaderCircle className="h-8 w-8 animate-spin text-slate-600" aria-label="Creating secure link" />}
          {!busy && qrDataUrl && <img src={qrDataUrl} alt="QR code for this ABHILEKH continuation link" className="h-64 w-64 max-w-full" />}
          {!busy && error && !qrDataUrl && <p role="alert" className="p-4 text-center text-sm text-red-700">{error}</p>}
        </div>
        {url && <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400" htmlFor="continue-url">Short-lived continuation link</label>
          <div className="flex gap-2"><input id="continue-url" readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200" /><button type="button" onClick={() => void copyUrl()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950" aria-label="Copy continuation link">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button></div>
          <p className="text-[11px] text-slate-400">Expires {new Date(expiresAt).toLocaleString()} · Link contents are stored server-side and the token expires automatically.</p>
          {error && <p role="status" className="text-xs text-amber-200">{error}</p>}
        </div>}
        {!busy && error && qrDataUrl && <p role="status" className="mt-3 text-xs text-amber-200">{error}</p>}
      </section>
    </div>}
  </>;
};
