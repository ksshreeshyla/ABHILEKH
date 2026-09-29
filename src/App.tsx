import React, { useEffect, useState } from 'react';
import { ArchiveProvider, useArchive } from './context/ArchiveContext';
import { Header } from './components/navigation/Header';
import { ToastContainer } from './components/common/ToastContainer';
import { VisitorHome } from './components/visitor/VisitorHome';
import { DigitalArchive } from './components/archive/DigitalArchive';
import { DocumentExplorer } from './components/explorer/DocumentExplorer';
import { InteractiveTimeline } from './components/timeline/InteractiveTimeline';
import { KnowledgeMap } from './components/knowledgemap/KnowledgeMap';
import { AudioVideoArchive } from './components/audiovideo/AudioVideoArchive';
import { AiResearchAssistant } from './components/assistant/AiResearchAssistant';
import { ResearchWorkbench } from './components/research/ResearchWorkbench';
import { AdminPortal } from './components/admin/AdminPortal';
import { Heritage360Viewer } from './components/heritage/Heritage360Viewer';
import { Minimize2, Shield, Landmark } from 'lucide-react';

const AppContent: React.FC = () => {
  const { view, kioskMode, setKioskMode, themeMode, navigateTo, showToast } = useArchive();
  const [continueMessage, setContinueMessage] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/continue\/([^/]+)\/?$/);
    if (!match) return;
    let mounted = true;
    const token = decodeURIComponent(match[1]);
    void fetch(`/api/share-sessions/${encodeURIComponent(token)}`)
      .then(async response => {
        const result = await response.json();
        if (!mounted) return;
        if (!response.ok || !result.ok) throw new Error(result.message || 'The continuation link is unavailable.');
        const resolved = result.data;
        if (resolved.state !== 'valid') {
          const messages: Record<string, string> = {
            expired: 'This continuation link has expired. Return to ABHILEKH and create a new one.',
            revoked: 'This continuation link has been revoked.',
            unavailable: 'The shared archive context is no longer available.',
            invalid: 'This continuation link is invalid.',
          };
          setContinueMessage(messages[resolved.state] || messages.invalid);
          return;
        }
        const context = resolved.context;
        if (context.type === 'document' && context.archiveItemId) {
          navigateTo('explorer', { docId: context.archiveItemId, page: context.pageNumber });
        } else if (context.type === 'research') {
          navigateTo('assistant', {
            assistantQuery: context.query,
            docId: context.archiveItemId || context.references?.[0]?.archiveItemId,
            page: context.references?.[0]?.pageNumber,
          });
        } else if (context.type === 'heritage360') {
          navigateTo('heritage360', { heritageContext: context });
        }
        window.history.replaceState({}, '', '/');
        showToast('Shared ABHILEKH context restored on this device.', 'success');
      })
      .catch(error => { if (mounted) setContinueMessage(error instanceof Error ? error.message : 'Continuation is unavailable.'); });
    return () => { mounted = false; };
  }, []);

  const getThemeClass = () => {
    if (themeMode === 'contrast') return 'bg-black text-white selection:bg-yellow-400 selection:text-black';
    if (themeMode === 'light') return 'bg-[#faf8f5] text-stone-900 selection:bg-amber-200 selection:text-amber-950';
    return 'bg-[#070c1a] text-slate-100 selection:bg-amber-800 selection:text-amber-100';
  };

  const renderActiveView = () => {
    switch (view) {
      case 'home':
        return <VisitorHome />;
      case 'archive':
        return <DigitalArchive />;
      case 'explorer':
        return <DocumentExplorer />;
      case 'timeline':
        return <InteractiveTimeline />;
      case 'knowledgemap':
        return <KnowledgeMap />;
      case 'audiovideo':
        return <AudioVideoArchive />;
      case 'heritage360':
        return <Heritage360Viewer />;
      case 'assistant':
        return <AiResearchAssistant />;
      case 'compare':
        return <ResearchWorkbench initialTab="compare" />;
      case 'collections':
        return <ResearchWorkbench initialTab="binder" />;
      case 'admin_dashboard':
      case 'admin_upload':
      case 'admin_audit':
        return <AdminPortal />;
      default:
        return <VisitorHome />;
    }
  };

  return (
    <div className={`min-h-screen ${getThemeClass()} flex flex-col font-sans text-base transition-colors duration-150`}>
      {/* Kiosk Mode Floating Banner */}
      {kioskMode && (
        <div className="bg-amber-600 text-stone-950 text-xs py-1.5 px-4 flex items-center justify-between font-bold z-50 shadow-md">
          <span>MEMORIAL TOUCH-SCREEN KIOSK MODE ACTIVE</span>
          <button
            onClick={() => setKioskMode(false)}
            className="flex items-center gap-1 bg-stone-950 text-stone-100 px-2.5 py-0.5 rounded text-[11px] cursor-pointer"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Exit Kiosk</span>
          </button>
        </div>
      )}

      {/* Global Header (Unified Single Navigation matching Reference Design) */}
      <Header />

      {/* Main Archival Viewport */}
      <main className="flex-1">
        {continueMessage ? <div role="alert" className="mx-auto my-16 max-w-xl rounded-xl border border-amber-500/30 bg-[#0d1629] p-8 text-center text-white"><h1 className="font-serif text-2xl font-bold">Continuation link unavailable</h1><p className="mt-3 text-sm text-slate-300">{continueMessage}</p></div> : null}
        {renderActiveView()}
      </main>

      {/* Global Institutional Footer (Exact match to Reference Image Bottom Bar) */}
      <footer className="bg-[#050812] text-slate-400 text-xs py-6 px-6 border-t border-[#14203a]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Emblem + Title */}
          <div className="flex items-center gap-2.5 text-center md:text-left">
            <div className="w-7 h-7 rounded-full bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-serif font-bold text-xs shrink-0">
              अ
            </div>
            <div>
              <div className="font-serif font-bold text-white text-sm">
                ABHILEKH
              </div>
              <div className="text-[11px] text-slate-400">
                Ambedkar Bharatiya Heritage &amp; Intellectual Knowledge Hub
              </div>
            </div>
          </div>

          {/* Center: Institutional Motto */}
          <div className="text-center text-xs font-serif text-slate-400 italic">
            Preserving the past <span className="text-amber-500/60 mx-1.5">|</span> Empowering the future
          </div>

          {/* Right: Archival Provenance Attribution */}
          <div className="text-center md:text-right space-y-0.5 text-[11px] text-slate-400">
            <div className="font-medium text-slate-300">
              National Digital Heritage Knowledge Platform
            </div>
            <div className="text-[10px] text-slate-500">
              Preserving official holdings of Dr. Ambedkar Foundation &amp; Parliamentary Archives
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ArchiveProvider>
      <AppContent />
    </ArchiveProvider>
  );
}
