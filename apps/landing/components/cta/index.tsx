'use client';

import { DownloadSimpleIcon, GithubLogoIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CtaSection() {
  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-5 overflow-visible px-6 py-24 text-center font-mono">
      {/* Version Tag */}
      <span className="text-primary text-[10px] font-bold tracking-widest uppercase">
        // RUSH DESKTOP v0.1.0
      </span>

      {/* Heading */}
      <h2 className="max-w-xl text-3xl leading-tight font-black tracking-tight text-white uppercase md:text-4xl">
        Accelerate Your Video Editing Pipeline
      </h2>

      {/* Description */}
      <p className="text-muted-foreground max-w-md text-xs leading-relaxed md:text-sm">
        Get the local-first desktop editor. Leverage local WebGPU render passes
        and autonomous AI editing agents on your machine.
      </p>

      {/* Action Buttons */}
      <div className="mt-2 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href="#"
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
        </a>
        <a
          href="https://github.com/Starz099/rush"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'border-border flex h-11 cursor-pointer items-center gap-2 rounded-none px-8 font-bold tracking-tight uppercase transition-all duration-300 hover:bg-white/5',
          )}
        >
          <GithubLogoIcon weight="bold" size={16} />
          Star on GitHub
        </a>
      </div>
    </div>
  );
}
