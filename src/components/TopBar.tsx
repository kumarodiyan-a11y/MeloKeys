import React from 'react';

export const TopBar: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0C0E]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
        <a
          href="#instrument"
          className="font-display text-xl font-semibold tracking-tight text-[#F4F3EE] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A359]"
        >
          Keystroke Grand
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A6AAB5]"
        >
          <a
            href="#instrument"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F4F3EE] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A359]"
          >
            Instrument
          </a>
          <a
            href="#anatomy"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F4F3EE] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A359]"
          >
            Video Anatomy
          </a>
          <a
            href="#timeline"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F4F3EE] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A359]"
          >
            Timeline Map
          </a>
          <a
            href="#original-video"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F4F3EE] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A359]"
          >
            Original Video
          </a>
        </nav>

        <div className="shrink-0">
          <a
            href="#original-video"
            className="inline-flex items-center justify-center rounded-lg bg-[#D4A359] px-4 py-2 text-xs font-semibold text-[#0B0C0E] transition-colors duration-150 hover:bg-[#E0B470] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4F3EE]"
          >
            Original Video
          </a>
        </div>
      </div>
    </header>
  );
};
