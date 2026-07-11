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
      <h2 className="max-w-xl text-3xl leading-tight font-black tracking-tight text-white uppercase md:text-4xl">
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
            'group relative flex h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-none px-8 font-bold tracking-tight uppercase shadow-[0_0_20px_rgba(251,85,54,0.15)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,85,54,0.3)] active:scale-[0.98]',
          )}
        >
          <span className="relative z-10 flex items-center gap-2">
            <DownloadSimpleIcon weight="bold" size={16} />
            Download Installer
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </button>
        <a
          href="https://github.com/Starz099/rush"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'border-border relative flex h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-none px-8 font-bold tracking-tight uppercase transition-all duration-300 hover:bg-white/5',
          )}
        >
          <span className="relative z-10 flex items-center gap-2">
            <GithubLogoIcon weight="bold" size={16} />
            <span>Star on GitHub</span>
            <span className="bg-border h-3 w-[1px]" />
            <div className="text-primary flex items-center gap-1 text-[10px] font-bold">
              <StarIcon size={10} weight="fill" />
              <span>{formattedStars}</span>
            </div>
          </span>
          {/* Hardware-accelerated continuous shine */}
          <span className="custom-shine-element" />
        </a>
      </div>
    </div>
  );
}
