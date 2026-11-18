import React, { useEffect, useRef } from 'react';
import { pianoEngine } from '../audio/pianoEngine';
import { NUMBER_KEYS } from '../data/videoAnalysis';

export interface WaterfallPulse {
  id: number;
  laneIndex: number; // 0..9
  label: string;
  startedAt: number;
  releasedAt: number | null;
}

interface NoteWaterfallProps {
  activeLaneIndices: Set<number>;
  pulsesRef: React.MutableRefObject<WaterfallPulse[]>;
  upcomingDigits: string[]; // Next ~6 digits in current song/AI guide
  guideActive: boolean;
}

const DIGIT_TO_LANE = new Map<string, number>(
  NUMBER_KEYS.map((k, idx) => [k.keyLabel, idx])
);

export const NoteWaterfall: React.FC<NoteWaterfallProps> = ({
  activeLaneIndices,
  pulsesRef,
  upcomingDigits,
  guideActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeLanesRef = useRef<Set<number>>(activeLaneIndices);
  const upcomingRef = useRef<string[]>(upcomingDigits);
  const guideActiveRef = useRef<boolean>(guideActive);

  useEffect(() => {
    activeLanesRef.current = activeLaneIndices;
  }, [activeLaneIndices]);

  useEffect(() => {
    upcomingRef.current = upcomingDigits;
  }, [upcomingDigits]);

  useEffect(() => {
    guideActiveRef.current = guideActive;
  }, [guideActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const waveData = new Uint8Array(128);
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderFrame = (nowMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const w = canvas.width;
      const h = canvas.height;
      const laneW = w / 10;

      ctx.clearRect(0, 0, w, h);

      // Subtle vertical lane guides matching the 10 natural keys
      for (let i = 0; i < 10; i++) {
        const x = i * laneW;
        if (activeLanesRef.current.has(i)) {
          const laneGrad = ctx.createLinearGradient(0, h, 0, 0);
          laneGrad.addColorStop(0, 'rgba(212, 163, 89, 0.16)');
          laneGrad.addColorStop(1, 'rgba(212, 163, 89, 0.0)');
          ctx.fillStyle = laneGrad;
          ctx.fillRect(x, 0, laneW, h);
        }

        if (i > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
          ctx.lineWidth = Math.max(1, dpr * 0.75);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }

      // Draw rising ribbons for played notes (Free play / Demo / Practice)
      const riseSpeedPxPerMs = (reducedMotion ? 0.05 : 0.11) * dpr;
      const maxAgeMs = 2600;
      const surviving: WaterfallPulse[] = [];

      for (const pulse of pulsesRef.current) {
        const ageMs = nowMs - pulse.startedAt;
        if (ageMs > maxAgeMs) continue;

        const endMs = pulse.releasedAt ?? nowMs;
        const holdDurationMs = Math.max(110, endMs - pulse.startedAt);
        const bottomOffset =
          pulse.releasedAt !== null ? (nowMs - pulse.releasedAt) * riseSpeedPxPerMs : 0;
        const barHeight = Math.min(h * 0.85, holdDurationMs * riseSpeedPxPerMs);
        const yBottom = h - bottomOffset;
        const yTop = yBottom - barHeight;

        if (yBottom < 0) continue;
        surviving.push(pulse);

        const alpha = Math.max(0, 1 - bottomOffset / (h * 0.95));
        const xPad = Math.max(4 * dpr, laneW * 0.16);
        const barX = pulse.laneIndex * laneW + xPad;
        const barW = laneW - xPad * 2;
        const radius = Math.min(5 * dpr, barW * 0.25);

        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
        grad.addColorStop(0, '#F5E1BA');
        grad.addColorStop(1, '#D4A359');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(barX, yTop, barW, Math.max(8 * dpr, barHeight), radius);
        ctx.fill();
        ctx.restore();
      }
      pulsesRef.current = surviving;

      // Draw descending upcoming guide blocks when Follow-Along Guide is active
      if (guideActiveRef.current && upcomingRef.current.length > 0) {
        const slots = upcomingRef.current.slice(0, 5);
        const slotHeight = 20 * dpr;
        const stepGap = (h - 26 * dpr) / 5;

        for (let s = slots.length - 1; s >= 0; s--) {
          const digit = slots[s];
          const lane = DIGIT_TO_LANE.get(digit);
          if (lane === undefined) continue;

          const isNext = s === 0;
          const xPad = Math.max(5 * dpr, laneW * 0.2);
          const bx = lane * laneW + xPad;
          const bw = laneW - xPad * 2;
          const by = h - 24 * dpr - s * stepGap;

          ctx.save();
          ctx.fillStyle = isNext
            ? 'rgba(212, 163, 89, 0.96)'
            : 'rgba(244, 243, 238, 0.14)';
          ctx.strokeStyle = isNext
            ? '#FFF5DC'
            : 'rgba(212, 163, 89, 0.32)';
          ctx.lineWidth = Math.max(1, dpr);

          ctx.beginPath();
          ctx.roundRect(bx, by, bw, slotHeight, 4 * dpr);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isNext ? '#0B0C0E' : '#E6E4DC';
          ctx.font = `600 ${Math.round(11 * dpr)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(digit, bx + bw / 2, by + slotHeight / 2 + 0.5 * dpr);
          ctx.restore();
        }
      }

      // Draw live Web Audio waveform ribbon along top fallboard edge
      const analyser = pianoEngine.getAnalyser();
      const waveY = 14 * dpr;
      const waveAmp = 10 * dpr;

      ctx.save();
      ctx.beginPath();
      if (analyser) {
        analyser.getByteTimeDomainData(waveData);
        const sliceW = w / waveData.length;
        for (let i = 0; i < waveData.length; i++) {
          const v = (waveData[i] - 128) / 128;
          const x = i * sliceW;
          const y = waveY + v * waveAmp * 1.8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.moveTo(0, waveY);
        ctx.lineTo(w, waveY);
      }
      ctx.strokeStyle = 'rgba(212, 163, 89, 0.55)';
      ctx.lineWidth = Math.max(1.2, dpr * 1.2);
      ctx.stroke();
      ctx.restore();

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [pulsesRef]);

  return (
    <div className="relative mb-2 overflow-hidden rounded-t-lg border border-b-0 border-white/10 bg-gradient-to-b from-[#07080A] to-[#0C0E13]">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5 text-[11px] text-[#8C919E]">
        <span>Live Acoustic Waveform &amp; Key Roll</span>
        {guideActive && upcomingDigits.length > 0 ? (
          <span className="font-mono-tabular text-[#D4A359]">
            Next Queue: {upcomingDigits.slice(0, 5).join(' · ')}
          </span>
        ) : (
          <span className="font-mono-tabular">Polyphonic 10-Lane Visualizer</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-28 w-full sm:h-36"
      />
    </div>
  );
};
