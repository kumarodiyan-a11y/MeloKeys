import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import { ENGINEERING_FINDINGS, YOUTUBE_VIDEO_META } from '../data/videoAnalysis';

export const VideoAnatomySection: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section id="anatomy" className="mx-auto max-w-[1200px] px-6 py-20">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-medium text-[#D4A359]">
          Video Analysis · {YOUTUBE_VIDEO_META.channel} · ID {YOUTUBE_VIDEO_META.id}
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F4F3EE] sm:text-4xl [text-wrap:balance]">
          How a 10-Slice Timeline Turns YouTube Into an Instrument
        </h2>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        {/* Visual Asset Column */}
        <div className="lg:col-span-6">
          <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-white/10 bg-[#13151A]">
            {!imgFailed ? (
              <img
                src="/src/assets/images/hero_grand_piano_hammers_1794897315905.jpg"
                alt="Macro view inside a concert grand piano showing felt hammers, brass bridge pins, and copper strings"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-[#191C24] to-[#0E1015] p-8 text-center">
                <Music2 className="h-10 w-10 text-[#D4A359]" aria-hidden="true" />
                <p className="mt-3 font-display text-lg text-[#F4F3EE]">
                  Concert Grand Hammer &amp; String Action
                </p>
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0C0E]/85 via-[#0B0C0E]/20 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-xs font-medium text-[#D4A359]">
                Acoustic Reference · C Major Diatonic Span
              </p>
              <p className="mt-1 text-sm text-[#E5E3DC]">
                Ten isolated grand piano recordings mapped across YouTube&apos;s decile seekbar shortcuts ({YOUTUBE_VIDEO_META.keyRange}).
              </p>
            </div>
          </div>
        </div>

        {/* Structured Engineering Breakdown Column */}
        <div className="flex flex-col justify-between gap-6 lg:col-span-6">
          {ENGINEERING_FINDINGS.map((finding) => (
            <article
              key={finding.index}
              className="rounded-xl border border-white/10 bg-[#13151A] p-6"
            >
              <h3 className="font-display text-xl font-semibold text-[#F4F3EE]">
                <span className="font-mono-tabular mr-2.5 text-base font-medium text-[#D4A359]">
                  {finding.index}
                </span>
                {finding.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#B2B6C2]">
                {finding.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
