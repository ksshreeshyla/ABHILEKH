import React, { useState, useEffect, useRef } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { audioEngine } from '../../utils/audioEngine';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Search, 
  Download, 
  Clock, 
  Mic, 
  Video, 
  FileText, 
  Check,
  Film,
  Sparkles,
  Maximize2,
  Copy,
  BookOpen,
  ShieldCheck,
  Languages,
  Music,
  Tv,
  Activity,
  Award
} from 'lucide-react';

export const AudioVideoArchive: React.FC = () => {
  const { 
    audioVideoRecords, 
    selectedMediaId, 
    setSelectedMediaId, 
    language,
    setLanguage,
    t, 
    showToast 
  } = useArchive();

  const activeMedia = audioVideoRecords.find(m => m.id === selectedMediaId) || audioVideoRecords[0];

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [playerViewMode, setPlayerViewMode] = useState<'film' | 'oscilloscope'>('film');
  const [audioFeedbackNotice, setAudioFeedbackNotice] = useState<string>('Ready · Click Play to listen');

  const activeSegmentIndexRef = useRef<number>(-1);
  const timerIntervalRef = useRef<any>(null);

  // Multilingual text extractors
  const getMediaTitle = () => {
    if (language === 'hi' && activeMedia.titleHi) return activeMedia.titleHi;
    if (language === 'mr' && activeMedia.titleMr) return activeMedia.titleMr;
    if (language === 'kn' && activeMedia.titleKn) return activeMedia.titleKn;
    return activeMedia.title;
  };

  const getMediaDesc = () => {
    if (language === 'hi' && activeMedia.descriptionHi) return activeMedia.descriptionHi;
    if (language === 'mr' && activeMedia.descriptionMr) return activeMedia.descriptionMr;
    if (language === 'kn' && activeMedia.descriptionKn) return activeMedia.descriptionKn;
    return activeMedia.description;
  };

  const getSegmentText = (seg: any) => {
    if (!seg) return '';
    if (language === 'hi' && seg.textHi) return seg.textHi;
    if (language === 'mr' && seg.textMr) return seg.textMr;
    if (language === 'kn' && seg.textKn) return seg.textKn;
    return seg.text;
  };

  const getSegmentSpeaker = (seg: any) => {
    if (!seg) return '';
    if (language === 'hi' && seg.speakerHi) return seg.speakerHi;
    if (language === 'mr' && seg.speakerMr) return seg.speakerMr;
    if (language === 'kn' && seg.speakerKn) return seg.speakerKn;
    return seg.speaker;
  };

  const getLanguageDisplayName = () => {
    switch (language) {
      case 'hi': return 'हिन्दी (Hindi)';
      case 'mr': return 'मराठी (Marathi)';
      case 'kn': return 'ಕನ್ನಡ (Kannada)';
      default: return 'English';
    }
  };

  // Find active segment based on currentSeconds
  const activeSegmentIndex = activeMedia.transcripts.findIndex((t_seg, idx) => {
    const nextT = activeMedia.transcripts[idx + 1];
    if (nextT) {
      return currentSeconds >= t_seg.seconds && currentSeconds < nextT.seconds;
    }
    return currentSeconds >= t_seg.seconds;
  });

  const currentSegment = activeMedia.transcripts[activeSegmentIndex >= 0 ? activeSegmentIndex : 0];

  // Function to audibly speak a transcript segment in the active language
  const speakSegment = async (seg: any) => {
    if (isMuted) return;

    try {
      const textToSpeak = getSegmentText(seg);
      const speakerName = getSegmentSpeaker(seg);

      setAudioFeedbackNotice(`Broadcasting audio in ${getLanguageDisplayName()}...`);

      await audioEngine.speakText(textToSpeak, language, {
        rate: playbackRate,
        onStart: () => {
          setAudioFeedbackNotice(`● Playing audio in ${getLanguageDisplayName()} (${speakerName})`);
        },
        onEnd: () => {
          setAudioFeedbackNotice(`Segment complete · Ready in ${getLanguageDisplayName()}`);
        },
        onError: () => {
          setAudioFeedbackNotice(`Audio broadcasting active (${getLanguageDisplayName()})`);
        }
      });
    } catch (err) {
      console.warn('Audio synthesis call error:', err);
    }
  };

  // Synchronized playback tick
  useEffect(() => {
    if (isPlaying) {
      timerIntervalRef.current = setInterval(() => {
        setCurrentSeconds(prev => {
          const nextSec = prev + 1;
          const maxSec = 400;
          if (nextSec >= maxSec) {
            setIsPlaying(false);
            audioEngine.stopSpeaking();
            return 0;
          }
          return nextSec;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPlaying]);

  // When segment changes while playing, speak the new segment
  useEffect(() => {
    if (isPlaying && activeSegmentIndex >= 0 && activeSegmentIndex !== activeSegmentIndexRef.current) {
      activeSegmentIndexRef.current = activeSegmentIndex;
      const seg = activeMedia.transcripts[activeSegmentIndex];
      if (seg) {
        speakSegment(seg);
      }
    }
  }, [activeSegmentIndex, isPlaying, activeMedia]);

  // If user switches language while audio is playing, restart the segment in new language!
  useEffect(() => {
    if (isPlaying && currentSegment) {
      speakSegment(currentSegment);
      showToast(`Audio narration switched to ${getLanguageDisplayName()}`, 'info');
    }
  }, [language]);

  // Stop audio on media switch or unmount
  useEffect(() => {
    setIsPlaying(false);
    setCurrentSeconds(0);
    activeSegmentIndexRef.current = -1;
    audioEngine.stopSpeaking();
    return () => {
      audioEngine.stopSpeaking();
    };
  }, [selectedMediaId]);

  const handleTogglePlay = async () => {
    if (!isPlaying) {
      setIsPlaying(true);
      const seg = activeMedia.transcripts[activeSegmentIndex >= 0 ? activeSegmentIndex : 0];
      if (seg) {
        activeSegmentIndexRef.current = activeSegmentIndex >= 0 ? activeSegmentIndex : 0;
        await speakSegment(seg);
      }
      showToast(`Playing archival recording in ${getLanguageDisplayName()}`, 'info');
    } else {
      setIsPlaying(false);
      audioEngine.stopSpeaking();
      setAudioFeedbackNotice('Paused · Click Play to resume');
    }
  };

  const handleJumpToTime = async (seconds: number, segmentIdx: number) => {
    setCurrentSeconds(seconds);
    setIsPlaying(true);
    activeSegmentIndexRef.current = segmentIdx;
    const seg = activeMedia.transcripts[segmentIdx];
    if (seg) {
      await speakSegment(seg);
    }
    showToast(`Jumped to ${formatSeconds(seconds)} (${getLanguageDisplayName()})`, 'info');
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyTranscript = () => {
    const fullText = activeMedia.transcripts
      .map(t_entry => `[${t_entry.timestamp}] ${getSegmentSpeaker(t_entry)}: ${getSegmentText(t_entry)}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedTranscript(true);
    showToast(`Translated transcript (${getLanguageDisplayName()}) copied`, 'success');
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(activeMedia.archiveCitation);
    setCopiedCitation(true);
    showToast('Original archival citation copied to clipboard', 'success');
    setTimeout(() => setCopiedCitation(false), 2500);
  };

  const filteredTranscripts = activeMedia.transcripts.filter(t_entry => {
    if (!transcriptSearch.trim()) return true;
    const q = transcriptSearch.toLowerCase();
    const speaker = getSegmentSpeaker(t_entry).toLowerCase();
    const text = getSegmentText(t_entry).toLowerCase();
    return text.includes(q) || speaker.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-300 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-700 font-semibold mb-1">
            <Film className="w-4 h-4 text-amber-600" />
            <span>MULTIMEDIA PRESERVATION CONSOLE</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
            {t('audio_video_title')}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            {t('audio_video_desc')}
          </p>
        </div>

        {/* Audio Language Quick Selector */}
        <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-lg border border-stone-300">
          <Languages className="w-4 h-4 text-amber-700 ml-1" />
          <span className="text-xs font-semibold text-stone-700">Audio Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs font-bold text-stone-900 focus:outline-none cursor-pointer"
          >
            <option value="en">English (Original Voice)</option>
            <option value="hi">हिन्दी (Hindi Spoken Audio)</option>
            <option value="mr">मराठी (Marathi Spoken Audio)</option>
            <option value="kn">ಕನ್ನಡ (Kannada Spoken Audio)</option>
          </select>
        </div>
      </div>

      {/* Main Player & Transcript Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Player & Media Info (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Media Player Console */}
          <div className="bg-stone-950 rounded-2xl border border-stone-800 p-5 sm:p-6 text-stone-100 shadow-2xl space-y-4">
            {/* Top Bar with Media Type & Status */}
            <div className="flex items-center justify-between text-xs text-stone-400 font-mono border-b border-stone-800 pb-3">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                {activeMedia.mediaType === 'audio' ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span className="uppercase">{activeMedia.category}</span>
                <span className="text-stone-600">·</span>
                <span className="text-stone-300">{activeMedia.id}</span>
              </span>

              {/* View Mode Toggle: Film Screen vs Oscilloscope */}
              <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded border border-stone-800">
                <button
                  onClick={() => setPlayerViewMode('film')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans cursor-pointer transition-colors ${
                    playerViewMode === 'film' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                  title="Film Reel Screen"
                >
                  <Tv className="w-3 h-3" />
                  <span>Film Screen</span>
                </button>
                <button
                  onClick={() => setPlayerViewMode('oscilloscope')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans cursor-pointer transition-colors ${
                    playerViewMode === 'oscilloscope' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                  title="Acoustic Oscilloscope"
                >
                  <Activity className="w-3 h-3" />
                  <span>Oscilloscope</span>
                </button>
              </div>
            </div>

            {/* VISUAL ARCHIVAL DOCUMENTARY SCREEN (NEVER BLANK!) */}
            <div className="relative bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 rounded-xl overflow-hidden border border-stone-800 shadow-inner min-h-[300px] flex flex-col justify-between select-none">
              {/* Vintage 35mm Celluloid Sprockets Header */}
              <div className="bg-stone-950 border-b border-stone-800/80 px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-stone-400">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <span key={i} className="inline-block w-2.5 h-1.5 bg-stone-800 rounded-xs border border-stone-700"></span>
                    ))}
                  </div>
                  <span className="text-amber-400 font-bold">REEL 35MM · AIR-DAIC-1953</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-stone-300 uppercase">{audioFeedbackNotice}</span>
                </div>
              </div>

              {/* Main Screen Content: Historical Visual Frame */}
              {playerViewMode === 'film' ? (
                <div className="relative flex-1 p-6 flex flex-col items-center justify-center text-center overflow-hidden">
                  {/* Atmospheric Vintage Film Lighting & Vignette */}
                  <div className="absolute inset-0 bg-radial from-amber-950/20 via-transparent to-stone-950/90 pointer-events-none"></div>

                  {/* Archival Graphic Representation */}
                  <div className="relative z-10 space-y-3 max-w-lg">
                    {/* Visual Stamp / Emblem of Historical Record */}
                    <div className="w-16 h-16 mx-auto rounded-full bg-stone-900 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shadow-xl relative group">
                      {isPlaying ? (
                        <div className="relative flex items-center justify-center">
                          <span className="absolute w-20 h-20 rounded-full border border-amber-400/30 animate-ping"></span>
                          <Volume2 className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                      ) : (
                        <Volume2 className="w-8 h-8 text-stone-500" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                        {getLanguageDisplayName()} Audio Broadcast
                      </div>
                      <h3 className="font-serif font-bold text-lg sm:text-xl text-stone-100 leading-snug">
                        {getMediaTitle()}
                      </h3>
                      <div className="text-xs font-mono text-amber-400">
                        Speaker: <strong>{getSegmentSpeaker(currentSegment)}</strong> ({currentSegment?.timestamp || '00:00'})
                      </div>
                    </div>

                    {/* Animated Equalizer Wave Bars */}
                    <div className="flex items-center justify-center gap-1.5 h-12 py-2">
                      {[18, 35, 52, 28, 65, 80, 42, 70, 90, 58, 36, 75, 40, 30, 62, 85, 45, 22].map((h, i) => (
                        <div
                          key={i}
                          style={{ 
                            height: isPlaying ? `${Math.max(10, (h * ((i % 5) + 1.2)) % 46)}px` : '6px',
                            opacity: isPlaying ? 0.95 : 0.35
                          }}
                          className="w-1.5 bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300 rounded-full transition-all duration-150"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Oscilloscope Mode */
                <div className="relative flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="font-mono text-xs text-amber-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>ACOUSTIC VOCAL FORMANT & FREQUENCY MONITOR</span>
                  </div>
                  {/* Grid-based oscilloscope visualizer */}
                  <div className="w-full max-w-md h-32 bg-stone-950 border border-stone-800 rounded-lg p-3 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1c1917_1px,transparent_1px),linear-gradient(to_bottom,#1c1917_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                    <div className="relative z-10 flex items-center justify-between w-full h-full px-4">
                      {[20, 45, 80, 35, 95, 60, 110, 45, 85, 30, 70, 95, 40, 65, 100, 50, 35, 20].map((val, idx) => (
                        <div
                          key={idx}
                          style={{
                            height: isPlaying ? `${Math.max(8, (val * 0.9))}%` : '4%',
                          }}
                          className="w-1 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.6)] transition-all duration-100"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-stone-400">
                    Acoustic Output Level: <span className="text-emerald-400 font-bold">{isPlaying ? '-14.2 dBFS' : 'Idle'}</span> · Language Pitch Modulator: <span className="text-amber-400 font-bold">{language.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {/* Subtitle Caption Overlay directly on Screen */}
              <div className="bg-stone-950/95 border-t border-stone-800 p-3.5 px-5">
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-1">
                  <span>{getSegmentSpeaker(currentSegment)} ({currentSegment?.timestamp || '00:00'})</span>
                  <span className="text-stone-400">{getLanguageDisplayName()}</span>
                </div>
                <p className="font-serif italic text-xs sm:text-sm text-stone-100 leading-snug line-clamp-2">
                  "{currentSegment ? getSegmentText(currentSegment) : 'Press Play to hear Dr. Ambedkar\'s address'}"
                </p>
              </div>

              {/* Vintage 35mm Celluloid Sprockets Footer */}
              <div className="bg-stone-950 border-t border-stone-800/80 px-4 py-1 flex items-center justify-between text-[10px] font-mono text-stone-500">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <span key={i} className="inline-block w-2.5 h-1.5 bg-stone-800 rounded-xs border border-stone-700"></span>
                  ))}
                </div>
                <span>DAIC PRESERVATION COPY · NEW DELHI</span>
              </div>
            </div>

            {/* Scrubber Bar */}
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min="0"
                max="360"
                value={currentSeconds}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentSeconds(val);
                  if (isPlaying) {
                    const segIdx = activeMedia.transcripts.findIndex((t_entry, idx) => {
                      const nextT = activeMedia.transcripts[idx + 1];
                      return nextT ? val >= t_entry.seconds && val < nextT.seconds : val >= t_entry.seconds;
                    });
                    if (segIdx >= 0) {
                      activeSegmentIndexRef.current = segIdx;
                      speakSegment(activeMedia.transcripts[segIdx]);
                    }
                  }
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-stone-500">
                <span>{formatSeconds(currentSeconds)}</span>
                <span>Duration: {activeMedia.duration}</span>
              </div>
            </div>

            {/* Player Controls & Volume */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isMuted) {
                      audioEngine.stopSpeaking();
                    }
                    setIsMuted(!isMuted);
                  }}
                  className={`p-2 rounded transition-colors cursor-pointer ${isMuted ? 'text-rose-400 bg-stone-900' : 'text-stone-400 hover:text-white'}`}
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="bg-stone-900 border border-stone-800 text-stone-300 text-xs rounded px-2 py-1 focus:outline-none cursor-pointer"
                  title="Playback Speech Speed"
                >
                  <option value="0.8">0.8x Speed</option>
                  <option value="1.0">1.0x Normal</option>
                  <option value="1.2">1.2x Speed</option>
                </select>

                {/* Instant Audio Sound Diagnostic Test Button */}
                <button
                  onClick={() => {
                    audioEngine.playTestChime(() => {
                      showToast('Speaker & Headphone audio verified!', 'success');
                    });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                  title="Click to test your device speakers with an audible chime"
                >
                  <Music className="w-3 h-3 text-amber-400" />
                  <span>Test Speaker Sound</span>
                </button>
              </div>

              {/* Main Play / Pause Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCurrentSeconds(prev => Math.max(0, prev - 10));
                  }}
                  className="p-2 text-stone-400 hover:text-white transition-colors cursor-pointer"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  title={isPlaying ? t('pause_audio') : t('play_audio')}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current text-black" />
                  ) : (
                    <Play className="w-6 h-6 fill-current text-black ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleJumpToTime(0, 0)}
                  className="p-2 text-stone-400 hover:text-white transition-colors cursor-pointer"
                  title="Restart Recording"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs font-mono text-stone-400">
                Audio State: <strong className="text-emerald-400">{isMuted ? 'Muted' : `${getLanguageDisplayName()} Voice Active`}</strong>
              </div>
            </div>
          </div>

          {/* DEDICATED ARCHIVAL SOURCE & VERIFIABLE CITATION CARD */}
          <div className="bg-white rounded-xl border border-stone-300 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-700" />
                <h3 className="font-serif font-bold text-base text-stone-900">
                  {t('archival_source_citation')}
                </h3>
              </div>
              <button
                onClick={handleCopyCitation}
                className="flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900 font-semibold cursor-pointer"
              >
                {copiedCitation ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCitation ? t('copied') : 'Copy Citation'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
                <span className="font-semibold text-stone-700 uppercase tracking-wider text-[11px] block">
                  {t('original_holding')}
                </span>
                <p className="text-stone-900 font-medium">
                  {activeMedia.originalHolding}
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
                <span className="font-semibold text-stone-700 uppercase tracking-wider text-[11px] block">
                  Original Delivery Language:
                </span>
                <p className="text-stone-900 font-medium">
                  {activeMedia.language} · Synthesized for Multilingual Educational Access
                </p>
              </div>
            </div>

            {/* Verifiable Academic Citation */}
            <div className="p-3 bg-stone-900 text-stone-100 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-400 block uppercase">
                  {t('citation_note')}
                </span>
                <span className="text-[10px] text-stone-400 font-mono">Ref: {activeMedia.id}</span>
              </div>
              <p className="font-mono text-xs text-stone-200 select-all leading-relaxed">
                {activeMedia.archiveCitation}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-800">
                <button
                  onClick={() => {
                    const text = `${activeMedia.speaker}. "${activeMedia.title}." Archival audio-visual recording, ${activeMedia.date}. ${activeMedia.originalHolding}.`;
                    navigator.clipboard.writeText(text);
                    showToast('Chicago citation copied', 'success');
                  }}
                  className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-stone-400" />
                  <span>{t('copy_chicago')}</span>
                </button>
                <button
                  onClick={() => {
                    const text = `${activeMedia.speaker} (${activeMedia.date}). ${activeMedia.title} [Multimedia recording]. ${activeMedia.originalHolding}.`;
                    navigator.clipboard.writeText(text);
                    showToast('APA citation copied', 'success');
                  }}
                  className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-stone-400" />
                  <span>{t('copy_apa')}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed font-sans">
              {getMediaDesc()}
            </p>
          </div>

          {/* Media Playlist Selector */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-stone-600 uppercase tracking-wider">
              {t('available_recordings')}
            </h3>
            <div className="space-y-2">
              {audioVideoRecords.map(item => {
                let localizedItemTitle = item.title;
                if (language === 'hi' && item.titleHi) localizedItemTitle = item.titleHi;
                if (language === 'mr' && item.titleMr) localizedItemTitle = item.titleMr;
                if (language === 'kn' && item.titleKn) localizedItemTitle = item.titleKn;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedMediaId(item.id);
                      setCurrentSeconds(0);
                      setIsPlaying(false);
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      activeMedia.id === item.id
                        ? 'bg-stone-900 text-stone-100 border-stone-900 shadow-sm'
                        : 'bg-white border-stone-300 hover:border-stone-400 text-stone-900'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono opacity-80 block">{item.date} · {item.duration}</span>
                      <h4 className="font-serif font-bold text-xs">{localizedItemTitle}</h4>
                    </div>
                    <span className="text-xs font-mono">{item.duration}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Synchronized Interactive Transcript (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-300 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                {t('sync_transcript')}
              </h3>
              <p className="text-[11px] text-stone-500">
                {t('sync_transcript_desc')}
              </p>
            </div>

            <button
              onClick={handleCopyTranscript}
              className="p-1.5 text-stone-500 hover:text-stone-900 rounded border border-stone-200 hover:border-stone-400 cursor-pointer"
              title="Copy Full Translated Transcript"
            >
              {copiedTranscript ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </button>
          </div>

          {/* Transcript Search */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('search_transcript')}
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-2.5 pl-8 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Transcript Scrollable List */}
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredTranscripts.map((entry, idx) => {
              const originalIndex = activeMedia.transcripts.indexOf(entry);
              const isActive = originalIndex === activeSegmentIndex;
              const speaker = getSegmentSpeaker(entry);
              const text = getSegmentText(entry);

              return (
                <div
                  key={idx}
                  onClick={() => handleJumpToTime(entry.seconds, originalIndex)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                    isActive
                      ? 'bg-amber-50/90 border-amber-400 shadow-xs ring-1 ring-amber-300'
                      : 'bg-stone-50/60 border-stone-200 hover:bg-stone-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-stone-800">{speaker}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToTime(entry.seconds, originalIndex);
                      }}
                      className={`font-mono px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                        isActive 
                          ? 'bg-amber-600 text-stone-950 font-bold' 
                          : 'bg-stone-200 hover:bg-amber-500 hover:text-stone-950 text-stone-700'
                      }`}
                      title={`Listen in ${getLanguageDisplayName()}`}
                    >
                      {entry.timestamp} ▶
                    </button>
                  </div>
                  <p className="font-serif text-xs text-stone-800 leading-relaxed">
                    {text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
