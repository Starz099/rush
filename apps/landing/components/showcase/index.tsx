'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { STEPS } from './data';
import { EditorWorkspace } from './workspace';

export default function Showcase() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [prevIdx, setPrevIdx] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Auto-cycle slide logic: simply ticks the progress state
  useEffect(() => {
    const slideDuration = 5000; // 5 seconds per slide
    const intervalTime = 100;
    const progressStep = (intervalTime / slideDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + progressStep;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeIdx]);

  // Handle slide transition trigger when progress reaches 100%
  useEffect(() => {
    if (progress >= 100) {
      const nextIdx = (activeIdx + 1) % STEPS.length;
      triggerWipeTransition(nextIdx);
    }
  }, [progress, activeIdx]);

  const triggerWipeTransition = (targetIdx: number) => {
    if (targetIdx === activeIdx || isTransitioning) return;

    setPrevIdx(activeIdx);
    setActiveIdx(targetIdx);
    setProgress(0);
    setIsTransitioning(true);
  };

  // Sync transition state reset with setTimeout to ensure it never gets stuck
  useEffect(() => {
    if (!isTransitioning) return;

    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 900); // 900ms matches the 0.85s rotation duration

    return () => clearTimeout(timer);
  }, [isTransitioning]);

  return (
    <div
      id="how-it-works"
      className="relative flex w-full max-w-7xl flex-col items-start gap-16 px-6 py-24 lg:flex-row"
    >
      {/* Decorative background radial glow behind the mockup */}
      <div
        className="pointer-events-none absolute top-1/2 right-[-100px] z-0 h-[600px] w-[600px] -translate-y-1/2"
        style={{
          background:
            'radial-gradient(circle, rgba(251, 85, 54, 0.12) 0%, rgba(251, 85, 54, 0.01) 50%, transparent 70%)',
        }}
      />

      {/* Left Column: Descriptive Text & Systems Widget */}
      <div className="z-10 flex w-full min-w-0 flex-col justify-start gap-6 lg:w-[320px] lg:flex-none lg:pt-6">
        {/* Step Indicator dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => triggerWipeTransition(idx)}
              className={cn(
                'h-1.5 cursor-pointer rounded-none border border-transparent transition-all duration-300',
                idx === activeIdx
                  ? 'bg-primary w-8'
                  : 'w-2 bg-white/20 hover:bg-white/40',
              )}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Text transition container */}
        <div className="relative flex h-[120px] flex-col justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col"
            >
              <div className="text-primary mb-1.5 text-[10px] font-black tracking-widest uppercase">
                // {STEPS[activeIdx].tag}
              </div>
              <h3 className="mb-3 text-xl font-black tracking-tight text-white uppercase md:text-2xl">
                {STEPS[activeIdx].stepNum}. {STEPS[activeIdx].title}
              </h3>
              <p className="text-muted-foreground max-w-lg text-[11px] leading-relaxed">
                {STEPS[activeIdx].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Systems Telemetry Widget */}
        <div className="border-border relative flex w-full gap-6 border bg-[#0d0d0d]/80 p-4 text-[10px]">
          <div className="border-border absolute top-0 right-3 -translate-y-1/2 border-x bg-[#0d0d0d] px-1.5 font-mono text-[8px] font-black tracking-widest text-white/30 uppercase">
            TELEMETRY
          </div>

          <div className="flex-1">
            <span className="text-primary font-mono text-[8px] font-black tracking-widest uppercase">
              LATENCY
            </span>
            <div className="mt-0.5 font-mono font-bold tracking-tight text-white">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {STEPS[activeIdx].latency}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-border/80 w-[1px]" />

          <div className="flex-1">
            <span className="text-primary font-mono text-[8px] font-black tracking-widest uppercase">
              OFFLOAD
            </span>
            <div className="mt-0.5 font-mono font-bold tracking-tight text-white">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {STEPS[activeIdx].offload}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-border/80 w-[1px]" />

          <div className="flex-1">
            <span className="text-primary font-mono text-[8px] font-black tracking-widest uppercase">
              ENGINE MODEL
            </span>
            <div className="mt-0.5 truncate font-mono font-bold tracking-tight text-white">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {STEPS[activeIdx].model}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Sliding Wipe Editor Workspace */}
      <div className="z-10 flex w-full min-w-0 flex-1 flex-col items-center justify-center lg:items-end">
        <div
          className="border-border relative flex h-[500px] w-full flex-col overflow-hidden border bg-[#080808] text-xs md:w-[680px] lg:w-[780px]"
          style={{
            boxShadow:
              '0 30px 100px -10px rgba(0, 0, 0, 0.8), 0 20px 80px -20px rgba(251, 85, 54, 0.18), 0 4px 20px -5px rgba(251, 85, 54, 0.15)',
          }}
        >
          {/* Base Layer: Renders the NEW active step */}
          <div className="absolute inset-0 z-0">
            <EditorWorkspace step={STEPS[activeIdx]} />
          </div>

          {/* Top Layer: Renders the OLD step, rotating out like a falling card hinged at bottom-left */}
          {isTransitioning && (
            <motion.div
              className="border-primary absolute inset-0 z-10 origin-bottom-left overflow-hidden border-t-2 border-r-2 bg-[#080808] shadow-[0_0_30px_rgba(251,85,54,0.25)]"
              initial={{ rotate: 0 }}
              animate={{ rotate: -100 }}
              transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
            >
              <div className="absolute inset-y-0 left-0 h-full w-full md:w-[680px] lg:w-[780px]">
                <EditorWorkspace step={STEPS[prevIdx]} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
