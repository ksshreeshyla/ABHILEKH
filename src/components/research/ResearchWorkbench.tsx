import React, { useState, useEffect } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { ArchiveItem } from '../../types/archive';
import { 
  GitCompare, 
  Bookmark, 
  Copy, 
  Check, 
  Trash2, 
  Download, 
  FileText, 
  ExternalLink, 
  Edit3, 
  BookOpen, 
  Quote,
  Sparkles,
  FolderPlus,
  Layers,
  Video,
  Headphones,
  Search,
  Plus
} from 'lucide-react';

interface ResearchWorkbenchProps {
  initialTab?: 'compare' | 'binder';
}

export const ResearchWorkbench: React.FC<ResearchWorkbenchProps> = ({ initialTab = 'compare' }) => {
  const { 
    archiveItems, 
    bookmarks, 
    removeBookmark, 
    updateBookmarkNotes, 
    navigateTo, 
    showToast,
    view
  } = useArchive();

  // Active view in Research Mode vs My Collection
  const [activeResearchTab, setActiveResearchTab] = useState<'compare' | 'binder'>(
    view === 'collections' ? 'binder' : initialTab
  );

  // My Collection sub-tab: 'saved' or 'packs'
  const [collectionSubTab, setCollectionSubTab] = useState<'saved' | 'packs'>('saved');

  // Document Comparison States
  const [docAId, setDocAId] = useState<string>('cad-1949-closing');
  const [docBId, setDocBId] = useState<string>('draft-constitution-1948');

  // Citation format selection
  const [citationFormat, setCitationFormat] = useState<'APA' | 'MLA' | 'Chicago' | 'BibTeX'>('APA');

  // Research Packs state
  const [researchPacks, setResearchPacks] = useState([
    {
      id: 'pack-1',
      title: 'Constitutional Rights & Remedies',
      itemCount: 12,
      docCount: 3,
      videoCount: 2,
      category: 'Constitutional Law',
      description: 'Core articles, CAD volumes, and landmark debates regarding Article 32 and fundamental rights.'
    },
    {
      id: 'pack-2',
      title: 'Social Justice & Emancipation',
      itemCount: 8,
      docCount: 1,
      videoCount: 2,
      category: 'Social Reform',
      description: 'Documents and speeches from Mahad Satyagraha and the Annihilation of Caste treatise.'
    },
    {
      id: 'pack-3',
      title: 'Ambedkar’s Economic Treatises',
      itemCount: 15,
      docCount: 5,
      videoCount: 3,
      category: 'Economics & Public Finance',
      description: 'The Problem of the Rupee, Hilton Young Commission depositions, and provincial finance studies.'
    }
  ]);

  useEffect(() => {
    if (view === 'collections') {
      setActiveResearchTab('binder');
    } else if (view === 'compare') {
      setActiveResearchTab('compare');
    }
  }, [view]);

  const docA = archiveItems.find(i => i.id === docAId) || archiveItems[0];
  const docB = archiveItems.find(i => i.id === docBId) || archiveItems[1];

  const generateCitation = (item: ArchiveItem, format: 'APA' | 'MLA' | 'Chicago' | 'BibTeX') => {
    switch (format) {
      case 'APA':
        return `Ambedkar, B. R. (${item.year}). ${item.title}. In ${item.collection}. New Delhi: ${item.sourceInstitution}. [Archive ID: ${item.archiveId}].`;
      case 'MLA':
        return `Ambedkar, Bhimrao Ramji. "${item.title}." ${item.collection}, ${item.year}, ${item.sourceInstitution}. Archive ID: ${item.archiveId}.`;
      case 'Chicago':
        return `Ambedkar, B. R. "${item.title}." In ${item.collection}. New Delhi: ${item.sourceInstitution}, ${item.year}. ${item.archiveId}.`;
      case 'BibTeX':
        return item.citationBibtex;
    }
  };

  const handleExportBinderDossier = () => {
    if (bookmarks.length === 0) {
      showToast('Your research binder is currently empty.', 'warning');
      return;
    }

    const dossierContent = `=====================================================
DR. AMBEDKAR INTERNATIONAL CENTRE (DAIC)
SCHOLARLY RESEARCH DOSSIER & CITATION EXPORT
Generated: ${new Date().toLocaleString()}
Records Saved: ${bookmarks.length}
=====================================================

${bookmarks.map((bmk, idx) => {
  const doc = archiveItems.find(d => d.id === bmk.docId);
  return `[RECORD ${idx + 1}]
TITLE: ${bmk.title}
CATEGORY: ${bmk.category}
DATE SAVED: ${bmk.dateAdded}
CITATIONS:
- APA: ${doc ? generateCitation(doc, 'APA') : 'N/A'}
- MLA: ${doc ? generateCitation(doc, 'MLA') : 'N/A'}
- Chicago: ${doc ? generateCitation(doc, 'Chicago') : 'N/A'}

RESEARCHER NOTES:
${bmk.researcherNotes || '(No private notes recorded)'}
-----------------------------------------------------`;
}).join('\n\n')}

=====================================================
Platform: ABHILEKH — Ambedkar Bharatiya Heritage & Intellectual Knowledge Hub
Archival Holdings: Dr. Ambedkar Foundation / DAIC / Parliamentary Archives
=====================================================`;

    const blob = new Blob([dossierContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ABHILEKH-Research-Dossier-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Research dossier exported successfully', 'success');
  };

  const handleCreateNewPack = () => {
    const title = window.prompt('Enter new Research Pack title:');
    if (!title || !title.trim()) return;

    const newPack = {
      id: 'pack-' + Date.now(),
      title: title.trim(),
      itemCount: 0,
      docCount: 0,
      videoCount: 0,
      category: 'General Research',
      description: 'Custom scholarly research binder initialized by user.'
    };

    setResearchPacks(prev => [newPack, ...prev]);
    showToast(`Created Research Pack: "${title.trim()}"`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Context Description */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1b2b4d] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              {activeResearchTab === 'binder' 
                ? 'PERSONAL CURATION REPOSITORY · MY COLLECTION' 
                : 'SCHOLARLY WORKBENCH · RESEARCH MODE'}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            {activeResearchTab === 'binder' ? 'My Collection' : 'Scholarly Research Workbench'}
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            {activeResearchTab === 'binder'
              ? 'Save and organize your favorite archival resources, document facsimiles, and research packs.'
              : 'Side-by-side textual comparative analysis, citation compilation, and research binders for constitutional scholars.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#090f20] p-1 rounded-xl border border-[#1a2744]">
          <button
            onClick={() => setActiveResearchTab('compare')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeResearchTab === 'compare'
                ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Document Comparison</span>
          </button>

          <button
            onClick={() => setActiveResearchTab('binder')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeResearchTab === 'binder'
                ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>My Collection ({bookmarks.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: COMPARATIVE DOCUMENT ANALYSIS */}
      {activeResearchTab === 'compare' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0d1629] p-4 rounded-xl border border-[#1b2b4d]">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Primary Document A:
              </label>
              <select
                value={docAId}
                onChange={(e) => setDocAId(e.target.value)}
                className="w-full bg-[#070c18] border border-[#203259] rounded-lg px-3 py-2 text-xs font-serif text-white focus:outline-none focus:border-amber-500"
              >
                {archiveItems.map(item => (
                  <option key={item.id} value={item.id} className="bg-[#0b1326] text-white">
                    {item.title} ({item.year}) - [{item.archiveId}]
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 block">
                Comparative Document B:
              </label>
              <select
                value={docBId}
                onChange={(e) => setDocBId(e.target.value)}
                className="w-full bg-[#070c18] border border-[#203259] rounded-lg px-3 py-2 text-xs font-serif text-white focus:outline-none focus:border-amber-500"
              >
                {archiveItems.map(item => (
                  <option key={item.id} value={item.id} className="bg-[#0b1326] text-white">
                    {item.title} ({item.year}) - [{item.archiveId}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-Side Comparison Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Column A */}
            <div className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-6 space-y-4 shadow-sm">
              <div className="border-b border-[#1b2b4d] pb-3 space-y-1">
                <div className="text-[11px] font-mono text-amber-400">
                  {docA.archiveId} · {docA.date} · {docA.category}
                </div>
                <h3 className="font-serif font-bold text-lg text-white">
                  {docA.title}
                </h3>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Executive Archival Summary:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#070c18] p-3 rounded-lg border border-[#1b2b4d]">
                  {docA.aiSummary}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Primary Text Excerpt:
                </span>
                <blockquote className="font-serif text-xs text-slate-200 leading-relaxed border-l-2 border-amber-500 pl-3 italic bg-[#070c18]/50 p-2.5 rounded-r">
                  "{docA.pages[0]?.ocrText.slice(0, 500) || docA.fullText.slice(0, 500)}..."
                </blockquote>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigateTo('explorer', { docId: docA.id })}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Complete Scanned Manuscript</span>
                </button>
              </div>
            </div>

            {/* Column B */}
            <div className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-6 space-y-4 shadow-sm">
              <div className="border-b border-[#1b2b4d] pb-3 space-y-1">
                <div className="text-[11px] font-mono text-amber-400">
                  {docB.archiveId} · {docB.date} · {docB.category}
                </div>
                <h3 className="font-serif font-bold text-lg text-white">
                  {docB.title}
                </h3>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Executive Archival Summary:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#070c18] p-3 rounded-lg border border-[#1b2b4d]">
                  {docB.aiSummary}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Primary Text Excerpt:
                </span>
                <blockquote className="font-serif text-xs text-slate-200 leading-relaxed border-l-2 border-amber-500 pl-3 italic bg-[#070c18]/50 p-2.5 rounded-r">
                  "{docB.pages[0]?.ocrText.slice(0, 500) || docB.fullText.slice(0, 500)}..."
                </blockquote>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigateTo('explorer', { docId: docB.id })}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Complete Scanned Manuscript</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MY COLLECTION (Saved Items & Research Packs - Reference UI Panel 9) */}
      {activeResearchTab === 'binder' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Saved Items vs Research Packs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1629] p-4 rounded-xl border border-[#1b2b4d]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollectionSubTab('saved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  collectionSubTab === 'saved'
                    ? 'bg-amber-600 text-stone-950 shadow-xs'
                    : 'bg-[#070c18] text-slate-300 hover:text-white border border-[#1b2b4d]'
                }`}
              >
                Saved Items ({bookmarks.length})
              </button>
              <button
                onClick={() => setCollectionSubTab('packs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  collectionSubTab === 'packs'
                    ? 'bg-amber-600 text-stone-950 shadow-xs'
                    : 'bg-[#070c18] text-slate-300 hover:text-white border border-[#1b2b4d]'
                }`}
              >
                Research Packs ({researchPacks.length})
              </button>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-3">
              {collectionSubTab === 'saved' && (
                <>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-400">Citation Style:</span>
                    <select
                      value={citationFormat}
                      onChange={(e) => setCitationFormat(e.target.value as any)}
                      className="bg-[#070c18] border border-[#203259] rounded px-2.5 py-1 text-xs font-semibold text-white focus:outline-none cursor-pointer"
                    >
                      <option value="APA">APA (7th ed.)</option>
                      <option value="MLA">MLA (9th ed.)</option>
                      <option value="Chicago">Chicago (17th ed.)</option>
                      <option value="BibTeX">BibTeX</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExportBinderDossier}
                    className="px-3.5 py-1.5 bg-[#142347] hover:bg-[#1a2f60] border border-[#20376d] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export Dossier</span>
                  </button>
                </>
              )}

              {collectionSubTab === 'packs' && (
                <button
                  onClick={handleCreateNewPack}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Pack</span>
                </button>
              )}
            </div>
          </div>

          {/* SUB-VIEW A: SAVED ITEMS */}
          {collectionSubTab === 'saved' && (
            <>
              {bookmarks.length === 0 ? (
                <div className="bg-[#0d1629] rounded-2xl border border-dashed border-[#1b2b4d] p-12 text-center space-y-3">
                  <Bookmark className="w-10 h-10 text-slate-500 mx-auto" />
                  <h4 className="font-serif font-bold text-lg text-white">Your Saved Collection is Empty</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    While browsing the Digital Archive or consulting the AI Assistant, click the bookmark icon on any document to save it here for note-taking and citation export.
                  </p>
                  <button
                    onClick={() => navigateTo('archive')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs rounded-lg font-bold cursor-pointer transition-colors"
                  >
                    Browse Archival Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {bookmarks.map((bmk) => {
                    const doc = archiveItems.find(d => d.id === bmk.docId);
                    const citationText = doc ? generateCitation(doc, citationFormat) : bmk.title;

                    return (
                      <div
                        key={bmk.id}
                        className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-5 space-y-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4 border-b border-[#1b2b4d] pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                              <span className="text-amber-400 font-semibold">{bmk.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>Saved: {bmk.dateAdded}</span>
                              {doc && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-slate-300 font-bold">{doc.archiveId}</span>
                                </>
                              )}
                            </div>
                            <h4 
                              onClick={() => doc && navigateTo('explorer', { docId: doc.id })}
                              className="font-serif font-bold text-lg text-white hover:text-amber-400 cursor-pointer transition-colors"
                            >
                              {bmk.title}
                            </h4>
                          </div>

                          <button
                            onClick={() => {
                              removeBookmark(bmk.id);
                              showToast('Removed from collection', 'info');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded cursor-pointer"
                            title="Remove from saved items"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Citation Preview */}
                        <div className="bg-[#070c18] p-3 rounded-lg border border-[#1b2b4d] space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span className="font-semibold uppercase text-amber-400">{citationFormat} Archival Citation</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(citationText);
                                showToast('Citation copied to clipboard', 'success');
                              }}
                              className="text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="font-mono text-xs text-slate-300 select-all leading-relaxed whitespace-pre-wrap">
                            {citationText}
                          </p>
                        </div>

                        {/* Private Notes */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                            Researcher Annotation & Field Notes:
                          </label>
                          <textarea
                            value={bmk.researcherNotes}
                            onChange={(e) => updateBookmarkNotes(bmk.id, e.target.value)}
                            placeholder="Add private commentary, analytical notes, or cross-references..."
                            rows={2}
                            className="w-full p-2.5 bg-[#070c18] border border-[#1b2b4d] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Quick View Button */}
                        {doc && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => navigateTo('explorer', { docId: doc.id })}
                              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open in Document Explorer</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* SUB-VIEW B: RESEARCH PACKS (Exact match to Panel 9 of Reference UI) */}
          {collectionSubTab === 'packs' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {researchPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] hover:border-amber-500/50 p-5 space-y-4 shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                        {pack.category}
                      </span>
                      <span>{pack.itemCount} items</span>
                    </div>

                    <h4 className="font-serif font-bold text-lg text-white">
                      {pack.title}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {pack.description}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono pt-2 border-t border-[#1b2b4d]">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>{pack.docCount} docs</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-blue-400" />
                        <span>{pack.videoCount} media</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      showToast(`Opened Research Pack: ${pack.title}`, 'info');
                      navigateTo('archive', { searchQuery: pack.title.split(' ')[0] });
                    }}
                    className="w-full py-2 bg-[#070c18] hover:bg-[#121f3d] border border-[#1b2b4d] hover:border-amber-500/40 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Pack Contents</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
