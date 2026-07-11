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

  const triggerDownload = (platform: string) => {
    setIsOpen(false);
    // Redirect triggers browser download dialogue for file selection
    window.location.href = `/api/download?platform=${platform}`;
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
            className="relative z-10 w-full max-w-2xl overflow-hidden border border-white/10 bg-[#0d0d0f] p-8 shadow-2xl md:p-12"
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
            <div className="mb-10 pr-6 pl-6 text-center">
              <h3 className="text-xl font-black tracking-wider text-white uppercase sm:text-3xl">
                Get Rush Video Editor
              </h3>
              <p className="text-muted-foreground mx-auto mt-3 max-w-md text-xs leading-relaxed tracking-wide uppercase sm:text-xs">
                Select your platform to download the installer setup.
              </p>
            </div>

            {/* OS Cards Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Windows Card */}
              <button
                onClick={() => triggerDownload('windows')}
                className="group hover:border-primary/30 flex cursor-pointer flex-col items-center justify-between border border-white/5 bg-white/[0.01] p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.08)]"
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

              {/* macOS Card */}
              <button
                onClick={() => triggerDownload('macos')}
                className="group hover:border-primary/30 flex cursor-pointer flex-col items-center justify-between border border-white/5 bg-white/[0.01] p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.08)]"
              >
                <div className="flex flex-col items-center">
                  {/* Glowing Icon Ring */}
                  <div className="group-hover:border-primary/30 group-hover:bg-primary/5 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(251,85,54,0.15)]">
                    <svg
                      className="group-hover:text-primary h-7 w-7 text-white/80 transition-colors"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.63.73-1.18 1.87-1.03 2.98.12.01.24.02.35.02.9 0 2.07-.63 2.63-1.44z" />
                    </svg>
                  </div>
                  <h4 className="group-hover:text-primary mt-5 text-sm font-black tracking-wider text-white uppercase transition-colors">
                    macOS
                  </h4>
                  <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed tracking-wide uppercase">
                    Apple Silicon / Intel (.dmg)
                  </p>
                </div>
                <div className="text-primary/75 group-hover:text-primary mt-6 flex translate-y-1 items-center gap-1 text-[10px] font-bold tracking-widest uppercase opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <DownloadSimpleIcon size={12} weight="bold" />
                  <span>Download</span>
                </div>
              </button>

              {/* Linux Card */}
              <button
                onClick={() => triggerDownload('linux')}
                className="group hover:border-primary/30 flex cursor-pointer flex-col items-center justify-between border border-white/5 bg-white/[0.01] p-6 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.08)]"
              >
                <div className="flex flex-col items-center">
                  {/* Glowing Icon Ring */}
                  <div className="group-hover:border-primary/30 group-hover:bg-primary/5 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(251,85,54,0.15)]">
                    <svg
                      className="group-hover:text-primary h-7 w-7 text-white/80 transition-colors"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm3.36 12.3c-.3.45-.63.92-.98 1.4-.41.56-.84 1.12-1.3 1.63-.4.43-.82.84-1.25 1.21-.45.38-.94.7-1.47.92-.51.22-1.07.34-1.63.34a4.34 4.34 0 0 1-3.23-1.44 5.3 5.3 0 0 1-1.36-3.8c0-1.67.65-3.1 1.77-4.1C8.65 7.46 10.22 7 12 7c1.78 0 3.35.46 4.47 1.46 1.12 1 1.77 2.43 1.77 4.1 0 1.22-.35 2.27-1 3.08a4.13 4.13 0 0 1-2.88 1.66z" />
                    </svg>
                  </div>
                  <h4 className="group-hover:text-primary mt-5 text-sm font-black tracking-wider text-white uppercase transition-colors">
                    Linux
                  </h4>
                  <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed tracking-wide uppercase">
                    Debian / AppImage (.deb)
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
