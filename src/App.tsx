/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState } from 'react';
import { OriginalVideoSection } from './components/OriginalVideoSection';
import { PianoStage } from './components/PianoStage';
import { TimelineMapSection } from './components/TimelineMapSection';
import { TopBar } from './components/TopBar';
import { VideoAnatomySection } from './components/VideoAnatomySection';
import { PianoKeySpec, YOUTUBE_VIDEO_META } from './data/videoAnalysis';

export default function App() {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeTimerRef = useRef<number | null>(null);

  const handleNoteTriggered = (spec: PianoKeySpec) => {
    setActiveNoteId(spec.id);
    if (activeTimerRef.current !== null) {
      window.clearTimeout(activeTimerRef.current);
    }
    activeTimerRef.current = window.setTimeout(() => {
      setActiveNoteId(null);
    }, 320);
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-[#F4F3EE]">
      <TopBar />

      <main>
        {/* Hero + Focal Interactive Grand Piano Stage */}
        <section id="instrument" className="mx-auto max-w-[1200px] px-6 pt-12 pb-16">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-medium text-[#D4A359]">
              Video Analysis · {YOUTUBE_VIDEO_META.channel} · YouTube ID {YOUTUBE_VIDEO_META.id}
            </p>
            <h1
              className="mt-3 font-display font-semibold tracking-tight text-[#F4F3EE] [text-wrap:balance]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)', lineHeight: 1.08 }}
            >
              Ten Number Keys. One Grand Piano.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#B2B6C2]">
              In <span className="text-[#F4F3EE]">{YOUTUBE_VIDEO_META.title}</span>, Chill Buddies
              turned YouTube&apos;s desktop <span className="font-mono-tabular text-[#F4F3EE]">0–9</span>{' '}
              seek shortcuts into a playable C major instrument. Play live across seven instruments,
              let the AI Note Guide coach you step-by-step, or scrub the simulated decile timeline.
            </p>
          </div>

          <PianoStage
            externalActiveNoteId={activeNoteId}
            onNoteTriggered={handleNoteTriggered}
          />
        </section>

        <VideoAnatomySection />

        <TimelineMapSection
          activeNoteId={activeNoteId}
          onTriggerKey={handleNoteTriggered}
        />

        <OriginalVideoSection onNoteTriggered={handleNoteTriggered} />
      </main>

      <footer className="border-t border-white/10 bg-[#08090B] py-10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-base font-semibold text-[#F4F3EE]">
              Keystroke Grand
            </p>
            <p className="mt-1 text-xs text-[#8C919E]">
              Acoustic breakdown and web synthesis study of YouTube video {YOUTUBE_VIDEO_META.id}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#9BA0AC]">
            <a href="#instrument" className="hover:text-[#F4F3EE]">
              Instrument
            </a>
            <a href="#anatomy" className="hover:text-[#F4F3EE]">
              Video Anatomy
            </a>
            <a href="#timeline" className="hover:text-[#F4F3EE]">
              Timeline Map
            </a>
            <a
              href={YOUTUBE_VIDEO_META.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#D4A359]"
            >
              YouTube Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
