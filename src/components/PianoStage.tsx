import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import {
  HarmonyMode,
  INSTRUMENTS,
  InstrumentId,
  pianoEngine,
} from '../audio/pianoEngine';
import {
  ALL_KEYS,
  NUMBER_KEYS,
  PianoKeySpec,
  SHARP_KEYS,
  SONG_SCORES,
  SongScore,
} from '../data/videoAnalysis';
import { NoteWaterfall, WaterfallPulse } from './NoteWaterfall';

interface RecordedEvent {
  keySpec: PianoKeySpec;
  offsetMs: number;
}

interface AiGuideResponse {
  title: string;
  tempoBpm: number;
  coachingTip: string;
  phrases: { label: string; notes: string[] }[];
}

interface PianoStageProps {
  externalActiveNoteId: string | null;
  onNoteTriggered?: (keySpec: PianoKeySpec) => void;
}

const HARMONY_OPTIONS: { id: HarmonyMode; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'octave', label: 'Octave' },
  { id: 'triad', label: 'Triad' },
];

const AI_STYLE_OPTIONS = ['Melodic', 'Beginner', 'Expressive'] as const;
type AiStyle = (typeof AI_STYLE_OPTIONS)[number];

export const PianoStage: React.FC<PianoStageProps> = ({
  externalActiveNoteId,
  onNoteTriggered,
}) => {
  const [activeKeyIds, setActiveKeyIds] = useState<Set<string>>(new Set());
  const [lastTriggeredKey, setLastTriggeredKey] = useState<PianoKeySpec>(NUMBER_KEYS[0]);
  const [instrument, setInstrument] = useState<InstrumentId>('concert-grand');
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('single');
  const [octaveOffset, setOctaveOffset] = useState<-1 | 0 | 1>(0);
  const [sustainOn, setSustainOn] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [volume, setVolume] = useState(82);
  const [reverbMix, setReverbMix] = useState(30);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);

  // Songbook + AI custom songs state
  const [aiSongs, setAiSongs] = useState<SongScore[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>(SONG_SCORES[0].id);
  const [tempoBpm, setTempoBpm] = useState<number>(SONG_SCORES[0].tempoBpm);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [followAlongActive, setFollowAlongActive] = useState(true);
  const [songStepIndex, setSongStepIndex] = useState(0);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  // Real measured practice stats during Follow-Along
  const [practiceHits, setPracticeHits] = useState(0);
  const [practiceAttempts, setPracticeAttempts] = useState(0);
  const [practiceStreak, setPracticeStreak] = useState(0);

  // Recent user-played digits for AI "Continue My Notes" coaching
  const [recentPlayedDigits, setRecentPlayedDigits] = useState<string[]>([]);

  // AI Note Guide state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState<AiStyle>('Melodic');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);

  const recordStartRef = useRef<number>(0);
  const demoTimerRef = useRef<number | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const metronomeBeatRef = useRef<number>(0);
  const replayTimersRef = useRef<number[]>([]);
  const pressedCodeRef = useRef<Map<string, PianoKeySpec>>(new Map());
  const keyboardContainerRef = useRef<HTMLDivElement | null>(null);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  // Waterfall canvas pulse queue
  const pulsesRef = useRef<WaterfallPulse[]>([]);
  const pulseIdCounterRef = useRef<number>(1);
  const activePulseByKeyRef = useRef<Map<string, number>>(new Map());

  const allAvailableSongs = useMemo(
    () => [...aiSongs, ...SONG_SCORES],
    [aiSongs]
  );

  const selectedSong = useMemo(
    () =>
      allAvailableSongs.find((s) => s.id === selectedSongId) ?? allAvailableSongs[0],
    [allAvailableSongs, selectedSongId]
  );

  const activeInstrumentProfile = useMemo(
    () => INSTRUMENTS.find((i) => i.id === instrument) ?? INSTRUMENTS[0],
    [instrument]
  );

  const flattenedSongSteps = useMemo(() => {
    const steps: {
      keyLabel: string;
      phraseIdx: number;
      noteIdx: number;
      flatIdx: number;
    }[] = [];
    let flatIdx = 0;
    selectedSong.phrases.forEach((phrase, phraseIdx) => {
      phrase.forEach((keyLabel, noteIdx) => {
        steps.push({ keyLabel, phraseIdx, noteIdx, flatIdx });
        flatIdx += 1;
      });
    });
    return steps;
  }, [selectedSong]);

  const upcomingDigits = useMemo(() => {
    if (!followAlongActive && !isPlayingDemo) return [];
    return flattenedSongSteps
      .slice(songStepIndex, songStepIndex + 6)
      .map((s) => s.keyLabel);
  }, [flattenedSongSteps, followAlongActive, isPlayingDemo, songStepIndex]);

  const targetFollowKeyLabel =
    followAlongActive && songStepIndex < flattenedSongSteps.length
      ? flattenedSongSteps[songStepIndex].keyLabel
      : null;

  const keyByDigitMap = useMemo(() => {
    const map = new Map<string, PianoKeySpec>();
    for (const k of NUMBER_KEYS) {
      map.set(k.keyLabel, k);
    }
    return map;
  }, []);

  const keyByCodeMap = useMemo(() => {
    const map = new Map<string, PianoKeySpec>();
    for (const k of ALL_KEYS) {
      map.set(k.keyboardCode, k);
      if (k.keyboardCode.startsWith('Digit')) {
        const digit = k.keyboardCode.replace('Digit', '');
        map.set(`Numpad${digit}`, k);
      }
    }
    return map;
  }, []);

  const targetFollowSpec = targetFollowKeyLabel
    ? keyByDigitMap.get(targetFollowKeyLabel) ?? null
    : null;

  const activeLaneIndices = useMemo(() => {
    const lanes = new Set<number>();
    NUMBER_KEYS.forEach((k, idx) => {
      if (activeKeyIds.has(k.id) || externalActiveNoteId === k.id) {
        lanes.add(idx);
      }
    });
    return lanes;
  }, [activeKeyIds, externalActiveNoteId]);

  const stopDemoPlayback = useCallback(() => {
    if (demoTimerRef.current !== null) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    setIsPlayingDemo(false);
  }, []);

  const clearReplayTimers = useCallback(() => {
    for (const id of replayTimersRef.current) {
      window.clearTimeout(id);
    }
    replayTimersRef.current = [];
    setIsReplaying(false);
  }, []);

  const handleInstrumentChange = (next: InstrumentId) => {
    setInstrument(next);
    pianoEngine.setInstrument(next);
  };

  const handleHarmonyChange = (next: HarmonyMode) => {
    setHarmonyMode(next);
    pianoEngine.setHarmonyMode(next);
  };

  const handleVolumeChange = (nextVal: number) => {
    setVolume(nextVal);
    pianoEngine.setVolume(nextVal / 100);
  };

  const handleReverbChange = (nextVal: number) => {
    setReverbMix(nextVal);
    pianoEngine.setReverbMix(nextVal / 100);
  };

  const toggleSustain = useCallback(() => {
    setSustainOn((prev) => {
      const next = !prev;
      pianoEngine.setSustain(next);
      return next;
    });
  }, []);

  const getEffectiveKeySpec = useCallback(
    (keySpec: PianoKeySpec): PianoKeySpec => {
      if (octaveOffset === 0) return keySpec;
      const multiplier = Math.pow(2, octaveOffset);
      const shiftedNoteName = keySpec.noteName.replace(/\d+$/, (match) =>
        String(Number(match) + octaveOffset)
      );
      return {
        ...keySpec,
        noteName: shiftedNoteName,
        frequencyHz: Number((keySpec.frequencyHz * multiplier).toFixed(2)),
      };
    },
    [octaveOffset]
  );

  const pressKey = useCallback(
    (rawKeySpec: PianoKeySpec, fromFollowOrDemo = false) => {
      const keySpec = getEffectiveKeySpec(rawKeySpec);
      pianoEngine.noteOn(keySpec.id, keySpec.frequencyHz, 0.9);
      setLastTriggeredKey(keySpec);
      setActiveKeyIds((prev) => {
        const next = new Set(prev);
        next.add(keySpec.id);
        return next;
      });
      onNoteTriggered?.(keySpec);

      if (typeof keySpec.naturalIndex === 'number' && !keySpec.isSharp) {
        const pulseId = pulseIdCounterRef.current++;
        activePulseByKeyRef.current.set(keySpec.id, pulseId);
        pulsesRef.current.push({
          id: pulseId,
          laneIndex: keySpec.naturalIndex,
          label: keySpec.keyLabel,
          startedAt: performance.now(),
          releasedAt: null,
        });
      }

      if (!fromFollowOrDemo && !keySpec.isSharp) {
        setRecentPlayedDigits((prev) => [...prev.slice(-15), keySpec.keyLabel]);
      }

      if (isRecording && !fromFollowOrDemo) {
        setRecordedEvents((prev) => [
          ...prev,
          { keySpec, offsetMs: performance.now() - recordStartRef.current },
        ]);
      }

      if (followAlongActive && !fromFollowOrDemo) {
        const expected = flattenedSongSteps[songStepIndex]?.keyLabel;
        if (expected) {
          setPracticeAttempts((n) => n + 1);
          if (keySpec.keyLabel === expected) {
            setPracticeHits((n) => n + 1);
            setPracticeStreak((s) => s + 1);
            setCompletedMessage(null);
            if (songStepIndex + 1 >= flattenedSongSteps.length) {
              setCompletedMessage(
                `Completed "${selectedSong.title}". Press key ${flattenedSongSteps[0]?.keyLabel ?? '1'} to replay or ask the AI guide for a continuation.`
              );
              setSongStepIndex(0);
            } else {
              setSongStepIndex((idx) => idx + 1);
            }
          } else {
            setPracticeStreak(0);
          }
        }
      }
    },
    [
      flattenedSongSteps,
      followAlongActive,
      getEffectiveKeySpec,
      isRecording,
      onNoteTriggered,
      selectedSong.title,
      songStepIndex,
    ]
  );

  const releaseKey = useCallback((keySpec: PianoKeySpec) => {
    pianoEngine.noteOff(keySpec.id);
    setActiveKeyIds((prev) => {
      if (!prev.has(keySpec.id)) return prev;
      const next = new Set(prev);
      next.delete(keySpec.id);
      return next;
    });

    const pulseId = activePulseByKeyRef.current.get(keySpec.id);
    if (pulseId !== undefined) {
      activePulseByKeyRef.current.delete(keySpec.id);
      const pulse = pulsesRef.current.find((p) => p.id === pulseId);
      if (pulse && pulse.releasedAt === null) {
        pulse.releasedAt = performance.now();
      }
    }
  }, []);

  // Metronome loop synced to tempoBpm
  useEffect(() => {
    if (!metronomeOn) {
      if (metronomeTimerRef.current !== null) {
        window.clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
      metronomeBeatRef.current = 0;
      return;
    }

    const intervalMs = Math.round((60 / tempoBpm) * 1000);
    const tick = () => {
      const accent = metronomeBeatRef.current % 4 === 0;
      pianoEngine.playMetronomeClick(accent);
      metronomeBeatRef.current += 1;
    };
    tick();
    metronomeTimerRef.current = window.setInterval(tick, intervalMs);

    return () => {
      if (metronomeTimerRef.current !== null) {
        window.clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
    };
  }, [metronomeOn, tempoBpm]);

  // Physical keyboard support: top-row 1-9/0, Numpad 1-9/0, W/E/T/Y/U/O/P sharps, -/+ octave, M metronome, Space sustain
  useEffect(() => {
    const isTextEntryElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'select' || target.isContentEditable) {
        return true;
      }
      if (tag === 'input') {
        const inputType = (target as HTMLInputElement).type.toLowerCase();
        return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(
          inputType
        );
      }
      return false;
    };

    const onFocusIn = (e: FocusEvent) => {
      setIsTextInputFocused(isTextEntryElement(e.target));
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        setIsTextInputFocused(isTextEntryElement(document.activeElement));
      }, 0);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          document.activeElement instanceof HTMLElement &&
          isTextEntryElement(document.activeElement)
        ) {
          document.activeElement.blur();
          keyboardContainerRef.current?.focus();
          setIsTextInputFocused(false);
        }
        return;
      }

      if (isTextEntryElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '-' || e.key === '[') {
        e.preventDefault();
        setOctaveOffset((prev) => (prev > -1 ? ((prev - 1) as -1 | 0 | 1) : prev));
        return;
      }
      if (e.key === '=' || e.key === '+' || e.key === ']') {
        e.preventDefault();
        setOctaveOffset((prev) => (prev < 1 ? ((prev + 1) as -1 | 0 | 1) : prev));
        return;
      }
      if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
        e.preventDefault();
        setMetronomeOn((prev) => !prev);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          setSustainOn(true);
          pianoEngine.setSustain(true);
        }
        return;
      }

      const spec = keyByCodeMap.get(e.code) ?? keyByDigitMap.get(e.key);
      if (spec && !pressedCodeRef.current.has(e.code || spec.id)) {
        e.preventDefault();
        const trackingKey = e.code || spec.id;
        pressedCodeRef.current.set(trackingKey, spec);
        pressKey(spec);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!isTextEntryElement(e.target)) {
          e.preventDefault();
        }
        setSustainOn(false);
        pianoEngine.setSustain(false);
        return;
      }

      const trackingKey = e.code || '';
      const tracked = pressedCodeRef.current.get(trackingKey);
      const spec = tracked ?? keyByCodeMap.get(e.code) ?? keyByDigitMap.get(e.key);
      if (spec) {
        pressedCodeRef.current.delete(trackingKey);
        releaseKey(spec);
      }
    };

    const onWindowBlur = () => {
      for (const [, spec] of pressedCodeRef.current) {
        releaseKey(spec);
      }
      pressedCodeRef.current.clear();
      setSustainOn(false);
      pianoEngine.setSustain(false);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [keyByCodeMap, keyByDigitMap, pressKey, releaseKey]);

  // Demo playback loop
  useEffect(() => {
    if (!isPlayingDemo) return;

    let currentStep =
      songStepIndex >= flattenedSongSteps.length ? 0 : songStepIndex;
    const stepMs = Math.round((60 / tempoBpm) * 1000 * 0.68);

    const scheduleNext = () => {
      if (currentStep >= flattenedSongSteps.length) {
        setIsPlayingDemo(false);
        setSongStepIndex(0);
        return;
      }

      const step = flattenedSongSteps[currentStep];
      const spec = keyByDigitMap.get(step.keyLabel);
      setSongStepIndex(currentStep);

      if (spec) {
        pressKey(spec, true);
        window.setTimeout(() => {
          releaseKey(spec);
        }, Math.max(180, stepMs * 0.78));
      }

      currentStep += 1;
      demoTimerRef.current = window.setTimeout(scheduleNext, stepMs);
    };

    scheduleNext();

    return () => {
      if (demoTimerRef.current !== null) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayingDemo, selectedSongId, tempoBpm]);

  useEffect(() => {
    return () => {
      stopDemoPlayback();
      clearReplayTimers();
      if (metronomeTimerRef.current !== null) {
        window.clearInterval(metronomeTimerRef.current);
      }
      pianoEngine.stopAll();
    };
  }, [clearReplayTimers, stopDemoPlayback]);

  const handleSelectSong = (song: SongScore) => {
    stopDemoPlayback();
    setCompletedMessage(null);
    setSelectedSongId(song.id);
    setTempoBpm(song.tempoBpm);
    setSongStepIndex(0);
    setPracticeHits(0);
    setPracticeAttempts(0);
    setPracticeStreak(0);
  };

  const handleToggleDemo = () => {
    if (isPlayingDemo) {
      stopDemoPlayback();
    } else {
      setFollowAlongActive(false);
      setCompletedMessage(null);
      setSongStepIndex(0);
      setIsPlayingDemo(true);
    }
  };

  const handleToggleFollowAlong = () => {
    stopDemoPlayback();
    setCompletedMessage(null);
    setFollowAlongActive((prev) => !prev);
    setSongStepIndex(0);
    setPracticeHits(0);
    setPracticeAttempts(0);
    setPracticeStreak(0);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      clearReplayTimers();
      setRecordedEvents([]);
      recordStartRef.current = performance.now();
      setIsRecording(true);
    }
  };

  const handleReplayRecording = () => {
    if (recordedEvents.length === 0 || isReplaying) return;
    stopDemoPlayback();
    setIsReplaying(true);

    const maxOffset = recordedEvents[recordedEvents.length - 1].offsetMs;
    recordedEvents.forEach((evt) => {
      const t1 = window.setTimeout(() => {
        pressKey(evt.keySpec, true);
        const t2 = window.setTimeout(() => releaseKey(evt.keySpec), 260);
        replayTimersRef.current.push(t2);
      }, evt.offsetMs);
      replayTimersRef.current.push(t1);
    });

    const endTimer = window.setTimeout(() => {
      setIsReplaying(false);
    }, maxOffset + 350);
    replayTimersRef.current.push(endTimer);
  };

  const requestAiGuide = async (
    mode: 'song' | 'coach',
    overridePrompt?: string
  ) => {
    const rawPrompt = (overridePrompt ?? aiPrompt).trim();
    if (mode === 'song' && !rawPrompt) {
      setAiError('Describe a song, mood, or scale for the AI guide.');
      return;
    }

    const promptToSend =
      mode === 'song'
        ? `${rawPrompt} (Style: ${aiStyle})`
        : rawPrompt;

    setAiLoading(true);
    setAiError(null);
    stopDemoPlayback();

    try {
      const response = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: promptToSend,
          recentNotes: recentPlayedDigits,
          instrument: activeInstrumentProfile.label,
        }),
      });

      const payload = (await response.json()) as Partial<AiGuideResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || 'The AI note guide could not complete this request.'
        );
      }

      if (!payload.phrases || payload.phrases.length === 0) {
        throw new Error('The AI note guide did not return any playable notes.');
      }

      const newSongId = `ai-${Date.now()}`;
      const newSong: SongScore = {
        id: newSongId,
        title: payload.title || 'AI Guided Score',
        composer: `AI Note Guide · ${activeInstrumentProfile.label}`,
        originNote:
          payload.coachingTip ||
          'Follow the highlighted keys step-by-step on your keyboard.',
        tempoBpm: payload.tempoBpm || 108,
        phrases: payload.phrases.map((p) => p.notes),
        phraseLabels: payload.phrases.map((p) => p.label),
        coachingTip: payload.coachingTip,
      };

      setAiSongs((prev) => [newSong, ...prev].slice(0, 4));
      setSelectedSongId(newSongId);
      setTempoBpm(newSong.tempoBpm);
      setSongStepIndex(0);
      setPracticeHits(0);
      setPracticeAttempts(0);
      setPracticeStreak(0);
      setFollowAlongActive(true);
      setCompletedMessage(null);
      if (mode === 'song' && !overridePrompt) {
        setAiPrompt('');
      }
      keyboardContainerRef.current?.focus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach the AI note guide.';
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  const decileTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const selectedAiTip = selectedSong.coachingTip;
  const accuracyPct =
    practiceAttempts > 0 ? Math.round((practiceHits / practiceAttempts) * 100) : null;

  return (
    <section
      aria-label="Interactive Multi-Instrument Studio & AI Guide"
      className="rounded-xl border border-white/10 bg-[#13151A] p-5 md:p-7"
    >
      {/* Zone 1: Studio Instrument & FX Control Deck */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          {/* 7-Instrument Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[#9BA0AC]">
              Instrument · {activeInstrumentProfile.family}
            </span>
            <div
              role="group"
              aria-label="Select instrument"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#0B0C0E] p-1"
            >
              {INSTRUMENTS.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => handleInstrumentChange(inst.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                    instrument === inst.id
                      ? 'bg-[#D4A359] font-semibold text-[#0B0C0E]'
                      : 'text-[#9BA0AC] hover:text-[#F4F3EE]'
                  }`}
                >
                  {inst.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harmony Voicing & Octave */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[#9BA0AC]">
                Key Harmony
              </span>
              <div
                role="group"
                aria-label="Harmony layering mode"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0B0C0E] p-1"
              >
                {HARMONY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleHarmonyChange(opt.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      harmonyMode === opt.id
                        ? 'bg-[#22252E] text-[#D4A359]'
                        : 'text-[#9BA0AC] hover:text-[#F4F3EE]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[#9BA0AC]">
                Octave (-/+)
              </span>
              <div
                role="group"
                aria-label="Octave shift"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0B0C0E] p-1"
              >
                {([-1, 0, 1] as const).map((oct) => (
                  <button
                    key={oct}
                    type="button"
                    onClick={() => setOctaveOffset(oct)}
                    className={`font-mono-tabular rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      octaveOffset === oct
                        ? 'bg-[#22252E] text-[#D4A359]'
                        : 'text-[#9BA0AC] hover:text-[#F4F3EE]'
                    }`}
                  >
                    {oct > 0 ? `+${oct}` : oct}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Second Studio Row: Sustain, Metronome, Hall Reverb, Volume, Record */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleSustain}
              aria-pressed={sustainOn}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                sustainOn
                  ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#F4F3EE]'
                  : 'border-white/12 bg-[#0B0C0E] text-[#A6AAB5] hover:text-[#F4F3EE]'
              }`}
            >
              <span>Sustain (Space)</span>
              <span className="font-mono-tabular text-[11px] text-[#D4A359]">
                {sustainOn ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMetronomeOn((prev) => !prev)}
              aria-pressed={metronomeOn}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                metronomeOn
                  ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#F4F3EE]'
                  : 'border-white/12 bg-[#0B0C0E] text-[#A6AAB5] hover:text-[#F4F3EE]'
              }`}
            >
              <span>Metronome (M)</span>
              <span className="font-mono-tabular text-[11px] text-[#D4A359]">
                {metronomeOn ? `${tempoBpm}` : 'OFF'}
              </span>
            </button>

            <label className="flex items-center gap-2 text-xs text-[#A6AAB5]">
              <span>Hall</span>
              <input
                type="range"
                min={0}
                max={80}
                value={reverbMix}
                onChange={(e) => handleReverbChange(Number(e.target.value))}
                aria-label="Concert hall reverb mix"
                className="h-1.5 w-16 cursor-pointer accent-[#D4A359]"
              />
              <span className="font-mono-tabular w-8 text-[#F4F3EE]">{reverbMix}%</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-[#A6AAB5]">
              <Volume2 className="h-3.5 w-3.5 text-[#A6AAB5]" aria-hidden="true" />
              <span className="sr-only">Master volume</span>
              <input
                type="range"
                min={15}
                max={100}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Master volume"
                className="h-1.5 w-16 cursor-pointer accent-[#D4A359]"
              />
              <span className="font-mono-tabular w-8 text-[#F4F3EE]">{volume}%</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                isRecording
                  ? 'border-[#DC2626] bg-[#DC2626]/15 text-[#FCA5A5]'
                  : 'border-white/12 bg-[#0B0C0E] text-[#D2D5DE] hover:border-white/25'
              }`}
            >
              {isRecording ? (
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              ) : (
                <Circle
                  className="h-3.5 w-3.5 fill-current text-[#DC2626]"
                  aria-hidden="true"
                />
              )}
              <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
            </button>

            <button
              type="button"
              onClick={handleReplayRecording}
              disabled={recordedEvents.length === 0 || isReplaying || isRecording}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#0B0C0E] px-3 py-1.5 text-xs font-medium text-[#D2D5DE] whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#D4A359]"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Replay{recordedEvents.length > 0 ? ` (${recordedEvents.length})` : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Live AI Guide Banner */}
      {followAlongActive && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D4A359]/35 bg-[#0B0C0E] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-[#D4A359]">Live Guide</span>
            <span aria-hidden="true" className="text-white/20">
              ·
            </span>
            {targetFollowSpec ? (
              <span className="text-[#F4F3EE]">
                Press{' '}
                <strong className="font-mono-tabular text-sm text-[#D4A359]">
                  {targetFollowSpec.keyLabel}
                </strong>{' '}
                ({getEffectiveKeySpec(targetFollowSpec).noteName} · {targetFollowSpec.solfege})
              </span>
            ) : (
              <span className="text-[#F4F3EE]">Score ready</span>
            )}
            {selectedAiTip && (
              <>
                <span aria-hidden="true" className="hidden sm:inline text-white/20">
                  ·
                </span>
                <span className="text-[#A6AAB5]">{selectedAiTip}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {accuracyPct !== null && (
              <span className="font-mono-tabular text-[#D2D5DE]">
                Accuracy: <strong className="text-[#D4A359]">{accuracyPct}%</strong> · Streak:{' '}
                <strong className="text-[#F4F3EE]">{practiceStreak}</strong>
              </span>
            )}
            <span className="font-mono-tabular text-[#9BA0AC]">
              Step {Math.min(songStepIndex + 1, flattenedSongSteps.length)} /{' '}
              {flattenedSongSteps.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setSongStepIndex(0);
                setPracticeHits(0);
                setPracticeAttempts(0);
                setPracticeStreak(0);
                setCompletedMessage(null);
              }}
              className="inline-flex items-center gap-1 text-[#A6AAB5] hover:text-[#F4F3EE]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Restart</span>
            </button>
          </div>
        </div>
      )}

      {completedMessage && (
        <p className="mt-3 rounded-lg border border-white/10 bg-[#0B0C0E] px-4 py-2.5 text-xs text-[#D4A359]">
          {completedMessage}
        </p>
      )}

      {/* Zone 2: Falling-Notes Waterfall + Sculpted 10-Key Keyboard */}
      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9BA0AC]">
          <div className="flex flex-wrap items-center gap-2">
            {isTextInputFocused ? (
              <button
                type="button"
                onClick={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  keyboardContainerRef.current?.focus();
                  setIsTextInputFocused(false);
                }}
                className="rounded border border-[#D4A359]/50 bg-[#D4A359]/10 px-2.5 py-1 text-xs font-medium text-[#D4A359] hover:bg-[#D4A359]/20"
              >
                Typing in text field · Click here or press Esc to play keys 1–0
              </button>
            ) : (
              <span>
                Number Keys Active:{' '}
                <strong className="font-mono-tabular text-[#F4F3EE]">1–9, 0</strong>{' '}
                (Top row or Numpad · <strong className="font-mono-tabular text-[#F4F3EE]">W/E/T/Y/U/O/P</strong> sharps)
              </span>
            )}
          </div>
          <span className="font-mono-tabular">
            {activeInstrumentProfile.label} ·{' '}
            <strong className="text-[#D4A359]">{lastTriggeredKey.noteName}</strong> ·{' '}
            {lastTriggeredKey.frequencyHz.toFixed(2)} Hz ·{' '}
            {lastTriggeredKey.youtubeSeekPercent !== null
              ? `YouTube Seek ${lastTriggeredKey.youtubeSeekPercent}%`
              : 'Chromatic Sharp'}
          </span>
        </div>

        <div
          ref={keyboardContainerRef}
          tabIndex={0}
          className="relative touch-none select-none rounded-xl border border-white/12 bg-[#07080A] p-2.5 sm:p-3.5 focus-visible:outline-2 focus-visible:outline-[#D4A359]"
          role="application"
          aria-label="10-key playable instrument keyboard"
        >
          {/* Live Waterfall & Web Audio Oscilloscope */}
          <NoteWaterfall
            activeLaneIndices={activeLaneIndices}
            pulsesRef={pulsesRef}
            upcomingDigits={upcomingDigits}
            guideActive={followAlongActive || isPlayingDemo}
          />

          {/* Crimson Felt Fallboard Strip */}
          <div
            className="mb-1.5 h-2 w-full rounded-sm bg-gradient-to-b from-[#6F1E20] to-[#431012] shadow-inner"
            aria-hidden="true"
          />

          <div className="relative h-56 w-full sm:h-64">
            <div className="grid h-full grid-cols-10 gap-1 sm:gap-1.5">
              {NUMBER_KEYS.map((rawKeySpec) => {
                const keySpec = getEffectiveKeySpec(rawKeySpec);
                const isPressed =
                  activeKeyIds.has(keySpec.id) || externalActiveNoteId === keySpec.id;
                const isGuidedTarget = targetFollowKeyLabel === keySpec.keyLabel;

                return (
                  <button
                    key={keySpec.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pressKey(rawKeySpec);
                    }}
                    onPointerUp={() => releaseKey(rawKeySpec)}
                    onPointerLeave={() => releaseKey(rawKeySpec)}
                    onPointerCancel={() => releaseKey(rawKeySpec)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') pressKey(rawKeySpec);
                    }}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') releaseKey(rawKeySpec);
                    }}
                    aria-label={`Key ${keySpec.keyLabel}, note ${keySpec.noteName}, YouTube seek ${keySpec.youtubeSeekPercent}%`}
                    className={`group relative flex h-full flex-col justify-between rounded-b-lg border px-1.5 py-3 text-center transition-transform duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A359] ${
                      isPressed
                        ? 'translate-y-1 border-[#D4A359] bg-gradient-to-b from-[#E5CF9F] to-[#D9BC82] text-[#0B0C0E] shadow-[inset_0_4px_10px_rgba(0,0,0,0.28)]'
                        : isGuidedTarget
                        ? 'border-[#D4A359] bg-gradient-to-b from-[#FFFDF7] to-[#F7E8C3] text-[#0B0C0E] ring-2 ring-[#D4A359] shadow-[0_6px_0_#A68950]'
                        : 'border-[#CFC9BA] bg-gradient-to-b from-[#FFFFFF] via-[#F7F4EC] to-[#EAE4D5] text-[#141519] shadow-[0_6px_0_#9A9383] hover:from-[#FFFFFF] hover:to-[#F3EFE4]'
                    }`}
                  >
                    <span
                      className={`font-mono-tabular text-[10px] font-medium sm:text-[11px] ${
                        isPressed || isGuidedTarget ? 'text-[#7B5215]' : 'text-[#6A6E79]'
                      }`}
                    >
                      {isGuidedTarget ? 'NEXT' : `${keySpec.youtubeSeekPercent}%`}
                    </span>

                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={`font-mono-tabular flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold transition-colors sm:h-8 sm:w-8 sm:text-base ${
                          isPressed || isGuidedTarget
                            ? 'bg-[#0B0C0E] text-[#D4A359]'
                            : 'bg-[#E2DCCE] text-[#141519]'
                        }`}
                      >
                        {keySpec.keyLabel}
                      </span>
                      <span className="text-[11px] font-semibold tracking-tight text-[#141519] sm:text-xs">
                        {keySpec.noteName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {SHARP_KEYS.map((rawSharp) => {
              const sharp = getEffectiveKeySpec(rawSharp);
              const isPressed =
                activeKeyIds.has(sharp.id) || externalActiveNoteId === sharp.id;
              const leftPercent = ((sharp.naturalIndex ?? 0) + 1) * 10 - 3.1;

              return (
                <button
                  key={sharp.id}
                  type="button"
                  style={{ left: `${leftPercent}%`, width: '6.2%' }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pressKey(rawSharp);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    releaseKey(rawSharp);
                  }}
                  onPointerLeave={() => releaseKey(rawSharp)}
                  onPointerCancel={() => releaseKey(rawSharp)}
                  aria-label={`Sharp note ${sharp.noteName}`}
                  className={`absolute top-0 z-20 flex h-[56%] flex-col items-center justify-end rounded-b-md border pb-2.5 transition-transform duration-75 focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                    isPressed
                      ? 'translate-y-0.5 border-[#D4A359] bg-gradient-to-b from-[#2A2D38] to-[#171920] text-[#D4A359] shadow-[0_2px_6px_rgba(0,0,0,0.8)]'
                      : 'border-[#050507] bg-gradient-to-b from-[#22252E] via-[#15171D] to-[#0B0C10] text-[#9BA0AC] shadow-[0_8px_14px_rgba(0,0,0,0.75)] hover:from-[#2C303B]'
                  }`}
                >
                  <span className="hidden font-mono-tabular text-[10px] font-medium sm:inline">
                    {sharp.noteName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live YouTube Timeline Seekbar Simulator (0% to 90%) */}
      <div className="mt-6 rounded-lg border border-white/10 bg-[#0B0C0E] p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[#D2D5DE]">
            Simulated YouTube Timeline Scrub Position (BcL2AhaHJAg)
          </span>
          <span className="font-mono-tabular text-[#9BA0AC]">
            {lastTriggeredKey.youtubeSeekPercent !== null
              ? `Key ${lastTriggeredKey.keyLabel} → Jump to ${lastTriggeredKey.youtubeSeekPercent}% (${lastTriggeredKey.noteName})`
              : `Chromatic ${lastTriggeredKey.noteName} (Studio extension)`}
          </span>
        </div>

        <div className="relative flex items-center justify-between gap-1 pt-1">
          {decileTicks.map((pct) => {
            const rawMappedKey = NUMBER_KEYS.find((k) => k.youtubeSeekPercent === pct);
            const mappedKey = rawMappedKey ? getEffectiveKeySpec(rawMappedKey) : undefined;
            const isActiveTick = lastTriggeredKey.youtubeSeekPercent === pct;

            return (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  if (rawMappedKey) {
                    pressKey(rawMappedKey, true);
                    window.setTimeout(() => releaseKey(rawMappedKey), 280);
                  }
                }}
                className={`group flex flex-1 flex-col items-center rounded-md py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                  isActiveTick ? 'bg-[#D4A359]/15' : 'hover:bg-white/5'
                }`}
              >
                <div
                  className={`mb-1.5 h-1.5 w-full rounded-full transition-colors ${
                    isActiveTick
                      ? 'bg-[#D4A359]'
                      : 'bg-white/15 group-hover:bg-white/30'
                  }`}
                />
                <span
                  className={`font-mono-tabular text-[11px] font-medium ${
                    isActiveTick ? 'text-[#D4A359]' : 'text-[#8C919E]'
                  }`}
                >
                  {pct}%
                </span>
                <span className="text-[11px] text-[#D2D5DE]">
                  {mappedKey ? `${mappedKey.keyLabel} · ${mappedKey.noteName}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone 3: AI Note Guide & Guided Songbook */}
      <div className="mt-6 border-t border-white/10 pt-6">
        <div className="rounded-lg border border-white/10 bg-[#0B0C0E] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F4F3EE]">
                AI Note Guide
              </h2>
              <p className="mt-0.5 text-xs text-[#9BA0AC]">
                Ask for any song, chord walk, or mood—or let the AI continue from the keys you just played.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {recentPlayedDigits.length > 0 && (
                <span className="font-mono-tabular text-xs text-[#9BA0AC]">
                  Played: {recentPlayedDigits.slice(-8).join('-')}
                </span>
              )}
              <div
                role="group"
                aria-label="AI arrangement style"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#13151A] p-0.5"
              >
                {AI_STYLE_OPTIONS.map((styleOpt) => (
                  <button
                    key={styleOpt}
                    type="button"
                    onClick={() => setAiStyle(styleOpt)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      aiStyle === styleOpt
                        ? 'bg-[#22252E] text-[#D4A359]'
                        : 'text-[#8C919E] hover:text-[#F4F3EE]'
                    }`}
                  >
                    {styleOpt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              aiInputRef.current?.blur();
              keyboardContainerRef.current?.focus();
              void requestAiGuide('song');
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              ref={aiInputRef}
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask for a melody or lesson (e.g. Happy Birthday, dreamy arpeggio, Mozart motif)..."
              aria-label="Ask AI Note Guide for a song or lesson"
              className="flex-1 rounded-lg border border-white/12 bg-[#13151A] px-3.5 py-2.5 text-sm text-[#F4F3EE] placeholder:text-[#6D7280] focus:border-[#D4A359] focus:outline-none"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D4A359] px-4 py-2.5 text-xs font-semibold text-[#0B0C0E] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E0B470] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#F4F3EE]"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Composing Notes...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Get AI Notes</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void requestAiGuide('coach')}
              className="rounded-md border border-[#D4A359]/40 bg-[#13151A] px-3 py-1.5 text-xs font-medium text-[#D4A359] whitespace-nowrap shrink-0 transition-colors hover:border-[#D4A359] hover:bg-[#D4A359]/10 disabled:opacity-50"
            >
              {recentPlayedDigits.length > 0
                ? 'Continue What I Just Played'
                : 'Give Me a Starter Riff'}
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void requestAiGuide('song', 'Happy Birthday in C major')}
              className="rounded-md border border-white/10 bg-[#13151A] px-3 py-1.5 text-xs font-medium text-[#D2D5DE] whitespace-nowrap shrink-0 transition-colors hover:border-white/25 disabled:opacity-50"
            >
              Happy Birthday
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() =>
                void requestAiGuide('song', 'Dreamy emotional cinema arpeggio')
              }
              className="rounded-md border border-white/10 bg-[#13151A] px-3 py-1.5 text-xs font-medium text-[#D2D5DE] whitespace-nowrap shrink-0 transition-colors hover:border-white/25 disabled:opacity-50"
            >
              Cinema Arpeggio
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() =>
                void requestAiGuide('song', 'Warm lo-fi chill chord melody')
              }
              className="rounded-md border border-white/10 bg-[#13151A] px-3 py-1.5 text-xs font-medium text-[#D2D5DE] whitespace-nowrap shrink-0 transition-colors hover:border-white/25 disabled:opacity-50"
            >
              Lo-Fi Chill
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() =>
                void requestAiGuide('song', 'Uplifting baroque dance pattern')
              }
              className="rounded-md border border-white/10 bg-[#13151A] px-3 py-1.5 text-xs font-medium text-[#D2D5DE] whitespace-nowrap shrink-0 transition-colors hover:border-white/25 disabled:opacity-50"
            >
              Baroque Dance
            </button>
          </div>

          {aiError && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]"
            >
              {aiError}
            </p>
          )}
        </div>

        {/* Songbook & Playback Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#F4F3EE]">
              Guided Songbook
            </h3>
            <p className="mt-0.5 text-xs text-[#9BA0AC]">{selectedSong.originNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[#A6AAB5]">
              <span>Tempo</span>
              <input
                type="range"
                min={65}
                max={160}
                value={tempoBpm}
                onChange={(e) => setTempoBpm(Number(e.target.value))}
                aria-label="Song tempo BPM"
                className="h-1.5 w-20 cursor-pointer accent-[#D4A359]"
              />
              <span className="font-mono-tabular w-14 text-[#F4F3EE]">
                {tempoBpm} BPM
              </span>
            </label>

            <button
              type="button"
              onClick={handleToggleFollowAlong}
              aria-pressed={followAlongActive}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                followAlongActive
                  ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#F4F3EE]'
                  : 'border-white/12 bg-[#0B0C0E] text-[#D2D5DE] hover:border-white/25'
              }`}
            >
              <span>{followAlongActive ? 'Guide Active' : 'Enable Guide'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDemo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A359] px-4 py-2 text-xs font-semibold text-[#0B0C0E] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E0B470] focus-visible:outline-2 focus-visible:outline-[#F4F3EE]"
            >
              {isPlayingDemo ? (
                <>
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Stop Demo</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Play Demo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Song Tabs */}
        <div
          role="tablist"
          aria-label="Song scores"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          {allAvailableSongs.map((song) => {
            const active = song.id === selectedSongId;
            return (
              <button
                key={song.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectSong(song)}
                className={`rounded-lg border px-3.5 py-2 text-left text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                  active
                    ? 'border-[#D4A359] bg-[#1C1F27] text-[#F4F3EE]'
                    : 'border-white/10 bg-[#0B0C0E] text-[#9BA0AC] hover:text-[#F4F3EE]'
                }`}
              >
                {song.title}
              </button>
            );
          })}
        </div>

        {/* Clickable Number Notation Phrases */}
        <div className="mt-4 rounded-lg border border-white/10 bg-[#0B0C0E] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9BA0AC]">
            <span>
              <strong className="font-medium text-[#F4F3EE]">
                {selectedSong.title}
              </strong>{' '}
              · {selectedSong.composer}
            </span>
            <span className="font-mono-tabular">
              {flattenedSongSteps.length} notes · Click any digit to audition
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {selectedSong.phrases.map((phrase, phraseIdx) => (
              <div
                key={`${selectedSong.id}-p-${phraseIdx}`}
                className="flex flex-col gap-1"
              >
                {selectedSong.phraseLabels?.[phraseIdx] && (
                  <span className="text-[11px] text-[#8C919E]">
                    {selectedSong.phraseLabels[phraseIdx]}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {phrase.map((digit, noteIdx) => {
                    const step = flattenedSongSteps.find(
                      (s) => s.phraseIdx === phraseIdx && s.noteIdx === noteIdx
                    );
                    const isCurrent =
                      (isPlayingDemo || followAlongActive) &&
                      step?.flatIdx === songStepIndex;
                    const isDone =
                      followAlongActive &&
                      step !== undefined &&
                      step.flatIdx < songStepIndex;
                    const mappedSpec = keyByDigitMap.get(digit);

                    return (
                      <button
                        key={`${selectedSong.id}-${phraseIdx}-${noteIdx}`}
                        type="button"
                        onClick={() => {
                          if (mappedSpec) {
                            pressKey(mappedSpec, true);
                            window.setTimeout(() => releaseKey(mappedSpec), 260);
                          }
                        }}
                        className={`font-mono-tabular flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                          isCurrent
                            ? 'border-[#D4A359] bg-[#D4A359] text-[#0B0C0E]'
                            : isDone
                            ? 'border-white/10 bg-[#1B1E26] text-[#6B707D]'
                            : 'border-white/12 bg-[#14171D] text-[#E6E4DC] hover:border-[#D4A359]/60'
                        }`}
                        title={
                          mappedSpec
                            ? `Play ${getEffectiveKeySpec(mappedSpec).noteName} (Key ${digit})`
                            : digit
                        }
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
