import React, { useState, useRef, useEffect } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { askArchivalAssistant } from '../../services/aiAssistantService';
import { AssistantMessage } from '../../types/archive';
import { audioEngine } from '../../utils/audioEngine';
import { ContinueOnPhoneButton } from '../common/ContinueOnPhoneButton';
import { 
  Send, 
  Sparkles, 
  RotateCcw, 
  BookOpen, 
  Bookmark, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  ShieldCheck,
  Tag,
  Calendar,
  Layers
} from 'lucide-react';

const SUGGESTED_PROMPTS = {
  en: [
    'What was Dr. Ambedkar\'s definition of Social Democracy in his concluding CAD speech?',
    'Why did Dr. Ambedkar call Article 32 the "Heart and Soul" of the Constitution?',
    'What was Dr. Ambedkar’s thesis on the Problem of the Rupee and the gold standard?',
    'Explain the significance of the Mahad Satyagraha and the Chavadar Tank struggle.'
  ],
  hi: [
    'संविधान सभा के समापन भाषण में डॉ. अम्बेडकर ने सामाजिक लोकतंत्र को कैसे परिभाषित किया?',
    'डॉ. अम्बेडकर ने अनुच्छेद 32 को संविधान का "हृदय और आत्मा" क्यों कहा?',
    'रुपये की समस्या और मुद्रा विनिमय पर डॉ. अम्बेडकर के क्या विचार थे?',
    'महाड सत्याग्रह और चवदार तालाब संघर्ष का क्या ऐतिहासिक महत्व है?'
  ],
  mr: [
    'संविधान सभेच्या समारोपाच्या भाषणात डॉ. आंबेडकरांनी सामाजिक लोकशाहीची व्याख्या कशी केली?',
    'डॉ. आंबेडकरांनी कलम ३२ ला संविधानाचा "आत्मा आणि हृदय" का म्हटले?',
    'रुपयाच्या समस्येवर आणि चलनव्यवस्थेवर डॉ. बाबासाहेबांचे काय विचार होते?',
    'महाड सत्याग्रह आणि चवदार तळ्याच्या ऐतिहासिक लढ्याचे महत्त्व काय आहे?'
  ],
  kn: [
    'ಸಂವಿಧಾನ ಸಭೆಯ ಅಂತಿಮ ಭಾಷಣದಲ್ಲಿ ಡಾ. ಅಂಬೇಡ್ಕರ್ ಅವರು ಸಾಮಾಜಿಕ ಪ್ರಜಾಪ್ರಭುತ್ವವನ್ನು ಹೇಗೆ ವ್ಯಾಖ್ಯಾನಿಸಿದ್ದಾರೆ?',
    'ಡಾ. ಅಂಬೇಡ್ಕರ್ ಅವರು 32 ನೇ ವಿಧಿಯನ್ನು ಸಂವಿಧಾನದ "ಹೃದಯ ಮತ್ತು ಆತ್ಮ" ಎಂದು ಏಕೆ ಕರೆದರು?',
    'ರೂಪಾಯಿಯ ಸಮಸ್ಯೆ ಮತ್ತು ವಿತ್ತೀಯ ನೀತಿಯ ಕುರಿತು ಡಾ. ಅಂಬೇಡ್ಕರ್ ಅವರ ಸಿದ್ಧಾಂತವೇನು?',
    'ಮಹಾದ್ ಸತ್ಯಾಗ್ರಹ ಮತ್ತು ಚವದಾರ್ ಕೆರೆ ಹೋರಾಟದ ಐತಿಹಾಸಿಕ ಮಹತ್ವವೇನು?'
  ]
};

export const AiResearchAssistant: React.FC = () => {
  const { 
    archiveItems, 
    addBookmark, 
    navigateTo, 
    showToast, 
    assistantInitialQuery, 
    setAssistantInitialQuery,
    language,
    t
  } = useArchive();

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Welcome to the ABHILEKH Research Assistant. I search stored page-level OCR and show matching source pages when available. If the archive has no usable OCR for a question, I will say so rather than inventing evidence.

What would you like to research?`,
      timestamp: 'Session Initialized',
      suggestedFollowUps: [
        'Explore the debate on Constitutional Remedies (Article 32)',
        'Examine Dr. Ambedkar\'s definition of Social Democracy',
        'Learn about the economic recommendations for the Reserve Bank of India'
      ]
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retrievalStatus, setRetrievalStatus] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, retrievalStatus]);

  useEffect(() => {
    audioEngine.stopSpeaking();
    setSpeakingMsgId(null);
  }, [language]);

  useEffect(() => {
    if (assistantInitialQuery) {
      const q = assistantInitialQuery;
      setAssistantInitialQuery(null);
      handleSendMessage(q);
    }
  }, [assistantInitialQuery]);

  const handleSendMessage = async (queryText?: string) => {
    const query = (queryText || inputQuery).trim();
    if (!query || isLoading) return;

    setInputQuery('');

    // Append user message
    const userMsg: AssistantMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setRetrievalStatus('Searching stored page-level OCR...');

    try {
      setTimeout(() => {
        setRetrievalStatus('Preparing references from retrieved OCR pages...');
      }, 700);

      const result = await askArchivalAssistant(query, language);

      const aiMsg: AssistantMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: result.sources,
        suggestedFollowUps: result.suggestedFollowUps
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      showToast('Error processing archival inquiry', 'error');
    } finally {
      setIsLoading(false);
      setRetrievalStatus(null);
    }
  };

  const handleResetSession = () => {
    setMessages([messages[0]]);
    showToast('Research assistant session refreshed', 'info');
  };

  // Related Topics and Works (Matching Panel 4 of Reference Design)
  const relatedTopics = [
    'Social Justice',
    'Caste System',
    'Constitutional Rights',
    'Democracy',
    'Article 32',
    'Monetary Reform'
  ];

  const relatedWorks = [
    { title: 'Annihilation of Caste', year: 1936, docId: 'annihilation-of-caste-1936' },
    { title: 'The Problem of the Rupee', year: 1923, docId: 'problem-of-the-rupee-1923' },
    { title: 'States and Minorities', year: 1947, docId: 'cad-1949-closing' },
    { title: 'Castes in India: Their Mechanism', year: 1916, docId: 'castes-in-india-1916' }
  ];

  const relatedEvents = [
    { title: 'Mahad Satyagraha', year: 1927, eventId: 'mahad-satyagraha-1927' },
    { title: 'Poona Pact Negotiations', year: 1932, eventId: 'poona-pact-1932' },
    { title: 'Constituent Assembly Closing Speech', year: 1949, eventId: 'cad-adoption-1949' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Subtitle Header (Panel 4 of Reference Design) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b2b4d] pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            AI Research Assistant
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Ask questions about Dr. Ambedkar's works, constitutional ideas and historical context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ContinueOnPhoneButton context={{
            type: 'research',
            query: [...messages].reverse().find(message => message.role === 'user')?.content || undefined,
            references: [...messages].reverse().find(message => message.role === 'assistant' && message.sources?.length)?.sources?.slice(0, 5).map(source => ({ documentId: source.documentId, pageNumber: source.pageNumber })),
          }} />
          <button
            onClick={handleResetSession}
            className="self-start sm:self-center px-3 py-1.5 bg-[#0d1629] hover:bg-[#152342] text-slate-300 hover:text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-[#1b2b4d]"
            title="Clear session history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Inquiry</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout (Matching Panel 4 of Reference Design) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT / MAIN AREA: Conversation, Answers, Evidentiary Sources (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Suggested Starting Questions */}
          {messages.length <= 1 && (
            <div className="space-y-2 bg-[#0d1629] p-4 rounded-2xl border border-[#1b2b4d]">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono">
                Suggested Research Questions:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(SUGGESTED_PROMPTS[language] || SUGGESTED_PROMPTS.en).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-left p-3 rounded-xl bg-[#070c18] border border-[#1b2b4d] hover:border-amber-500/50 text-xs text-slate-200 transition-all flex items-start justify-between gap-2 cursor-pointer group"
                  >
                    <span className="group-hover:text-amber-400">{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* User Message Bubble */}
                {msg.role === 'user' && (
                  <div className="max-w-xl bg-blue-600 text-white p-4 rounded-2xl rounded-tr-xs text-xs sm:text-sm font-sans leading-relaxed shadow-sm">
                    {msg.content}
                    <div className="text-[10px] text-blue-200 text-right mt-1 font-mono">
                      {msg.timestamp}
                    </div>
                  </div>
                )}

                {/* Assistant Message Bubble */}
                {msg.role === 'assistant' && (
                  <div className="max-w-3xl w-full bg-[#0d1629] border border-[#1b2b4d] p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#1b2b4d] pb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                          अ
                        </div>
                        <span className="font-serif font-bold text-white">Archival Scholar Response</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Audio Narration */}
                        <button
                          onClick={() => {
                            if (speakingMsgId === msg.id) {
                              audioEngine.stopSpeaking();
                              setSpeakingMsgId(null);
                            } else {
                              audioEngine.stopSpeaking();
                              audioEngine.speakText(msg.content, language, {
                                onStart: () => setSpeakingMsgId(msg.id),
                                onEnd: () => setSpeakingMsgId(null),
                                onError: () => setSpeakingMsgId(null)
                              });
                            }
                          }}
                          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer border ${
                            speakingMsgId === msg.id 
                              ? 'bg-amber-600 text-stone-950 border-amber-500 font-bold' 
                              : 'bg-[#070c18] hover:bg-[#121f3d] text-slate-300 border-[#1b2b4d]'
                          }`}
                        >
                          {speakingMsgId === msg.id ? <VolumeX className="w-3.5 h-3.5 text-stone-950" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{speakingMsgId === msg.id ? 'Stop' : 'Listen'}</span>
                        </button>

                        {/* Copy Citation */}
                        <button
                          onClick={() => {
                            const citationText = `ABHILEKH — Ambedkar Bharatiya Heritage & Intellectual Knowledge Hub Archival Response.\n${msg.content}`;
                            navigator.clipboard.writeText(citationText);
                            setCopiedId(msg.id);
                            showToast('Answer & citation copied', 'success');
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                          title="Copy Answer & Citation"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="font-serif text-sm leading-relaxed text-slate-200 whitespace-pre-line select-text">
                      {msg.content}
                    </div>

                    {/* Evidentiary Sources Drawer (Matching Panel 4 of Reference) */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#1b2b4d] space-y-3 bg-[#070c18] p-4 rounded-xl border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                            <span>Evidentiary Archival Sources ({msg.sources.length})</span>
                          </div>
                            <span className="text-[11px] text-slate-400 font-semibold font-mono">
                             Retrieved OCR Evidence
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {msg.sources.map((src, i) => (
                            <div
                              key={i}
                              className="bg-[#0d1629] border border-[#1b2b4d] p-3 rounded-lg text-xs space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400 font-mono">
                                <span className="font-bold text-amber-400">{src.archiveId}</span>
                                <span>Page {src.pageNumber}</span>
                              </div>

                              <h5 className="font-serif font-bold text-white">
                                {src.documentTitle}
                              </h5>

                              <blockquote className="border-l-2 border-amber-500 pl-2.5 italic text-slate-300 font-serif text-[11px] leading-relaxed">
                                "{src.relevantExcerpt}"
                              </blockquote>

                              {src.sourceUrl && (
                                <a href={src.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                                  View Original Source
                                </a>
                              )}

                              {/* View Original Source in Explorer */}
                              <div className="pt-2 flex items-center justify-between border-t border-[#1b2b4d]">
                                <button
                                  onClick={() => {
                                    navigateTo('explorer', { docId: src.documentId, page: src.pageNumber });
                                  }}
                                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Original Source in Document Explorer</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => {
                                    addBookmark({
                                      docId: src.documentId,
                                      title: src.documentTitle,
                                      category: 'Constituent Assembly Debates',
                                      researcherNotes: 'Retrieved via ABHILEKH Research Assistant.',
                                      tags: ['Retrieved Source']
                                    });
                                    showToast('Saved to My Collection', 'success');
                                  }}
                                  className="text-slate-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Bookmark className="w-3 h-3" />
                                  <span>Save Source</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Suggestions */}
                    {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                      <div className="pt-2 border-t border-[#1b2b4d] space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Recommended Follow-Up Inquiries:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedFollowUps.map((fu, fidx) => (
                            <button
                              key={fidx}
                              onClick={() => handleSendMessage(fu)}
                              className="text-left text-[11px] bg-[#070c18] hover:bg-[#142347] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-[#1b2b4d] transition-colors cursor-pointer"
                            >
                              {fu} →
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="bg-[#0d1629] border border-[#1b2b4d] rounded-2xl p-4 max-w-md space-y-2 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>{retrievalStatus || 'Searching DAIC Archival Repositories...'}</span>
                </div>
                <div className="w-full bg-[#070c18] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full w-2/3 animate-pulse"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Follow-up Question Input Box */}
          <div className="sticky bottom-4 bg-[#0d1629]/95 backdrop-blur-md p-3 rounded-2xl border border-[#1b2b4d] shadow-xl space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask a follow-up question or query..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-[#070c18] border border-[#22355c] text-white text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={isLoading || !inputQuery.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <span>Ask</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span>Answers verified against Constituent Assembly debates and treatises</span>
              <span>DAIC Grounded RAG</span>
            </div>
          </div>
        </div>

        {/* RIGHT / SECONDARY AREA: Related Topics, Works, Events (lg:col-span-4 - Matching Panel 4 of Reference) */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. Related Topics */}
          <div className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              <Tag className="w-3.5 h-3.5" />
              <span>Related Topics</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {relatedTopics.map(topic => (
                <button
                  key={topic}
                  onClick={() => handleSendMessage(`What were Dr. Ambedkar's philosophical and constitutional thoughts on ${topic}?`)}
                  className="px-3 py-1.5 rounded-lg bg-[#070c18] hover:bg-[#142347] border border-[#1b2b4d] hover:border-amber-500/50 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Related Works */}
          <div className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Related Works</span>
            </div>

            <div className="space-y-2">
              {relatedWorks.map(work => (
                <div
                  key={work.title}
                  onClick={() => navigateTo('explorer', { docId: work.docId })}
                  className="p-3 rounded-xl bg-[#070c18] border border-[#1b2b4d] hover:border-amber-500/50 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-serif font-bold text-xs text-white group-hover:text-amber-400">
                      {work.title}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">Published {work.year}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Related Events */}
          <div className="bg-[#0d1629] rounded-2xl border border-[#1b2b4d] p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              <Calendar className="w-3.5 h-3.5" />
              <span>Related Events</span>
            </div>

            <div className="space-y-2">
              {relatedEvents.map(event => (
                <div
                  key={event.title}
                  onClick={() => navigateTo('timeline', { timelineEventId: event.eventId })}
                  className="p-3 rounded-xl bg-[#070c18] border border-[#1b2b4d] hover:border-amber-500/50 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-serif font-bold text-xs text-white group-hover:text-amber-400">
                      {event.title}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">Historical Year: {event.year}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
                </div>
              ))}
            </div>
          </div>

          {/* 4. Archival Grounding Guarantee Badge */}
          <div className="p-4 rounded-xl bg-[#0a1122] border border-emerald-500/30 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Primary Grounding</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every scholarly response is synthesized with strict grounding in the verified holdings of the Dr. Ambedkar International Centre (DAIC), Lok Sabha Parliamentary Archives, and Columbia University alumni records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
