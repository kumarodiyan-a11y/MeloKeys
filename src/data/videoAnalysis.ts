export interface PianoKeySpec {
  id: string;
  keyLabel: string; // '1'..'9','0' for natural keys, or sharp code
  keyboardCode: string;
  noteName: string; // e.g. 'C4'
  solfege: string;
  scaleDegree: string;
  frequencyHz: number;
  youtubeSeekPercent: number | null; // 10..90, 0 for '0' key, null for chromatic sharps
  isSharp: boolean;
  naturalIndex?: number; // 0..9 for positioning sharps cleanly
  description: string;
}

export interface SongScore {
  id: string;
  title: string;
  composer: string;
  originNote: string;
  tempoBpm: number;
  phrases: string[][]; // array of phrases, each phrase is array of keyLabels ('1'..'0')
  coachingTip?: string;
  phraseLabels?: string[];
}

export const YOUTUBE_VIDEO_META = {
  id: 'BcL2AhaHJAg',
  url: 'https://www.youtube.com/watch?v=BcL2AhaHJAg',
  embedUrl: 'https://www.youtube.com/embed/BcL2AhaHJAg?rel=0',
  title: 'YouTube Grand Piano - Play it on YouTube with your number keys',
  channel: 'Chill Buddies',
  keyRange: 'C4 – E5 (C Major Diatonic)',
  triggerCount: 10,
};

// The 10 primary number-key triggers mapped to YouTube's 0-9 seekbar shortcuts
// Keys 1-9 map to 10%-90% (C4 to D5); key 0 jumps to 0% (0:00) holding E5 to complete the left-to-right keyboard row.
export const NUMBER_KEYS: PianoKeySpec[] = [
  {
    id: 'C4',
    keyLabel: '1',
    keyboardCode: 'Digit1',
    noteName: 'C4',
    solfege: 'Do',
    scaleDegree: 'Root (I)',
    frequencyHz: 261.63,
    youtubeSeekPercent: 10,
    isSharp: false,
    naturalIndex: 0,
    description: 'Middle C anchor located at the 10% timeline mark.',
  },
  {
    id: 'D4',
    keyLabel: '2',
    keyboardCode: 'Digit2',
    noteName: 'D4',
    solfege: 'Re',
    scaleDegree: 'Major 2nd (II)',
    frequencyHz: 293.66,
    youtubeSeekPercent: 20,
    isSharp: false,
    naturalIndex: 1,
    description: 'Supertonic step triggered at 20% video progress.',
  },
  {
    id: 'E4',
    keyLabel: '3',
    keyboardCode: 'Digit3',
    noteName: 'E4',
    solfege: 'Mi',
    scaleDegree: 'Major 3rd (III)',
    frequencyHz: 329.63,
    youtubeSeekPercent: 30,
    isSharp: false,
    naturalIndex: 2,
    description: 'Major third defining the bright triad color at 30%.',
  },
  {
    id: 'F4',
    keyLabel: '4',
    keyboardCode: 'Digit4',
    noteName: 'F4',
    solfege: 'Fa',
    scaleDegree: 'Perfect 4th (IV)',
    frequencyHz: 349.23,
    youtubeSeekPercent: 40,
    isSharp: false,
    naturalIndex: 3,
    description: 'Subdominant tone placed at 40% of total runtime.',
  },
  {
    id: 'G4',
    keyLabel: '5',
    keyboardCode: 'Digit5',
    noteName: 'G4',
    solfege: 'Sol',
    scaleDegree: 'Perfect 5th (V)',
    frequencyHz: 392.0,
    youtubeSeekPercent: 50,
    isSharp: false,
    naturalIndex: 4,
    description: 'Dominant center resting exactly at the 50% midpoint.',
  },
  {
    id: 'A4',
    keyLabel: '6',
    keyboardCode: 'Digit6',
    noteName: 'A4',
    solfege: 'La',
    scaleDegree: 'Major 6th (VI)',
    frequencyHz: 440.0,
    youtubeSeekPercent: 60,
    isSharp: false,
    naturalIndex: 5,
    description: 'Concert A440 pitch reference at the 60% mark.',
  },
  {
    id: 'B4',
    keyLabel: '7',
    keyboardCode: 'Digit7',
    noteName: 'B4',
    solfege: 'Ti',
    scaleDegree: 'Major 7th (VII)',
    frequencyHz: 493.88,
    youtubeSeekPercent: 70,
    isSharp: false,
    naturalIndex: 6,
    description: 'Leading tone resolving upward at 70% progress.',
  },
  {
    id: 'C5',
    keyLabel: '8',
    keyboardCode: 'Digit8',
    noteName: 'C5',
    solfege: 'Do (Oct)',
    scaleDegree: 'Octave (VIII)',
    frequencyHz: 523.25,
    youtubeSeekPercent: 80,
    isSharp: false,
    naturalIndex: 7,
    description: 'High C octave anchor triggered at the 80% slice.',
  },
  {
    id: 'D5',
    keyLabel: '9',
    keyboardCode: 'Digit9',
    noteName: 'D5',
    solfege: 'Re (9th)',
    scaleDegree: 'Major 9th (IX)',
    frequencyHz: 587.33,
    youtubeSeekPercent: 90,
    isSharp: false,
    naturalIndex: 8,
    description: 'Upper ninth extension at the final 90% jump point.',
  },
  {
    id: 'E5',
    keyLabel: '0',
    keyboardCode: 'Digit0',
    noteName: 'E5',
    solfege: 'Mi (10th)',
    scaleDegree: 'Major 10th (X)',
    frequencyHz: 659.25,
    youtubeSeekPercent: 0,
    isSharp: false,
    naturalIndex: 9,
    description: 'Placed at 0% (0:00) so physical key 0 completes the ascending row.',
  },
];

// Chromatic ebony keys positioned between the 10 natural keys (playable via pointer/touch)
export const SHARP_KEYS: PianoKeySpec[] = [
  {
    id: 'C#4',
    keyLabel: 'C♯4',
    keyboardCode: 'KeyW',
    noteName: 'C♯4',
    solfege: 'Di',
    scaleDegree: 'Chromatic (b2)',
    frequencyHz: 277.18,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 0,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'D#4',
    keyLabel: 'D♯4',
    keyboardCode: 'KeyE',
    noteName: 'D♯4',
    solfege: 'Ri',
    scaleDegree: 'Chromatic (b3)',
    frequencyHz: 311.13,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 1,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'F#4',
    keyLabel: 'F♯4',
    keyboardCode: 'KeyT',
    noteName: 'F♯4',
    solfege: 'Fi',
    scaleDegree: 'Chromatic (#4)',
    frequencyHz: 369.99,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 3,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'G#4',
    keyLabel: 'G♯4',
    keyboardCode: 'KeyY',
    noteName: 'G♯4',
    solfege: 'Si',
    scaleDegree: 'Chromatic (#5)',
    frequencyHz: 415.3,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 4,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'A#4',
    keyLabel: 'A♯4',
    keyboardCode: 'KeyU',
    noteName: 'A♯4',
    solfege: 'Li',
    scaleDegree: 'Chromatic (b7)',
    frequencyHz: 466.16,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 5,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'C#5',
    keyLabel: 'C♯5',
    keyboardCode: 'KeyO',
    noteName: 'C♯5',
    solfege: 'Di',
    scaleDegree: 'Chromatic (b9)',
    frequencyHz: 554.37,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 7,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
  {
    id: 'D#5',
    keyLabel: 'D♯5',
    keyboardCode: 'KeyP',
    noteName: 'D♯5',
    solfege: 'Ri',
    scaleDegree: 'Chromatic (#9)',
    frequencyHz: 622.25,
    youtubeSeekPercent: null,
    isSharp: true,
    naturalIndex: 8,
    description: 'Studio chromatic accidental (not in YouTube 0–9 map).',
  },
];

export const ALL_KEYS: PianoKeySpec[] = [...NUMBER_KEYS, ...SHARP_KEYS];

export const SONG_SCORES: SongScore[] = [
  {
    id: 'fly-me-to-the-moon',
    title: 'Fly Me to the Moon',
    composer: 'Bart Howard · Fan Transcription',
    originNote: 'Transcribed directly from top YouTube comments on BcL2AhaHJAg',
    tempoBpm: 112,
    phrases: [
      ['8', '7', '6', '5', '4'],
      ['5', '6', '8', '7'],
      ['6', '5', '4', '3'],
      ['6', '5', '4', '3', '2'],
      ['3', '4', '6', '5'],
      ['4', '3', '2', '1'],
    ],
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    originNote: 'Classic 5-note diatonic melody spanning keys 1 through 5',
    tempoBpm: 118,
    phrases: [
      ['3', '3', '4', '5'],
      ['5', '4', '3', '2'],
      ['1', '1', '2', '3'],
      ['3', '2', '2'],
      ['3', '3', '4', '5'],
      ['5', '4', '3', '2'],
      ['1', '1', '2', '3'],
      ['2', '1', '1'],
    ],
  },
  {
    id: 'twinkle-star',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional (C Major)',
    originNote: 'Ideal starter pattern demonstrating 5th and 6th scale leaps',
    tempoBpm: 108,
    phrases: [
      ['1', '1', '5', '5', '6', '6', '5'],
      ['4', '4', '3', '3', '2', '2', '1'],
      ['5', '5', '4', '4', '3', '3', '2'],
      ['5', '5', '4', '4', '3', '3', '2'],
      ['1', '1', '5', '5', '6', '6', '5'],
      ['4', '4', '3', '3', '2', '2', '1'],
    ],
  },
  {
    id: 'canon-in-c',
    title: 'Canon in C (Theme)',
    composer: 'Johann Pachelbel · Transposed',
    originNote: 'Uses the full 1–0 span including the 0 (E5) upper-register peak',
    tempoBpm: 96,
    phrases: [
      ['0', '9', '8', '7', '6', '5', '6', '7'],
      ['8', '7', '6', '5', '4', '3', '4', '2'],
      ['1', '3', '5', '4', '3', '1', '3', '2'],
      ['1', '6', '5', '4', '3', '2', '1'],
    ],
  },
];

export const ENGINEERING_FINDINGS = [
  {
    index: '01.',
    title: 'The Seekbar Shortcut Hack',
    summary:
      'On desktop YouTube, pressing number keys 0 through 9 jumps playback immediately to 0%, 10%, 20%... up to 90% of the video duration. By pacing ten distinct piano recordings at exact decile intervals, a passive video timeline behaves like a sampled keyboard.',
  },
  {
    index: '02.',
    title: 'Why 0 Sits at Zero Percent',
    summary:
      'Keys 1 through 9 naturally step from 10% (C4) to 90% (D5). Because a physical keyboard places 0 immediately to the right of 9, placing E5 at the 0% mark (0:00) ensures pressing 1–2–3–4–5–6–7–8–9–0 produces an unbroken ascending C major scale.',
  },
  {
    index: '03.',
    title: 'From Buffering Lag to Acoustic Synthesis',
    summary:
      'Seeking an H.264/VP9 video stream introduces 180–450ms keyframe latency, cuts off sustain on the next note, and fails completely in mobile YouTube apps. Web Audio harmonic synthesis eliminates seek delay, restores true polyphony, and adds damper pedal sustain.',
  },
];

export const COMPARISON_METRICS = [
  {
    dimension: 'Trigger Latency',
    youtubePlayer: '180–450 ms (keyframe seek)',
    webStudio: '< 5 ms (instant AudioContext)',
  },
  {
    dimension: 'Polyphony & Chords',
    youtubePlayer: 'Monophonic (1 stream seek)',
    webStudio: 'Full Polyphony (multi-key)',
  },
  {
    dimension: 'Mobile & Touch',
    youtubePlayer: 'Unsupported in mobile app',
    webStudio: 'Multi-touch ready on all screens',
  },
  {
    dimension: 'Damper Sustain',
    youtubePlayer: 'Cuts abruptly on next key',
    webStudio: 'Spacebar pedal + hall reverb',
  },
];
