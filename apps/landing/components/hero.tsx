'use client';
import { CaretRightIcon, DownloadIcon } from '@phosphor-icons/react';
import { Button } from './ui/button';

const StyledText = ({ text }: { text: string }) => (
  <span className="text-primary underline underline-offset-3">{text}</span>
);

const Hero = () => {
  return (
    <div className="flex w-full flex-col items-center gap-8 pt-32">
      <div className="max-w-200 p-4 text-center text-7xl font-bold">
        Ship a week of edits in an afternoon.
      </div>
      <div className="text-muted-foreground max-w-220 text-center text-xl">
        <StyledText text="Rush" /> is a desktop video editor with a chat-style
        agent panel. Describe your vision, and it executes tools and{' '}
        <StyledText text="edits for you" />, saving you hours of time and
        effort. Without losing the control of the timeline.
      </div>
      <div className="flex min-w-86 justify-between gap-4 p-4">
        <Button size="lg" className="cursor-pointer px-6 text-xl">
          Download now
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="cursor-pointer px-6 text-xl"
        >
          Learn more <CaretRightIcon />
        </Button>
      </div>
    </div>
  );
};

export default Hero;
