'use client';

import { CaretRightIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Button } from '../ui/button';

const StyledText = ({ text }: { text: string }) => (
  <span className="text-primary underline underline-offset-3">{text}</span>
);

export default function Hero() {
  return (
    <div className="flex w-full flex-col items-center gap-8 pt-32 pb-24">
      <div className="max-w-200 text-center text-7xl font-bold">
        Ship a week of edits in an afternoon.
      </div>
      <div className="text-muted-foreground max-w-220 text-center text-xl">
        <StyledText text="Rush" /> is a desktop video editor with a chat-style
        agent panel. Describe your vision, and it executes tools and{' '}
        <StyledText text="edits for you" />, saving you hours of time and
        effort. Without losing the control of the timeline.
      </div>

      {/* High-fidelity CTA buttons */}
      <div className="flex min-w-86 justify-between gap-4 pt-12">
        {/* Primary Download Button with Tactile Hover Scale, Glow and Shine */}
        <Button
          size="lg"
          className="group relative cursor-pointer overflow-hidden px-8 py-6 text-sm font-bold tracking-wider uppercase shadow-[0_0_20px_rgba(251,85,54,0.15)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(251,85,54,0.35)] active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center gap-2">
            Download now
            <DownloadSimpleIcon weight="bold" size={15} />
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </Button>

        {/* Secondary Learn More Button with Hover Arrow Push */}
        <Button
          size="lg"
          variant="outline"
          className="group border-border cursor-pointer px-8 py-6 text-sm font-bold tracking-wider uppercase transition-all duration-300 hover:bg-white/5"
        >
          <span className="flex items-center gap-2">
            Learn more
            <CaretRightIcon
              weight="bold"
              size={15}
              className="transition-transform duration-300 group-hover:translate-x-1.5"
            />
          </span>
        </Button>
      </div>
    </div>
  );
}
