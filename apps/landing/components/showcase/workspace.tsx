'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CaretLeftIcon,
  FileVideoIcon,
  FileAudioIcon,
  ChatIcon,
  FolderOpenIcon,
  GearIcon,
  PlayIcon,
  ExportIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface EditorWorkspaceProps {
  stageId: string;
  subStepId: string;
  progress: number;
}

const PROMPT_TEXT = 'clean silent gaps and insert city skyline b-roll';

export function EditorWorkspace({
  stageId,
  subStepId,
  progress,
}: EditorWorkspaceProps) {
  // Simulate cursor blinking
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Compute typed prompt length based on progress during typing sub-step
  const getTypedPrompt = () => {
    if (stageId === 'import') return '';
    if (subStepId === 'TYPE_PROMPT') {
      const charCount = Math.floor((progress / 100) * PROMPT_TEXT.length);
      return PROMPT_TEXT.substring(0, charCount);
    }
    return PROMPT_TEXT;
  };

  const typedPrompt = getTypedPrompt();

  return (
    <div className="flex h-full w-full flex-col bg-[#080808] text-xs select-none">
      {/* 1. Header Bar */}
      <header className="border-border flex h-11 shrink-0 items-center justify-between border-b bg-[#0a0a0a] px-4">
        <div className="flex items-center gap-3">
          <div className="border-border flex size-7 items-center justify-center border bg-[#141414] text-white/40">
            <CaretLeftIcon weight="bold" size={14} />
          </div>
          <div className="bg-border h-4 w-[1px]" />
          <h1 className="font-mono text-[10px] font-bold tracking-wide text-white">
            timeline_assembly.rsh
          </h1>
          <span className="border-border border bg-[#121212] px-1.5 py-0.5 font-mono text-[8px] text-white/40">
            1920x1080 @ 24fps
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              'border-border flex h-7 items-center justify-center gap-1.5 rounded-none border px-3 font-mono text-[9px] font-bold transition-all duration-300',
              subStepId === 'EXPORT_CLICK'
                ? 'bg-primary border-primary scale-[0.97] text-white'
                : stageId === 'export'
                  ? 'bg-primary/20 border-primary/30 text-white'
                  : 'bg-[#141414] text-white/60',
            )}
          >
            <ExportIcon size={12} weight="bold" />
            <span>EXPORT</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Panels */}
      <div className="border-border flex min-h-0 flex-1 border-b">
        {/* LEFT PANEL: Assets Bin */}
        <div className="border-border flex w-[22%] min-w-0 flex-col gap-2 border-r bg-[#090909] p-2.5">
          <div className="mb-1 font-mono text-[8px] font-black tracking-wider text-white/30 uppercase">
            PROJECT BIN
          </div>

          <div className="flex flex-col gap-1.5 font-mono">
            {/* Asset 1: Audio WAV */}
            {subStepId !== 'BROWSER_OPEN' && (
              <div
                className={cn(
                  'flex items-center gap-2 border p-1.5 transition-all duration-300',
                  subStepId === 'AUDIO_INDEX'
                    ? 'border-primary/40 bg-primary/[0.02]'
                    : 'border-white/5 bg-[#0c0c0c]',
                )}
              >
                <FileAudioIcon
                  size={14}
                  className={
                    subStepId === 'AUDIO_INDEX'
                      ? 'text-primary animate-pulse'
                      : 'text-white/40'
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[9px] font-bold text-white/70">
                    mic_audio.wav
                  </div>
                  <div className="truncate text-[8px] text-white/30">
                    {subStepId === 'AUDIO_INDEX' && progress < 100
                      ? `INDEXING... ${Math.round(progress)}%`
                      : '48kHz • Stereo'}
                  </div>
                </div>
              </div>
            )}

            {/* Asset 2: Video MP4 */}
            {(stageId !== 'import' ||
              (subStepId !== 'BROWSER_OPEN' &&
                subStepId !== 'AUDIO_INDEX')) && (
              <div
                className={cn(
                  'flex items-center gap-2 border p-1.5 transition-all duration-300',
                  subStepId === 'VISUAL_INDEX'
                    ? 'border-primary/40 bg-primary/[0.02]'
                    : 'border-white/5 bg-[#0c0c0c]',
                )}
              >
                <FileVideoIcon
                  size={14}
                  className={
                    subStepId === 'VISUAL_INDEX'
                      ? 'text-primary animate-pulse'
                      : 'text-white/40'
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[9px] font-bold text-white/70">
                    skyline_broll.mp4
                  </div>
                  <div className="truncate text-[8px] text-white/30">
                    {subStepId === 'VISUAL_INDEX' && progress < 100
                      ? `INDEXING... ${Math.round(progress)}%`
                      : '1080p • 24fps'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL: Preview Canvas & Timeline */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#060606]">
          {/* Video Preview Viewport */}
          <div className="border-border relative flex flex-[1.4] items-center justify-center overflow-hidden border-b bg-black/40 p-4">
            <div className="absolute top-2 left-2 font-mono text-[8px] font-bold tracking-wider text-white/20 uppercase">
              PREVIEW VIEWPORT
            </div>

            {/* Canvas Aspect Border Box */}
            <div className="border-border relative flex aspect-video w-full max-w-[340px] items-center justify-center overflow-hidden border bg-[#0c0c0c]">
              {/* Grid Background */}
              <div className="bg-grid-white/[0.01] absolute inset-0" />

              {/* Dynamic rendering states representing the video clip output */}
              <div className="relative flex h-full w-full items-center justify-center bg-black/60">
                {/* STATE 1: No media imported */}
                {stageId === 'import' && subStepId === 'BROWSER_OPEN' && (
                  <span className="font-mono text-[8px] font-bold tracking-widest text-white/20 uppercase">
                    [ NO MEDIA LOADED ]
                  </span>
                )}

                {/* STATE 2: Audio indexing (Microphone Monitor) */}
                {subStepId === 'AUDIO_INDEX' && (
                  <div className="flex flex-col items-center justify-center p-4">
                    <div className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-white/[0.01]">
                      <div className="border-primary/20 absolute inset-0 animate-ping rounded-full border" />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50">
                        🎤
                      </div>
                    </div>
                    <span className="animate-pulse text-[8px] font-black tracking-widest text-white/30 uppercase">
                      PROCESSING WAVEFORM INDEX
                    </span>
                  </div>
                )}

                {/* STATE 3: Visual indexing (CLIP laser scanning grid) */}
                {subStepId === 'VISUAL_INDEX' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                    <div className="border-primary/30 relative flex h-3/5 w-4/5 items-center justify-center border border-dashed bg-white/[0.01]">
                      {/* Laser scanning line */}
                      <motion.div
                        className="bg-primary/40 absolute right-0 left-0 h-[1.5px] shadow-[0_0_8px_#fb5536]"
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                          ease: 'easeInOut',
                        }}
                      />
                      <svg
                        className="h-full w-full opacity-30"
                        viewBox="0 0 100 50"
                      >
                        <path
                          d="M 0 45 L 20 20 L 35 35 L 55 10 L 70 30 L 85 15 L 100 45 Z"
                          fill="none"
                          stroke="#fb5536"
                          strokeWidth="0.8"
                        />
                      </svg>
                      <div className="bg-primary/20 border-primary/40 absolute bottom-1 border px-1 py-0.5 text-[6px] font-bold tracking-wider text-white uppercase">
                        CLIP SCANNING FRAME
                      </div>
                    </div>
                  </div>
                )}

                {/* STATE 4: AI editing / Typing (static audio visualizer) */}
                {stageId === 'prompt' &&
                  (subStepId === 'TYPE_PROMPT' || subStepId === 'THINKING') && (
                    <div className="flex h-full w-full items-center justify-center p-4">
                      <div className="flex items-center gap-1 opacity-20">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-[2px] bg-white"
                            style={{
                              height: `${Math.round(Math.abs(Math.sin(i * 0.3)) * 20 + 5)}px`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                {/* STATE 5: Active scene output (city skyline wireframe) */}
                {(subStepId === 'TIMELINE_EDIT' ||
                  subStepId === 'TASK_COMPLETE' ||
                  stageId === 'adjust' ||
                  stageId === 'export') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                    {/* Active video viewport mockup - kept stationary */}
                    <div
                      className={cn(
                        'relative flex h-3/5 w-4/5 scale-100 rotate-0 items-center justify-center transition-all duration-300',
                        stageId === 'adjust'
                          ? 'border-primary/50 bg-primary/[0.03] border'
                          : 'border border-white/5',
                      )}
                    >
                      <svg
                        className="h-full w-full opacity-60"
                        viewBox="0 0 100 50"
                      >
                        {/* Wireframe city block outlines */}
                        <path
                          d="M 0 50 L 15 25 L 20 25 L 20 50 M 20 50 L 35 15 L 45 15 L 45 50 M 45 50 L 60 30 L 70 30 L 70 50 M 70 50 L 85 20 L 90 20 L 90 50"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="0.8"
                          className="opacity-30"
                        />
                        {/* Sunrise glow path */}
                        <path
                          d="M 30 50 A 15 15 0 0 1 60 50"
                          fill="none"
                          stroke="#fb5536"
                          strokeWidth="1"
                        />
                      </svg>

                      {/* Active wireframe adjust handles */}
                      {stageId === 'adjust' && (
                        <>
                          <div className="absolute top-0 left-0 h-1.5 w-1.5 border-t border-l border-white" />
                          <div className="absolute top-0 right-0 h-1.5 w-1.5 border-t border-r border-white" />
                          <div className="absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l border-white" />
                          <div className="absolute right-0 bottom-0 h-1.5 w-1.5 border-r border-b border-white" />
                          <div className="bg-primary absolute -bottom-4 px-1 py-0.5 font-mono text-[6px] font-bold tracking-widest text-white uppercase">
                            ROT: 2° | SCL: 1.1x
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Panel */}
          <div className="relative flex min-h-0 flex-1 flex-col bg-[#080808]">
            <div className="border-border flex h-6 items-center justify-between border-b bg-[#0a0a0a] px-3 text-[8px] text-white/30">
              <span className="font-mono font-black tracking-widest uppercase">
                TIMELINE
              </span>
              <div className="flex gap-6 font-mono text-[7px]">
                <span>0:00</span>
                <span>0:05</span>
                <span>0:10</span>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col justify-center gap-2 overflow-hidden p-2.5">
              {/* Playhead needle bar */}
              <div
                className="bg-primary pointer-events-none absolute top-0 bottom-0 z-20 w-[1px] transition-all duration-300"
                style={{
                  left:
                    subStepId === 'TIMELINE_EDIT'
                      ? `${25 + progress * 0.4}%`
                      : stageId === 'import'
                        ? '25%'
                        : '65%',
                }}
              >
                <div className="bg-primary absolute top-0 -left-1 h-1 w-2" />
              </div>

              {/* Track V1 */}
              <div className="relative flex h-7 items-center">
                <div className="border-border flex h-full w-6 shrink-0 items-center justify-center border bg-[#0c0c0c] font-mono text-[7px] font-bold text-white/30">
                  V1
                </div>
                <div className="relative ml-2 flex h-full flex-1 items-center gap-1">
                  {stageId === 'import' ? (
                    <span className="pl-1 font-mono text-[7px] tracking-widest text-white/10 uppercase">
                      [ EMPTY TRACK ]
                    </span>
                  ) : subStepId === 'TYPE_PROMPT' ||
                    subStepId === 'THINKING' ? (
                    /* Initial raw video with silent gap */
                    <div className="flex h-full w-[85%] shrink-0 items-center border border-white/5 bg-white/[0.01] p-1 font-mono text-[7px] text-white/50">
                      interview_raw.mp4
                    </div>
                  ) : (
                    /* Processed timeline, gaps removed, B-roll inserted */
                    <>
                      <div
                        className={cn(
                          'flex h-full w-[38%] shrink-0 flex-col justify-center border p-1 transition-all duration-300',
                          stageId === 'adjust' && subStepId === 'SELECT_CLIP'
                            ? 'border-primary bg-primary/10 shadow-[0_0_8px_rgba(251,85,54,0.15)]'
                            : 'border-white/5 bg-white/[0.01]',
                        )}
                      >
                        <span
                          className={cn(
                            'truncate text-[7px] font-bold transition-colors duration-300',
                            stageId === 'adjust' && subStepId === 'SELECT_CLIP'
                              ? 'text-primary'
                              : 'text-white/60',
                          )}
                        >
                          interview_pt1
                        </span>
                      </div>
                      <div className="flex h-full w-[35%] shrink-0 flex-col justify-center border border-white/5 bg-white/[0.01] p-1">
                        <span className="truncate text-[7px] font-bold text-white/60">
                          interview_pt2
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex h-full w-[22%] shrink-0 flex-col justify-center border p-1 transition-all duration-300',
                          stageId === 'adjust'
                            ? subStepId === 'PARAMETER_TWEAK'
                              ? 'border-primary bg-primary/10 shadow-[0_0_8px_rgba(251,85,54,0.15)]'
                              : 'border-white/5 bg-white/[0.01]'
                            : 'border-primary/20 bg-primary/5',
                        )}
                      >
                        <span
                          className={cn(
                            'truncate text-[7px] font-bold transition-colors duration-300',
                            stageId === 'adjust'
                              ? subStepId === 'PARAMETER_TWEAK'
                                ? 'text-primary'
                                : 'text-white/40'
                              : 'text-primary',
                          )}
                        >
                          skyline_broll
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Track A1 (Waveforms) */}
              <div className="relative flex h-7 items-center">
                <div className="border-border flex h-full w-6 shrink-0 items-center justify-center border bg-[#0c0c0c] font-mono text-[7px] font-bold text-white/30">
                  A1
                </div>
                <div className="relative ml-2 flex h-full flex-1 items-center">
                  {stageId === 'import' && subStepId === 'BROWSER_OPEN' ? (
                    <span className="pl-1 font-mono text-[7px] tracking-widest text-white/10 uppercase">
                      [ EMPTY TRACK ]
                    </span>
                  ) : (
                    <div className="flex h-full w-full items-center gap-[1px] overflow-hidden border border-dashed border-white/5 bg-black/25 px-2">
                      {Array.from({ length: 60 }).map((_, i) => {
                        // Flat line representation for the silence cut area
                        const isSilenceZone = i >= 20 && i <= 30;
                        const isCut =
                          (stageId === 'prompt' &&
                            (subStepId === 'TIMELINE_EDIT' ||
                              subStepId === 'TASK_COMPLETE')) ||
                          stageId === 'adjust' ||
                          stageId === 'export';

                        if (isCut && isSilenceZone) return null; // segment has been cut!

                        return (
                          <div
                            key={i}
                            className={cn(
                              'w-[1.5px] shrink-0 transition-all duration-300',
                              isSilenceZone ? 'bg-primary/30' : 'bg-white/10',
                            )}
                            style={{
                              height: isSilenceZone
                                ? '1px'
                                : `${Math.round(Math.abs(Math.sin(i * 0.25)) * 10 + 3)}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Agent Panel or Properties Panel */}
        <div className="border-border flex w-[28%] min-w-0 flex-col border-l bg-[#090909]">
          {stageId === 'adjust' ? (
            /* Properties Panel */
            <>
              <div className="border-border flex h-9 shrink-0 items-center justify-between border-b bg-[#0a0a0a] px-3">
                <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wide text-white/80 uppercase">
                  <GearIcon
                    size={12}
                    className="text-primary animate-spin"
                    style={{ animationDuration: '6s' }}
                  />
                  <span>PROPERTIES</span>
                </div>
                <span className="border-border border bg-[#121212] px-1 py-0.5 font-mono text-[7px] text-white/40">
                  VIDEO
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-3 font-mono text-[9px] text-white/70">
                {/* File source metadata */}
                <div className="flex flex-col gap-1 border-b border-white/5 pb-2.5">
                  <span className="text-[7px] font-bold tracking-wider text-white/20 uppercase">
                    SOURCE FILE
                  </span>
                  <span className="truncate font-bold text-white/80">
                    {subStepId === 'SELECT_CLIP'
                      ? 'interview_raw.mp4'
                      : 'skyline_broll.mp4'}
                  </span>
                </div>

                {/* Transform properties list */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-[7px] font-bold tracking-wider text-white/20 uppercase">
                    TRANSFORM
                  </span>

                  {/* Position coordinates */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">POSITION</span>
                    <div className="flex gap-2 text-right">
                      <div className="w-14 border border-white/5 bg-black/40 px-1.5 py-0.5">
                        {subStepId === 'SELECT_CLIP' ? 'X: 0px' : 'X: 12px'}
                      </div>
                      <div className="w-14 border border-white/5 bg-black/40 px-1.5 py-0.5">
                        {subStepId === 'SELECT_CLIP' ? 'Y: 0px' : 'Y: -5px'}
                      </div>
                    </div>
                  </div>

                  {/* Scale values */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">SCALE</span>
                    <div className="flex gap-2 text-right">
                      <div className="w-14 border border-white/5 bg-black/40 px-1.5 py-0.5">
                        {subStepId === 'SELECT_CLIP' ? 'W: 100%' : 'W: 110%'}
                      </div>
                      <div className="w-14 border border-white/5 bg-black/40 px-1.5 py-0.5">
                        {subStepId === 'SELECT_CLIP' ? 'H: 100%' : 'H: 110%'}
                      </div>
                    </div>
                  </div>

                  {/* Rotation value */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">ROTATION</span>
                    <div className="text-primary w-14 border border-white/5 bg-black/40 px-1.5 py-0.5 text-right font-bold">
                      {subStepId === 'SELECT_CLIP' ? '0°' : '2°'}
                    </div>
                  </div>
                </div>

                {/* Audio parameters list */}
                <div className="mt-1 flex flex-col gap-2 border-t border-white/5 pt-2.5">
                  <span className="text-[7px] font-bold tracking-wider text-white/20 uppercase">
                    AUDIO CHANNEL
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/40">VOLUME</span>
                    <span className="w-14 border border-white/5 bg-black/40 px-1.5 py-0.5 text-right">
                      0.0 dB
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Agent Panel */
            <>
              <div className="border-border flex h-9 shrink-0 items-center justify-between border-b bg-[#0a0a0a] px-3">
                <div className="flex items-center gap-1.5">
                  <ChatIcon size={12} className="text-primary" />
                  <span className="font-mono text-[9px] font-bold tracking-wide text-white/80 uppercase">
                    AGENT PANEL
                  </span>
                </div>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    subStepId === 'THINKING'
                      ? 'animate-pulse bg-amber-500'
                      : 'bg-emerald-500',
                  )}
                />
              </div>

              {/* Conversation History Drawer */}
              <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden bg-[#080808]/40 p-2 font-mono text-[9px]">
                {/* User prompt balloon */}
                {stageId !== 'import' && (
                  <div className="ml-auto flex max-w-[95%] flex-col items-end gap-0.5">
                    <span className="text-[7px] font-black tracking-widest text-white/30 uppercase">
                      USER
                    </span>
                    <div className="bg-primary/10 border-primary/20 border px-2 py-1 text-right text-white">
                      <span>{typedPrompt}</span>
                      {subStepId === 'TYPE_PROMPT' && showCursor && (
                        <span className="text-primary ml-0.5">|</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Agent response balloon */}
                {(subStepId === 'THINKING' ||
                  subStepId === 'TIMELINE_EDIT' ||
                  subStepId === 'TASK_COMPLETE' ||
                  stageId === 'adjust' ||
                  stageId === 'export') && (
                  <div className="mr-auto flex max-w-[95%] flex-col items-start gap-0.5">
                    <span className="text-primary text-[7px] font-black tracking-widest uppercase">
                      AGENT
                    </span>
                    <div className="border border-white/5 bg-white/[0.02] px-2 py-1 text-left leading-relaxed whitespace-pre-line text-white/70">
                      {subStepId === 'THINKING' ? (
                        <div className="flex items-center gap-1">
                          <CircleNotchIcon
                            className="text-primary animate-spin"
                            size={10}
                          />
                          <span>Reasoning edit tree...</span>
                        </div>
                      ) : (
                        <>
                          {subStepId === 'TIMELINE_EDIT'
                            ? 'Reasoning silence zones...\n✓ Deleted segment V1/A1.\nProcessing vector assets...'
                            : '✓ Deleted gap at 4.5s - 6.5s.\n✓ Appended skyline_broll.mp4 (94% match) on Track V1.'}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-border flex shrink-0 gap-1.5 border-t bg-[#0a0a0a] p-2">
                <div className="border-border flex flex-1 items-center border bg-black/60 px-2 py-1 font-mono text-[8px] text-white/30">
                  <span className="text-primary mr-1">&gt;</span>
                  Ask co-editor...
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Browser Popup Window Overlay (Stage: Import, Step: BROWSER_OPEN) */}
      <AnimatePresence>
        {stageId === 'import' && subStepId === 'BROWSER_OPEN' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6"
          >
            <div className="border-border flex h-[280px] w-[420px] flex-col border bg-[#0c0c0c] font-mono text-[9px] shadow-2xl">
              <header className="border-border flex h-8 items-center justify-between border-b bg-[#121212] px-3">
                <span className="font-bold text-white/70">
                  Local OS File Browser
                </span>
                <div className="flex gap-1.5">
                  <div className="size-2 rounded-full bg-white/10" />
                  <div className="size-2 rounded-full bg-white/10" />
                </div>
              </header>
              <div className="flex min-h-0 flex-1">
                {/* File explorer folders */}
                <div className="border-border flex w-[30%] flex-col gap-1.5 border-r bg-[#090909] p-2 text-white/40">
                  <span className="text-[7px] font-bold tracking-wider text-white/20 uppercase">
                    Locations
                  </span>
                  <div className="flex items-center gap-1.5 text-white/70">
                    <FolderOpenIcon size={10} />
                    <span>Raw Media</span>
                  </div>
                </div>
                {/* File list with cursor selection animation */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                  <span className="text-[7px] font-bold tracking-wider text-white/20 uppercase">
                    Select video/audio binary
                  </span>
                  <div className="flex flex-col gap-1">
                    {/* mic_audio.wav */}
                    <div className="flex items-center justify-between border border-white/5 bg-white/[0.02] p-1.5 text-white/80">
                      <span>mic_audio.wav</span>
                      <span className="text-white/30">1.8 MB</span>
                    </div>
                    {/* skyline_broll.mp4 (Select Highlight target) */}
                    <div
                      className={cn(
                        'flex items-center justify-between border p-1.5 transition-all duration-300',
                        progress > 35
                          ? 'border-primary bg-primary/10 text-white shadow-[0_0_10px_rgba(251,85,54,0.1)]'
                          : 'border-white/5 bg-[#0c0c0c] text-white/80',
                      )}
                    >
                      <span>skyline_broll.mp4</span>
                      <span
                        className={
                          progress > 35 ? 'text-primary' : 'text-white/30'
                        }
                      >
                        14.5 MB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <footer className="border-border flex h-10 shrink-0 items-center justify-end gap-2 border-t bg-[#121212] px-3">
                <div className="border-border border px-2.5 py-1 text-white/40">
                  Cancel
                </div>
                <div
                  className={cn(
                    'border px-3 py-1 font-bold transition-all duration-300',
                    progress > 70
                      ? 'bg-primary border-primary scale-[0.98] text-white'
                      : 'border-white/10 bg-white/5 text-white/30',
                  )}
                >
                  Import Selected
                </div>
              </footer>

              {/* Custom Simulated Mouse Cursor */}
              <motion.div
                className="pointer-events-none absolute z-50 text-[16px]"
                animate={{
                  top: ['80%', '52%', '52%', '84%', '84%'],
                  left: ['90%', '65%', '65%', '85%', '85%'],
                }}
                transition={{
                  duration: 2.2,
                  ease: 'easeInOut',
                }}
              >
                🖱️
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Dialog Overlay (Stage 4) */}
      <AnimatePresence>
        {stageId === 'export' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6"
          >
            <div className="border-border flex w-[300px] flex-col gap-3.5 border bg-[#0c0c0c] p-4 font-mono text-[9px] text-white/70 shadow-2xl">
              <header className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-[8px] font-bold tracking-wider text-white uppercase">
                  Export Progress
                </span>
                <span className="text-primary font-bold">
                  {subStepId === 'EXPORT_CLICK'
                    ? '0%'
                    : subStepId === 'WEBGPU_ENCODE'
                      ? `${Math.round(progress * 0.7)}%`
                      : `${Math.round(70 + progress * 0.3)}%`}
                </span>
              </header>

              <div className="flex flex-col gap-2.5">
                {/* Step 1: WebGPU Rasterizer */}
                <div className="flex items-center justify-between">
                  <span className="text-white/50">1. WebGPU Render Pass</span>
                  <span
                    className={cn(
                      'font-bold',
                      subStepId === 'EXPORT_CLICK'
                        ? 'text-white/20'
                        : subStepId === 'WEBGPU_ENCODE'
                          ? 'text-primary animate-pulse'
                          : 'text-green-500',
                    )}
                  >
                    {subStepId === 'EXPORT_CLICK'
                      ? 'PENDING'
                      : subStepId === 'WEBGPU_ENCODE'
                        ? `RENDERING (${Math.round(progress)}%)`
                        : '✓ DONE'}
                  </span>
                </div>

                {/* Step 2: FFmpeg Stream Muxer */}
                <div className="flex items-center justify-between">
                  <span className="text-white/50">2. FFmpeg Stream Muxer</span>
                  <span
                    className={cn(
                      'font-bold',
                      subStepId === 'FFMPEG_MUX'
                        ? 'text-primary animate-pulse'
                        : subStepId === 'WEBGPU_ENCODE' ||
                            subStepId === 'EXPORT_CLICK'
                          ? 'text-white/20'
                          : 'text-green-500',
                    )}
                  >
                    {subStepId === 'FFMPEG_MUX'
                      ? `MUXING (${Math.round(progress)}%)`
                      : subStepId === 'WEBGPU_ENCODE' ||
                          subStepId === 'EXPORT_CLICK'
                        ? 'PENDING'
                        : '✓ DONE'}
                  </span>
                </div>
              </div>

              {/* Unified Progress Bar */}
              <div className="h-1 w-full overflow-hidden bg-white/5">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{
                    width: `${
                      subStepId === 'EXPORT_CLICK'
                        ? 0
                        : subStepId === 'WEBGPU_ENCODE'
                          ? progress * 0.7
                          : 70 + progress * 0.3
                    }%`,
                  }}
                />
              </div>

              {/* Final Completion Status */}
              {subStepId === 'FFMPEG_MUX' && progress >= 85 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="animate-fade-in mt-1 flex flex-col gap-2 border-t border-white/5 pt-2.5 text-center"
                >
                  <span className="font-bold text-green-400">
                    ✓ Render Completed Successfully
                  </span>
                  <span className="truncate text-[7px] text-white/40">
                    rush_project_final.mp4
                  </span>
                  <button className="border-border mt-1 cursor-default rounded-none border bg-white/5 px-2 py-1 text-white hover:bg-white/10">
                    Reveal File in Explorer
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Toast Overlay representing background tasks */}
      <AnimatePresence mode="wait">
        {(subStepId === 'AUDIO_INDEX' || subStepId === 'VISUAL_INDEX') && (
          <motion.div
            key={subStepId}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-3 left-3 z-30 flex w-[230px] flex-col gap-1.5 border border-white/10 bg-[#0e0e11] p-2.5 font-mono text-white shadow-2xl"
          >
            <div className="flex items-center justify-between text-[8px] font-bold tracking-wider text-white/40 uppercase">
              <span>
                {subStepId === 'AUDIO_INDEX'
                  ? 'Transcribing Speech'
                  : 'Visual Indexing'}
              </span>
              <span className="text-primary text-[8px] font-bold">
                {`${Math.round(progress)}%`}
              </span>
            </div>
            <p className="truncate text-[9px] leading-relaxed text-white/80">
              {subStepId === 'AUDIO_INDEX'
                ? 'Running local Whisper audio indexing...'
                : 'Generating CLIP frame embeddings...'}
            </p>
            <div className="h-1 w-full overflow-hidden bg-white/10">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
