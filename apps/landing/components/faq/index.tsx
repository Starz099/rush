'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { FAQS } from './data';

export default function FaqSection() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggleItem = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div
      id="faq"
      className="relative mx-auto w-full max-w-4xl overflow-visible px-6 py-24"
    >
      {/* Centered Heading on Top */}
      <div className="mb-16 flex flex-col items-center text-center">
        <h2 className="text-primary mb-1.5 text-[10px] font-bold tracking-widest uppercase md:text-xs">
          // DIAGNOSTICS & SYSTEM FAQ
        </h2>
        <h3 className="text-2xl leading-tight font-black tracking-tight text-white uppercase md:text-3xl">
          Frequently Resolved Cases
        </h3>
        <p className="text-muted-foreground mt-4 max-w-lg text-xs leading-relaxed md:text-sm">
          Detailed information about the core engineering, GPU rendering
          pipelines, and security architecture of the editor.
        </p>
        <div className="bg-primary/30 mt-6 h-[1px] w-20" />
      </div>

      {/* Accordions list: centered & taking full width */}
      <div className="flex w-full flex-col">
        {FAQS.map((faq) => {
          const isOpen = openId === faq.id;

          return (
            <div
              key={faq.id}
              className="border-border first:border-border/60 relative border-b pl-6 transition-all duration-300 first:border-t"
            >
              {/* Active Left Laser Bracket Line */}
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: isOpen ? '100%' : '0%',
                  opacity: isOpen ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="bg-primary absolute top-0 left-0 z-10 w-[2px] origin-top shadow-[0_0_12px_#fb5536,0_0_4px_#fb5536]"
              />

              {/* Trigger Button */}
              <button
                onClick={() => toggleItem(faq.id)}
                className="group flex w-full cursor-pointer items-center justify-between py-5 text-left transition-colors duration-200 hover:text-white"
                aria-expanded={isOpen}
              >
                <span
                  className={cn(
                    'text-sm font-black tracking-tight uppercase transition-colors duration-200 md:text-base',
                    isOpen
                      ? 'text-primary'
                      : 'text-white/80 group-hover:text-white',
                  )}
                >
                  {faq.question}
                </span>

                {/* Rotating Chevron Icon */}
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className={cn(
                    'ml-4 shrink-0',
                    isOpen
                      ? 'text-primary'
                      : 'text-white/40 group-hover:text-white/70',
                  )}
                >
                  <CaretDownIcon weight="bold" size={14} />
                </motion.div>
              </button>

              {/* Content Panel */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="text-muted-foreground pb-5 text-xs leading-relaxed antialiased md:text-sm">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
