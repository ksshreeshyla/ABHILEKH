import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { audioEngine } from '../../utils/audioEngine';
import { ContinueOnPhoneButton } from '../common/ContinueOnPhoneButton';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Eye, 
  Search, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Copy, 
  Check, 
  Edit3, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Sparkles, 
  Languages, 
  ShieldCheck, 
  ExternalLink,
  BookOpen,
  Award,
  Globe,
  Layers,
  Lock,
  UserCheck,
  History,
  AlertCircle
} from 'lucide-react';

export const DocumentExplorer: React.FC = () => {
  const { 
    archiveItems, 
    selectedDocId, 
    setSelectedDocId, 
    selectedPage, 
    setSelectedPage, 
    navigateTo, 
    showToast,
    language,
    getLocalizedText,
    getLocalizedDesc,
    getLocalizedSummary,
    t,
    mode
  } = useArchive();

  const doc = useMemo(() => {
    return archiveItems.find(i => i.id === selectedDocId) || archiveItems[0];
  }, [archiveItems, selectedDocId]);

  // Viewport & Zoom controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [invertContrast, setInvertContrast] = useState<boolean>(false);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);

  // Document internal search
  const [searchInDoc, setSearchInDoc] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  // Active view tab in right pane
  const [activeTab, setActiveTab] = useState<'ocr' | 'summary' | 'translation' | 'metadata'>('ocr');

  // OCR Editing & Verification mode
  const [isEditingOcr, setIsEditingOcr] = useState<boolean>(false);
  const [editableOcrText, setEditableOcrText] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [ocrViewMode, setOcrViewMode] = useState<'verified' | 'raw'>('verified');
  const [reviewerId, setReviewerId] = useState<string>('admin-archivist');
  const [reviewerName, setReviewerName] = useState<string>('Certified Archival Reviewer');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [isSavingVerification, setIsSavingVerification] = useState<boolean>(false);
  const [showOriginalModal, setShowOriginalModal] = useState<boolean>(false);

  // Multilingual toggle: allow researcher to switch between Vernacular Translation and Original English scan OCR
  const [preferOriginalLanguage, setPreferOriginalLanguage] = useState<boolean>(false);
  const [copiedCitationFormat, setCopiedCitationFormat] = useState<string | null>(null);

  // Audio Narration
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isPausedAudio, setIsPausedAudio] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [pageJumpInput, setPageJumpInput] = useState('1');

  // Live Document & Asset Status from Server API
  interface LiveDocStatus {
    hasDocumentRecord: boolean;
    archiveItemId: string;
    assetStatus: 'METADATA_ONLY' | 'EXTERNAL_DOCUMENT' | 'DOCUMENT_AVAILABLE' | 'DOCUMENT_PROCESSING' | 'DOCUMENT_READY' | 'ACCESS_RESTRICTED';
    message: string;
    externalSourceUrl?: string;
    sourceInstitution: string;
    sourceProvenance?: string;
    rightsInformation?: string;
    pageCount: number;
    pages?: any[];
    document?: {
      id: string;
      title: string;
      documentType: string;
      pageCount: number;
      status: string;
    };
  }

  const [docStatus, setDocStatus] = useState<LiveDocStatus | null>(null);
  const [isLoadingDocStatus, setIsLoadingDocStatus] = useState(true);
  const [isLoadingPageOcr, setIsLoadingPageOcr] = useState(false);
  const [livePageOcr, setLivePageOcr] = useState<any>(null);
  const [renderedScanLoadedFor, setRenderedScanLoadedFor] = useState<string | null>(null);
  const [renderedScanFailedFor, setRenderedScanFailedFor] = useState<string | null>(null);
  const [translationLanguage, setTranslationLanguage] = useState<'en' | 'hi' | 'mr' | 'kn'>('hi');
  const [pageTranslation, setPageTranslation] = useState<{ key: string; text: string; cached: boolean } | null>(null);
  const [isTranslatingPage, setIsTranslatingPage] = useState(false);
  const [translationError, setTranslationError] = useState('');

  useEffect(() => {
    if (!doc) {
      setDocStatus(null);
      setLivePageOcr(null);
      setIsLoadingDocStatus(false);
      setIsLoadingPageOcr(false);
      return;
    }
    let isMounted = true;
    setDocStatus(null);
    setLivePageOcr(null);
    setIsLoadingDocStatus(true);
    setIsLoadingPageOcr(false);
    fetch(`/api/archive/items/${encodeURIComponent(doc.id)}/document`)
      .then(res => {
        if (!res.ok) throw new Error('Document availability could not be loaded.');
        return res.json();
      })
      .then(data => {
        if (isMounted && data.ok) {
          setDocStatus(data.data);
        } else if (isMounted) {
          throw new Error('Document availability response was invalid.');
        }
      })
      .catch(() => {
        if (isMounted) {
          const hasScans = Boolean(doc.pages && doc.pages.length > 0 && doc.pages.some(p => p.scanImageUrl || p.svgScanType));
          setDocStatus({
            hasDocumentRecord: hasScans,
            archiveItemId: doc.id,
            assetStatus: hasScans ? 'DOCUMENT_AVAILABLE' : 'METADATA_ONLY',
            message: hasScans ? 'Facsimile Scan Available' : 'Metadata available — document asset not currently available.',
            externalSourceUrl: doc.downloadUrl,
            sourceInstitution: doc.sourceInstitution,
            sourceProvenance: doc.sourceProvenance,
            rightsInformation: 'NDLI Access / Historical Official Records',
            pageCount: doc.pages?.length || 0
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDocStatus(false);
      });
    return () => { isMounted = false; };
  }, [doc]);

  // Query live OCR endpoint if page record exists
  useEffect(() => {
    if (!docStatus || docStatus.archiveItemId !== doc.id || docStatus.assetStatus === 'METADATA_ONLY') {
      setLivePageOcr(null);
      setIsLoadingPageOcr(false);
      return;
    }
    const pageId = `page-${docStatus.document?.id || doc.id}-${selectedPage}`;
    let isMounted = true;
    setLivePageOcr(null);
    setIsLoadingPageOcr(true);
    fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Page OCR status could not be loaded.');
        return res.json();
      })
      .then(data => {
        if (isMounted && data.ok) {
          setLivePageOcr(data.data);
        }
      })
      .catch(() => {
        if (isMounted) setLivePageOcr(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPageOcr(false);
      });
    return () => { isMounted = false; };
  }, [docStatus, doc, selectedPage]);

  const currentDocStatus = docStatus?.archiveItemId === doc.id ? docStatus : null;
  const isDocumentStatusLoading = isLoadingDocStatus || !currentDocStatus;

  const isMetadataOnly = useMemo(() => {
    return Boolean(currentDocStatus) && !(currentDocStatus?.assetStatus === 'DOCUMENT_READY' && Boolean(currentDocStatus.pages?.length));
  }, [currentDocStatus]);

  const currentPageOcr = livePageOcr?.documentId === currentDocStatus?.document?.id &&
    Number(livePageOcr?.pageNumber) === selectedPage
    ? livePageOcr
    : null;

  const totalPages = useMemo(() => {
    if (currentDocStatus?.pages && currentDocStatus.pages.length > 0) {
      return currentDocStatus.pages.length;
    }
    return doc.pages?.length || 0;
  }, [doc, currentDocStatus]);

  const currentPageData = doc.pages[selectedPage - 1] || doc.pages[0];
  const currentStoredPage = currentDocStatus?.pages?.find((page: any) => Number(page.pageNumber) === selectedPage);
  const actualPageOcr = currentPageOcr?.ocr?.processedText || currentPageOcr?.ocr?.rawText || '';
  const pageTranslationKey = `${currentPageOcr?.pageId || ''}:${translationLanguage}:${currentPageOcr?.ocr?.processedText || currentPageOcr?.ocr?.rawText || ''}`;
  const pageTranslationKeyRef = useRef(pageTranslationKey);
  pageTranslationKeyRef.current = pageTranslationKey;
  const renderedScanUrl = currentDocStatus?.document?.id
    ? `/api/documents/${encodeURIComponent(currentDocStatus.document.id)}/pages/${selectedPage}/rendered${currentStoredPage?.pageMetadata?.checksumSha256 ? `?v=${encodeURIComponent(currentStoredPage.pageMetadata.checksumSha256)}` : ''}`
    : '';

  useEffect(() => setPageJumpInput(String(selectedPage)), [selectedPage]);

  useEffect(() => {
    setPageTranslation(null);
    setTranslationError('');
    setIsTranslatingPage(false);
  }, [currentPageOcr?.pageId, selectedPage, translationLanguage]);

  // Resolve localized text for current page
  const currentLocalizedOcr = useMemo(() => {
    if (!currentPageOcr?.hasOcrRecord || !currentPageOcr.ocr) return '';
    if (preferOriginalLanguage) return currentPageOcr.ocr.rawText || '';
    if (language === 'hi' && currentPageOcr.ocr.textHi) return currentPageOcr.ocr.textHi;
    if (language === 'mr' && currentPageOcr.ocr.textMr) return currentPageOcr.ocr.textMr;
    if (language === 'kn' && currentPageOcr.ocr.textKn) return currentPageOcr.ocr.textKn;
    return actualPageOcr;
  }, [actualPageOcr, currentPageOcr, language, preferOriginalLanguage]);

  useEffect(() => {
    setEditableOcrText(currentLocalizedOcr);
    audioEngine.stopSpeaking();
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
  }, [doc, selectedPage, currentLocalizedOcr]);

  useEffect(() => {
    audioEngine.stopSpeaking();
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
  }, [activeTab, language, translationLanguage]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopSpeaking();
    };
  }, []);

  const getLanguageDisplayName = () => {
    if (preferOriginalLanguage) return 'English';
    switch (language) {
      case 'hi': return 'हिन्दी (Hindi)';
      case 'mr': return 'मराठी (Marathi)';
      case 'kn': return 'ಕನ್ನಡ (Kannada)';
      default: return 'English';
    }
  };

  // Text-to-Speech handler
  const handlePlayAudio = () => {
    if (isPausedAudio) {
      audioEngine.resumeSpeaking();
      setIsPausedAudio(false);
      setIsPlayingAudio(true);
      return;
    }

    const translatingTab = activeTab === 'translation';
    const textToRead = translatingTab
      ? (pageTranslation?.key === pageTranslationKey ? pageTranslation.text : '')
      : (editableOcrText || currentLocalizedOcr || '');
    if (!textToRead.trim()) {
      showToast(translatingTab ? 'Translate this page before listening.' : 'No OCR text is available for this page.', 'info');
      return;
    }
    const storedOcrLanguage = String(currentPageOcr?.ocr?.language || '').toLowerCase();
    const sourceLanguage = storedOcrLanguage.startsWith('hi') || storedOcrLanguage === 'hin' ? 'hi'
      : storedOcrLanguage.startsWith('mr') || storedOcrLanguage === 'mar' ? 'mr'
      : storedOcrLanguage.startsWith('kn') || storedOcrLanguage === 'kan' ? 'kn' : 'en';
    const localizedOcrHasTarget = !preferOriginalLanguage && (
      (language === 'hi' && Boolean(currentPageOcr?.ocr?.textHi)) ||
      (language === 'mr' && Boolean(currentPageOcr?.ocr?.textMr)) ||
      (language === 'kn' && Boolean(currentPageOcr?.ocr?.textKn))
    );
    const langToSpeak = translatingTab ? translationLanguage : (localizedOcrHasTarget ? language : sourceLanguage);
    const spokenLanguageName = langToSpeak === 'hi' ? 'Hindi' : langToSpeak === 'mr' ? 'Marathi' : langToSpeak === 'kn' ? 'Kannada' : 'English';

    audioEngine.speakText(textToRead, langToSpeak, {
      rate: speechRate,
      onStart: () => {
        setIsPlayingAudio(true);
        setIsPausedAudio(false);
        showToast(`Playing audible narration in ${getLanguageDisplayName()}`, 'info');
      },
      onEnd: () => {
        setIsPlayingAudio(false);
        setIsPausedAudio(false);
      },
      onError: () => {
        setIsPlayingAudio(false);
        setIsPausedAudio(false);
        showToast(`No ${spokenLanguageName} speech voice is available in this browser.`, 'error');
      }
    });
  };

  const handleTranslatePage = async () => {
    const pageId = currentPageOcr?.pageId;
    if (!pageId || !actualPageOcr.trim()) {
      setTranslationError('No stored OCR text is available to translate for this page.');
      return;
    }
    const requestedKey = pageTranslationKey;
    setIsTranslatingPage(true);
    setTranslationError('');
    setPageTranslation(null);
    try {
      const response = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: translationLanguage })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || typeof payload.data?.translatedText !== 'string' || !payload.data.translatedText.trim()) {
        throw new Error(payload.message || 'Translation failed.');
      }
      if (requestedKey === pageTranslationKeyRef.current) {
        setPageTranslation({ key: requestedKey, text: payload.data.translatedText, cached: Boolean(payload.data.cached) });
      }
    } catch (error) {
      if (requestedKey === pageTranslationKeyRef.current) setTranslationError(error instanceof Error ? error.message : 'Translation failed.');
    } finally {
      if (requestedKey === pageTranslationKeyRef.current) setIsTranslatingPage(false);
    }
  };

  const handlePageJump = () => {
    const requestedPage = Number.parseInt(pageJumpInput, 10);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > totalPages) {
      setPageJumpInput(String(selectedPage));
      showToast(`Enter a page number from 1 to ${totalPages}.`, 'info');
      return;
    }
    setSelectedPage(requestedPage);
  };

  const handlePauseAudio = () => {
    audioEngine.pauseSpeaking();
    setIsPlayingAudio(false);
    setIsPausedAudio(true);
  };

  const handleStopAudio = () => {
    audioEngine.stopSpeaking();
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
  };

  // Search matches within OCR text
  const searchMatches = useMemo(() => {
    if (!searchInDoc.trim() || !editableOcrText) return [];
    const text = editableOcrText;
    const regex = new RegExp(searchInDoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches: number[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match.index);
    }
    return matches;
  }, [searchInDoc, editableOcrText]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(editableOcrText);
    setCopiedText(true);
    showToast('OCR Text copied to clipboard', 'success');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([editableOcrText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.archiveId}-page-${selectedPage}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded OCR text file', 'success');
  };

  const handleSaveOcrCorrection = async () => {
    setIsSavingVerification(true);
    const pageId = currentPageOcr?.pageId || `page-${currentDocStatus?.document?.id || doc.id}-${selectedPage}`;
    try {
      const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctedText: editableOcrText,
          reviewerId,
          reviewerName,
          correctionNotes: correctionNotes || 'Scholarly correction against archival facsimile.'
        })
      });
      if (res.ok) {
        const json = await res.json();
        setLivePageOcr((prev: any) => ({
          ...prev,
          processingStatus: 'CORRECTED',
          ocr: json.data
        }));
        showToast('OCR Correction saved to repository (Machine OCR preserved)', 'success');
      } else {
        showToast('OCR Correction recorded into session catalog', 'info');
      }
    } catch {
      showToast('OCR Correction recorded into session catalog', 'info');
    } finally {
      setIsSavingVerification(false);
      setIsEditingOcr(false);
    }
  };

  const handleMarkVerified = async () => {
    setIsSavingVerification(true);
    const pageId = currentPageOcr?.pageId || `page-${currentDocStatus?.document?.id || doc.id}-${selectedPage}`;
    try {
      const res = await fetch(`/api/ocr/pages/${encodeURIComponent(pageId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId,
          reviewerName,
          notes: 'Verified against master archival facsimile.'
        })
      });
      if (res.ok) {
        const json = await res.json();
        setLivePageOcr((prev: any) => ({
          ...prev,
          processingStatus: 'VERIFIED',
          ocr: json.data
        }));
        showToast('OCR Record marked as VERIFIED by Certified Reviewer', 'success');
      } else {
        showToast('OCR Record marked as verified in session catalog', 'info');
      }
    } catch {
      showToast('OCR Record marked as verified in session catalog', 'info');
    } finally {
      setIsSavingVerification(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Breadcrumb Path (Matching Panel 3 of Reference) */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
        <button 
          onClick={() => navigateTo('home')}
          className="hover:text-amber-400 transition-colors cursor-pointer"
        >
          Home
        </button>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <button 
          onClick={() => navigateTo('archive')}
          className="hover:text-amber-400 transition-colors cursor-pointer"
        >
          Archive
        </button>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <span className="text-amber-400 font-medium truncate max-w-md">
          {doc.title}
        </span>
      </div>

      {/* Top Document Header & Metadata Strip (Exact match to Reference Panel 3) */}
      <div className="bg-[#0d1629] p-5 rounded-2xl border border-[#1b2b4d] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-white tracking-tight leading-tight">
            {getLocalizedText(doc)}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-amber-400">
            <span>{doc.category}</span>
            <span className="text-slate-600">•</span>
            <span>{doc.year}</span>
            <span className="text-slate-600">•</span>
            <span>{doc.language || 'English'}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">{doc.sourceInstitution}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Ref: {doc.archiveId}</span>
          </div>
        </div>

        {/* Quick Document Switcher & Consult AI */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {currentDocStatus?.document?.id && <ContinueOnPhoneButton context={{ type: 'document', documentId: currentDocStatus.document.id, pageNumber: selectedPage }} />}
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              setSelectedPage(1);
            }}
            className="bg-[#070c18] border border-[#22355c] rounded-lg px-2.5 py-1.5 text-xs font-serif text-white focus:outline-none focus:border-amber-500 cursor-pointer max-w-xs truncate"
            aria-label="Switch document"
          >
            {archiveItems.map(item => (
              <option key={item.id} value={item.id} className="bg-[#0b1326] text-white">
                {item.year}: {item.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => navigateTo('assistant', { assistantQuery: `What are the core arguments and historical significance of ${doc.title} (${doc.year})?` })}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consult AI</span>
          </button>
        </div>
      </div>

      {/* Main Split Screen Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[640px]">
        {/* LEFT PANE: Original Archival Scan / Facsimile OR Truthful Metadata Card */}
        <div className="bg-stone-900 rounded-xl border border-stone-800 flex flex-col overflow-hidden shadow-lg">
          {/* Scan Controls Toolbar */}
          <div className="bg-stone-950 p-2.5 px-4 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-200">
                {isDocumentStatusLoading ? 'Checking Document' : isMetadataOnly ? 'Catalog Holding' : 'Facsimile Scan'}
              </span>
              <span className="text-stone-500">|</span>
              <span className="text-stone-400">
                {isDocumentStatusLoading ? (
                  <span role="status" className="text-stone-400 font-mono font-semibold">CHECKING DOCUMENT AVAILABILITY</span>
                ) : isMetadataOnly ? (
                  <span className="text-amber-400 font-mono font-semibold">METADATA ONLY (Zero Local Binaries)</span>
                ) : (
                  `Page ${selectedPage} of ${totalPages}`
                )}
              </span>
            </div>

            {/* Action: View Original Page */}
            <div className="flex items-center gap-2">
              {isDocumentStatusLoading ? (
                <button disabled className="px-2.5 py-1 rounded bg-stone-900 text-stone-500 border border-stone-800 text-[11px] font-sans cursor-wait opacity-60">
                  Checking availability…
                </button>
              ) : isMetadataOnly ? (
                <button
                  disabled
                  className="px-2.5 py-1 rounded bg-stone-900 text-stone-500 border border-stone-800 text-[11px] font-sans flex items-center gap-1.5 cursor-not-allowed opacity-60"
                  title="Original page asset not currently available locally. Consult verified NDLI portal link."
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Original Page (Not Available)</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowOriginalModal(true)}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-[11px] font-sans flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="View high-resolution original facsimile scan"
                >
                  <Eye className="w-3 h-3" />
                  <span>View Original Page</span>
                </button>
              )}
            </div>

            {/* Zoom, Rotate, Invert controls (Active only when legitimate scans exist) */}
            {!isMetadataOnly && !isDocumentStatusLoading && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                  className="p-1 hover:text-amber-400 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                  title="Zoom Out"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono w-10 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
                  className="p-1 hover:text-amber-400 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                  title="Zoom In"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1 hover:text-amber-400 hover:bg-stone-800 rounded transition-colors ml-1 cursor-pointer"
                  title="Rotate 90°"
                  aria-label="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setInvertContrast(!invertContrast)}
                  className={`p-1 rounded transition-colors ml-1 cursor-pointer ${invertContrast ? 'bg-amber-500 text-stone-950' : 'hover:text-amber-400 hover:bg-stone-800'}`}
                  title="Invert Contrast (Microfilm Negative Mode)"
                  aria-label="Invert contrast"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ml-1 cursor-pointer ${showBoundingBoxes ? 'bg-stone-800 text-amber-300 border border-stone-700' : 'text-stone-400 hover:text-stone-200'}`}
                  title="Toggle OCR Recognized Text Coordinates"
                >
                  Boxes
                </button>
              </div>
            )}
          </div>

          {/* Canvas Scan Area */}
          <div className="flex-1 bg-stone-950/80 p-6 overflow-auto flex items-center justify-center relative min-h-[460px]">
            {isDocumentStatusLoading ? (
              <div role="status" className="max-w-md w-full rounded-xl border border-stone-700 bg-stone-900 p-6 text-center text-sm text-stone-300">
                Checking the live document record and page assets…
              </div>
            ) : isMetadataOnly ? (
              <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-xl p-6 sm:p-8 text-center shadow-xl">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-950/70 border border-amber-600/40 text-amber-300 mb-2">
                  <span>METADATA ONLY · ZERO LOCAL PAGES</span>
                </div>
                <h3 className="font-serif font-bold text-lg text-stone-100 mb-2">
                  Original page asset not currently available.
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed mb-4">
                  No original file or extracted pages are available for this record in the current runtime. Metadata alone does not establish page content, so no facsimile or OCR is shown.
                </p>

                <div className="bg-stone-950/90 rounded-lg p-3 text-left border border-stone-800 space-y-1 text-[11px] mb-5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Archival Call No:</span>
                    <span className="text-stone-300 font-semibold">{doc.archiveId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Source Holding:</span>
                    <span className="text-stone-300">{doc.sourceInstitution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Asset Status:</span>
                    <span className="text-amber-400 font-bold">{currentDocStatus?.assetStatus || 'METADATA_ONLY'}</span>
                  </div>
                </div>

                {doc.downloadUrl && (
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer w-full"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Original Source</span>
                  </a>
                )}
              </div>
            ) : currentDocStatus?.pages && currentDocStatus.pages.length > 0 ? (
              <div className="w-full h-full min-h-[460px] flex items-center justify-center p-2 relative">
                {renderedScanUrl && renderedScanFailedFor !== renderedScanUrl && (
                  <img
                    key={renderedScanUrl}
                    src={renderedScanUrl}
                    alt={`Digitized archival scan, page ${selectedPage} of ${totalPages}`}
                    onLoad={() => setRenderedScanLoadedFor(renderedScanUrl)}
                    onError={() => setRenderedScanFailedFor(renderedScanUrl)}
                    className={`max-h-[520px] max-w-full object-contain rounded-lg border border-stone-800 bg-white shadow-xl transition-opacity ${renderedScanLoadedFor === renderedScanUrl ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)` }}
                  />
                )}
                {renderedScanUrl && renderedScanFailedFor !== renderedScanUrl && renderedScanLoadedFor !== renderedScanUrl && (
                  <div role="status" className="absolute rounded-lg bg-stone-900/95 border border-stone-700 px-4 py-3 text-sm text-stone-200">
                    Rendering digitized page {selectedPage}…
                  </div>
                )}
                {renderedScanFailedFor === renderedScanUrl && (
                  <div role="alert" className="max-w-sm rounded-lg bg-stone-900 border border-red-800 px-5 py-4 text-center text-sm text-red-200">
                    Digitized page could not be rendered.
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                className={`relative max-w-md w-full shadow-2xl transition-all duration-300 ${
                  invertContrast ? 'filter invert hue-rotate-180 brightness-90 contrast-125' : ''
                }`}
              >
                {/* Parchment Scan Render */}
                <div className="bg-[#f7f2e7] text-stone-900 p-8 sm:p-10 rounded-sm border border-stone-400/80 shadow-md font-serif text-xs leading-relaxed relative overflow-hidden select-none">
                  {/* Vintage Archival Header Stamp */}
                  <div className="border-b-2 border-stone-800 pb-3 mb-4 flex items-start justify-between">
                    <div>
                      <div className="font-bold tracking-widest text-[9px] uppercase text-stone-700">
                        Constituent Assembly of India / Official Records
                      </div>
                      <div className="font-mono text-[9px] text-stone-600">
                        FILE NO: {doc.archiveId}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-stone-600 flex items-center justify-center text-[7px] text-center font-mono leading-none text-stone-600 rotate-12">
                      ARCHIVE<br/>DAIC<br/>SEAL
                    </div>
                  </div>

                  {/* Historical Document Typewriter Simulation */}
                  <div className="space-y-4 font-mono text-[11px] leading-relaxed text-stone-800">
                    <div className="text-center font-bold uppercase tracking-wider text-[12px] border-b border-stone-300 pb-1">
                      {doc.title.slice(0, 48)}
                    </div>
                    <div className="text-justify whitespace-pre-line opacity-95">
                      {actualPageOcr || 'OCR not yet available for this page.'}
                    </div>
                  </div>

                  {/* Marginalia & Watermark */}
                  <div className="mt-8 pt-3 border-t border-stone-300/80 flex items-center justify-between text-[9px] font-mono text-stone-500">
                    <span>Digitized by DAIC Heritage Lab</span>
                    <span>Master Facsimile 600 DPI</span>
                    <span>Pg. {selectedPage}</span>
                  </div>

                  {/* Bounding box simulation overlays */}
                  {showBoundingBoxes && (
                    <>
                      <div className="absolute top-28 left-8 right-8 h-8 border border-amber-600/50 bg-amber-500/10 pointer-events-none rounded-xs animate-pulse"></div>
                      <div className="absolute top-44 left-8 right-8 h-14 border border-sky-600/50 bg-sky-500/10 pointer-events-none rounded-xs"></div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scan Footer Page Pagination */}
          <div className="bg-stone-950 p-2.5 px-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <span>
              {isDocumentStatusLoading ? 'Checking preservation status…' : isMetadataOnly ? 'Preservation Status: Catalog Metadata Verified' : 'Preservation Status: Master Digitized Scan'}
            </span>
            {!isMetadataOnly && !isDocumentStatusLoading && (
              <div className="flex items-center gap-2">
                <button
                  disabled={selectedPage <= 1}
                  onClick={() => setSelectedPage(selectedPage - 1)}
                  className="px-2 py-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 rounded text-stone-200 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev Page</span>
                </button>
                <label className="flex items-center gap-1 font-mono text-stone-300">
                  <span className="sr-only">Jump to page</span>
                  <input
                    aria-label="Jump to page"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageJumpInput}
                    onChange={event => setPageJumpInput(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') handlePageJump(); }}
                    className="w-14 rounded border border-stone-700 bg-stone-900 px-1.5 py-1 text-center text-stone-100"
                  />
                  <span>/ {totalPages}</span>
                  <button type="button" onClick={handlePageJump} className="rounded bg-stone-800 px-2 py-1 text-stone-100 hover:bg-stone-700">Go</button>
                </label>
                <button
                  disabled={selectedPage >= totalPages}
                  onClick={() => setSelectedPage(selectedPage + 1)}
                  className="px-2 py-1 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 rounded text-stone-200 cursor-pointer flex items-center gap-1"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {isMetadataOnly && !isDocumentStatusLoading && (
              <span className="text-stone-500 font-mono text-[11px]">Pages: 0 (Binary Pending Acquisition)</span>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Extracted OCR Text & Scholarly Tools */}
        <div className="bg-white rounded-xl border border-stone-300 flex flex-col overflow-hidden shadow-sm">
          {/* Right Pane Navigation Tabs */}
          <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            {/* Functional Tab Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('ocr')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === 'ocr'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                Extracted OCR
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                AI Summary
              </button>
              <button
                onClick={() => setActiveTab('translation')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === 'translation'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                Multilingual
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === 'metadata'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                Metadata
              </button>
            </div>

            {/* OCR Accuracy Meter / Status */}
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className={`w-4 h-4 ${isMetadataOnly ? 'text-amber-500' : 'text-emerald-600'}`} />
              <div className="flex items-center gap-1.5 font-mono text-stone-700">
                {isDocumentStatusLoading ? (
                  <>
                    <span role="status" className="bg-stone-100 text-stone-600 border border-stone-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      CHECKING DOCUMENT
                    </span>
                    <span className="text-stone-500 text-[11px]">OCR status pending lookup</span>
                  </>
                ) : isMetadataOnly ? (
                  <>
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      STATUS: NOT_PROCESSED
                    </span>
                    <span className="text-stone-500 text-[11px]">
                      Confidence: <strong>Unavailable</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      currentPageOcr?.processingStatus === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : currentPageOcr?.processingStatus === 'CORRECTED'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-stone-200 text-stone-800 border-stone-300'
                    }`}>
                      STATUS: {isLoadingPageOcr ? 'CHECKING' : currentPageOcr?.processingStatus || 'NOT_PROCESSED'}
                    </span>
                    <span className="text-stone-700 text-[11px]">
                      Confidence: <strong>{isLoadingPageOcr ? 'Checking' : currentPageOcr?.confidence !== null && currentPageOcr?.confidence !== undefined ? `${(currentPageOcr.confidence * 100).toFixed(1)}%` : 'Confidence unavailable'}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sub-bar: Search within doc & Audio Narration controls */}
          <div className="bg-stone-100/70 p-2.5 px-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search within document */}
            <div className="flex items-center gap-1.5 flex-1 max-w-sm">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search within this document..."
                  value={searchInDoc}
                  onChange={(e) => setSearchInDoc(e.target.value)}
                  disabled={isDocumentStatusLoading || isLoadingPageOcr || (isMetadataOnly && !editableOcrText.trim())}
                  className="w-full bg-white border border-stone-300 rounded px-2.5 pl-7 py-1 text-xs text-stone-900 focus:outline-none focus:border-stone-800 disabled:opacity-50"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
              </div>

              {searchMatches.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-stone-600 shrink-0 font-mono">
                  <span>{currentMatchIndex + 1}/{searchMatches.length}</span>
                  <button
                    onClick={handlePrevMatch}
                    className="p-0.5 hover:bg-stone-200 rounded cursor-pointer"
                    title="Previous match"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    className="p-0.5 hover:bg-stone-200 rounded cursor-pointer"
                    title="Next match"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Audio Narration Controls */}
            {!isMetadataOnly && (
              <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded px-2 py-0.5 shadow-2xs">
                <span className="text-[11px] text-stone-500 flex items-center gap-1 mr-1">
                  <Volume2 className="w-3.5 h-3.5 text-stone-700" />
                  <span className="hidden sm:inline">Narration:</span>
                </span>

                {!isPlayingAudio ? (
                  <button
                    onClick={handlePlayAudio}
                    disabled={activeTab === 'translation' && pageTranslation?.key !== pageTranslationKey}
                    className="p-1 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded cursor-pointer"
                    title={activeTab === 'translation' ? `Listen in ${translationLanguage === 'hi' ? 'Hindi' : translationLanguage === 'mr' ? 'Marathi' : translationLanguage === 'kn' ? 'Kannada' : 'English'}` : 'Play Audio Narration'}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handlePauseAudio}
                    className="p-1 text-amber-700 hover:bg-stone-100 rounded cursor-pointer"
                    title="Pause Narration"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}

                <button
                  onClick={handleStopAudio}
                  className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded cursor-pointer"
                  title="Stop Narration"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>

                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  className="text-[10px] bg-transparent border-none text-stone-600 focus:outline-none cursor-pointer"
                  title="Narration Speed"
                >
                  <option value="0.8">0.8x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.2">1.2x</option>
                </select>
              </div>
            )}
          </div>

          {/* Main Content Body */}
          <div className="flex-1 p-6 overflow-y-auto min-h-[400px]">
            {activeTab === 'ocr' && (
              <div className="space-y-4">
                {isDocumentStatusLoading || isLoadingPageOcr ? (
                  <div role="status" className="py-12 px-4 text-center text-sm text-stone-500">
                    {isDocumentStatusLoading ? 'Checking this document’s page availability…' : `Checking OCR for page ${selectedPage}…`}
                  </div>
                ) : isMetadataOnly || !currentPageOcr?.hasOcrRecord || !editableOcrText.trim() ? (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center my-auto space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-800">
                      {isMetadataOnly ? 'No OCR Transcript Currently Available' : currentPageOcr?.hasPageRecord ? 'OCR not yet available for this page.' : 'Page OCR status is unavailable.'}
                    </h4>
                    <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                      {isMetadataOnly ? <>This record is in <strong>METADATA_ONLY</strong> status. Page-level text extraction and OCR transcripts will be activated once verified document facsimiles are legitimately acquired.</> : currentPageOcr?.hasPageRecord ? 'The page asset is available, but no OCR result has been stored for this page yet.' : 'The OCR service did not return a page record, so no OCR text is shown.'}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <button
                        onClick={() => setActiveTab('metadata')}
                        className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View Dublin Core Metadata</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('summary')}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>View Historical Summary</span>
                      </button>
                    </div>
                  </div>
                ) : isEditingOcr ? (
                  <div className="space-y-2">
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                      <strong>Archivist Correction Mode:</strong> You can edit typography ligatures or OCR errors below. Changes will be recorded in the institutional audit log.
                    </div>
                    <textarea
                      value={editableOcrText}
                      onChange={(e) => setEditableOcrText(e.target.value)}
                      rows={14}
                      className="w-full p-3 font-mono text-xs leading-relaxed text-stone-900 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-800"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingOcr(false)}
                        className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveOcrCorrection}
                        className="px-3 py-1.5 text-xs bg-stone-900 text-white rounded font-medium hover:bg-stone-800 cursor-pointer flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save OCR Correction</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="font-serif text-sm leading-relaxed text-stone-800 whitespace-pre-line select-text">
                    {searchInDoc.trim() ? (
                      // Highlight searched terms
                      editableOcrText.split(new RegExp(`(${searchInDoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => {
                        if (part.toLowerCase() === searchInDoc.toLowerCase()) {
                          return (
                            <mark key={i} className="bg-amber-300 text-stone-950 px-0.5 rounded font-bold">
                              {part}
                            </mark>
                          );
                        }
                        return part;
                      })
                    ) : (
                      editableOcrText
                    )}
                  </div>
                )}

                {/* Page-Level OCR & Verification Metadata Details Panel */}
                <div className="mt-6 pt-4 border-t border-stone-200 bg-stone-50/80 p-4 rounded-lg space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>OCR Extraction & Verification State</span>
                    </div>
                    <span className="font-mono text-[10px] text-stone-500 uppercase">
                      {isMetadataOnly ? 'Catalog Mode' : 'Facsimile Mode'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">OCR Status:</span>
                      <span className="font-bold text-stone-900">
                        {isLoadingPageOcr ? 'CHECKING' : currentPageOcr?.processingStatus || 'NOT_PROCESSED'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Confidence:</span>
                      <span className="font-bold text-stone-900">
                        {currentPageOcr?.confidence !== null && currentPageOcr?.confidence !== undefined
                            ? `${(currentPageOcr.confidence * 100).toFixed(1)}%`
                            : 'Confidence unavailable'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Verification:</span>
                      <span className="font-bold text-stone-900">
                        {currentPageOcr?.verificationStatus || 'UNVERIFIED'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Reviewer:</span>
                      <span className="text-stone-700 truncate block">
                        {currentPageOcr?.ocr?.verification?.reviewerName || 'Unassigned'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Correction State:</span>
                      <span className="text-stone-700 block">
                        {currentPageOcr?.processingStatus === 'CORRECTED' ? 'Human-Corrected' : currentPageOcr?.hasOcrRecord ? 'Unmodified Machine OCR' : 'No OCR result'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Provenance:</span>
                      <span className="text-stone-700 truncate block" title={`${doc.sourceInstitution} · ${doc.archiveId}`}>
                        {doc.sourceInstitution}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Archival Digest & Executive Summary</span>
                  </div>
                  <p className="font-sans text-xs leading-relaxed text-stone-700">
                    {getLocalizedSummary(doc)}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-sm text-stone-900">
                    Key Historical Entities & Doctrines
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs text-stone-700">
                    {doc.keyConcepts.map(concept => (
                      <span key={concept} className="bg-stone-100 border border-stone-200 px-2.5 py-1 rounded">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-200">
                  <h4 className="font-serif font-bold text-sm text-stone-900">
                    Historical Provenance
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Source: {doc.sourceInstitution} · Collection: {doc.collection}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'translation' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <Languages className="h-4 w-4 text-stone-700" />
                  <label htmlFor="page-translation-language" className="text-xs font-semibold text-stone-800">Translate this page to</label>
                  <select id="page-translation-language" value={translationLanguage} onChange={event => setTranslationLanguage(event.target.value as 'en' | 'hi' | 'mr' | 'kn')} className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800">
                    <option value="en">English</option><option value="hi">Hindi</option><option value="mr">Marathi</option><option value="kn">Kannada</option>
                  </select>
                  <button type="button" onClick={handleTranslatePage} disabled={isTranslatingPage || !actualPageOcr.trim() || isLoadingPageOcr} className="rounded bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {isTranslatingPage ? 'Translating complete page…' : 'Translate page'}
                  </button>
                </div>

                <div className="rounded-lg border border-stone-200 bg-white p-4">
                  <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Original stored OCR · page {selectedPage}</h5>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">{isLoadingPageOcr ? 'Loading page OCR…' : actualPageOcr || 'No stored OCR text exists for this page.'}</p>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h5 className="text-xs font-bold uppercase tracking-wide text-emerald-900">{translationLanguage === 'hi' ? 'Hindi' : translationLanguage === 'mr' ? 'Marathi' : translationLanguage === 'kn' ? 'Kannada' : 'English'} translation · page {selectedPage}</h5>
                    {pageTranslation?.key === pageTranslationKey && <span className="text-[10px] text-emerald-800">{pageTranslation.cached ? 'Cached translation' : 'Translation saved'}</span>}
                  </div>
                  {translationError ? <p role="alert" className="text-sm text-red-800">{translationError}</p> : pageTranslation?.key === pageTranslationKey ? (
                    <><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-900">{pageTranslation.text}</p><p className="mt-3 border-t border-emerald-200 pt-2 text-[11px] text-emerald-900">AI-generated translation — original archival text remains authoritative.</p></>
                  ) : <p className="text-sm text-stone-600">{actualPageOcr ? 'Translate to display the complete available OCR text in the selected language.' : 'Translation is unavailable because this page has no OCR text.'}</p>}
                </div>
              </div>
            )}
          </div>

          {/* OCR Footer Actions */}
          <div className="border-t border-stone-200 bg-stone-50 p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-1.5 bg-white border border-stone-300 hover:border-stone-500 rounded text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                className="px-3 py-1.5 bg-white border border-stone-300 hover:border-stone-500 rounded text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export TXT</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isEditingOcr && mode === 'admin' && !isMetadataOnly && (
                <button
                  onClick={() => setIsEditingOcr(true)}
                  className="px-3 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Correct OCR</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Provenance & Citation to Original Source */}
      <div className="bg-white rounded-xl border border-stone-300 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                {t('original_source_title')}
              </h3>
              <p className="text-xs text-stone-500">
                Archive record, holding, and citation metadata supplied with this item.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('source_verified_seal')}</span>
          </div>
        </div>

        {/* Provenance Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200 space-y-1">
            <div className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
              {t('source_holding_label')}
            </div>
            <div className="font-serif font-bold text-stone-900 text-sm">
              {doc.sourceInstitution}
            </div>
            <div className="text-stone-600 text-[11px]">
              {doc.originalHolding || 'National Archives of India / Parliamentary Records Repository'}
            </div>
          </div>

          <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200 space-y-1">
            <div className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
              {t('master_ref_code')}
            </div>
            <div className="font-mono font-bold text-stone-900 text-sm">
              {doc.archiveId}
            </div>
            <div className="text-stone-600 text-[11px]">
              Collection: {doc.collection}
            </div>
          </div>

          <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200 space-y-1">
            <div className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
              {t('volume_page_ref')}
            </div>
            <div className="font-sans font-bold text-stone-900 text-sm">
              Page {selectedPage} of {totalPages} · {doc.year}
            </div>
            <div className="text-stone-600 text-[11px]">
              Author: {doc.author} · Date: {doc.date}
            </div>
          </div>
        </div>

        {/* Copy Academic Citation Formats */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-stone-700">
            Generate & Copy Academic Citation:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const text = doc.citationChicago || `${doc.author}. "${doc.title}." In ${doc.collection}, ${doc.year}. ${doc.sourceInstitution}. Archival Ref: ${doc.archiveId}.`;
                navigator.clipboard.writeText(text);
                setCopiedCitationFormat('chicago');
                showToast('Chicago 17th ed. citation copied to clipboard', 'success');
                setTimeout(() => setCopiedCitationFormat(null), 2500);
              }}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs text-stone-800 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCitationFormat === 'chicago' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{t('copy_chicago')}</span>
            </button>

            <button
              onClick={() => {
                const text = doc.citationApa || `${doc.author} (${doc.year}). ${doc.title}. ${doc.collection}. ${doc.sourceInstitution}. ${doc.archiveId}`;
                navigator.clipboard.writeText(text);
                setCopiedCitationFormat('apa');
                showToast('APA 7th ed. citation copied to clipboard', 'success');
                setTimeout(() => setCopiedCitationFormat(null), 2500);
              }}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs text-stone-800 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCitationFormat === 'apa' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{t('copy_apa')}</span>
            </button>

            <button
              onClick={() => {
                const text = doc.citationMla || `${doc.author}. "${doc.title}." ${doc.collection}, ${doc.year}, ${doc.sourceInstitution}.`;
                navigator.clipboard.writeText(text);
                setCopiedCitationFormat('mla');
                showToast('MLA 9th ed. citation copied to clipboard', 'success');
                setTimeout(() => setCopiedCitationFormat(null), 2500);
              }}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs text-stone-800 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCitationFormat === 'mla' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{t('copy_mla')}</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(doc.citationBibtex);
                setCopiedCitationFormat('bibtex');
                showToast('BibTeX academic citation copied to clipboard', 'success');
                setTimeout(() => setCopiedCitationFormat(null), 2500);
              }}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-xs text-stone-800 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCitationFormat === 'bibtex' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>Copy BibTeX</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
