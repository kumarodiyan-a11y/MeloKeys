import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Play, Square, Trash2 } from 'lucide-react';
import { pianoEngine } from '../audio/pianoEngine';
import { NUMBER_KEYS, PianoKeySpec, YOUTUBE_VIDEO_META } from '../data/videoAnalysis';

interface OriginalVideoSectionProps {
  onNoteTriggered: (keySpec: PianoKeySpec) => void;
}

export const OriginalVideoSection: React.FC<OriginalVideoSectionProps> = ({
  onNoteTriggered,
}) => {
  const [sequenceInput, setSequenceInput] = useState('8-7-6-5-4 5-6-8-7 6-5-4-3 6-5-4-3-2 3-4-6-5 4-3-2-1');
  const [customBpm, setCustomBpm] = useState(112);
  const [isPlayingCustom, setIsPlayingCustom] = useState(false);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const parsedDigits = useMemo(() => {
    return sequenceInput.match(/[0-9]/g) ?? [];
  }, [sequenceInput]);

  const keyByDigitMap = useMemo(() => {
    const map = new Map<string, PianoKeySpec>();
    for (const k of NUMBER_KEYS) {
      map.set(k.keyLabel, k);
    }
    return map;
  }, []);

  const stopCustomPlayback = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlayingCustom(false);
    setActiveTokenIndex(null);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handlePlayCustom = () => {
    if (isPlayingCustom) {
      stopCustomPlayback();
      return;
    }
    if (parsedDigits.length === 0) return;

    setIsPlayingCustom(true);
    let idx = 0;
    const stepMs = Math.round((60 / customBpm) * 1000 * 0.65);

    const tick = () => {
      if (idx >= parsedDigits.length) {
        stopCustomPlayback();
        return;
      }

      const digit = parsedDigits[idx];
      const spec = keyByDigitMap.get(digit);
      setActiveTokenIndex(idx);

      if (spec) {
        pianoEngine.triggerBriefNote(spec.id, spec.frequencyHz, Math.max(200, stepMs * 0.8));
        onNoteTriggered(spec);
      }

      idx += 1;
      timerRef.current = window.setTimeout(tick, stepMs);
    };

    tick();
  };

  return (
    <section id="original-video" className="mx-auto max-w-[1200px] px-6 py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#D4A359]">
            Source Reference &amp; Custom Tab Auditioner
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F4F3EE] sm:text-4xl [text-wrap:balance]">
            Watch the Original Video &amp; Test Custom Tabs
          </h2>
        </div>

        <a
          href={YOUTUBE_VIDEO_META.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#13151A] px-4 py-2.5 text-xs font-medium text-[#F4F3EE] whitespace-nowrap shrink-0 transition-colors hover:border-[#D4A359] focus-visible:outline-2 focus-visible:outline-[#D4A359]"
        >
          <span>Open on YouTube</span>
          <ExternalLink className="h-3.5 w-3.5 text-[#D4A359]" aria-hidden="true" />
        </a>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Embedded YouTube Player */}
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13151A]">
            <div className="aspect-video w-full bg-[#08090B]">
              <iframe
                src={YOUTUBE_VIDEO_META.embedUrl}
                title={YOUTUBE_VIDEO_META.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-xs text-[#9BA0AC]">
              <span>
                <strong className="font-medium text-[#F4F3EE]">{YOUTUBE_VIDEO_META.title}</strong> ·{' '}
                {YOUTUBE_VIDEO_META.channel}
              </span>
              <span className="font-mono-tabular">ID: {YOUTUBE_VIDEO_META.id}</span>
            </div>
          </div>
        </div>

        {/* Custom Number-Key Tab Composer */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#13151A] p-6 lg:col-span-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-[#F4F3EE]">
              Custom Number-Key Sequence Player
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#9BA0AC]">
              Paste any comment tab using digits <span className="font-mono-tabular text-[#F4F3EE]">0–9</span> (dashes or spaces allowed) to hear it on the studio grand piano.
            </p>

            <label className="mt-5 block text-xs font-medium text-[#D2D5DE]" htmlFor="tab-sequence-input">
              Number-Key Sequence
            </label>
            <textarea
              id="tab-sequence-input"
              rows={3}
              value={sequenceInput}
              onChange={(e) => {
                stopCustomPlayback();
                setSequenceInput(e.target.value);
              }}
              placeholder="Example: 1-2-3-4-5-6-7-8-9-0"
              className="font-mono-tabular mt-2 w-full rounded-lg border border-white/12 bg-[#0B0C0E] p-3 text-sm text-[#F4F3EE] placeholder:text-[#666B78] focus:border-[#D4A359] focus:outline-none"
            />

            {/* Live Parsed Note Preview */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-[#9BA0AC]">
                <span>Parsed Notes</span>
                <span className="font-mono-tabular">{parsedDigits.length} notes</span>
              </div>
              {parsedDigits.length > 0 ? (
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-white/8 bg-[#0B0C0E] p-3">
                  {parsedDigits.map((digit, index) => {
                    const spec = keyByDigitMap.get(digit);
                    const isActive = activeTokenIndex === index;
                    return (
                      <span
                        key={`${digit}-${index}`}
                        className={`font-mono-tabular inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                          isActive
                            ? 'bg-[#D4A359] font-semibold text-[#0B0C0E]'
                            : 'bg-[#171A21] text-[#D2D5DE]'
                        }`}
                      >
                        <span>{digit}</span>
                        <span className={isActive ? 'text-[#0B0C0E]/80' : 'text-[#8C919E]'}>
                          {spec?.noteName}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-white/8 bg-[#0B0C0E] p-3 text-xs text-[#8C919E]">
                  Enter digits 0–9 above to preview note sequence.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <label className="flex items-center gap-2 text-xs text-[#A6AAB5]">
              <span>Speed</span>
              <input
                type="range"
                min={65}
                max={160}
                value={customBpm}
                onChange={(e) => setCustomBpm(Number(e.target.value))}
                aria-label="Custom sequence BPM"
                className="h-1.5 w-20 cursor-pointer accent-[#D4A359]"
              />
              <span className="font-mono-tabular text-[#F4F3EE]">{customBpm} BPM</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopCustomPlayback();
                  setSequenceInput('');
                }}
                disabled={sequenceInput.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#0B0C0E] px-3 py-2 text-xs font-medium text-[#A6AAB5] transition-colors hover:text-[#F4F3EE] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#D4A359]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                onClick={handlePlayCustom}
                disabled={parsedDigits.length === 0 && !isPlayingCustom}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A359] px-4 py-2 text-xs font-semibold text-[#0B0C0E] transition-colors hover:bg-[#E0B470] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#F4F3EE]"
              >
                {isPlayingCustom ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Play Sequence</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
