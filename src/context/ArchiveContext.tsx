import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  ArchiveItem, 
  DocumentCategory, 
  PublishingStatus, 
  LanguageCode, 
  ThemeMode,
  DocumentPage,
  ResearchBookmark, 
  AuditLogEntry, 
  AudioVideoRecord,
  TimelineEvent,
  KnowledgeNode,
  KnowledgeLink
} from '../types/archive';
import { INITIAL_AUDIO_VIDEO_RECORDS, INITIAL_KNOWLEDGE_LINKS, INITIAL_KNOWLEDGE_NODES, INITIAL_TIMELINE_EVENTS } from '../data/archiveData';
import { getUIText, getCategoryLabel } from '../utils/translations';
import { archiveRepository } from '../services/repository/archiveRepository';
import { ArchivalIngestionService } from '../services/ingestion/ingestionService';
import { 
  OFFICIAL_SOURCE_COLLECTIONS, 
  SourceCollectionInfo, 
  NormalizedArchivalPackage, 
  IngestionSummary 
} from '../services/ingestion/types';
import { getDatabaseStatus, fetchLiveDatabaseStatus, DatabaseStatus } from '../db/databaseConfig';


export type AppMode = 'visitor' | 'research' | 'admin';

export type AppView = 
  | 'home' 
  | 'archive' 
  | 'explorer' 
  | 'timeline' 
  | 'assistant' 
  | 'knowledgemap' 
  | 'audiovideo' 
  | 'heritage360'
  | 'compare' 
  | 'collections' 
  | 'admin_dashboard' 
  | 'admin_upload' 
  | 'admin_audit';

interface NavigationState {
  mode: AppMode;
  view: AppView;
  selectedDocId?: string;
  selectedPage?: number;
  searchQuery?: string;
  activeCategory?: DocumentCategory | 'All';
  selectedMediaId?: string;
  selectedTimelineEventId?: string | null;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export interface HeritageViewerContext {
  locationId: string;
  viewpointId?: string;
  heading?: number;
  pitch?: number;
  zoom?: number;
  hotspotId?: string;
}

interface ArchiveContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  view: AppView;
  setView: (view: AppView) => void;
  navigationHistory: NavigationState[];
  navigateTo: (view: AppView, params?: { 
    docId?: string; 
    page?: number; 
    mediaId?: string; 
    category?: DocumentCategory | 'All';
    timelineEventId?: string;
    knowledgeNodeId?: string;
    assistantQuery?: string;
    searchQuery?: string;
    heritageContext?: HeritageViewerContext;
  }) => void;
  goBack: () => void;
  canGoBack: boolean;
  selectedDocId: string;
  setSelectedDocId: (id: string) => void;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  selectedMediaId: string;
  setSelectedMediaId: (id: string) => void;
  selectedTimelineEventId: string | null;
  setSelectedTimelineEventId: (id: string | null) => void;
  selectedKnowledgeNodeId: string | null;
  setSelectedKnowledgeNodeId: (id: string | null) => void;
  assistantInitialQuery: string | null;
  setAssistantInitialQuery: (q: string | null) => void;
  heritageContext: HeritageViewerContext | null;
  setHeritageContext: (context: HeritageViewerContext | null) => void;
  
  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: DocumentCategory | 'All';
  setActiveCategory: (cat: DocumentCategory | 'All') => void;
  
  // Localization
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  getLocalizedText: (item: { title: string; titleHi?: string; titleMr?: string; titleKn?: string }) => string;
  getLocalizedDesc: (item: { description: string; descriptionHi?: string; descriptionMr?: string; descriptionKn?: string }) => string;
  getLocalizedSummary: (item: { aiSummary: string; aiSummaryHi?: string; aiSummaryMr?: string; aiSummaryKn?: string }) => string;

  // Theme & Accessibility
  themeMode: ThemeMode;
  setThemeMode: (theme: ThemeMode) => void;
  fontSize: 'normal' | 'large' | 'xl';
  setFontSize: (size: 'normal' | 'large' | 'xl') => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  kioskMode: boolean;
  setKioskMode: (val: boolean) => void;
  getCategoryTitle: (cat: DocumentCategory | 'All') => string;
  getLocalizedPageOcr: (page: DocumentPage) => string;

  // Data Collections
  archiveItems: ArchiveItem[];
  publishedItems: ArchiveItem[];
  timelineEvents: TimelineEvent[];
  knowledgeNodes: KnowledgeNode[];
  knowledgeLinks: KnowledgeLink[];
  audioVideoRecords: AudioVideoRecord[];
  auditLogs: AuditLogEntry[];
  bookmarks: ResearchBookmark[];

  // Mutations
  updateDocumentStatus: (docId: string, status: PublishingStatus) => void;
  updateDocumentMetadata: (docId: string, updated: Partial<ArchiveItem>) => void;
  addNewDocument: (doc: ArchiveItem) => void;
  addBookmark: (bookmark: Omit<ResearchBookmark, 'id' | 'dateAdded'>) => void;
  removeBookmark: (id: string) => void;
  updateBookmarkNotes: (id: string, notes: string) => void;
  
  // Notifications
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;

  // Database & Ingestion Layer
  databaseStatus: DatabaseStatus;
  sourceCollections: SourceCollectionInfo[];
  isLoadingItems: boolean;
  refreshArchiveItems: () => Promise<void>;
  refreshAuditLogs: () => Promise<void>;
  ingestArchivalPackage: (pkg: NormalizedArchivalPackage) => Promise<ArchiveItem>;
  importFromJSON: (jsonText: string, sourceColId: string) => IngestionSummary;
  importFromCSV: (csvText: string, sourceColId: string) => IngestionSummary;
  previewImport: (rawText: string, format: 'json' | 'csv', sourceColId: string) => { summary: IngestionSummary; previewItems: NormalizedArchivalPackage[] };
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

export const ArchiveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('visitor');
  const [view, setViewState] = useState<AppView>('home');
  const [selectedDocId, setSelectedDocId] = useState<string>('cad-1949-closing');
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [selectedMediaId, setSelectedMediaId] = useState<string>('bbc-interview-1953');
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [selectedKnowledgeNodeId, setSelectedKnowledgeNodeId] = useState<string | null>(null);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState<string | null>(null);
  const [heritageContext, setHeritageContext] = useState<HeritageViewerContext | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'All'>('All');
  const [language, setLanguage] = useState<LanguageCode>('en');

  // Theme & Accessibility
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('daic_theme_mode') as ThemeMode;
    return saved === 'dark' || saved === 'contrast' || saved === 'light' ? saved : 'dark';
  });
  const [fontSize, setFontSizeState] = useState<'normal' | 'large' | 'xl'>(() => {
    const saved = localStorage.getItem('daic_font_size');
    return saved === 'large' || saved === 'xl' ? saved : 'normal';
  });
  const setFontSize = (size: 'normal' | 'large' | 'xl') => {
    setFontSizeState(size);
    localStorage.setItem('daic_font_size', size);
  };
  const [kioskMode, setKioskMode] = useState<boolean>(false);

  const highContrast = themeMode === 'contrast';
  const setHighContrast = (val: boolean) => {
    setThemeMode(val ? 'contrast' : 'light');
  };

  const setThemeMode = (newTheme: ThemeMode) => {
    setThemeModeState(newTheme);
    localStorage.setItem('daic_theme_mode', newTheme);
  };

  // Sync theme mode to document root classes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-contrast', 'dark', 'high-contrast');
    if (themeMode === 'contrast') {
      root.classList.add('theme-contrast', 'high-contrast', 'dark');
      document.body.classList.add('high-contrast');
    } else if (themeMode === 'dark') {
      root.classList.add('theme-dark', 'dark');
      document.body.classList.remove('high-contrast');
    } else {
      root.classList.add('theme-light');
      document.body.classList.remove('high-contrast');
    }
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = fontSize;
    root.style.fontSize = fontSize === 'xl' ? '20px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  // History stack for intelligent back navigation
  const [navigationHistory, setNavigationHistory] = useState<NavigationState[]>([
    { mode: 'visitor', view: 'home' }
  ]);

  // Data Store
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [knowledgeNodes] = useState<KnowledgeNode[]>(INITIAL_KNOWLEDGE_NODES);
  const [knowledgeLinks] = useState<KnowledgeLink[]>(INITIAL_KNOWLEDGE_LINKS);

  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);

  const refreshArchiveItems = async () => {
    try {
      setIsLoadingItems(true);
      const res = await fetch('/api/archive/items');
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json.data || []);
        if (Array.isArray(items)) {
          setArchiveItems(items);
          if (json.source === 'database') localStorage.setItem('daic_archive_items', JSON.stringify(items));
        }
      }
    } catch (err) {
      console.warn('[ArchiveContext] Failed to load archive items from database:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    void refreshArchiveItems();
    void fetch('/api/archive/timeline').then(async response => {
      const result = await response.json();
      const liveEvents = response.ok && result.source === 'database' && Array.isArray(result.data) ? result.data : [];
      setTimelineEvents(liveEvents.length ? liveEvents : INITIAL_TIMELINE_EVENTS);
    }).catch(() => setTimelineEvents(INITIAL_TIMELINE_EVENTS));
  }, []);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const refreshAuditLogs = async () => {
    try {
      const response = await fetch('/api/audit-logs');
      if (!response.ok) {
        setAuditLogs([]);
        return;
      }
      const result = await response.json();
      const rows = Array.isArray(result.data) ? result.data : [];
      setAuditLogs(rows.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        performedBy: row.performed_by,
        userRole: row.user_role,
        documentId: row.document_id,
        documentTitle: row.document_title,
        details: row.details,
      })));
    } catch {
      setAuditLogs([]);
    }
  };

  useEffect(() => {
    void refreshAuditLogs();
  }, []);

  const [bookmarks, setBookmarks] = useState<ResearchBookmark[]>(() => {
    const saved = localStorage.getItem('daic_research_bookmarks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse bookmarks', e);
      }
    }
    return [
      {
        id: 'bmk-001',
        docId: 'cad-1949-closing',
        title: 'Constituent Assembly Concluding Speech (25 Nov 1949)',
        category: 'Constituent Assembly Debates',
        dateAdded: '2026-09-24',
        researcherNotes: 'Key citation for Social Democracy thesis: "In politics we will have equality and in social and economic life we will have inequality."',
        tags: ['Constitutional Law', 'Social Democracy', 'CAD Volume XI']
      }
    ];
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('daic_archive_items', JSON.stringify(archiveItems));
  }, [archiveItems]);

  useEffect(() => {
    localStorage.setItem('daic_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('daic_research_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    if (newMode === 'visitor') {
      navigateTo('home');
    } else if (newMode === 'research') {
      navigateTo('archive');
    } else if (newMode === 'admin') {
      navigateTo('admin_dashboard');
    }
    showToast(`Switched to ${newMode.toUpperCase()} Mode`, 'info');
  };

  const setView = (newView: AppView) => {
    navigateTo(newView);
  };

  const navigateTo = (
    newView: AppView, 
    params?: { 
      docId?: string; 
      page?: number; 
      mediaId?: string; 
      category?: DocumentCategory | 'All';
      timelineEventId?: string;
      knowledgeNodeId?: string;
      assistantQuery?: string;
      searchQuery?: string;
      heritageContext?: HeritageViewerContext;
    }
  ) => {
    if (params?.docId) setSelectedDocId(params.docId);
    if (params?.page) setSelectedPage(params.page);
    if (params?.mediaId) setSelectedMediaId(params.mediaId);
    if (params?.category) setActiveCategory(params.category);
    if (params?.timelineEventId) setSelectedTimelineEventId(params.timelineEventId);
    if (params?.knowledgeNodeId) setSelectedKnowledgeNodeId(params.knowledgeNodeId);
    if (params?.assistantQuery) setAssistantInitialQuery(params.assistantQuery);
    if (params?.searchQuery !== undefined) setSearchQuery(params.searchQuery);
    if (params?.heritageContext) setHeritageContext(params.heritageContext);

    const nextState: NavigationState = {
      mode,
      view: newView,
      selectedDocId: params?.docId || selectedDocId,
      selectedPage: params?.page || selectedPage,
      selectedMediaId: params?.mediaId || selectedMediaId,
      searchQuery: params?.searchQuery !== undefined ? params.searchQuery : searchQuery,
      activeCategory: params?.category || activeCategory,
      selectedTimelineEventId: params?.timelineEventId || selectedTimelineEventId
    };

    if (newView === 'home') {
      setNavigationHistory([{ mode, view: 'home' }]);
    } else {
      setNavigationHistory(prev => {
        const last = prev[prev.length - 1];
        if (last?.view === nextState.view && last.selectedDocId === nextState.selectedDocId && last.selectedPage === nextState.selectedPage) return prev;
        return [...prev, nextState];
      });
    }
    setViewState(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (navigationHistory.length <= 1) {
      // Default to home
      setViewState('home');
      return;
    }

    const newHistory = [...navigationHistory];
    newHistory.pop(); // Remove current
    const prevState = newHistory[newHistory.length - 1];

    setNavigationHistory(newHistory);
    setViewState(prevState.view);
    if (prevState.mode) setModeState(prevState.mode);
    if (prevState.selectedDocId) setSelectedDocId(prevState.selectedDocId);
    if (prevState.selectedPage) setSelectedPage(prevState.selectedPage);
    if (prevState.selectedMediaId) setSelectedMediaId(prevState.selectedMediaId);
    if (prevState.selectedTimelineEventId !== undefined) setSelectedTimelineEventId(prevState.selectedTimelineEventId);
    if (prevState.searchQuery !== undefined) setSearchQuery(prevState.searchQuery);
    if (prevState.activeCategory) setActiveCategory(prevState.activeCategory);
  };

  const canGoBack = view !== 'home' && navigationHistory.length > 1;

  // Localized string helpers
  const getLocalizedText = (item: { title: string; titleHi?: string; titleMr?: string; titleKn?: string }) => {
    if (language === 'hi' && item.titleHi) return item.titleHi;
    if (language === 'mr' && item.titleMr) return item.titleMr;
    if (language === 'kn' && item.titleKn) return item.titleKn;
    return item.title;
  };

  const getLocalizedDesc = (item: { description: string; descriptionHi?: string; descriptionMr?: string; descriptionKn?: string }) => {
    if (language === 'hi' && item.descriptionHi) return item.descriptionHi;
    if (language === 'mr' && item.descriptionMr) return item.descriptionMr;
    if (language === 'kn' && item.descriptionKn) return item.descriptionKn;
    return item.description;
  };

  const getLocalizedSummary = (item: { aiSummary: string; aiSummaryHi?: string; aiSummaryMr?: string; aiSummaryKn?: string }) => {
    if (language === 'hi' && item.aiSummaryHi) return item.aiSummaryHi;
    if (language === 'mr' && item.aiSummaryMr) return item.aiSummaryMr;
    if (language === 'kn' && item.aiSummaryKn) return item.aiSummaryKn;
    return item.aiSummary;
  };

  const getCategoryTitle = (cat: DocumentCategory | 'All') => {
    return getCategoryLabel(cat, language);
  };

  const getLocalizedPageOcr = (page: DocumentPage) => {
    if (language === 'hi' && page.ocrTextHi) return page.ocrTextHi;
    if (language === 'mr' && page.ocrTextMr) return page.ocrTextMr;
    if (language === 'kn' && page.ocrTextKn) return page.ocrTextKn;
    return page.ocrText;
  };

  // Published items filter (for visitor and general research mode)
  const publishedItems = archiveItems.filter(item => 
    mode === 'admin' ? true : item.publishingStatus === 'Published'
  );

  // Mutations
  const updateDocumentStatus = (docId: string, status: PublishingStatus) => {
    const doc = archiveItems.find(i => i.id === docId);
    setArchiveItems(prev => prev.map(item => 
      item.id === docId ? { ...item, publishingStatus: status } : item
    ));

    showToast(`Status updated to "${status}" for ${doc?.archiveId || docId}`, 'success');
  };

  const updateDocumentMetadata = (docId: string, updated: Partial<ArchiveItem>) => {
    setArchiveItems(prev => prev.map(item => 
      item.id === docId ? { ...item, ...updated } : item
    ));

    showToast('Document metadata saved successfully', 'success');
  };

  const addNewDocument = (newDoc: ArchiveItem) => {
    setArchiveItems(prev => [newDoc, ...prev]);
    showToast(`Document "${newDoc.title.slice(0, 30)}..." added to repository`, 'success');
  };

  const addBookmark = (bmk: Omit<ResearchBookmark, 'id' | 'dateAdded'>) => {
    const existing = bookmarks.find(b => b.docId === bmk.docId);
    if (existing) {
      showToast('Document already present in your Research Binder', 'info');
      return;
    }
    const newBmk: ResearchBookmark = {
      ...bmk,
      id: 'bmk-' + Date.now(),
      dateAdded: new Date().toISOString().substring(0, 10)
    };
    setBookmarks(prev => [newBmk, ...prev]);
    showToast('Saved to Research Binder', 'success');
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    showToast('Removed from Research Binder', 'info');
  };

  const updateBookmarkNotes = (id: string, notes: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, researcherNotes: notes } : b));
    showToast('Research notes updated', 'success');
  };

  // Database & Ingestion Layer Implementations
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>(() => getDatabaseStatus());
  const sourceCollections = OFFICIAL_SOURCE_COLLECTIONS;

  useEffect(() => {
    let isMounted = true;
    fetchLiveDatabaseStatus().then(status => {
      if (isMounted) {
        setDatabaseStatus(status);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const ingestArchivalPackage = async (pkg: NormalizedArchivalPackage): Promise<ArchiveItem> => {
    const saved = await archiveRepository.ingestArchivalPackage(pkg);
    setArchiveItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id || i.archiveId === saved.archiveId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });

    await refreshAuditLogs();

    showToast(`Archival Record "${saved.title.slice(0, 32)}..." ingested into repository`, 'success');
    return saved;
  };

  const importFromJSON = (jsonText: string, sourceColId: string): IngestionSummary => {
    const existingArchiveIds = new Set(archiveItems.map(i => i.archiveId));
    const summary = ArchivalIngestionService.processJsonInput(jsonText, sourceColId, existingArchiveIds);

    // Commit valid items
    summary.importedItems.forEach(pkg => {
      void ingestArchivalPackage(pkg);
    });

    return summary;
  };

  const importFromCSV = (csvText: string, sourceColId: string): IngestionSummary => {
    const existingArchiveIds = new Set(archiveItems.map(i => i.archiveId));
    const summary = ArchivalIngestionService.processCsvInput(csvText, sourceColId, existingArchiveIds);

    // Commit valid items
    summary.importedItems.forEach(pkg => {
      void ingestArchivalPackage(pkg);
    });

    return summary;
  };

  const previewImport = (rawText: string, format: 'json' | 'csv', sourceColId: string) => {
    const existingArchiveIds = new Set(archiveItems.map(i => i.archiveId));
    return ArchivalIngestionService.previewImport(rawText, format, sourceColId, existingArchiveIds);
  };

  return (
    <ArchiveContext.Provider
      value={{
        mode,
        setMode,
        view,
        setView,
        navigationHistory,
        navigateTo,
        goBack,
        canGoBack,
        selectedDocId,
        setSelectedDocId,
        selectedPage,
        setSelectedPage,
        selectedMediaId,
        setSelectedMediaId,
        selectedTimelineEventId,
        setSelectedTimelineEventId,
        selectedKnowledgeNodeId,
        setSelectedKnowledgeNodeId,
        assistantInitialQuery,
        setAssistantInitialQuery,
        heritageContext,
        setHeritageContext,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        language,
        setLanguage,
        t: (key: string) => getUIText(key, language),
        getLocalizedText,
        getLocalizedDesc,
        getLocalizedSummary,
        getCategoryTitle,
        getLocalizedPageOcr,
        themeMode,
        setThemeMode,
        fontSize,
        setFontSize,
        highContrast,
        setHighContrast,
        kioskMode,
        setKioskMode,
        archiveItems,
        publishedItems,
        timelineEvents,
        knowledgeNodes,
        knowledgeLinks,
        audioVideoRecords: INITIAL_AUDIO_VIDEO_RECORDS,
        auditLogs,
        bookmarks,
        updateDocumentStatus,
        updateDocumentMetadata,
        addNewDocument,
        addBookmark,
        removeBookmark,
        updateBookmarkNotes,
        toasts,
        showToast,
        dismissToast,
        databaseStatus,
        sourceCollections,
        isLoadingItems,
        refreshArchiveItems,
        refreshAuditLogs,
        ingestArchivalPackage,
        importFromJSON,
        importFromCSV,
        previewImport
      }}
    >
      {children}
    </ArchiveContext.Provider>
  );
};

export const useArchive = () => {
  const context = useContext(ArchiveContext);
  if (!context) {
    throw new Error('useArchive must be used within an ArchiveProvider');
  }
  return context;
};
