'use client';

import { useRef } from 'react';
import { motion, useScroll } from 'motion/react';
import { FEATURES } from './data';
import { FeatureRow } from './row';

export default function FeatureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trunkRef = useRef<HTMLDivElement>(null);

  // Track scroll progress relative to the trunk's physical boundaries
  const { scrollYProgress } = useScroll({
    target: trunkRef,
    offset: ['start center', 'end center'],
  });

  return (
    <div
      ref={containerRef}
      id="features"
      className="relative w-full max-w-5xl overflow-visible px-6 py-24 font-mono"
    >
      {/* Section Header */}
      <div className="mb-20 flex flex-col items-center text-center">
        <h2 className="text-primary mb-1.5 text-xs font-bold tracking-widest uppercase">
          // ENGINE CAPABILITIES
        </h2>
        <h3 className="max-w-md text-2xl leading-tight font-black tracking-tight text-white uppercase">
          A Modular Architecture for Modern Creators
        </h3>
        <div className="bg-primary/30 mt-4 h-[1px] w-20" />
      </div>

      {/* Vertical Tree Trunk SVG */}
      <div
        ref={trunkRef}
        className="pointer-events-none absolute top-[240px] bottom-[100px] left-6 z-0 w-1 -translate-x-1/2 lg:left-1/2"
      >
        {/* Underlay dim track */}
        <div className="absolute inset-0 border-l border-dashed border-white/10 bg-white/5" />
        {/* Glowing laser path that draws on scroll */}
        <motion.div
          className="from-primary via-primary absolute top-0 right-0 left-0 origin-top bg-gradient-to-b to-transparent shadow-[0_0_15px_#fb5536,0_0_5px_#fb5536]"
          style={{
            height: '100%',
            scaleY: scrollYProgress,
            width: '2px',
            left: '-0.5px',
          }}
        />
      </div>

      {/* Alternating Features List */}
      <div className="relative z-10 flex flex-col gap-16 lg:gap-24">
        {FEATURES.map((feat, index) => (
          <FeatureRow key={feat.id} feat={feat} index={index} />
        ))}
      </div>
    </div>
  );
}
