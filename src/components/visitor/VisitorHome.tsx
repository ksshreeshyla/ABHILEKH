import React, { useState } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { 
  Library, 
  FileText, 
  Clock, 
  Bot, 
  Search, 
  ArrowRight, 
  Sparkles, 
  Volume2, 
  ChevronRight,
  Bookmark,
  Share2,
  ExternalLink,
  Network,
  BookOpen,
  Quote,
  ShieldCheck
} from 'lucide-react';

export const VisitorHome: React.FC = () => {
  const { 
    navigateTo, 
    publishedItems, 
    setSearchQuery, 
    getLocalizedText, 
    getLocalizedDesc,
    showToast,
    addBookmark,
    t
  } = useArchive();

  const [heroSearchInput, setHeroSearchInput] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearchInput.trim()) {
      setSearchQuery(heroSearchInput.trim());
      navigateTo('archive');
    }
  };

  const handleSearchTag = (term: string) => {
    setSearchQuery(term);
    navigateTo('archive');
  };

  const featuredDoc = publishedItems.find(i => i.id === 'cad-1949-closing') || publishedItems[0];

  return (
    <div className="space-y-12 pb-16">
      {/* SECTION 1 — HERO AREA (DEVICE-ADAPTIVE ARCHIVAL HERO WITH ZERO TEXT OVERLAP ON FACE) */}
      <section className="relative bg-[#060b18] text-slate-100 border-b border-[#14203a] overflow-hidden">
        
        {/* ======================================================== */}
        {/* A. MOBILE & TABLET LAYOUT (< 1024px): PORTRAIT ON TOP, TEXT BELOW */}
        {/* ======================================================== */}
        <div className="lg:hidden flex flex-col">
          {/* Top Archival Portrait Frame (Face 100% visible, unobstructed) */}
          <div className="relative w-full h-72 sm:h-96 md:h-[420px] overflow-hidden bg-[#060b18]">
            <img
              src="/ambedkar-reading-portrait.jpg"
              alt="Dr. B. R. Ambedkar Reading Manuscript"
              className="w-full h-full object-cover object-[center_top] filter contrast-105"
            />
            {/* Seamless gradient fade from portrait into the text section below */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-transparent via-65% to-[#060b18]/30" />
            <div className="absolute inset-0 bg-radial from-transparent to-[#060b18]/40" />
          </div>

          {/* Text & Search Section (Positions cleanly below the portrait - zero face collision) */}
          <div className="px-4 sm:px-8 py-6 -mt-10 sm:-mt-12 relative z-10 space-y-4 max-w-2xl mx-auto w-full">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold tracking-wider text-amber-200">ABHILEKH</span>
                <span className="text-amber-500/60">·</span>
                <span className="text-slate-300 font-sans">Ambedkar Bharatiya Heritage &amp; Intellectual Knowledge Hub</span>
              </div>

              <span className="text-lg sm:text-2xl font-serif text-slate-200 block font-normal tracking-wide drop-shadow-md">
                Explore the Legacy of
              </span>

              <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight drop-shadow-lg">
                Dr. B. R. Ambedkar
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 font-sans tracking-wide pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 drop-shadow-md">
                <span>Writings</span>
                <span className="text-amber-400">•</span>
                <span>Speeches</span>
                <span className="text-amber-400">•</span>
                <span>Manuscripts</span>
                <span className="text-amber-400">•</span>
                <span>Constituent Assembly Debates</span>
                <span className="text-amber-400">•</span>
                <span>Archives</span>
              </p>
            </div>

            {/* Mobile/Tablet White Search Bar */}
            <form onSubmit={handleHeroSearch} className="pt-1">
              <div className="relative flex items-center bg-white rounded-xl shadow-2xl overflow-hidden p-1 border border-slate-200 ring-2 ring-black/10">
                <input
                  type="text"
                  value={heroSearchInput}
                  onChange={(e) => setHeroSearchInput(e.target.value)}
                  placeholder="Search keywords, topics, events, historical records..."
                  className="w-full bg-transparent text-slate-900 text-xs sm:text-sm pl-4 pr-12 py-3 focus:outline-none placeholder:text-slate-500 font-sans"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Search the Archive"
                >
                  <Search className="w-4 h-4 text-white" />
                </button>
              </div>
            </form>

            {/* Mobile/Tablet Popular Search Shortcuts */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-300 pt-1">
              <span className="text-slate-400 font-medium text-[11px]">Popular searches:</span>
              {(['Constitution', 'Equality', 'Caste', 'Speeches', 'Dalit Rights', 'Mahad'] as const).map(term => (
                <button
                  key={term}
                  onClick={() => handleSearchTag(term)}
                  className="px-2.5 py-1 rounded-md bg-[#0a1224]/90 backdrop-blur-md hover:bg-[#152342] border border-[#22355c] hover:border-amber-400/60 text-[11px] text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Mobile Quote */}
            <div className="pt-3 border-t border-[#182645] flex items-center justify-between text-xs text-amber-200/90 font-serif">
              <span className="italic">"Educate, Agitate, Organize."</span>
              <span className="text-[10px] font-mono text-slate-400">— 1891–1956</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* B. DESKTOP, LAPTOP & KIOSK LAYOUT (>= 1024px): CINEMATIC WIDESCREEN */}
        {/* ======================================================== */}
        <div className="hidden lg:flex relative min-h-[560px] xl:min-h-[620px] items-center px-8 xl:px-16 overflow-hidden">
          {/* Full Archival Background Image anchored strictly to the left */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src="/ambedkar-reading-portrait.jpg"
              alt="Dr. B. R. Ambedkar"
              className="w-full h-full object-cover object-[12%_center] xl:object-[15%_center] filter contrast-105 brightness-100"
            />
            {/* Directional gradient: 100% transparent on left over Dr. Ambedkar's face, fading smoothly to solid dark navy on the right */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#060b18]/45 via-42% to-[#060b18]/95 to-68%" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-transparent to-[#060b18]/40" />
          </div>

          {/* Content Container strictly pinned to the right half (ml-auto) - ZERO overlap on left portrait */}
          <div className="max-w-7xl mx-auto w-full relative z-10 flex justify-end">
            <div className="w-full lg:w-[48%] xl:w-[45%] ml-auto space-y-5 text-left py-12">
              
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-bold tracking-wider text-amber-200">ABHILEKH</span>
                  <span className="text-amber-500/60">·</span>
                  <span className="text-slate-300 font-sans">Ambedkar Bharatiya Heritage &amp; Intellectual Knowledge Hub</span>
                </div>

                <span className="text-2xl xl:text-3xl font-serif text-slate-200 block font-normal tracking-wide drop-shadow-md">
                  Explore the Legacy of
                </span>

                <h1 className="font-serif text-4xl xl:text-6xl font-bold tracking-tight text-white leading-tight drop-shadow-lg">
                  Dr. B. R. Ambedkar
                </h1>

                <p className="text-xs sm:text-sm text-slate-200 font-sans tracking-wide pt-1 flex flex-wrap items-center gap-2 drop-shadow-md">
                  <span>Writings</span>
                  <span className="text-amber-400">•</span>
                  <span>Speeches</span>
                  <span className="text-amber-400">•</span>
                  <span>Manuscripts</span>
                  <span className="text-amber-400">•</span>
                  <span>Constituent Assembly Debates</span>
                  <span className="text-amber-400">•</span>
                  <span>Archives</span>
                </p>
              </div>

              {/* Desktop White Archival Search Bar */}
              <form onSubmit={handleHeroSearch} className="pt-2 max-w-xl">
                <div className="relative flex items-center bg-white rounded-xl shadow-2xl overflow-hidden p-1 border border-slate-200 ring-2 ring-black/10">
                  <input
                    type="text"
                    value={heroSearchInput}
                    onChange={(e) => setHeroSearchInput(e.target.value)}
                    placeholder="Search keywords, topics, events, historical records, or manuscripts..."
                    className="w-full bg-transparent text-slate-900 text-xs sm:text-sm pl-4 pr-12 py-3.5 focus:outline-none placeholder:text-slate-500 font-sans"
                  />
                  <button
                    type="submit"
                    className="w-11 h-11 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
                    title="Search the Archive"
                  >
                    <Search className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>

              {/* Desktop Popular Search Shortcuts */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1">
                <span className="text-slate-300 font-medium text-[11px] drop-shadow-sm">Popular searches:</span>
                {(['Constitution', 'Equality', 'Caste', 'Speeches', 'Dalit Rights', 'Mahad'] as const).map(term => (
                  <button
                    key={term}
                    onClick={() => handleSearchTag(term)}
                    className="px-3 py-1 rounded-md bg-[#0a1224]/90 backdrop-blur-md hover:bg-[#152342] border border-[#22355c] hover:border-amber-400/60 text-[11px] text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    {term}
                  </button>
                ))}
              </div>

              {/* Desktop Archival Motto Quote */}
              <div className="pt-3 flex items-center justify-between text-xs text-amber-200/90 font-serif border-t border-[#182645]/80 max-w-xl">
                <span className="italic text-sm">"Educate, Agitate, Organize."</span>
                <span className="text-[11px] font-mono text-slate-400">— Dr. B. R. Ambedkar (1891–1956)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — HOMEPAGE FEATURE ACCESS (4 Cards Matching Reference Screenshot) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Digital Archive */}
          <div 
            onClick={() => navigateTo('archive')}
            className="group bg-[#081022]/95 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-[#1d2f57] hover:border-amber-400/80 hover:shadow-xl hover:shadow-blue-950/40 transition-all cursor-pointer flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-[#0b1630] border border-[#1e3466] flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <Library className="w-5 h-5 text-sky-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-serif font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors truncate">
                Digital Archive
              </h3>
              <p className="text-[11px] text-slate-300 line-clamp-2 font-sans leading-tight">
                Explore books, speeches, manuscripts and more
              </p>
            </div>
          </div>

          {/* Card 2: Timeline */}
          <div 
            onClick={() => navigateTo('timeline')}
            className="group bg-[#081022]/95 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-[#1d2f57] hover:border-amber-400/80 hover:shadow-xl hover:shadow-blue-950/40 transition-all cursor-pointer flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-[#0b1630] border border-[#1e3466] flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-serif font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors truncate">
                Timeline
              </h3>
              <p className="text-[11px] text-slate-300 line-clamp-2 font-sans leading-tight">
                Journey through key moments
              </p>
            </div>
          </div>

          {/* Card 3: Knowledge Map */}
          <div 
            onClick={() => navigateTo('knowledgemap')}
            className="group bg-[#081022]/95 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-[#1d2f57] hover:border-amber-400/80 hover:shadow-xl hover:shadow-blue-950/40 transition-all cursor-pointer flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-[#0b1630] border border-[#1e3466] flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
              <Network className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-serif font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors truncate">
                Knowledge Map
              </h3>
              <p className="text-[11px] text-slate-300 line-clamp-2 font-sans leading-tight">
                Discover connections
              </p>
            </div>
          </div>

          {/* Card 4: AI Research Assistant */}
          <div 
            onClick={() => navigateTo('assistant')}
            className="group bg-[#081022]/95 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-[#1d2f57] hover:border-amber-400/80 hover:shadow-xl hover:shadow-blue-950/40 transition-all cursor-pointer flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-[#0b1630] border border-[#1e3466] flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-serif font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors truncate">
                AI Research Assistant
              </h3>
              <p className="text-[11px] text-slate-300 line-clamp-2 font-sans leading-tight">
                Ask, explore, learn
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — ARCHIVAL SPOTLIGHT FEATURE */}
      {featuredDoc && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-[#0b1326] text-slate-100 rounded-2xl p-6 sm:p-8 border border-[#1b2b4d] shadow-lg relative overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>PRIMARY ARCHIVAL HOLDING</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredDoc.archiveId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredDoc.date}</span>
                </div>

                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  {getLocalizedText(featuredDoc)}
                </h3>

                <p className="text-sm text-slate-300 font-sans leading-relaxed">
                  {getLocalizedDesc(featuredDoc)}
                </p>

                {/* Key Concepts */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
                  <span className="text-slate-300 font-medium">Core Concepts:</span>
                  {featuredDoc.keyConcepts.map((concept, idx) => (
                    <React.Fragment key={concept}>
                      <button
                        onClick={() => handleSearchTag(concept)}
                        className="text-amber-400 hover:underline cursor-pointer"
                      >
                        {concept}
                      </button>
                      {idx < featuredDoc.keyConcepts.length - 1 && <span aria-hidden="true">·</span>}
                    </React.Fragment>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    onClick={() => navigateTo('explorer', { docId: featuredDoc.id })}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open in Document Explorer</span>
                  </button>

                  <button
                    onClick={() => {
                      addBookmark({
                        docId: featuredDoc.id,
                        title: featuredDoc.title,
                        category: featuredDoc.category,
                        researcherNotes: 'Key primary source for CAD final address analysis.',
                        tags: ['CAD', 'Volume XI', 'Social Democracy']
                      });
                      showToast('Saved to My Collection', 'success');
                    }}
                    className="px-3.5 py-2 bg-[#121e38] hover:bg-[#192b52] text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-[#1e3057]"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save to My Collection</span>
                  </button>
                </div>
              </div>

              {/* Facsimile Preview */}
              <div className="w-full lg:w-80 bg-[#070c18] p-4 rounded-xl border border-[#1b2b4d] text-xs font-mono text-slate-300 space-y-3 shrink-0">
                <div className="text-[11px] text-slate-400 border-b border-[#1b2b4d] pb-2 flex justify-between">
                  <span>FACSIMILE SCAN PREVIEW</span>
                  <span className="text-emerald-400 font-bold">OCR 99.2%</span>
                </div>
                <div className="bg-[#0b1326] p-3 rounded border border-[#1b2b4d] font-serif text-[11px] leading-relaxed text-slate-300 italic">
                  "On the 26th of January 1950, we are going to enter into a life of contradictions. In politics we will have equality and in social and economic life we will have inequality..."
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Holding: Lok Sabha Secretariat</span>
                  <button
                    onClick={() => navigateTo('explorer', { docId: featuredDoc.id })}
                    className="text-amber-400 hover:underline cursor-pointer"
                  >
                    View Scan →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
