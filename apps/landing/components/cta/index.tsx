'use client';

import {
  DownloadSimpleIcon,
  GithubLogoIcon,
  StarIcon,
} from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGitHubStars } from '@/hooks/use-github-stars';

export default function CtaSection() {
  const { formattedStars } = useGitHubStars();
  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-5 overflow-visible px-6 py-24 text-center">
      {/* Heading */}
      <h2 className="max-w-2xl text-center text-3xl leading-tight font-bold tracking-wide text-white uppercase md:text-4xl">
        The video editor you actually own
      </h2>

      {/* Description */}
      <p className="text-muted-foreground max-w-md text-xs leading-relaxed md:text-sm">
        No cloud logins, no monthly subscription bills. Just a local,
        open-source desktop app running on your own hardware. Bring your own API
        keys for the AI agent and pay only for what you actually use.
      </p>

      {/* Action Buttons */}
      <div className="mt-2 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          onClick={() => {
            window.dispatchEvent(new Event('open-download-modal'));
          }}
          className={cn(
            buttonVariants({ variant: 'default' }),
            'group relative flex h-12 cursor-pointer items-center gap-2 overflow-hidden rounded-none px-8 text-sm font-semibold tracking-wide text-white shadow-[0_0_20px_rgba(251,85,54,0.15)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.3)] active:scale-[0.98]',
          )}
        >
          <span className="relative z-10 flex items-center gap-2">
            <DownloadSimpleIcon weight="bold" size={16} />
            <span>Download Installer</span>
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </button>
        <a
          href="https://github.com/Starz099/rush"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex h-12 cursor-pointer items-center gap-2 overflow-hidden rounded-none border border-white/5 bg-[#141414] px-8 text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:border-white/15 hover:bg-[#1c1c1c] active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center gap-2">
            <GithubLogoIcon weight="bold" size={16} className="shrink-0" />
            <span>Star on GitHub</span>
            <span className="h-4 w-[1px] shrink-0 bg-white/20" />
            <span className="text-primary flex shrink-0 items-center gap-1 text-sm font-bold">
              <StarIcon size={13} weight="fill" />
              <span>{formattedStars}</span>
            </span>
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </a>
      </div>
    </div>
  );
}
