import React, { useState } from 'react';
import { Piano } from 'lucide-react';
import { pianoEngine } from '../audio/pianoEngine';
import {
  COMPARISON_METRICS,
  NUMBER_KEYS,
  PianoKeySpec,
} from '../data/videoAnalysis';

interface TimelineMapSectionProps {
  activeNoteId: string | null;
  onTriggerKey: (keySpec: PianoKeySpec) => void;
}

export const TimelineMapSection: React.FC<TimelineMapSectionProps> = ({
  activeNoteId,
  onTriggerKey,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const handleRowPlay = (spec: PianoKeySpec) => {
    pianoEngine.triggerBriefNote(spec.id, spec.frequencyHz, 440);
    onTriggerKey(spec);
  };

  return (
    <section
      id="timeline"
      className="border-y border-white/10 bg-[#0F1115] py-20"
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium text-[#D4A359]">
            Keystroke-to-Frequency Matrix · Click any row to audition
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F4F3EE] sm:text-4xl [text-wrap:balance]">
            Complete 0–9 Seekbar &amp; Pitch Mapping
          </h2>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Interactive 10-Row Tabular Matrix */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13151A] lg:col-span-7">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0B0C0E] text-xs font-medium text-[#9BA0AC]">
                    <th scope="col" className="px-4 py-3.5">Key</th>
                    <th scope="col" className="px-4 py-3.5">Seek</th>
                    <th scope="col" className="px-4 py-3.5">Note</th>
                    <th scope="col" className="px-4 py-3.5">Scale Degree</th>
                    <th scope="col" className="px-4 py-3.5 text-right">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {NUMBER_KEYS.map((spec) => {
                    const isActive = activeNoteId === spec.id;
                    return (
                      <tr
                        key={spec.id}
                        onClick={() => handleRowPlay(spec)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#D4A359]/15 text-[#F4F3EE]'
                            : 'text-[#D2D5DE] hover:bg-white/5'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowPlay(spec);
                            }}
                            aria-label={`Audition key ${spec.keyLabel} (${spec.noteName})`}
                            className={`font-mono-tabular inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A359] ${
                              isActive
                                ? 'border-[#D4A359] bg-[#D4A359] text-[#0B0C0E]'
                                : 'border-white/15 bg-[#0B0C0E] text-[#F4F3EE]'
                            }`}
                          >
                            {spec.keyLabel}
                          </button>
                        </td>
                        <td className="font-mono-tabular px-4 py-3 text-xs text-[#D4A359]">
                          {spec.youtubeSeekPercent}%
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#F4F3EE]">
                          {spec.noteName}{' '}
                          <span className="ml-1 text-xs font-normal text-[#8E93A0]">
                            ({spec.solfege})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#A6AAB5]">
                          {spec.scaleDegree}
                        </td>
                        <td className="font-mono-tabular px-4 py-3 text-right text-xs text-[#A6AAB5]">
                          {spec.frequencyHz.toFixed(2)} Hz
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Comparison Card + Studio Keyboard Photograph */}
          <div className="flex flex-col justify-between gap-6 lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13151A]">
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#0B0C0E]">
                {!imgFailed ? (
                  <img
                    src="/src/assets/images/studio_keyboard_overhead_1794897318108.jpg"
                    alt="Overhead studio view of concert grand piano ivory and ebony keys"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#191C24] to-[#0E1015] p-6 text-center">
                    <Piano className="h-9 w-9 text-[#D4A359]" aria-hidden="true" />
                    <p className="mt-2 font-display text-base text-[#F4F3EE]">
                      Acoustic Keyboard Studio
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6">
                <h3 className="font-display text-xl font-semibold text-[#F4F3EE]">
                  YouTube Player vs. Web Audio Studio
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#9BA0AC]">
                  Why recreating the BcL2AhaHJAg layout with native oscillator harmonics unlocks true musical playability.
                </p>

                <dl className="mt-5 divide-y divide-white/8 border-t border-white/10">
                  {COMPARISON_METRICS.map((item) => (
                    <div
                      key={item.dimension}
                      className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-2 sm:gap-3"
                    >
                      <dt className="text-xs font-medium text-[#A6AAB5]">
                        {item.dimension}
                      </dt>
                      <dd className="text-xs">
                        <span className="block text-[#8C919E] line-through decoration-white/25">
                          {item.youtubePlayer}
                        </span>
                        <span className="mt-0.5 block font-medium text-[#D4A359]">
                          {item.webStudio}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
