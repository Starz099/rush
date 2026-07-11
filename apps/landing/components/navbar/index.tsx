'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GithubLogoIcon,
  StarIcon,
  ListIcon,
  XIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Brand logo matching the favicon.ico
const Logo = () => (
  <img
    src="/favicon.ico"
    alt="Rush Logo"
    width={28}
    height={28}
    className="transition-transform duration-300 select-none hover:scale-105"
  />
);

const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.header
        animate={{
          width: isScrolled ? '96%' : '100%',
          y: isScrolled ? 16 : 0,
          backgroundColor: isScrolled ? '#000000' : undefined,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'fixed right-0 left-0 z-50 mx-auto flex items-center justify-center',
          isScrolled ? 'h-10 shadow-2xl backdrop-blur-md' : 'h-14',
        )}
        style={{
          maxWidth: isScrolled ? '96%' : '100%',
        }}
      >
        {/* Left Side: Logo & Brand */}
        <div className="absolute left-6 flex items-center gap-8 md:left-8">
          <a href="#" className="group flex items-center gap-3">
            <Logo />
            <span className="group-hover:text-primary text-md font-black tracking-widest text-white transition-colors">
              RUSH
            </span>
          </a>
        </div>

        {/* Middle Side: Nav Items */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className="text-muted-foreground relative px-4 py-1.5 text-xs font-semibold transition-colors hover:text-white"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="relative z-10">{item.label}</span>
              {hoveredIndex === index && (
                <motion.span
                  layoutId="navHover"
                  className="border-primary absolute inset-0 border-b bg-white/[0.04]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </a>
          ))}
        </nav>

        {/* Right Side: GitHub Star & Download */}
        <div className="absolute right-6 flex items-center gap-4 md:right-8">
          {/* GitHub Star Link */}

          <a
            href="https://github.com/Starz099/rush"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border text-muted-foreground bg-secondary hidden items-center gap-2 border px-3 py-1.5 text-xs transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white md:flex"
          >
            <GithubLogoIcon size={14} weight="bold" />
            <span>Star</span>
            <span className="bg-border h-3 w-[1px]" />
            <div className="text-primary flex items-center gap-1 text-[10px] font-bold">
              <StarIcon size={10} weight="fill" />
              <span>0</span>
            </div>
          </a>

          {/* Download Button */}
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90 group relative flex items-center gap-1.5 overflow-hidden px-4 text-xs font-bold tracking-wider text-white shadow-[0_0_15px_rgba(251,85,54,0.1)] transition-all hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(251,85,54,0.3)] active:scale-[0.97]"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <span>DOWNLOAD</span>
              <DownloadSimpleIcon size={14} weight="bold" />
            </span>
            {/* Hardware-accelerated continuous shine */}
            <span className="custom-shine-element" />
          </Button>

          {/* Hamburger Menu (Mobile Only) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-muted-foreground hover:border-border flex border border-transparent bg-white/[0.02] p-1.5 transition-all hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <XIcon size={20} /> : <ListIcon size={20} />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-border bg-card/95 absolute top-full right-0 left-0 z-40 flex flex-col gap-6 border-x border-b p-6 backdrop-blur-md md:hidden"
            >
              <div className="flex flex-col gap-3">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-muted-foreground border-b border-white/[0.03] py-2.5 text-xs font-semibold transition-colors hover:text-white"
                  >
                    {item.label.toUpperCase()}
                  </a>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <a
                  href="https://github.com/Starz099/rush"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border text-muted-foreground flex items-center justify-between border bg-white/[0.02] px-4 py-3 text-xs transition-all hover:text-white"
                >
                  <div className="flex items-center gap-2">
                    <GithubLogoIcon size={16} weight="bold" />
                    <span>GITHUB REPOSITORY</span>
                  </div>
                  <div className="text-primary flex items-center gap-1 text-[10px] font-bold">
                    <StarIcon size={12} weight="fill" />
                    <span>1,248</span>
                  </div>
                </a>

                <Button
                  variant="default"
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 text-xs font-bold tracking-wider text-white"
                >
                  <span>DOWNLOAD NOW</span>
                  <DownloadSimpleIcon size={16} weight="bold" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
