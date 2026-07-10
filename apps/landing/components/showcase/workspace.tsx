'use client';

import { CaretLeftIcon, FileVideoIcon, ChatIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { ShowcaseStep } from './types';

interface EditorWorkspaceProps {
  step: ShowcaseStep;
}

export function EditorWorkspace({ step }: EditorWorkspaceProps) {
  return (
    <div className="flex h-full w-full flex-col bg-[#080808] text-xs">
      {/* Editor Header bar */}
      <header className="border-border flex h-11 shrink-0 items-center justify-between border-b bg-[#0a0a0a] px-4">
        <div className="flex items-center gap-3">
          <div className="border-border flex size-7 items-center justify-center border bg-[#141414] text-white/40">
            <CaretLeftIcon weight="bold" size={14} />
          </div>
          <div className="bg-border h-4 w-[1px]" />
          <h1 className="font-mono text-[11px] font-bold tracking-wide text-white">
            {step.projectName}
          </h1>
          <span className="border-border border bg-[#121212] px-1.5 py-0.5 font-mono text-[9px] text-white/40">
            {step.dimensions} @ {step.framerate}fps
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="border-border flex h-7 items-center justify-center border bg-[#141414] px-3 font-mono text-[10px] font-bold text-white/60">
            EXPORT
          </div>
        </div>
      </header>

      {/* Editor Panels area */}
      <div className="border-border flex min-h-0 flex-1 border-b">
        {/* Left Sidebar (Assets list) */}
        <div className="border-border flex w-[20%] min-w-0 flex-col gap-2 border-r bg-[#090909] p-2.5">
          <div className="mb-1 font-mono text-[9px] font-bold tracking-wider text-white/40 uppercase">
            ASSETS
          </div>

          <div className="flex flex-col gap-1.5 font-mono">
            <div className="border-border flex items-center gap-2 border bg-[#0c0c0c] p-1.5">
              <FileVideoIcon size={14} className="text-white/40" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold text-white/70">
                  interview_A.mp4
                </div>
                <div className="truncate text-[8px] text-white/30">
                  1080p • 24fps
                </div>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 border p-1.5 transition-all duration-300',
                step.id === 'embeddings'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-[#0c0c0c]',
              )}
            >
              <FileVideoIcon
                size={14}
                className={
                  step.id === 'embeddings' ? 'text-primary' : 'text-white/40'
                }
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold text-white/70">
                  skyline_broll.mp4
                </div>
                <div className="truncate text-[8px] text-white/30">
                  {step.id === 'embeddings'
                    ? 'CONFIDENCE: 94%'
                    : '2160p • 30fps'}
                </div>
              </div>
            </div>

            <div className="border-border flex items-center gap-2 border bg-[#0c0c0c] p-1.5">
              <FileVideoIcon size={14} className="text-white/40" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[9px] font-bold text-white/70">
                  mic_audio.wav
                </div>
                <div className="truncate text-[8px] text-white/30">
                  48kHz • Stereo
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel (Preview top, Timeline bottom) */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#060606]">
          {/* Video Preview Viewport */}
          <div className="border-border relative flex flex-[1.4] items-center justify-center overflow-hidden border-b bg-black/25 p-4">
            <div className="absolute top-2 left-2 font-mono text-[9px] font-semibold tracking-wider text-white/30">
              PREVIEW
            </div>

            {/* Visual Aspect Box */}
            <div className="border-border relative flex aspect-video w-full max-w-[340px] items-center justify-center overflow-hidden border bg-[#0c0c0c]">
              <div className="bg-grid-white/[0.01] absolute inset-0" />

              {/* Dynamic canvas graphics representing the scenes */}
              <div className="relative flex h-full w-full items-center justify-center bg-black/40">
                {step.id === 'silence' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    {/* Audio silence talking avatar */}
                    <div className="relative mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                      <div className="border-primary/20 absolute inset-0 animate-ping rounded-full border" />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-white/60">
                        🗣️
                      </div>
                    </div>
                    <span className="text-[8px] font-black tracking-widest text-white/40 uppercase">
                      MIC INPUT MONITOR
                    </span>
                  </div>
                )}

                {step.id === 'embeddings' && (
                  <div className="bg-primary/[0.01] absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                    {/* Bounding box wireframe graphic of skyline */}
                    <div className="border-primary/40 relative flex h-3/5 w-4/5 items-center justify-center border border-dashed">
                      {/* Bounding box label */}
                      <div className="bg-primary absolute top-1 left-1 px-1 py-0.5 text-[7px] font-bold text-white">
                        skyline: 94%
                      </div>
                      {/* Wireframe lines */}
                      <svg
                        className="h-full w-full opacity-60"
                        viewBox="0 0 100 50"
                      >
                        <path
                          d="M 0 45 L 20 20 L 35 35 L 55 10 L 70 30 L 85 15 L 100 45 Z"
                          fill="none"
                          stroke="#fb5536"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {step.id === 'transform' && (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                    {/* Crop handles inside the scale layout */}
                    <div className="border-primary bg-primary/5 relative flex h-[75px] w-[110px] scale-[1.4] rotate-[2deg] items-center justify-center border">
                      <div className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2 border-white" />
                      <div className="absolute top-0 right-0 h-2 w-2 border-t-2 border-r-2 border-white" />
                      <div className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2 border-white" />
                      <div className="absolute right-0 bottom-0 h-2 w-2 border-r-2 border-b-2 border-white" />
                      <span className="text-[6px] font-bold tracking-widest text-white/60">
                        [ V1 TRANSFORM ]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Panel */}
          <div className="relative flex min-h-0 flex-1 flex-col bg-[#080808]">
            <div className="border-border flex h-6 items-center justify-between border-b bg-[#0a0a0a] px-3 text-[9px] text-white/40">
              <span className="font-mono font-bold tracking-widest uppercase">
                TIMELINE
              </span>
              <div className="flex gap-4 font-mono">
                <span>0:00</span>
                <span>0:05</span>
                <span>0:10</span>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col justify-center gap-1.5 overflow-hidden p-2">
              {/* Playhead line */}
              <div
                className={cn(
                  'bg-primary pointer-events-none absolute top-0 bottom-0 z-20 w-[1.5px] transition-all duration-500',
                  step.id === 'silence' ? 'left-[60%]' : 'left-[35%]',
                )}
              >
                <div className="bg-primary absolute top-0 -left-1.5 h-1.5 w-3.5" />
              </div>

              {/* V1 Track */}
              <div className="relative flex h-8 items-center">
                <div className="border-border flex h-full w-8 shrink-0 items-center justify-center border bg-[#0c0c0c] font-mono text-[8px] font-bold text-white/40">
                  V1
                </div>
                <div className="relative ml-2 flex h-full flex-1 items-center gap-1">
                  {step.id === 'silence' ? (
                    <>
                      <div className="border-primary/30 bg-primary/5 flex h-full w-[42%] shrink-0 flex-col justify-center overflow-hidden border p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt1
                        </span>
                      </div>
                      <div className="border-primary/30 bg-primary/5 flex h-full w-[45%] shrink-0 flex-col justify-center overflow-hidden border p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt2
                        </span>
                      </div>
                    </>
                  ) : step.id === 'embeddings' ? (
                    <>
                      <div className="flex h-full w-[42%] shrink-0 flex-col justify-center overflow-hidden border border-white/10 bg-white/[0.02] p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt1
                        </span>
                      </div>
                      <div className="flex h-full w-[38%] shrink-0 flex-col justify-center overflow-hidden border border-white/10 bg-white/[0.02] p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt2
                        </span>
                      </div>
                      <div className="border-primary bg-primary/10 flex h-full w-[16%] shrink-0 flex-col justify-center overflow-hidden border p-1">
                        <span className="text-primary truncate text-[8px] font-bold">
                          skyline_broll
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-primary bg-primary/5 ring-primary/20 flex h-full w-[42%] shrink-0 flex-col justify-center overflow-hidden border p-1 ring-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt1
                        </span>
                      </div>
                      <div className="flex h-full w-[38%] shrink-0 flex-col justify-center overflow-hidden border border-white/10 bg-white/[0.02] p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          interview_A_pt2
                        </span>
                      </div>
                      <div className="flex h-full w-[16%] shrink-0 flex-col justify-center overflow-hidden border border-white/10 bg-white/[0.02] p-1">
                        <span className="truncate text-[8px] font-bold text-white/80">
                          skyline_broll
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* A1 Track */}
              <div className="relative flex h-8 items-center">
                <div className="border-border flex h-full w-8 shrink-0 items-center justify-center border bg-[#0c0c0c] font-mono text-[8px] font-bold text-white/40">
                  A1
                </div>
                <div className="relative ml-2 flex h-full flex-1 items-center">
                  <div className="flex h-full w-full items-center gap-[1px] overflow-hidden border border-dashed border-white/5 bg-black/20 px-2">
                    {Array.from({ length: 60 }).map((_, i) => {
                      const isFlat =
                        step.id === 'silence' && i >= 20 && i <= 30;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'w-[2px] shrink-0 transition-all duration-300',
                            isFlat ? 'bg-red-500/20' : 'bg-white/10',
                          )}
                          style={{
                            height: isFlat
                              ? '1px'
                              : `${Math.round(Math.abs(Math.sin(i * 0.2)) * 11 + 3)}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Agent Chat panel) */}
        <div className="border-border flex w-[28%] min-w-0 flex-col border-l bg-[#090909]">
          <div className="border-border flex h-9 items-center justify-between border-b bg-[#0a0a0a] px-3">
            <div className="flex items-center gap-1.5">
              <ChatIcon size={12} className="text-primary" />
              <span className="font-mono text-[9px] font-bold tracking-wide text-white/80 uppercase">
                AGENT PANEL
              </span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>

          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden bg-[#080808]/50 p-2 font-mono">
            <div className="ml-auto flex max-w-[95%] flex-col items-end gap-0.5">
              <span className="text-[7px] font-black tracking-widest text-white/30 uppercase">
                USER
              </span>
              <div className="bg-primary/10 border-primary/20 border px-2 py-1 text-right text-[9px] leading-tight text-white">
                {step.agentPrompt}
              </div>
            </div>

            <div className="mr-auto flex max-w-[95%] flex-col items-start gap-0.5">
              <span className="text-primary text-[7px] font-black tracking-widest uppercase">
                AGENT
              </span>
              <div className="border border-white/10 bg-white/5 px-2 py-1 text-left text-[9px] leading-relaxed text-white/80">
                {step.agentResponse}
              </div>
            </div>
          </div>

          <div className="border-border flex shrink-0 gap-1.5 border-t bg-[#0a0a0a] p-1.5">
            <div className="border-border flex flex-1 items-center truncate border bg-black/60 px-2 py-1 font-mono text-[9px] text-white/30">
              <span className="text-primary mr-1">&gt;</span>
              Ask the agent...
            </div>
          </div>
        </div>
      </div>

      {/* Progress Toast Overlay representing background tasks */}
      {step.taskToast && (
        <div className="absolute bottom-3 left-3 z-30 flex w-[220px] flex-col gap-1.5 rounded border border-white/10 bg-[#121215] p-2.5 font-mono text-white shadow-2xl">
          <div className="flex items-center justify-between text-[8px] font-bold tracking-wider text-white/50 uppercase">
            <span>{step.taskToast.type}</span>
            <span
              className={cn(
                'text-[8px] font-bold',
                step.taskToast.status === 'completed'
                  ? 'text-green-400'
                  : 'text-blue-400',
              )}
            >
              {step.taskToast.status === 'completed'
                ? 'Done'
                : `${step.taskToast.progress}%`}
            </span>
          </div>
          <p className="truncate text-[9px] leading-relaxed text-white/80">
            {step.taskToast.message}
          </p>
          <div className="h-1 w-full overflow-hidden bg-white/10">
            <div
              className={cn(
                'h-full transition-all duration-500',
                step.taskToast.status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-blue-500',
              )}
              style={{ width: `${step.taskToast.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
