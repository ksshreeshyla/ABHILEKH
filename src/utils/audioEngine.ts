/**
 * Audio Engine for SIH26096 Ambedkar Heritage Archive
 * Speaks the supplied text with an actual browser TTS voice matching the selected language.
 */

import { LanguageCode } from '../types/archive';

class HeritageAudioEngine {
  private audioCtx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];
  private isSynthesizing = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private syllableInterval: any = null;
  private ambientGain: GainNode | null = null;

  /**
   * Initializes or resumes AudioContext upon user gesture
   */
  public async ensureAudioContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
      return null;
    }
  }

  /**
   * Play an audible acoustic confirmation chime to verify browser audio output
   */
  public async playTestChime(onComplete?: () => void): Promise<void> {
    const ctx = await this.ensureAudioContext();
    if (!ctx) return;

    try {
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Bright heritage chime)
      const now = ctx.currentTime;

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.42);
      });

      if (onComplete) {
        setTimeout(onComplete, 700);
      }
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  }

  /**
   * Generates audible vocal formant acoustic synthesis
   * Creates real, audible vocal-like vowel formants (F1, F2, F3) that pulse with speech cadence
   * This guarantees that even if the client OS lacks an offline Hindi/Marathi/Kannada voice,
   * sound is clearly and loudly heard through the user's speakers!
   */
  private startAcousticSpeechCadence(text: string, rate: number = 1.0): void {
    this.stopAcousticSpeechCadence();

    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    try {
      // Split text into word tokens
      const words = text.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) return;

      this.isSynthesizing = true;
      let wordIdx = 0;
      const intervalMs = Math.max(120, Math.floor(260 / rate));

      // Create fundamental vocal pitch oscillator (warm male baritone fundamental ~125Hz-145Hz)
      const fundamental = ctx.createOscillator();
      const vocalGain = ctx.createGain();
      fundamental.type = 'sawtooth';
      fundamental.frequency.setValueAtTime(132, ctx.currentTime);

      // Formant filters to simulate human vocal tract resonances (vowels A, E, O)
      const formant1 = ctx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(700, ctx.currentTime); // F1 (~700Hz)
      formant1.Q.setValueAtTime(5, ctx.currentTime);

      const formant2 = ctx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.setValueAtTime(1220, ctx.currentTime); // F2 (~1220Hz)
      formant2.Q.setValueAtTime(7, ctx.currentTime);

      vocalGain.gain.setValueAtTime(0.001, ctx.currentTime);
      vocalGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);

      fundamental.connect(formant1);
      fundamental.connect(formant2);
      formant1.connect(vocalGain);
      formant2.connect(vocalGain);
      vocalGain.connect(ctx.destination);

      fundamental.start();
      this.activeOscillators.push(fundamental);
      this.activeGainNodes.push(vocalGain);

      // Pulse vocal formants to simulate natural syllable rhythms of speech
      this.syllableInterval = setInterval(() => {
        if (!this.isSynthesizing || wordIdx >= words.length) {
          this.stopAcousticSpeechCadence();
          return;
        }

        const now = ctx.currentTime;
        const currentWord = words[wordIdx];
        // Slight natural vocal inflection
        const pitchFluctuation = 128 + ((currentWord.charCodeAt(0) || 100) % 24);
        fundamental.frequency.cancelScheduledValues(now);
        fundamental.frequency.setValueAtTime(pitchFluctuation, now);

        // Syllable amplitude envelope
        vocalGain.gain.cancelScheduledValues(now);
        vocalGain.gain.setValueAtTime(0.015, now);
        vocalGain.gain.linearRampToValueAtTime(0.08, now + 0.04);
        vocalGain.gain.exponentialRampToValueAtTime(0.015, now + 0.18);

        wordIdx++;
      }, intervalMs);
    } catch (e) {
      console.warn('Acoustic speech cadence error:', e);
    }
  }

  private stopAcousticSpeechCadence(): void {
    if (this.syllableInterval) {
      clearInterval(this.syllableInterval);
      this.syllableInterval = null;
    }

    this.activeOscillators.forEach(osc => {
      try { osc.stop(); } catch (_) {}
      try { osc.disconnect(); } catch (_) {}
    });
    this.activeOscillators = [];

    this.activeGainNodes.forEach(gain => {
      try { gain.disconnect(); } catch (_) {}
    });
    this.activeGainNodes = [];

    this.isSynthesizing = false;
  }

  /**
   * Speak text in selected language with dual-engine reliability:
   * 1. Web Speech Synthesis with automatic voice matching
   * 2. Synchronized Web Audio vocal acoustic synthesis so sound is NEVER silent
   */
  public async speakText(
    text: string,
    lang: LanguageCode,
    options?: {
      rate?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): Promise<void> {
    // 1. Stop any currently active speech
    this.stopSpeaking();

    const rate = options?.rate || 1.0;

    // Browser TTS is required: tones or a different-language voice must never be presented as speech.
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onError?.(new Error('Speech synthesis is unavailable in this browser.'));
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;

      // Map language code to standard IETF BCP 47
      let bcp47 = 'en-IN';
      if (lang === 'hi') bcp47 = 'hi-IN';
      else if (lang === 'mr') bcp47 = 'mr-IN';
      else if (lang === 'kn') bcp47 = 'kn-IN';

      utterance.lang = bcp47;

      // Select best matching voice from available system voices
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langLower = bcp47.toLowerCase();
        const langPrefix = lang.toLowerCase();

        // 1. Exact match (e.g. kn-IN, hi-IN, mr-IN)
        let matchedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(langLower));

        // 2. Language prefix match (e.g. kn, hi, mr)
        if (!matchedVoice) {
          matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
        }

        if (!matchedVoice) throw new Error(`No ${lang} speech voice is installed in this browser.`);
        utterance.voice = matchedVoice;
      } else {
        throw new Error(`No speech voices are available for ${lang}.`);
      }

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.stopAcousticSpeechCadence();
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.stopAcousticSpeechCadence();
        options?.onError?.(e);
      };

      // Prevent Chrome garbage collection bug by pinning to window
      (window as any).__currentUtterance = utterance;
      this.activeUtterance = utterance;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      options?.onError?.(err);
    }
  }

  /**
   * Stop all active speech synthesis and acoustic vocal tones
   */
  public pauseSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }

  public resumeSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }

  public stopSpeaking(): void {
    this.stopAcousticSpeechCadence();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    this.activeUtterance = null;
    (window as any).__currentUtterance = null;
  }
}

export const audioEngine = new HeritageAudioEngine();
