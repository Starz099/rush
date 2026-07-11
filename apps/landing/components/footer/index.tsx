'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XIcon } from '@phosphor-icons/react';
import { customSmoothScroll, customSmoothScrollToTop } from '@/lib/scroll';

export default function Footer() {
  const [activeModal, setActiveModal] = useState<'pricing' | 'security' | null>(
    null,
  );

  const handleScrollToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    customSmoothScrollToTop();
  };

  const handleScrollToFeatures = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    customSmoothScroll('features');
  };

  return (
    <>
      <footer className="relative overflow-hidden pt-20">
        <div className="mx-auto mb-16 grid max-w-7xl gap-10 px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Column 1: Brand & Info */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-lg font-black tracking-widest text-white uppercase">
                Rush
              </span>
            </div>
            <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
              The local-first video editor with an integrated AI agent.
              Transcribe media, search visual frames, and control your timeline
              directly from chat prompts.
            </p>
          </div>

          {/* Column 2: Project */}
          <div>
            <div className="text-muted-foreground mb-4 font-mono text-[10px] tracking-widest uppercase">
              Project
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="#"
                  onClick={handleScrollToTop}
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Download
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  onClick={handleScrollToFeatures}
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Features
                </a>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('pricing')}
                  className="text-foreground/75 cursor-pointer text-left transition-colors hover:text-white"
                >
                  Pricing
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('security')}
                  className="text-foreground/75 cursor-pointer text-left transition-colors hover:text-white"
                >
                  Security & Privacy
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/Starz099/rush"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Source Code
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Developer */}
          <div>
            <div className="text-muted-foreground mb-4 font-mono text-[10px] tracking-widest uppercase">
              Developer
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://starzz.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="https://starzz.dev/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Connect */}
          <div>
            <div className="text-muted-foreground mb-4 font-mono text-[10px] tracking-widest uppercase">
              Connect
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://x.com/mayank0166"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Follow on X
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com/intent/tweet?text=Check%20out%20Rush%20%E2%80%94%20a%20local-first%20video%20editor%20with%20a%20chat-based%20AI%20agent%20to%20control%20cuts%2C%20transcriptions%2C%20and%20edits%20directly%20from%20your%20prompt.%20Ship%20a%20week%20of%20edits%20in%20an%20afternoon.%20%F0%9F%8E%AC%20https%3A%2F%2Fgithub.com%2FStarz099%2Frush"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Share on X
                </a>
              </li>
              <li>
                <a
                  href="https://starzz.dev/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/75 transition-colors hover:text-white"
                >
                  Submit Feedback
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Giant faded wordmark */}
        <div
          aria-hidden
          className="pointer-events-none overflow-hidden text-center select-none"
        >
          <div className="from-primary/10 bg-gradient-to-b to-transparent bg-clip-text font-mono text-[20vw] leading-[0.85] font-black tracking-tighter text-transparent">
            RUSH
          </div>
        </div>
      </footer>

      {/* Glassmorphic Modals Overlay */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark blur underlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Dialog Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.45 }}
              className="relative w-full max-w-md overflow-hidden rounded-none border border-white/10 bg-[#0d0d0f] p-6 shadow-2xl"
            >
              {/* Brand accent laser border line on top of the modal */}
              <div className="absolute top-0 right-0 left-0 h-[2px] bg-[#fb5536]" />

              {/* Close Button */}
              <button
                onClick={() => setActiveModal(null)}
                className="text-muted-foreground absolute top-4 right-4 cursor-pointer p-1 transition-colors hover:text-white"
                aria-label="Close modal"
              >
                <XIcon size={16} />
              </button>

              {activeModal === 'pricing' ? (
                <div>
                  <h4 className="mb-4 text-lg font-black tracking-tight text-white uppercase">
                    Rush is 100% Free
                  </h4>
                  <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
                    <p>
                      Since I am a solo developer building Rush as an
                      open-source tool, there are no monthly subscriptions, no
                      feature paywalls, and no hidden cloud processing costs.
                      The application runs completely on your own machine.
                    </p>
                    <p>
                      If you want to support this project, please consider
                      starring the repository on GitHub or sharing it with
                      others.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="mb-4 text-lg font-black tracking-tight text-white uppercase">
                    Local-First Architecture
                  </h4>
                  <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
                    <p>
                      <strong>Local Core Processing:</strong> All video
                      decoding, waveform parsing, Whisper transcription, and
                      visual CLIP frame indices are calculated 100% on your
                      device. Your media assets never leave your computer.
                    </p>
                    <p>
                      <strong>Your Agent Provider, Your Keys:</strong> The AI
                      Agent panel operates using the LLM API provider and API
                      key that <strong>you choose and configure</strong> (e.g.,
                      OpenAI, Anthropic, or a local llama.cpp server). Prompt
                      context goes directly to your selected LLM endpoint; your
                      API keys are stored securely in your local system
                      keychain.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
