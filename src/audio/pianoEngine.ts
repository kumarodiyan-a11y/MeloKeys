export type InstrumentId =
  | 'concert-grand'
  | 'felt-upright'
  | 'harpsichord'
  | 'pipe-organ'
  | 'acoustic-guitar'
  | 'marimba'
  | 'analog-synth';

export type HarmonyMode = 'single' | 'octave' | 'triad';

export interface InstrumentProfile {
  id: InstrumentId;
  label: string;
  family: string;
}

export const INSTRUMENTS: InstrumentProfile[] = [
  { id: 'concert-grand', label: 'Concert Grand', family: 'Acoustic Piano' },
  { id: 'felt-upright', label: 'Felt Upright', family: 'Intimate Piano' },
  { id: 'harpsichord', label: 'Harpsichord', family: 'Plucked Baroque' },
  { id: 'pipe-organ', label: 'Pipe Organ', family: 'Sustained Reed' },
  { id: 'acoustic-guitar', label: 'Acoustic Guitar', family: 'Nylon String' },
  { id: 'marimba', label: 'Concert Marimba', family: 'Wood Mallet' },
  { id: 'analog-synth', label: 'Analog Synth', family: 'Polyphonic Pad' },
];

interface ActiveVoice {
  stop: (immediate?: boolean) => void;
}

interface PartialSpec {
  ratio: number;
  amp: number;
  decayMult: number;
  type?: OscillatorType;
}

// Diatonic C-major semitone intervals for Triad Harmony mode
const DIATONIC_TRIAD_RATIOS: Record<string, [number, number]> = {
  C: [Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)],   // C-E-G
  D: [Math.pow(2, 3 / 12), Math.pow(2, 7 / 12)],   // D-F-A
  E: [Math.pow(2, 3 / 12), Math.pow(2, 7 / 12)],   // E-G-B
  F: [Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)],   // F-A-C
  G: [Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)],   // G-B-D
  A: [Math.pow(2, 3 / 12), Math.pow(2, 7 / 12)],   // A-C-E
  B: [Math.pow(2, 3 / 12), Math.pow(2, 6 / 12)],   // B-D-F (dim)
};

class MultiInstrumentEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private activeVoices = new Map<string, ActiveVoice[]>();
  private sustainedVoices: { noteId: string; voice: ActiveVoice }[] = [];
  private sustainPedal = false;
  private instrument: InstrumentId = 'concert-grand';
  private harmonyMode: HarmonyMode = 'single';
  private volume = 0.82;
  private reverbMix = 0.3;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.78;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(1 - this.reverbMix * 0.4, this.ctx.currentTime);

      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.setValueAtTime(this.reverbMix, this.ctx.currentTime);

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createConcertHallImpulse(this.ctx, 2.4, 2.7);

      this.dryGain.connect(this.compressor);
      this.wetGain.connect(this.reverbNode);
      this.reverbNode.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private createConcertHallImpulse(
    ctx: AudioContext,
    durationSeconds: number,
    decay: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSeconds);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * envelope * (i < sampleRate * 0.03 ? 0.5 : 1);
      }
    }
    return impulse;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setInstrument(instrument: InstrumentId): void {
    this.instrument = instrument;
  }

  public setHarmonyMode(mode: HarmonyMode): void {
    this.harmonyMode = mode;
  }

  public setReverbMix(mix: number): void {
    this.reverbMix = Math.max(0, Math.min(1, mix));
    if (this.ctx && this.wetGain && this.dryGain) {
      this.wetGain.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.03);
      this.dryGain.gain.setTargetAtTime(
        1 - this.reverbMix * 0.35,
        this.ctx.currentTime,
        0.03
      );
    }
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public setSustain(pressed: boolean): void {
    this.sustainPedal = pressed;
    if (!pressed && this.sustainedVoices.length > 0) {
      const pending = [...this.sustainedVoices];
      this.sustainedVoices = [];
      for (const item of pending) {
        item.voice.stop(false);
      }
    }
  }

  public playMetronomeClick(accent = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1320 : 940, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 660 : 480, now + 0.035);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(accent ? 0.16 : 0.1, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.dryGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private spawnVoice(
    frequencyHz: number,
    velocity: number,
    panPosition: number
  ): ActiveVoice | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryGain || !this.wetGain) return null;

    const now = ctx.currentTime;
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner =
      typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

    let partials: PartialSpec[];
    let brightnessStartHz: number;
    let brightnessEndHz: number;
    let filterQ = 0.7;
    let attackSec = 0.008;
    let peakAmp = 0.32 * velocity;
    let baseDecay = 3.4;
    let sustainedHold = false;
    let transientAmp = 0.05;
    let transientFreq = Math.min(frequencyHz * 2.5, 2200);
    let releaseSec = 0.34;
    let detuneUnison = false;

    switch (this.instrument) {
      case 'felt-upright':
        partials = [
          { ratio: 1, amp: 1.0, decayMult: 1.0, type: 'triangle' },
          { ratio: 2, amp: 0.34, decayMult: 0.7, type: 'sine' },
          { ratio: 3, amp: 0.12, decayMult: 0.45, type: 'sine' },
          { ratio: 4, amp: 0.04, decayMult: 0.3, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 4.2, 2600);
        brightnessEndHz = Math.max(frequencyHz * 1.4, 380);
        attackSec = 0.012;
        baseDecay = 2.6;
        transientAmp = 0.03;
        break;

      case 'harpsichord':
        partials = [
          { ratio: 1, amp: 0.85, decayMult: 1.0, type: 'sawtooth' },
          { ratio: 2, amp: 0.55, decayMult: 0.82, type: 'triangle' },
          { ratio: 3, amp: 0.36, decayMult: 0.65, type: 'sine' },
          { ratio: 4, amp: 0.24, decayMult: 0.5, type: 'sine' },
          { ratio: 5, amp: 0.16, decayMult: 0.4, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 11, 7600);
        brightnessEndHz = Math.max(frequencyHz * 2.5, 900);
        filterQ = 1.4;
        attackSec = 0.004;
        peakAmp = 0.24 * velocity;
        baseDecay = 1.9;
        transientAmp = 0.075;
        transientFreq = Math.min(frequencyHz * 4, 4200);
        releaseSec = 0.14;
        break;

      case 'pipe-organ':
        partials = [
          { ratio: 0.5, amp: 0.45, decayMult: 1.0, type: 'sine' },
          { ratio: 1, amp: 1.0, decayMult: 1.0, type: 'triangle' },
          { ratio: 2, amp: 0.58, decayMult: 1.0, type: 'sine' },
          { ratio: 3, amp: 0.28, decayMult: 1.0, type: 'sine' },
          { ratio: 4, amp: 0.2, decayMult: 1.0, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 6, 4200);
        brightnessEndHz = brightnessStartHz;
        attackSec = 0.045;
        peakAmp = 0.22 * velocity;
        sustainedHold = true;
        transientAmp = 0.012;
        releaseSec = 0.26;
        break;

      case 'acoustic-guitar':
        partials = [
          { ratio: 1, amp: 1.0, decayMult: 1.0, type: 'triangle' },
          { ratio: 2, amp: 0.48, decayMult: 0.68, type: 'sine' },
          { ratio: 3, amp: 0.22, decayMult: 0.45, type: 'sine' },
          { ratio: 4, amp: 0.1, decayMult: 0.3, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 7.5, 4800);
        brightnessEndHz = Math.max(frequencyHz * 1.4, 340);
        filterQ = 1.1;
        attackSec = 0.005;
        peakAmp = 0.3 * velocity;
        baseDecay = 2.1;
        transientAmp = 0.065;
        transientFreq = Math.min(frequencyHz * 3, 2800);
        releaseSec = 0.25;
        break;

      case 'marimba':
        partials = [
          { ratio: 1, amp: 1.0, decayMult: 1.0, type: 'sine' },
          { ratio: 4, amp: 0.42, decayMult: 0.32, type: 'sine' },
          { ratio: 9.2, amp: 0.09, decayMult: 0.14, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 6, 4600);
        brightnessEndHz = Math.max(frequencyHz * 1.6, 520);
        attackSec = 0.003;
        peakAmp = 0.38 * velocity;
        baseDecay = 1.15;
        transientAmp = 0.08;
        transientFreq = Math.min(frequencyHz * 2.2, 1800);
        releaseSec = 0.18;
        break;

      case 'analog-synth':
        partials = [
          { ratio: 0.5, amp: 0.42, decayMult: 1.0, type: 'triangle' },
          { ratio: 1, amp: 0.9, decayMult: 1.0, type: 'sawtooth' },
          { ratio: 1.004, amp: 0.85, decayMult: 1.0, type: 'sawtooth' },
          { ratio: 2, amp: 0.28, decayMult: 0.9, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 9, 5200);
        brightnessEndHz = Math.max(frequencyHz * 2.2, 700);
        filterQ = 2.8;
        attackSec = 0.028;
        peakAmp = 0.22 * velocity;
        sustainedHold = true;
        transientAmp = 0;
        releaseSec = 0.48;
        break;

      case 'concert-grand':
      default:
        partials = [
          { ratio: 1, amp: 1.0, decayMult: 1.0, type: 'triangle' },
          { ratio: 2.0008, amp: 0.52, decayMult: 0.78, type: 'sine' },
          { ratio: 3.002, amp: 0.26, decayMult: 0.58, type: 'sine' },
          { ratio: 4.004, amp: 0.14, decayMult: 0.42, type: 'sine' },
          { ratio: 5.008, amp: 0.07, decayMult: 0.3, type: 'sine' },
          { ratio: 6.012, amp: 0.035, decayMult: 0.22, type: 'sine' },
        ];
        brightnessStartHz = Math.min(frequencyHz * 8.5, 5800);
        brightnessEndHz = Math.max(frequencyHz * 1.8, 420);
        detuneUnison = true;
        transientAmp = 0.06;
        break;
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(brightnessStartHz, now);
    if (brightnessEndHz !== brightnessStartHz) {
      filter.frequency.exponentialRampToValueAtTime(brightnessEndHz, now + 1.4);
    }
    filter.Q.setValueAtTime(filterQ, now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peakAmp, now + attackSec);
    if (sustainedHold) {
      noteGain.gain.setTargetAtTime(peakAmp * 0.78, now + attackSec + 0.05, 0.25);
    } else {
      noteGain.gain.exponentialRampToValueAtTime(0.0008, now + baseDecay);
    }

    filter.connect(noteGain);
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-0.6, Math.min(0.6, panPosition)), now);
      noteGain.connect(panner);
      panner.connect(this.dryGain);
      panner.connect(this.wetGain);
    } else {
      noteGain.connect(this.dryGain);
      noteGain.connect(this.wetGain);
    }

    const oscillators: OscillatorNode[] = [];

    for (const partial of partials) {
      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();
      osc.type = partial.type ?? 'sine';
      osc.frequency.setValueAtTime(frequencyHz * partial.ratio, now);

      if (partial.ratio === 1 && detuneUnison) {
        const detuneOsc = ctx.createOscillator();
        const detuneGain = ctx.createGain();
        detuneOsc.type = 'sine';
        detuneOsc.frequency.setValueAtTime(frequencyHz * 1.0014, now);
        detuneGain.gain.setValueAtTime(0.28, now);
        detuneOsc.connect(detuneGain);
        detuneGain.connect(filter);
        detuneOsc.start(now);
        oscillators.push(detuneOsc);
      }

      pGain.gain.setValueAtTime(partial.amp, now);
      if (!sustainedHold) {
        pGain.gain.exponentialRampToValueAtTime(
          Math.max(0.001, partial.amp * 0.05),
          now + baseDecay * partial.decayMult
        );
      }

      osc.connect(pGain);
      pGain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    }

    if (transientAmp > 0) {
      const bufferSize = Math.floor(ctx.sampleRate * 0.018);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(transientFreq, now);
      noiseFilter.Q.setValueAtTime(1.2, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(transientAmp * velocity, now);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(panner ?? this.dryGain);
      noiseSource.start(now);
    }

    let stopped = false;
    return {
      stop: (immediate = false) => {
        if (stopped || !this.ctx) return;
        stopped = true;
        const stopTime = this.ctx.currentTime;
        const rel = immediate ? 0.06 : releaseSec;
        try {
          noteGain.gain.cancelScheduledValues(stopTime);
          noteGain.gain.setValueAtTime(Math.max(noteGain.gain.value, 0.0001), stopTime);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + rel);
          for (const osc of oscillators) {
            osc.stop(stopTime + rel + 0.04);
          }
        } catch {
          // Ignore already stopped oscillator
        }
      },
    };
  }

  public noteOn(noteId: string, frequencyHz: number, velocity = 0.85): void {
    // Stereo pan across C4..E5 keyboard width
    const pan = Math.max(-0.38, Math.min(0.38, ((frequencyHz - 420) / 260) * 0.35));
    const voicesToStart: ActiveVoice[] = [];

    const primary = this.spawnVoice(frequencyHz, velocity, pan);
    if (primary) voicesToStart.push(primary);

    if (this.harmonyMode === 'octave') {
      const sub = this.spawnVoice(frequencyHz * 0.5, velocity * 0.52, pan - 0.12);
      if (sub) voicesToStart.push(sub);
    } else if (this.harmonyMode === 'triad') {
      const pitchLetter = noteId.charAt(0).toUpperCase();
      const [thirdRatio, fifthRatio] = DIATONIC_TRIAD_RATIOS[pitchLetter] ?? [
        Math.pow(2, 4 / 12),
        Math.pow(2, 7 / 12),
      ];
      const third = this.spawnVoice(frequencyHz * thirdRatio, velocity * 0.62, pan + 0.08);
      const fifth = this.spawnVoice(frequencyHz * fifthRatio, velocity * 0.58, pan + 0.16);
      if (third) voicesToStart.push(third);
      if (fifth) voicesToStart.push(fifth);
    }

    if (voicesToStart.length > 0) {
      const existing = this.activeVoices.get(noteId) ?? [];
      existing.push(...voicesToStart);
      this.activeVoices.set(noteId, existing);
    }
  }

  public noteOff(noteId: string): void {
    const voices = this.activeVoices.get(noteId);
    if (!voices || voices.length === 0) return;
    this.activeVoices.delete(noteId);

    for (const voice of voices) {
      if (this.sustainPedal) {
        this.sustainedVoices.push({ noteId, voice });
      } else {
        voice.stop(false);
      }
    }
  }

  public triggerBriefNote(noteId: string, frequencyHz: number, durationMs = 420): void {
    this.noteOn(noteId, frequencyHz, 0.88);
    window.setTimeout(() => {
      this.noteOff(noteId);
    }, durationMs);
  }

  public stopAll(): void {
    for (const [, voices] of this.activeVoices) {
      for (const v of voices) v.stop(true);
    }
    this.activeVoices.clear();
    for (const item of this.sustainedVoices) {
      item.voice.stop(true);
    }
    this.sustainedVoices = [];
  }
}

export const pianoEngine = new MultiInstrumentEngine();
