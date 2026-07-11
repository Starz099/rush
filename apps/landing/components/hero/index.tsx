'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { CaretRightIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { customSmoothScroll } from '@/lib/scroll';

// Animated hand-drawn SVG laser underline highlight (Looping timeline)
const StyledText = ({ text, index }: { text: string; index: number }) => {
  const isFirst = index === 0;

  // Timeline fractions for a 6s infinite loop:
  // 0.0s - 0.75s: First highlight draws
  // 0.8s - 1.5s: Second highlight draws
  // 1.5s - 4.5s: Pause/read break (both highlighted)
  // 4.5s - 5.0s: Fade out
  // 5.0s - 6.0s: Reset cool-down
  const colorKeyframes = [
    '#a1a1aa',
    '#a1a1aa',
    '#fb5536',
    '#fb5536',
    '#a1a1aa',
    '#a1a1aa',
  ];
  const colorTimes = isFirst
    ? [0, 0.0083, 0.125, 0.75, 0.833, 1.0]
    : [0, 0.133, 0.25, 0.75, 0.833, 1.0];

  const pathKeyframes = [0, 0, 1, 1, 0, 0];
  const pathTimes = isFirst
    ? [0, 0.0083, 0.125, 0.75, 0.833, 1.0]
    : [0, 0.133, 0.25, 0.75, 0.833, 1.0];

  const opacityKeyframes = [0, 0, 1, 1, 0, 0];
  const opacityTimes = isFirst
    ? [0, 0.0083, 0.01, 0.75, 0.833, 1.0]
    : [0, 0.133, 0.135, 0.75, 0.833, 1.0];

  return (
    <motion.span
      animate={{ color: colorKeyframes }}
      transition={{
        duration: 6,
        repeat: Infinity,
        times: colorTimes,
        ease: 'easeInOut',
      }}
      className="relative inline-block"
    >
      {text}
      <svg
        viewBox="0 0 100 12"
        className="absolute bottom-[-6px] left-0 h-[6px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M 0 4 Q 50 10 100 4"
          fill="none"
          stroke="#fb5536"
          strokeWidth="3.5"
          strokeLinecap="round"
          suppressHydrationWarning
          animate={{
            pathLength: pathKeyframes,
            opacity: opacityKeyframes,
          }}
          transition={{
            pathLength: {
              duration: 6,
              repeat: Infinity,
              times: pathTimes,
              ease: 'easeInOut',
            },
            opacity: {
              duration: 6,
              repeat: Infinity,
              times: opacityTimes,
              ease: 'linear',
            },
          }}
        />
      </svg>
    </motion.span>
  );
};

export default function Hero() {
  const { scrollY } = useScroll();
  // Fade out completely when user scrolls 150px down
  const opacity = useTransform(scrollY, [0, 150], [1, 0]);
  const y = useTransform(scrollY, [0, 150], [0, 15]);

  return (
    <div className="relative flex w-full flex-col items-center gap-8 pt-32 pb-36">
      {/* Hero Title with Ambient Orange Drop Glow */}
      <h1
        className="max-w-4xl text-center text-5xl leading-[1.05] font-black tracking-tight text-white md:text-7xl"
        style={{
          textShadow:
            '0 0 25px rgba(251, 85, 54, 0.35), 0 0 60px rgba(251, 85, 54, 0.15)',
        }}
      >
        Ship a week of edits in an afternoon.
      </h1>

      <div className="text-muted-foreground max-w-220 text-center text-xl leading-relaxed">
        <StyledText text="Rush" index={0} /> is a desktop video editor with a
        chat-style agent panel. Describe your vision, and it executes{' '}
        <StyledText text="edits for you" index={1} />, saving you hours of
        effort while keeping you in control of the timeline.
      </div>

      {/* High-fidelity CTA buttons */}
      <div className="flex min-w-86 justify-between gap-4 pt-12 pb-8">
        {/* Primary Download Button with Tactile Hover Scale, Glow and Shine */}
        <Button
          size="lg"
          onClick={() => {
            window.dispatchEvent(new Event('open-download-modal'));
          }}
          className="group relative cursor-pointer overflow-hidden rounded-none px-8 py-6 text-sm font-bold tracking-tight uppercase shadow-[0_0_20px_rgba(251,85,54,0.15)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(251,85,54,0.35)] active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center gap-2">
            <DownloadSimpleIcon weight="bold" size={16} />
            Download Now
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </Button>

        {/* Secondary Learn More Button with Hover Arrow Push */}
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            customSmoothScroll('how-it-works');
          }}
          className="group border-border cursor-pointer rounded-none px-8 py-6 text-sm font-bold tracking-tight uppercase transition-all duration-300 hover:bg-white/5"
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

      {/* Looping V-Shape Scroll Indicator */}
      <motion.div
        style={{ opacity, y }}
        className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center"
      >
        <motion.div
          animate={{
            y: [0, 6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fb5536"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary h-3.5 w-3.5"
          >
            <path d="M7 13l5 5 5-5M7 7l5 5 5-5" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}
