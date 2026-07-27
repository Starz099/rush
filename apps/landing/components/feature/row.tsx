'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';
import { FeatureItem } from './types';

interface FeatureRowProps {
  feat: FeatureItem;
  index: number;
}

export function FeatureRow({ feat, index }: FeatureRowProps) {
  const isLeft = feat.side === 'left';
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track mouse movements relative to the hovered card for the spotlight effect
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Track scroll position of a centered fixed-height helper (120px) to normalize drawing rate
  const { scrollYProgress: rowScroll } = useScroll({
    target: scrollRef,
    offset: ['start center', 'center center'],
  });

  // Transform branch line animation based on row scroll position
  const branchPathLength = useTransform(rowScroll, [0, 1], [0, 1]);

  return (
    <div
      ref={rowRef}
      className="relative flex w-full flex-col items-center gap-8 lg:grid lg:grid-cols-9"
    >
      {/* Centered constant-height helper scroll target */}
      <div
        ref={scrollRef}
        className="pointer-events-none absolute top-1/2 z-0 h-[120px] w-full -translate-y-1/2"
      />
      {/* Card Column */}
      <div
        className={cn(
          'z-10 col-span-4 w-full pl-10 lg:pl-0',
          isLeft ? 'lg:order-1 lg:text-right' : 'lg:order-3 lg:text-left',
        )}
      >
        <motion.div
          initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="border-border relative flex flex-col gap-4 overflow-hidden border bg-[#0d0d0d]/80 p-6 shadow-2xl transition-all duration-300 hover:border-white/20"
          suppressHydrationWarning
        >
          {/* Mouse-Following Spotlight Radial Glow */}
          <div
            className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(180px circle at ${coords.x}px ${coords.y}px, rgba(251, 85, 54, 0.12), transparent 80%)`,
            }}
          />

          {/* Floating Icon badge */}
          <div
            className={cn(
              'relative z-10 flex items-center gap-2',
              isLeft ? 'lg:justify-end' : 'lg:justify-start',
            )}
          >
            {feat.icon}
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              0{feat.id} / {feat.tag}
            </span>
          </div>

          <h4 className="relative z-10 text-base font-bold tracking-wide text-white uppercase md:text-lg">
            {feat.title}
          </h4>

          <p className="relative z-10 font-sans text-xs leading-relaxed font-normal text-white/70 md:text-sm">
            {feat.description}
          </p>
        </motion.div>
      </div>

      {/* Hinge & Tree Node Column */}
      <div className="relative col-span-1 hidden h-full items-center justify-center lg:order-2 lg:flex">
        {/* Horizontal branch laser in pure primary orange */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Ambient Glow Aura */}
          <motion.div
            className={cn(
              'absolute h-[6px] opacity-70 blur-[4px]',
              isLeft
                ? 'right-1/2 w-1/2 origin-right bg-gradient-to-l from-[#fb5536] via-[#fb5536]/60 to-transparent'
                : 'left-1/2 w-1/2 origin-left bg-gradient-to-r from-[#fb5536] via-[#fb5536]/60 to-transparent',
            )}
            style={{
              scaleX: branchPathLength,
              opacity: rowScroll,
            }}
          />
          {/* Core Orange Laser Beam */}
          <motion.div
            className={cn(
              'absolute h-[2px] shadow-[0_0_12px_#fb5536,0_0_4px_#fb5536]',
              isLeft
                ? 'right-1/2 w-1/2 origin-right bg-gradient-to-l from-[#fb5536] via-[#fb5536]/80 to-transparent'
                : 'left-1/2 w-1/2 origin-left bg-gradient-to-r from-[#fb5536] via-[#fb5536]/80 to-transparent',
            )}
            style={{
              scaleX: branchPathLength,
              opacity: rowScroll,
            }}
          />
        </div>
      </div>

      {/* Empty Column for grid alignment on desktop */}
      <div
        className={cn(
          'col-span-4 hidden lg:block',
          isLeft ? 'lg:order-3' : 'lg:order-1',
        )}
      />
    </div>
  );
}
