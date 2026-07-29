'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XIcon, DownloadSimpleIcon } from '@phosphor-icons/react';

export default function DownloadModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-download-modal', handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-download-modal', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const triggerDownload = () => {
    setIsOpen(false);
    // Redirect triggers browser download dialogue for file selection
    window.location.href = `/api/download?platform=windows`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.1 }}
            className="relative z-10 w-full max-w-lg overflow-hidden border border-white/10 bg-[#0d0d0f] p-8 shadow-2xl md:p-10"
            style={{
              boxShadow:
                '0 0 80px -15px rgba(251, 85, 54, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.02)',
            }}
          >
            {/* Top Laser Accent Line */}
            <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[#fb5536] to-transparent" />

            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#fb5536]/10 blur-[80px]" />
            <div className="pointer-events-none absolute -right-24 -bottom-24 h-48 w-48 rounded-full bg-white/5 blur-[80px]" />

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground absolute top-5 right-5 flex cursor-pointer border border-transparent bg-white/[0.02] p-2 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              aria-label="Close download options"
            >
              <XIcon size={14} weight="bold" />
            </button>

            {/* Header */}
            <div className="mb-8 pr-6 pl-6 text-center">
              <h3 className="text-xl font-black tracking-wider text-white uppercase sm:text-2xl">
                Get Rush Video Editor
              </h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-xs leading-relaxed tracking-wide uppercase sm:text-xs">
                Download the installer setup for Windows.
              </p>
            </div>

            {/* OS Card Container */}
            <div className="mx-auto max-w-sm">
              {/* Windows Card */}
              <button
                onClick={triggerDownload}
                className="group hover:border-primary/30 flex w-full cursor-pointer flex-col items-center justify-between border border-white/5 bg-white/[0.01] p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.08)]"
              >
                <div className="flex flex-col items-center">
                  {/* Glowing Icon Ring */}
                  <div className="group-hover:border-primary/30 group-hover:bg-primary/5 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(251,85,54,0.15)]">
                    <svg
                      className="group-hover:text-primary h-7 w-7 text-white/80 transition-colors"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M0 3.449L9.75 2.1v9.45H0V3.449zM0 12.45h9.75v9.45L0 20.551v-8.1zM10.95 1.936L24 0v11.55H10.95V1.936zM10.95 12.45H24v11.55l-13.05-1.936v-9.614z" />
                    </svg>
                  </div>
                  <h4 className="group-hover:text-primary mt-5 text-sm font-black tracking-wider text-white uppercase transition-colors">
                    Windows
                  </h4>
                  <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed tracking-wide uppercase">
                    NSIS Setup (.exe)
                  </p>
                </div>
                <div className="text-primary/75 group-hover:text-primary mt-6 flex translate-y-1 items-center gap-1 text-[10px] font-bold tracking-widest uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <DownloadSimpleIcon size={12} weight="bold" />
                  <span>Download</span>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
