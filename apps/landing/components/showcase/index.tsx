'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { STAGES } from './data';
import { EditorWorkspace } from './workspace';

export default function Showcase() {
  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);
  const [activeSubStepIdx, setActiveSubStepIdx] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isWiping, setIsWiping] = useState<boolean>(false);

  const activeStage = STAGES[activeStageIdx];
  const activeSubStep = activeStage.subSteps[activeSubStepIdx];

  // Auto-cycle slide logic: updates the progress state
  useEffect(() => {
    const duration = activeSubStep.duration;
    const intervalTime = 50; // update every 50ms
    const stepIncrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStageIdx, activeSubStepIdx, activeSubStep.duration]);

  // Handle slide transition trigger when progress reaches 100%
  useEffect(() => {
    if (progress >= 100) {
      const stage = STAGES[activeStageIdx];

      // If there are more sub-steps in this stage, advance to next sub-step
      if (activeSubStepIdx < stage.subSteps.length - 1) {
        setActiveSubStepIdx((prev) => prev + 1);
        setProgress(0);
      } else {
        // Otherwise, move to the next stage with the curtain wipe
        const nextStageIdx = (activeStageIdx + 1) % STAGES.length;
        triggerWipeTransition(nextStageIdx);
      }
    }
  }, [progress, activeStageIdx, activeSubStepIdx]);

  const triggerWipeTransition = (targetStageIdx: number) => {
    if (isWiping || targetStageIdx === activeStageIdx) return;
    setIsWiping(true);

    // Staggered coverage: swap states at 380ms when screen is fully masked
    setTimeout(() => {
      setActiveStageIdx(targetStageIdx);
      setActiveSubStepIdx(0);
      setProgress(0);
    }, 380);

    // Clear wipe at 800ms (0.65s duration + 140ms max delay = 790ms total)
    setTimeout(() => {
      setIsWiping(false);
    }, 800);
  };

  return (
    <div
      id="how-it-works"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-24"
    >
      {/* 2. Middle Container: Full-Width Video-like Animation Component */}
      <div className="border-border relative flex h-[480px] w-full flex-col overflow-hidden border bg-[#080808] text-xs shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9),0_0_50px_-5px_rgba(251,85,54,0.05)]">
        <EditorWorkspace
          stageId={activeStage.id}
          subStepId={activeSubStep.id}
          progress={progress}
        />

        {/* Staggered horizontal lines wipe */}
        <AnimatePresence>
          {isWiping && (
            <div className="pointer-events-none absolute inset-0 z-50 flex flex-col overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="border-primary/20 w-full flex-1 border-b bg-[#080808]/85 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
                  initial={{ x: '-100%' }}
                  animate={{ x: ['-100%', '0%', '0%', '100%'] }}
                  transition={{
                    duration: 0.65,
                    times: [0, 0.35, 0.65, 1],
                    delay: i * 0.02,
                    ease: [0.76, 0, 0.24, 1],
                  }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Consolidated Bottom Card (Controls + Descriptions) */}
      <div className="border-border relative flex flex-col gap-5 border bg-[#0d0d0f] p-6 text-left shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9),0_0_50px_-5px_rgba(251,85,54,0.05)]">
        {/* Row 1: Interactive Stepper Tabs (Controls) */}
        <div className="relative z-10 grid w-full grid-cols-2 gap-1 border-b border-white/5 pb-4 md:grid-cols-4">
          {STAGES.map((stage, idx) => {
            const isActive = idx === activeStageIdx;
            return (
              <button
                key={stage.id}
                onClick={() => triggerWipeTransition(idx)}
                className={cn(
                  'relative flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-none border border-transparent px-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 select-none md:text-[11px]',
                  isActive
                    ? 'font-black text-white'
                    : 'text-white/40 hover:text-white/70',
                )}
              >
                {/* Sliding active background tab wrapper */}
                {isActive && (
                  <motion.div
                    layoutId="activeStageTab"
                    className="border-primary/30 bg-primary/5 absolute inset-0 z-0 border shadow-[inset_0_0_12px_rgba(251,85,54,0.08)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}

                {/* Content above the sliding background */}
                <span className="relative z-10">{stage.title}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Active Sub-step Details */}
        <div className="flex flex-col gap-1.5">
          <h4 className="font-sans text-sm font-bold tracking-wide text-white uppercase md:text-base">
            {activeSubStep.title}
          </h4>
          <p className="h-[20px] w-full overflow-hidden text-[12px] leading-relaxed text-white/50 md:h-[22px] md:text-[13px]">
            {activeSubStep.description}
          </p>
        </div>
      </div>
    </div>
  );
}
