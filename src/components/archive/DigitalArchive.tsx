import React, { useState, useMemo } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { DocumentCategory, ArchiveItem } from '../../types/archive';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  FileText, 
  Bookmark, 
  Bot, 
  Info, 
  X, 
  Copy, 
  Check, 
  Calendar, 
  User, 
  Building, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

const TOP_CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'Books & Writings', label: 'Books' },
  { id: 'Writings', label: 'Writings' },
  { id: 'Speeches', label: 'Speeches' },
  { id: 'Rare Manuscripts', label: 'Manuscripts' },
  { id: 'Photos', label: 'Photos' },
  { id: 'Videos', label: 'Videos' },
  { id: 'Audio', label: 'Audio' }
];

export const DigitalArchive: React.FC = () => {
  const { 
    archiveItems, 
    publishedItems, 
    mode, 
    navigateTo, 
    searchQuery, 
    setSearchQuery, 
    activeCategory, 
    setActiveCategory,
    addBookmark,
    getLocalizedText,
    getLocalizedDesc,
    getCategoryTitle,
    t,
    showToast
  } = useArchive();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedYearRange, setSelectedYearRange] = useState<number>(1910);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'title'>('date_desc');
  const [inspectedDoc, setInspectedDoc] = useState<ArchiveItem | null>(null);

  // Left sidebar filter states (matching Panel 2 of Reference Design)
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // Source items based on mode
  const sourceItems = mode === 'admin' ? archiveItems : publishedItems;

  const sourcesList = [
    'Dr. Ambedkar Foundation',
    'Constituent Assembly Debates',
    'NDLI',
    'Maharashtra State Archives',
    'Lok Sabha Secretariat'
  ];

  const typesList = [
    'Book',
    'Speech',
    'Manuscript',
    'Article',
    'Photo',
    'Video',
    'Audio'
  ];

  const languagesList = [
    'English',
    'Hindi',
    'Marathi',
    'Kannada',
    'Other'
  ];

  const handleToggleSource = (src: string) => {
    setSelectedSources(prev => 
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    );
  };

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleToggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveCategory('All');
    setSelectedSources([]);
    setSelectedTypes([]);
    setSelectedLanguages([]);
    setSelectedYearRange(1910);
    showToast('Filters reset to default', 'info');
  };

  const filteredItems = useMemo(() => {
    return sourceItems.filter(item => {
      // Top Category Filter
      if (activeCategory !== 'All') {
        if (activeCategory === 'Books & Writings' && item.category !== 'Books & Writings') return false;
        if ((activeCategory as string) === 'Writings' && !item.category.includes('Writings') && item.category !== 'Rare Manuscripts') return false;
        if (activeCategory === 'Speeches' && item.category !== 'Speeches' && item.category !== 'Constituent Assembly Debates') return false;
        if (activeCategory === 'Rare Manuscripts' && item.category !== 'Rare Manuscripts') return false;
      }

      // Year match
      if (item.year < selectedYearRange) {
        return false;
      }

      // Source Filter
      if (selectedSources.length > 0) {
        const matchesSource = selectedSources.some(s => 
          item.sourceInstitution.toLowerCase().includes(s.toLowerCase()) ||
          item.collection.toLowerCase().includes(s.toLowerCase()) ||
          (item.sourceProvenance || '').toLowerCase().includes(s.toLowerCase())
        );
        if (!matchesSource) return false;
      }

      // Type Filter
      if (selectedTypes.length > 0) {
        const matchesType = selectedTypes.some(t => {
          if (t === 'Book') return item.category.toLowerCase().includes('book');
          if (t === 'Speech') return item.category.toLowerCase().includes('speech') || item.category.toLowerCase().includes('debate');
          if (t === 'Manuscript') return item.category.toLowerCase().includes('manuscript');
          if (t === 'Article') return item.category.toLowerCase().includes('record') || item.category.toLowerCase().includes('writing');
          return true;
        });
        if (!matchesType) return false;
      }

      // Language Filter
      if (selectedLanguages.length > 0) {
        const matchesLang = selectedLanguages.some(l => 
          (item.language || 'English').toLowerCase().includes(l.toLowerCase())
        );
        if (!matchesLang) return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inAuthor = item.author.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inConcepts = item.keyConcepts.some(c => c.toLowerCase().includes(q));
        const inText = item.fullText.toLowerCase().includes(q);
        const inArchiveId = item.archiveId.toLowerCase().includes(q);

        return inTitle || inAuthor || inDesc || inConcepts || inText || inArchiveId;
      }

      return true;
    }).sort((a, b) => {
      const aPriority = a.id === 'item-baws-vol-01' || a.archiveId === 'DAF-BAWS-VOL-01' ? 0 : 1;
      const bPriority = b.id === 'item-baws-vol-01' || b.archiveId === 'DAF-BAWS-VOL-01' ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (sortBy === 'date_desc') return b.year - a.year;
      if (sortBy === 'date_asc') return a.year - b.year;
      return a.title.localeCompare(b.title);
    });
  }, [sourceItems, activeCategory, selectedYearRange, searchQuery, sortBy, selectedSources, selectedTypes, selectedLanguages]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Subtitle (Panel 2 of Reference UI) */}
      <div className="space-y-1 border-b border-[#1b2b4d] pb-4">
        <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
          Digital Archive
        </h1>
        <p className="text-sm text-slate-300">
          Explore the rich collection of Dr. Ambedkar's works and historical records.
        </p>
      </div>

      {/* Category Tabs across Top (Exact match to Reference Panel 2) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TOP_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-sm'
                  : 'bg-[#0d1629] text-slate-300 hover:text-white border-[#1b2b4d] hover:bg-[#13203c]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Layout (Left Filters Sidebar + Right Archival Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Multi-faceted Sidebar Filter (lg:col-span-3 - Matching Reference Panel 2) */}
        <div className="lg:col-span-3 bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-5 space-y-6 shadow-sm">
          {/* Filter Header & Reset */}
          <div className="flex items-center justify-between border-b border-[#1b2b4d] pb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filters</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Search inside filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Keyword Search:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#070c18] border border-[#22355c] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* 1. SOURCE FILTER */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              Source
            </span>
            <div className="space-y-1.5">
              {sourcesList.map(src => (
                <label key={src} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(src)}
                    onChange={() => handleToggleSource(src)}
                    className="rounded border-[#22355c] bg-[#070c18] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>{src}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. TYPE FILTER */}
          <div className="space-y-2 border-t border-[#1b2b4d] pt-4">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              Type
            </span>
            <div className="space-y-1.5">
              {typesList.map(type => (
                <label key={type} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => handleToggleType(type)}
                    className="rounded border-[#22355c] bg-[#070c18] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. LANGUAGE FILTER */}
          <div className="space-y-2 border-t border-[#1b2b4d] pt-4">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              Language
            </span>
            <div className="space-y-1.5">
              {languagesList.map(lang => (
                <label key={lang} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang)}
                    onChange={() => handleToggleLanguage(lang)}
                    className="rounded border-[#22355c] bg-[#070c18] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>{lang}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. DATE SLIDER */}
          <div className="space-y-2 border-t border-[#1b2b4d] pt-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold text-amber-400 uppercase tracking-wider">From Year:</span>
              <span className="font-mono font-bold text-white">{selectedYearRange}</span>
            </div>
            <input
              type="range"
              min="1910"
              max="1956"
              step="1"
              value={selectedYearRange}
              onChange={(e) => setSelectedYearRange(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1910</span>
              <span>1956</span>
            </div>
          </div>
        </div>

        {/* Right Column: Search Results & Archival Cards Grid (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Top Results Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1629] p-3 rounded-xl border border-[#1b2b4d]">
            <div className="text-xs text-slate-300 font-mono">
              Showing <span className="font-bold text-white">{filteredItems.length}</span> published archive records
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-300">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#070c18] border border-[#22355c] rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="date_desc">Newest to Oldest</option>
                  <option value="date_asc">Oldest to Newest</option>
                  <option value="title">Alphabetical (A-Z)</option>
                </select>
              </div>

              <div className="flex items-center border border-[#22355c] rounded-md overflow-hidden bg-[#070c18]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 cursor-pointer ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="bg-[#0d1629] p-12 rounded-2xl border border-dashed border-[#1b2b4d] text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="font-serif text-lg font-bold text-white">
                No Archival Documents Found
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No records match your active criteria. Try clearing your search term or resetting the sidebar filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-amber-600 text-stone-950 font-bold text-xs rounded-lg hover:bg-amber-500 cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* Clean 3-Column Archival Card Grid (Matching Panel 2 of Reference Design) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => navigateTo('explorer', { docId: item.id })}
                  className="group bg-[#0d1629] rounded-2xl border border-[#1b2b4d] hover:border-amber-500/60 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                >
                  {/* Card Thumbnail / Parchment Facsimile Preview */}
                  <div className="h-44 w-full bg-[#080e1c] border-b border-[#1b2b4d] p-4 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-[#0b1426] transition-colors">
                    <div className="w-24 h-32 rounded bg-[#f5efe0] border border-[#d8caa8] shadow-md p-2 flex flex-col justify-between text-stone-900 select-none group-hover:scale-105 transition-transform duration-200">
                      <div className="text-[7px] font-mono text-stone-500 tracking-wider text-center uppercase">
                        {item.archiveId}
                      </div>
                      <div className="font-serif font-bold text-[9px] text-center leading-tight text-stone-900 line-clamp-3">
                        {item.title}
                      </div>
                      <div className="text-[6px] font-serif italic text-stone-600 text-center">
                        Dr. B. R. Ambedkar
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-amber-400 border border-amber-500/30">
                      {item.year}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono text-amber-400">
                        {item.category} • {item.year} • {item.language || 'English'}
                      </div>

                      <h3 className="font-serif font-bold text-base text-white group-hover:text-amber-400 transition-colors leading-snug line-clamp-2">
                        {getLocalizedText(item)}
                      </h3>

                      <p className="text-xs text-slate-300 line-clamp-2 font-sans leading-relaxed">
                        {getLocalizedDesc(item)}
                      </p>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-[#162340] flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {item.sourceInstitution}
                      </span>
                      <span className="text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-semibold text-[11px]">
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => navigateTo('explorer', { docId: item.id })}
                  className="group bg-[#0d1629] p-4 rounded-xl border border-[#1b2b4d] hover:border-amber-500/60 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono text-amber-400">
                      {item.category} • {item.year} • {item.language || 'English'} • {item.archiveId}
                    </div>
                    <h3 className="font-serif font-bold text-base text-white group-hover:text-amber-400 transition-colors">
                      {getLocalizedText(item)}
                    </h3>
                    <p className="text-xs text-slate-300 font-sans line-clamp-1 max-w-2xl">
                      {getLocalizedDesc(item)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden md:inline">
                      {item.sourceInstitution}
                    </span>
                    <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer">
                      <span>View</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
