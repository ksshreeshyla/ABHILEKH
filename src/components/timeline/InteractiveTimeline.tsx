import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { TimelineEvent } from '../../types/archive';
import { INITIAL_TIMELINE_EVENTS } from '../../data/archiveData';
import { 
  Calendar, 
  MapPin, 
  Quote, 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  Filter, 
  ExternalLink,
  Users,
  Search,
  Sparkles,
  Network,
  Headphones,
  Video,
  UserRound,
  GraduationCap,
  Landmark,
  Handshake,
  ScrollText,
  Scale,
  Briefcase,
  Heart,
  Flame,
  Building2,
  Copy,
  Check,
  BookOpen,
  Tag,
  ArrowRight,
  ArrowLeft,
  Clock,
  Compass,
  X,
  Share2,
  ShieldCheck,
  Info,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const getMilestoneIcon = (eventId: string) => {
  switch (eventId) {
    case 'birth-1891': return UserRound;
    case 'columbia-study-1913': return GraduationCap;
    case 'lse-doctorate-1923': return Building2;
    case 'mahad-satyagraha-1927': return Users;
    case 'manusmriti-dahan-1927': return Flame;
    case 'round-table-1930': return Landmark;
    case 'poona-pact-1932': return Handshake;
    case 'annihilation-1936': return BookOpen;
    case 'cad-drafting-committee-1947': return ScrollText;
    case 'cad-adoption-1949': return Scale;
    case 'deekshabhoomi-1956': return Heart;
    default: return Briefcase;
  }
};

// Historical Eras definition
interface HistoricalEra {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  borderColor: string;
  bgGradient: string;
  description: string;
}

const HISTORICAL_ERAS: HistoricalEra[] = [
  {
    id: 'early-life',
    name: 'Early Life & Education',
    startYear: 1891,
    endYear: 1923,
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgGradient: 'from-sky-950/30 to-transparent',
    description: 'Upbringing in Mhow, Columbia University studies, and LSE Economics Doctorate.'
  },
  {
    id: 'social-reform',
    name: 'Social Reform & Human Rights',
    startYear: 1924,
    endYear: 1936,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgGradient: 'from-emerald-950/30 to-transparent',
    description: 'Mahad Satyagraha, Manusmriti Dahan, the Poona Pact, and Annihilation of Caste.'
  },
  {
    id: 'constitutional-era',
    name: 'Constitutional Architecture',
    startYear: 1937,
    endYear: 1950,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgGradient: 'from-amber-950/30 to-transparent',
    description: 'Round Table Conferences, Drafting Committee Chairman, and Authoring the Constitution.'
  },
  {
    id: 'spiritual-dhamma',
    name: 'Spiritual Emancipation & Dhamma',
    startYear: 1951,
    endYear: 1956,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgGradient: 'from-purple-950/30 to-transparent',
    description: 'Deekshabhoomi Nagpur, Revival of Navayana Buddhism, and Moral Fraternity.'
  }
];

export const InteractiveTimeline: React.FC = () => {
  const { 
    timelineEvents, 
    navigateTo, 
    archiveItems, 
    audioVideoRecords,
    selectedTimelineEventId, 
    setSelectedTimelineEventId,
    showToast,
    t,
    language
  } = useArchive();

  // State
  const [selectedTheme, setSelectedTheme] = useState<string>('All');
  const [timelineSearch, setTimelineSearch] = useState<string>('');
  const [scrubberYear, setScrubberYear] = useState<number>(1891);
  const [isDraggingTrack, setIsDraggingTrack] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [scrollLeftState, setScrollLeftState] = useState<number>(0);
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'documents' | 'people' | 'topics' | 'media' | 'sources'>('context');
  const [expandedSection, setExpandedSection] = useState<string | null>('context');
  const [kioskFullscreen, setKioskFullscreen] = useState<boolean>(false);

  // References
  const trackRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Themes
  const themes = [
    'All', 
    'Constitutional', 
    'Social Reform', 
    'Academic & Economics', 
    'Spiritual & Dhamma'
  ];

  // Helper for localized event title & descriptions
  const getEventTitle = (event: TimelineEvent) => {
    if (language === 'hi' && event.titleHi) return event.titleHi;
    if (language === 'mr' && event.titleMr) return event.titleMr;
    if (language === 'kn' && event.titleKn) return event.titleKn;
    return event.title;
  };

  const getEventDescription = (event: TimelineEvent) => {
    if (language === 'hi' && event.descriptionHi) return event.descriptionHi;
    if (language === 'mr' && event.descriptionMr) return event.descriptionMr;
    if (language === 'kn' && event.descriptionKn) return event.descriptionKn;
    return event.description;
  };

  const getEventDetailedDesc = (event: TimelineEvent) => {
    if (language === 'hi' && event.detailedDescriptionHi) return event.detailedDescriptionHi;
    if (language === 'mr' && event.detailedDescriptionMr) return event.detailedDescriptionMr;
    if (language === 'kn' && event.detailedDescriptionKn) return event.detailedDescriptionKn;
    return event.detailedDescription || event.description;
  };

  // Strictly chronological events (all 11 milestones)
  const chronologicalEvents = useMemo(() => {
    return [...timelineEvents].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.id.localeCompare(b.id);
    });
  }, [timelineEvents]);

  // Active selected event
  const selectedEvent = useMemo(() => {
    if (!selectedTimelineEventId) {
      return chronologicalEvents[0] || null;
    }
    return chronologicalEvents.find(e => e.id === selectedTimelineEventId) || chronologicalEvents[0] || null;
  }, [selectedTimelineEventId, chronologicalEvents]);

  // Sync scrubber year with selected event
  useEffect(() => {
    if (selectedEvent) {
      setScrubberYear(selectedEvent.year);
    }
  }, [selectedEvent]);

  // Current milestone index (0-based)
  const currentIndex = useMemo(() => {
    if (!selectedEvent) return 0;
    return chronologicalEvents.findIndex(e => e.id === selectedEvent.id);
  }, [selectedEvent, chronologicalEvents]);

  const totalMilestones = chronologicalEvents.length;
  const curatedEventIds = useMemo(() => new Set(INITIAL_TIMELINE_EVENTS.map(event => event.id)), []);
  const isCuratedTimeline = chronologicalEvents.length > 0 && chronologicalEvents.every(event => curatedEventIds.has(event.id));
  const selectedEventIsCurated = selectedEvent ? curatedEventIds.has(selectedEvent.id) : false;

  // Previous & Next event handlers
  const handlePrevEvent = () => {
    if (currentIndex > 0) {
      const prev = chronologicalEvents[currentIndex - 1];
      selectEventAndFocus(prev.id);
    }
  };

  const handleNextEvent = () => {
    if (currentIndex < totalMilestones - 1) {
      const next = chronologicalEvents[currentIndex + 1];
      selectEventAndFocus(next.id);
    }
  };

  // Smooth scroll and focus on selected node
  const selectEventAndFocus = (eventId: string) => {
    setSelectedTimelineEventId(eventId);
    const targetEl = nodeRefs.current[eventId];
    if (targetEl && trackRef.current) {
      targetEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  // Keyboard navigation (Left/Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevEvent();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextEvent();
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (chronologicalEvents[0]) {
          selectEventAndFocus(chronologicalEvents[0].id);
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = chronologicalEvents[chronologicalEvents.length - 1];
        if (last) {
          selectEventAndFocus(last.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, chronologicalEvents]);

  // Mouse drag handling for horizontal timeline
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDraggingTrack(true);
    setStartX(e.pageX - trackRef.current.offsetLeft);
    setScrollLeftState(trackRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingTrack(false);
  };

  const handleMouseUp = () => {
    setIsDraggingTrack(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTrack || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX) * 1.6;
    trackRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Scrubber slider change
  const handleScrubberChange = (year: number) => {
    setScrubberYear(year);
    // Find closest milestone
    let closestEvent = chronologicalEvents[0];
    let minDiff = Math.abs(chronologicalEvents[0].year - year);

    for (const ev of chronologicalEvents) {
      const diff = Math.abs(ev.year - year);
      if (diff < minDiff) {
        minDiff = diff;
        closestEvent = ev;
      }
    }

    if (closestEvent && closestEvent.id !== selectedEvent?.id) {
      selectEventAndFocus(closestEvent.id);
    }
  };

  // Copy citation
  const handleCopyCitation = (event: TimelineEvent) => {
    const citation = curatedEventIds.has(event.id)
      ? `ABHILEKH curated chronology. "${event.title} (${event.dateFormatted}, ${event.location})." This is a secondary summary; no primary-source link is supplied.`
      : `ABHILEKH timeline record. "${event.title} (${event.dateFormatted}, ${event.location})." Source: ${event.archiveSource || event.sourceProvenance || 'not recorded'}.`;
    navigator.clipboard.writeText(citation).then(() => {
      setCopiedCitationId(event.id);
      showToast('Archival Citation Copied to Clipboard', 'success');
      setTimeout(() => setCopiedCitationId(null), 3000);
    }).catch(() => {
      showToast('Unable to copy citation', 'error');
    });
  };

  // Connected documents lookup
  const relatedDocuments = useMemo(() => {
    if (!selectedEvent || !selectedEvent.relatedDocumentIds) return [];
    return archiveItems.filter(item => selectedEvent.relatedDocumentIds.includes(item.id));
  }, [selectedEvent, archiveItems]);

  // Connected media lookup
  const relatedMedia = useMemo(() => {
    if (!selectedEvent) return null;
    if (selectedEvent.relatedMediaId) {
      return audioVideoRecords.find(m => m.id === selectedEvent.relatedMediaId) || null;
    }
    return null;
  }, [selectedEvent, audioVideoRecords]);

  // Theme styling helpers
  const getThemeBadgeColor = (theme: TimelineEvent['theme']) => {
    switch (theme) {
      case 'Constitutional':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Social Reform':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Academic & Economics':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'Spiritual & Dhamma':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  // Distinct milestones years for scrubber ticks
  const milestoneYears = useMemo(() => {
    return Array.from(new Set(chronologicalEvents.map(e => e.year)));
  }, [chronologicalEvents]);

  return (
    <div className={`space-y-6 pb-20 ${kioskFullscreen ? 'fixed inset-0 z-50 bg-[#070b16] overflow-y-auto p-4 sm:p-8' : ''}`}>
      
      {/* 1. TOP HEADER & INSTITUTIONAL BREADCRUMB */}
      <section className="bg-[#090f22] border border-[#172545] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle Archival Watermark */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none font-serif text-8xl font-bold select-none text-amber-200">
          1891–1956
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="tracking-wide uppercase">Historical Journey & Interactive Chronology</span>
              <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{isCuratedTimeline ? 'Curated chronology' : `${chronologicalEvents.length} milestones`}</span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-white tracking-tight">
              The Life & Intellectual Journey of Dr. B. R. Ambedkar
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl font-sans">
              Explore the transformative milestones that shaped modern India. Navigate visually through education, mass civil rights actions, constitutional debates, and spiritual liberation from 1891 to 1956.
            </p>
          </div>

          {/* Quick controls: Kiosk toggle + Reset */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setKioskFullscreen(!kioskFullscreen)}
              className="px-3 py-1.5 rounded-lg bg-[#0e172e] hover:bg-[#152347] border border-[#1e315b] hover:border-amber-500/50 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Toggle Fullscreen Museum Kiosk View"
            >
              {kioskFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
              <span className="hidden sm:inline">{kioskFullscreen ? 'Exit Kiosk' : 'Kiosk Display'}</span>
            </button>

            <button
              onClick={() => {
                setSelectedTheme('All');
                setTimelineSearch('');
                if (chronologicalEvents[0]) {
                  selectEventAndFocus(chronologicalEvents[0].id);
                }
                showToast('Timeline View Reset', 'info');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#0e172e] hover:bg-[#152347] border border-[#1e315b] hover:border-amber-500/50 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset Timeline to 1891"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* 2. THEME FILTER CHIPS & LIVE SEARCH */}
        <div className="mt-5 pt-4 border-t border-[#14203d] flex flex-wrap items-center justify-between gap-3">
          {/* Theme Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-400" />
              <span>Theme:</span>
            </span>
            {themes.map(th => {
              const count = th === 'All' 
                ? chronologicalEvents.length 
                : chronologicalEvents.filter(e => e.theme === th).length;

              const isSelected = selectedTheme === th;
              return (
                <button
                  key={th}
                  onClick={() => setSelectedTheme(th)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20' 
                      : 'bg-[#0d162a] text-slate-300 hover:text-white hover:bg-[#152342] border border-[#1e2f54]'
                  }`}
                >
                  <span>{th}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-stone-950/20 text-stone-900 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box for milestone search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={timelineSearch}
              onChange={(e) => setTimelineSearch(e.target.value)}
              placeholder="Search events, people, places..."
              className="w-full bg-[#0d162a] border border-[#1e2f54] text-white text-xs rounded-xl pl-8 pr-7 py-1.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-500 transition-colors"
            />
            {timelineSearch && (
              <button
                onClick={() => setTimelineSearch('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. HISTORICAL ERA INDICATOR BAR */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {HISTORICAL_ERAS.map(era => {
          const isCurrentEra = selectedEvent && selectedEvent.year >= era.startYear && selectedEvent.year <= era.endYear;
          return (
            <div
              key={era.id}
              onClick={() => {
                const firstEventInEra = chronologicalEvents.find(e => e.year >= era.startYear && e.year <= era.endYear);
                if (firstEventInEra) {
                  selectEventAndFocus(firstEventInEra.id);
                }
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isCurrentEra 
                  ? `bg-gradient-to-r ${era.bgGradient} ${era.borderColor} border-amber-500/80 shadow-md ring-1 ring-amber-500/30` 
                  : 'bg-[#090f20]/60 border-[#152342] opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                <span className={era.color}>{era.startYear} – {era.endYear}</span>
                {isCurrentEra && <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold text-[9px]">ACTIVE ERA</span>}
              </div>
              <div className="font-serif font-bold text-xs text-white mt-1 truncate">
                {era.name}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                {era.description}
              </div>
            </div>
          );
        })}
      </section>

      {/* 4. YEAR SCRUBBER & HORIZONTAL CONTROLS */}
      <section className="bg-[#090f22] border border-[#172545] rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-serif font-semibold text-white">Year Scrubber</span>
            <span className="font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              {selectedEvent ? selectedEvent.year : scrubberYear}
            </span>
          </div>

          {/* Milestone Step Indicator */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
              Milestone <span className="text-amber-400 font-bold">{currentIndex + 1}</span> of <span className="text-white">{totalMilestones}</span>
            </span>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handlePrevEvent}
                disabled={currentIndex === 0}
                className="p-1 rounded-lg bg-[#0e172e] border border-[#1e315b] hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-white hover:text-amber-300 transition-colors cursor-pointer"
                title="Previous Milestone (← Key)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextEvent}
                disabled={currentIndex === totalMilestones - 1}
                className="p-1 rounded-lg bg-[#0e172e] border border-[#1e315b] hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-white hover:text-amber-300 transition-colors cursor-pointer"
                title="Next Milestone (→ Key)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Continuous Slider Track with Milestone Markers */}
        <div className="relative pt-2 pb-1">
          <input
            type="range"
            min={1891}
            max={1956}
            value={selectedEvent ? selectedEvent.year : scrubberYear}
            onChange={(e) => handleScrubberChange(Number(e.target.value))}
            className="w-full h-2 bg-[#121c33] rounded-lg appearance-none cursor-pointer accent-amber-500"
          />

          {/* Quick-Jump Milestone Year Ticks */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 px-1">
            {milestoneYears.map(yr => {
              const isSelected = selectedEvent?.year === yr;
              return (
                <button
                  key={yr}
                  onClick={() => handleScrubberChange(yr)}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    isSelected 
                      ? 'text-amber-400 font-bold bg-amber-500/20 border border-amber-500/40' 
                      : 'hover:text-slate-200'
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. THE MAIN VISUAL HORIZONTAL TIMELINE TRACK (JOURNEY) */}
      <section className="relative">
        <div className="flex items-center justify-between mb-2 px-1 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive Horizon · Drag or Scroll across time</span>
          </span>
          <span className="hidden sm:inline text-slate-500 text-[11px]">
            Use Arrow Keys (← / →) or Click any milestone
          </span>
        </div>

        {/* Scrollable Track Container */}
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="relative overflow-x-auto py-6 px-4 bg-[#060b18] border border-[#152342] rounded-2xl shadow-2xl scrollbar-thin scrollbar-thumb-[#1e315b] select-none cursor-grab active:cursor-grabbing"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Central Horizontal Axis Line (Golden Archival Spine) */}
          <div className="absolute top-[82px] left-8 right-8 h-1 bg-gradient-to-r from-amber-600/40 via-amber-400/60 to-amber-600/40 rounded-full z-0" />

          {/* Milestone Nodes Track */}
          <div className="flex items-start gap-8 min-w-max relative z-10 px-4">
            {chronologicalEvents.map((event, idx) => {
              const isSelected = selectedEvent?.id === event.id;
              const matchesTheme = selectedTheme === 'All' || event.theme === selectedTheme;
              const matchesSearch = !timelineSearch || (
                getEventTitle(event).toLowerCase().includes(timelineSearch.toLowerCase()) ||
                event.location.toLowerCase().includes(timelineSearch.toLowerCase()) ||
                event.year.toString().includes(timelineSearch)
              );

              const MilestoneIcon = getMilestoneIcon(event.id);

              return (
                <div
                  key={event.id}
                  ref={el => { nodeRefs.current[event.id] = el; }}
                  onClick={() => selectEventAndFocus(event.id)}
                  className={`flex flex-col items-center transition-all duration-300 ${
                    !matchesTheme || !matchesSearch ? 'opacity-35 hover:opacity-75 scale-95' : 'opacity-100'
                  }`}
                  style={{ width: isSelected ? '300px' : '260px' }}
                >
                  {/* Year Tag Above Axis */}
                  <div className={`mb-3 px-3 py-1 rounded-full font-mono text-xs font-bold transition-all shadow-md ${
                    isSelected 
                      ? 'bg-amber-500 text-stone-950 scale-110 shadow-amber-500/30' 
                      : 'bg-[#0d162a] text-amber-400 border border-[#1e2f54] hover:border-amber-400/60'
                  }`}>
                    {event.year}
                  </div>

                  {/* Central Spine Node (Dot) */}
                  <div className="relative mb-4 flex items-center justify-center">
                    <div className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                      isSelected 
                        ? 'bg-amber-400 border-white ring-4 ring-amber-500/40 scale-125' 
                        : 'bg-[#0d162a] border-amber-500/70 hover:scale-110'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-stone-950' : 'bg-amber-400'}`} />
                    </div>
                  </div>

                  {/* COMPACT EVENT CARD (Exact match to Section 4 Requirement) */}
                  <div className={`w-full rounded-2xl overflow-hidden border transition-all duration-300 text-left cursor-pointer group shadow-xl ${
                    isSelected 
                      ? 'bg-[#0e172e] border-amber-400 shadow-2xl shadow-amber-500/10 ring-2 ring-amber-400/30' 
                      : 'bg-[#090f20] border-[#1a2b4f] hover:border-amber-500/50 hover:bg-[#0c1429]'
                  }`}>
                    
                    {/* Milestone icon panel (intentionally not a photograph) */}
                    <div className="relative aspect-[16/10] bg-gradient-to-br from-[#111d38] via-[#0b1326] to-[#182441] overflow-hidden flex flex-col items-center justify-center gap-2">
                      <div className={`rounded-full border p-4 transition-transform duration-300 group-hover:scale-110 ${isSelected ? 'border-amber-300/70 bg-amber-400/10' : 'border-amber-500/30 bg-slate-900/40'}`}>
                        <MilestoneIcon className="w-10 h-10 text-amber-300" strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-slate-300">Milestone symbol</span>

                      {/* Top Overlay Badge: Year + Theme */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border backdrop-blur-xs font-semibold ${getThemeBadgeColor(event.theme)}`}>
                          {event.theme}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-mono text-amber-400 border border-amber-500/30">
                          #{idx + 1}
                        </span>
                      </div>

                    </div>

                    {/* Card Body: Title, Location & Quick Indicators */}
                    <div className="p-3.5 space-y-2">
                      <h3 className={`font-serif font-bold text-sm leading-snug line-clamp-2 transition-colors ${
                        isSelected ? 'text-amber-300' : 'text-white group-hover:text-amber-400'
                      }`}>
                        {getEventTitle(event)}
                      </h3>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-sans">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>

                      {/* Connected Material Counters (Section 12 requirement) */}
                      <div className="pt-2 border-t border-[#162340] flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-400">
                        {event.relatedDocumentIds && event.relatedDocumentIds.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#131f38] text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5" />
                            <span>{event.relatedDocumentIds.length} Doc</span>
                          </span>
                        )}
                        {event.relatedPeople && event.relatedPeople.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#131f38] text-slate-300 border border-slate-700/40 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            <span>{event.relatedPeople.length} People</span>
                          </span>
                        )}
                        {event.relatedMediaId && (
                          <span className="px-1.5 py-0.5 rounded bg-[#131f38] text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Headphones className="w-2.5 h-2.5" />
                            <span>AV</span>
                          </span>
                        )}
                        <span className="ml-auto text-amber-400 font-medium text-[11px] group-hover:translate-x-0.5 transition-transform flex items-center">
                          <span>View</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. CINEMATIC DETAIL PANEL (Split Layout & Deep Archival Explorer) */}
      {selectedEvent && (
        <section 
          ref={detailPanelRef}
          className="bg-[#080d1e] border-2 border-amber-500/50 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Subtle Top Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />

          {/* TOP BAR: Year, Theme, Title, Location & Milestone Controls */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#152342]">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full font-mono text-xs font-bold bg-amber-500 text-stone-950">
                  {selectedEvent.year}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold border ${getThemeBadgeColor(selectedEvent.theme)}`}>
                  {selectedEvent.theme}
                </span>
                <span className="text-slate-400 text-xs font-mono">
                  {selectedEvent.dateFormatted}
                </span>
              </div>

              <h2 className="font-serif font-bold text-2xl sm:text-3xl text-white tracking-tight leading-tight">
                {getEventTitle(selectedEvent)}
              </h2>

              <div className="flex items-center gap-2 text-xs text-amber-300/90 font-mono">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{selectedEvent.location}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Milestone {currentIndex + 1} of {totalMilestones}</span>
              </div>
            </div>

            {/* Previous & Next Navigation Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrevEvent}
                disabled={currentIndex === 0}
                className="px-3 py-2 rounded-xl bg-[#0e172e] hover:bg-[#152347] border border-[#1e315b] hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleNextEvent}
                disabled={currentIndex === totalMilestones - 1}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <span>Next Event</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-950" />
              </button>
            </div>
          </div>

          {/* MAIN CINEMATIC SPLIT: Archival Photo on Left, Structured Historical Context on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Large Archival Photo & Key Quote (Section 7 requirement) */}
            <div className="lg:col-span-5 space-y-4">
              <div 
                className="group relative rounded-2xl overflow-hidden border border-[#22355c] bg-[#0c1429] shadow-2xl"
              >
                <div className="relative aspect-[4/3] bg-gradient-to-br from-[#111d38] via-[#0b1326] to-[#182441] flex flex-col items-center justify-center gap-4">
                  {(() => { const MilestoneIcon = getMilestoneIcon(selectedEvent.id); return <MilestoneIcon className="w-20 h-20 text-amber-300" strokeWidth={1.25} aria-hidden="true" />; })()}
                  <div className="text-center px-6">
                    <div className="font-serif text-lg font-semibold text-amber-100">{getEventTitle(selectedEvent)}</div>
                    <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.2em] text-slate-300">Iconographic milestone · not a photograph</div>
                  </div>
                </div>

                {/* Photo Caption & Provenance */}
              <div className="p-3.5 bg-[#0a1024] border-t border-[#182645] space-y-1">
                <p className="text-xs text-slate-200 font-sans leading-relaxed">A thematic icon marks this milestone. Historical dates and descriptions remain unchanged.</p>
                <p className="text-[10px] font-mono text-amber-400/90">Visual symbol · no photograph shown</p>
                </div>
              </div>

              {/* Historical Key Quote Card */}
              {selectedEvent.keyQuote && (
                <div className="bg-[#0b1329] border border-amber-500/30 rounded-xl p-4 relative overflow-hidden shadow-md">
                  <Quote className="w-8 h-8 text-amber-500/20 absolute -right-2 -bottom-2 pointer-events-none" />
                  <blockquote className="font-serif italic text-sm text-amber-100 font-medium leading-relaxed">
                    "{selectedEvent.keyQuote}"
                  </blockquote>
                  <div className="text-[11px] font-mono text-amber-400/80 font-semibold mt-2">
                    — Dr. B. R. Ambedkar ({selectedEvent.year})
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Core Narrative & Expandable Research Sections */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Short Core Description (Clean, Readable) */}
              <div className="bg-[#0c1429] border border-[#1b2b4d] rounded-xl p-4 space-y-2">
                <div className="text-[11px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Summary Overview
                </div>
                <p className="text-sm text-slate-200 font-sans leading-relaxed">
                  {getEventDescription(selectedEvent)}
                </p>
              </div>

              {/* Expandable Accordion Tabs (Preventing text overload) */}
              <div className="space-y-2.5">
                
                {/* 1. Historical Context */}
                <div className="border border-[#172545] rounded-xl overflow-hidden bg-[#090f20]">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'context' ? null : 'context')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0e172e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <span>Historical Context & Significance</span>
                    </div>
                    {expandedSection === 'context' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandedSection === 'context' && (
                    <div className="p-4 pt-1 border-t border-[#14203d] text-xs text-slate-300 font-sans leading-relaxed space-y-2">
                      <p>{getEventDetailedDesc(selectedEvent)}</p>
                    </div>
                  )}
                </div>

                {/* 2. Connected Archival Documents (Section 12) */}
                <div className="border border-[#172545] rounded-xl overflow-hidden bg-[#090f20]">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'documents' ? null : 'documents')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0e172e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <FileText className="w-4 h-4 text-sky-400" />
                      <span>Connected Archival Documents ({relatedDocuments.length})</span>
                    </div>
                    {expandedSection === 'documents' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandedSection === 'documents' && (
                    <div className="p-4 pt-2 border-t border-[#14203d] space-y-2">
                      {relatedDocuments.length > 0 ? (
                        <div className="space-y-2">
                          {relatedDocuments.map(doc => (
                            <div 
                              key={doc.id}
                              onClick={() => navigateTo('explorer', { docId: doc.id })}
                              className="p-3 rounded-lg bg-[#0e1830] border border-[#1b2b4f] hover:border-amber-500/60 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                            >
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-mono text-amber-400">{doc.category} • Ref: {doc.archiveId}</div>
                                <div className="font-serif font-bold text-xs text-white group-hover:text-amber-300">{doc.title}</div>
                                <div className="text-[11px] text-slate-400 line-clamp-1">{doc.sourceInstitution}</div>
                              </div>
                              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-medium shrink-0 flex items-center gap-1 group-hover:bg-amber-500 group-hover:text-stone-950 transition-colors">
                                <span>Inspect</span>
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-sans italic py-1">
                          No direct digital manuscript attached in this tier. Consult the general catalog or AI assistant for related debate transcripts.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Associated Historical Figures */}
                <div className="border border-[#172545] rounded-xl overflow-hidden bg-[#090f20]">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'people' ? null : 'people')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0e172e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Associated Historical Figures ({selectedEvent.relatedPeople?.length || 0})</span>
                    </div>
                    {expandedSection === 'people' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandedSection === 'people' && (
                    <div className="p-4 pt-2 border-t border-[#14203d]">
                      {selectedEvent.relatedPeople && selectedEvent.relatedPeople.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.relatedPeople.map(person => (
                            <span 
                              key={person}
                              className="px-2.5 py-1 rounded-lg bg-[#0e1830] border border-[#1b2b4f] text-xs text-slate-200 font-medium"
                            >
                              {person}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No specific associates logged.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Audio & Video Holdings */}
                {relatedMedia && (
                  <div className="border border-[#172545] rounded-xl overflow-hidden bg-[#090f20]">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'media' ? null : 'media')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0e172e] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <Headphones className="w-4 h-4 text-purple-400" />
                        <span>Audio / Video Archive Recording</span>
                      </div>
                      {expandedSection === 'media' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedSection === 'media' && (
                      <div className="p-4 pt-2 border-t border-[#14203d]">
                        <div 
                          onClick={() => navigateTo('audiovideo', { mediaId: relatedMedia.id })}
                          className="p-3 rounded-lg bg-[#0e1830] border border-purple-500/30 hover:border-purple-400 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-purple-400 uppercase">{relatedMedia.mediaType} • {relatedMedia.duration}</span>
                            <div className="font-serif font-bold text-xs text-white group-hover:text-purple-300">{relatedMedia.title}</div>
                            <div className="text-[11px] text-slate-400">{relatedMedia.source}</div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-purple-500 text-stone-950 font-bold text-xs shrink-0 flex items-center gap-1">
                            <span>Listen</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Archival Source Citation (Section 15) */}
                <div className="border border-[#172545] rounded-xl overflow-hidden bg-[#090f20]">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'sources' ? null : 'sources')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0e172e] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Sources & citation</span>
                    </div>
                    {expandedSection === 'sources' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandedSection === 'sources' && (
                    <div className="p-4 pt-2 border-t border-[#14203d] space-y-3">
                      <div className="space-y-1 text-xs">
                        <div className="text-slate-400 font-mono text-[11px]">Primary Source Repository:</div>
                        <div className="text-white font-medium">{selectedEventIsCurated ? 'No source link is supplied for this curated chronology entry.' : selectedEvent.archiveSource || 'No primary source is linked for this milestone.'}</div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="text-slate-400 font-mono text-[11px]">Provenance Registry:</div>
                        <div className="text-amber-300 font-mono text-[11px]">{selectedEventIsCurated ? 'No institutional verification reference is recorded.' : selectedEvent.sourceProvenance || 'No institutional verification reference is recorded.'}</div>
                      </div>

                      <button
                        onClick={() => handleCopyCitation(selectedEvent)}
                        className="px-3 py-1.5 rounded-lg bg-[#0e172e] hover:bg-[#152347] border border-[#1e315b] hover:border-amber-500/50 text-xs font-medium text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedCitationId === selectedEvent.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCitationId === selectedEvent.id ? 'Citation Copied!' : 'Copy Archival Citation'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BAR: Ask AI + Explore Knowledge Map (Sections 13 & 14) */}
              <div className="pt-3 border-t border-[#172545] flex flex-wrap items-center gap-3">
                {/* 1. Ask AI Button */}
                <button
                  onClick={() => {
                    const prompt = `Tell me about the historical significance, constitutional legacy, and primary sources related to ${selectedEvent.title} (${selectedEvent.year}) at ${selectedEvent.location}.`;
                    navigateTo('assistant', { assistantQuery: prompt });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-blue-900/30"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Ask AI About This Event</span>
                </button>

                {/* 2. Explore Knowledge Map */}
                <button
                  onClick={() => {
                    navigateTo('knowledgemap', { 
                      knowledgeNodeId: selectedEvent.relatedKnowledgeNodeId || 'dr-ambedkar' 
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#0e172e] hover:bg-[#152347] border border-amber-500/40 text-amber-300 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Network className="w-4 h-4 text-amber-400" />
                  <span>Explore in Knowledge Map</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 8. INSTITUTIONAL FOOTER NOTICE */}
      <footer className="text-center py-4 text-xs text-slate-500 font-mono border-t border-[#121c33]">
        {isCuratedTimeline ? 'Curated chronology for exploration. Milestones are not presented as institutionally verified archival records.' : 'Timeline records and source details are shown as supplied by the archive database.'}
      </footer>
    </div>
  );
};
