import React, { useState } from 'react';
import { useArchive, AppMode } from '../../context/ArchiveContext';
import { 
  Building2, 
  Search, 
  ArrowLeft, 
  Bookmark, 
  Eye, 
  BookOpen, 
  ShieldCheck, 
  Languages, 
  Type, 
  Contrast, 
  Sun,
  Moon,
  Maximize2, 
  Minimize2,
  Home,
  ChevronRight,
  Settings,
  X,
  Lock,
  LogOut,
  Sliders,
  Sparkles,
  Globe,
  User,
  Menu,
  Clock,
  Network
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    mode, 
    setMode, 
    view, 
    navigateTo, 
    goBack, 
    canGoBack, 
    language, 
    setLanguage, 
    fontSize, 
    setFontSize, 
    themeMode,
    setThemeMode,
    highContrast, 
    setHighContrast, 
    kioskMode, 
    setKioskMode,
    bookmarks,
    searchQuery,
    setSearchQuery,
    t,
    showToast
  } = useArchive();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffPasscode, setStaffPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeErrorMessage, setPasscodeErrorMessage] = useState('');

  const getBreadcrumbLabel = () => {
    switch (view) {
      case 'home': return 'Home';
      case 'archive': return 'Digital Archive';
      case 'explorer': return 'Document Explorer & OCR';
      case 'timeline': return 'Chronological Timeline';
      case 'knowledgemap': return 'Knowledge Map';
      case 'audiovideo': return 'Audio & Video Repository';
      case 'heritage360': return '360° Heritage Viewer';
      case 'assistant': return 'AI Research Assistant';
      case 'compare': return 'Research Mode';
      case 'collections': return 'My Collection';
      case 'admin_dashboard': return 'Archival Dashboard';
      case 'admin_upload': return 'Ingestion & Digitization';
      case 'admin_audit': return 'Preservation & Audit Logs';
      default: return 'Archive';
    }
  };

  const toggleFontSize = () => {
    if (fontSize === 'normal') setFontSize('large');
    else if (fontSize === 'large') setFontSize('xl');
    else setFontSize('normal');
  };

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ passcode: staffPasscode }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
      setMode('admin');
      setSettingsOpen(false);
      setStaffPasscode('');
      setPasscodeError(false);
      showToast('Archivist Staff Access Granted', 'success');
      } else {
        setPasscodeErrorMessage(result.message || 'The archivist passcode was not accepted.');
        setPasscodeError(true);
      }
    } catch {
      setPasscodeErrorMessage('Admin authentication service is unavailable.');
      setPasscodeError(true);
    }
  };

  const handleExitAdmin = async () => {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
    setMode('visitor');
  };

  return (
    <header className="bg-[#070b16] text-slate-100 border-b border-[#14203a] sticky top-0 z-40 shadow-md">
      {/* Top Institutional Notification Bar */}
      <div className="border-b border-[#111a30] bg-[#050811] text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-slate-400">
        <div className="flex items-center gap-2 font-medium text-[11px]">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="text-slate-300">Digital Heritage &amp; Research Archive</span>
        </div>

        {/* Quick Accessibility Badges */}
        <div className="flex items-center gap-3">
          {/* Text Size Control */}
          <button
            onClick={toggleFontSize}
            className="flex items-center gap-1 text-xs hover:text-amber-300 transition-colors px-1 py-0.5 rounded cursor-pointer"
            title={`Current text size: ${fontSize}. Click to cycle.`}
            aria-label="Adjust font size"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="font-semibold text-[11px]">
              {fontSize === 'normal' ? 'A' : fontSize === 'large' ? 'A+' : 'A++'}
            </span>
          </button>

          {/* Theme Selector (Light / Dark / High Contrast) */}
          <button
            onClick={() => {
              if (themeMode === 'dark') {
                setThemeMode('contrast');
                showToast('Switched to High Contrast Mode (WCAG AAA)', 'info');
              } else if (themeMode === 'contrast') {
                setThemeMode('light');
                showToast('Switched to Light Mode (Archival Parchment)', 'info');
              } else {
                setThemeMode('dark');
                showToast('Switched to Dark Mode (Deep Navy)', 'info');
              }
            }}
            className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-0.5 rounded cursor-pointer border ${
              themeMode === 'contrast'
                ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                : themeMode === 'light'
                ? 'bg-stone-200 text-stone-900 border-stone-300'
                : 'bg-[#0f172a] text-amber-300 border-[#1e293b] hover:text-white'
            }`}
            title={`Current theme: ${themeMode.toUpperCase()}. Click to cycle.`}
            aria-label="Cycle theme mode"
          >
            {themeMode === 'contrast' ? (
              <>
                <Contrast className="w-3.5 h-3.5 text-black" />
                <span className="text-[11px] font-bold text-black">Contrast</span>
              </>
            ) : themeMode === 'light' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">Dark</span>
              </>
            )}
          </button>

          {/* Kiosk Mode Toggle */}
          <button
            onClick={() => setKioskMode(!kioskMode)}
            className={`flex items-center gap-1 text-xs transition-colors px-1 py-0.5 rounded cursor-pointer ${kioskMode ? 'text-amber-400 font-bold' : 'hover:text-slate-200'}`}
            title="Toggle Memorial Kiosk Fullscreen Mode"
            aria-label="Toggle kiosk mode"
          >
            {kioskMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px]">Kiosk</span>
          </button>
        </div>
      </div>

      {/* Main Global Header Bar (Exact match to Section 4 & Reference Design) */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* LEFT: Portrait/Avatar + Title */}
        <div 
          onClick={() => {
            navigateTo('home');
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500/80 shadow-md shrink-0 bg-stone-900 flex items-center justify-center ring-2 ring-amber-400/20">
            <img 
              src="/ambedkar-golden-bust.jpg" 
              alt="Dr. B. R. Ambedkar Golden Memorial Bust"
              className="w-full h-full object-cover object-center filter contrast-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Dr._Bhimrao_Ambedkar.jpg/220px-Dr._Bhimrao_Ambedkar.jpg";
              }}
            />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg sm:text-xl tracking-wider text-white group-hover:text-amber-400 transition-colors leading-tight">
              ABHILEKH
            </h1>
            <p className="text-[11px] sm:text-xs text-amber-400/90 font-medium tracking-wide">
              Ambedkar Bharatiya Heritage &amp; Intellectual Knowledge Hub
            </p>
          </div>
        </div>

        {/* CENTER / MAIN NAVIGATION (Home, Explore Archive, Research Mode, Timeline, Knowledge Map, My Collection) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          <button
            onClick={() => navigateTo('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              view === 'home' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Home
          </button>

          <button
            onClick={() => navigateTo('archive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              view === 'archive' || view === 'explorer'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Explore Archive
          </button>

          <button
            onClick={() => {
              setMode('research');
              navigateTo('compare');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              view === 'compare'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Research Mode
          </button>

          <button
            onClick={() => navigateTo('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              view === 'timeline' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Timeline
          </button>

          <button
            onClick={() => navigateTo('knowledgemap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              view === 'knowledgemap' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Knowledge Map
          </button>

          <button
            onClick={() => navigateTo('collections')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              view === 'collections' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>My Collection</span>
            {bookmarks.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 font-bold rounded-full text-[10px]">
                {bookmarks.length}
              </span>
            )}
          </button>
        </nav>

        {/* RIGHT: Language selector & Profile/Settings controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Admin Desk Indicator when unlocked */}
          {mode === 'admin' && (
            <div className="flex items-center gap-2 bg-amber-600/20 border border-amber-500/50 px-2.5 py-1 rounded-lg text-xs text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-[11px] hidden sm:inline">{t('archivist_portal')}</span>
              <button
                onClick={() => void handleExitAdmin()}
                className="px-2 py-0.5 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded text-[10px] cursor-pointer border border-stone-700"
                title="Exit Staff Portal"
              >
                Exit Admin
              </button>
            </div>
          )}

          {/* Language selector */}
          <div className="flex items-center gap-1 bg-[#0b1326] rounded-lg border border-[#1a294d] px-2.5 py-1.5 text-xs text-slate-200">
            <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer text-slate-200 font-medium"
              aria-label="Select language"
            >
              <option value="en" className="bg-[#0b1326] text-white">English</option>
              <option value="hi" className="bg-[#0b1326] text-white">हिन्दी</option>
              <option value="mr" className="bg-[#0b1326] text-white">मराठी</option>
              <option value="kn" className="bg-[#0b1326] text-white">ಕನ್ನಡ</option>
            </select>
          </div>

          {/* Profile / Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 bg-[#0b1326] hover:bg-[#111d38] border border-[#1a294d] hover:border-amber-500/60 rounded-lg text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
            title="Settings & Institutional Access"
            aria-label="Settings"
          >
            <User className="w-4 h-4" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 bg-[#0b1326] border border-[#1a294d] rounded-lg text-slate-300 hover:text-white cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#14203a] bg-[#070b16] px-4 py-3 space-y-1 text-xs">
          <button
            onClick={() => { navigateTo('home'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md ${view === 'home' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Home
          </button>
          <button
            onClick={() => { navigateTo('archive'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md ${view === 'archive' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Explore Archive
          </button>
          <button
            onClick={() => { setMode('research'); navigateTo('compare'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md ${view === 'compare' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Research Mode
          </button>
          <button
            onClick={() => { navigateTo('timeline'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md ${view === 'timeline' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Timeline
          </button>
          <button
            onClick={() => { navigateTo('knowledgemap'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md ${view === 'knowledgemap' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Knowledge Map
          </button>
          <button
            onClick={() => { navigateTo('collections'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between ${view === 'collections' ? 'bg-amber-600/20 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <span>My Collection</span>
            {bookmarks.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 font-bold rounded-full text-[10px]">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Secondary Sub-Bar: Back Button & Breadcrumbs */}
      <div className="bg-[#050914] border-t border-[#121c33] px-4 py-2 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-slate-300 hover:text-amber-400 transition-colors px-2.5 py-1 rounded bg-[#0b1326] hover:bg-[#111d38] border border-[#1a294d] cursor-pointer"
                title="Return to previous screen"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {/* Breadcrumb Path */}
            <div className="flex items-center gap-1.5 text-slate-400 font-sans">
              <button 
                onClick={() => navigateTo('home')}
                className="hover:text-amber-400 flex items-center gap-1 text-slate-300 transition-colors cursor-pointer"
              >
                <Home className="w-3 h-3" />
                <span>Home</span>
              </button>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-amber-400 font-medium">
                {getBreadcrumbLabel()}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block font-serif italic">
            Ambedkar Bharatiya Heritage &amp; Intellectual Knowledge Hub
          </div>
        </div>
      </div>

      {/* Settings & Discreet Staff Portal Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0d1527] border border-[#1e2f54] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-100 space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-[#1a2744] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-base text-white">System Settings & Preferences</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Theme Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Theme & Visual Mode:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setThemeMode('dark')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    themeMode === 'dark' ? 'bg-amber-600/20 text-amber-400 border-amber-500 font-bold' : 'bg-[#090f1e] text-slate-300 border-[#1a2744]'
                  }`}
                >
                  Deep Navy (Dark)
                </button>
                <button
                  onClick={() => setThemeMode('light')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    themeMode === 'light' ? 'bg-amber-600/20 text-amber-400 border-amber-500 font-bold' : 'bg-[#090f1e] text-slate-300 border-[#1a2744]'
                  }`}
                >
                  Parchment (Light)
                </button>
                <button
                  onClick={() => setThemeMode('contrast')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    themeMode === 'contrast' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-[#090f1e] text-slate-300 border-[#1a2744]'
                  }`}
                >
                  High Contrast
                </button>
              </div>
            </div>

            {/* Text Resizing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Typographic Scaling:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['normal', 'large', 'xl'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={`p-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer capitalize ${
                      fontSize === s ? 'bg-amber-600/20 text-amber-400 border-amber-500 font-bold' : 'bg-[#090f1e] text-slate-300 border-[#1a2744]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Memorial Touch-Screen Kiosk Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#090f1e] border border-[#1a2744]">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">Memorial Kiosk Display</div>
                <div className="text-[11px] text-slate-400">Optimized for large museum touch screens</div>
              </div>
              <button
                onClick={() => {
                  setKioskMode(!kioskMode);
                  showToast(kioskMode ? 'Exited Kiosk Mode' : 'Entered Touch-Screen Kiosk Mode', 'info');
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  kioskMode ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {kioskMode ? 'Active' : 'Enable'}
              </button>
            </div>

            {/* Discreet Staff & Institutional Administration Pathway */}
            <div className="border-t border-[#1a2744] pt-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Institutional Staff & Archival Desk</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Restricted to authorized DAIC curators and scanning specialists. Access is verified by the server.
              </p>

              <form onSubmit={handleUnlockAdmin} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter archivist passcode..."
                    value={staffPasscode}
                    onChange={(e) => {
                      setStaffPasscode(e.target.value);
                      setPasscodeError(false);
                      setPasscodeErrorMessage('');
                    }}
                    className="flex-1 bg-[#090f1e] border border-[#24355a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Authenticate
                  </button>
                </div>
                {passcodeError && (
                  <p className="text-[11px] text-red-400">
                    {passcodeErrorMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
