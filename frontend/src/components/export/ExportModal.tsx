import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CircleNotchIcon,
  CheckCircleIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { ExportPhase } from '@/types/export';
import { Button } from '@/components/ui/button';

interface ExportModalProps {
  isOpen: boolean;
  phase: ExportPhase;
  progress: number; // 0 to 100
  errorMessage?: string;
  onCancel: () => void;
  onClose: () => void;
}

const PHASES = [
  { id: 'preparing', label: 'Preparing render canvas & timeline assets' },
  { id: 'video', label: 'Rendering and encoding video frames' },
  { id: 'audio', label: 'Processing and speed-warping audio' },
  { id: 'muxing', label: 'Muxing media streams into final MP4' },
] as const;

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  phase,
  progress,
  errorMessage,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === phase);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
        {/* Main Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="border-border bg-popover ring-foreground/10 relative w-full max-w-sm overflow-hidden rounded-none border p-5 text-xs shadow-xl ring-1"
        >
          {/* Shimmer/Shining Overlay Effect */}
          {['preparing', 'video', 'audio', 'muxing'].includes(phase) && (
            <div className="via-foreground/5 pointer-events-none absolute -inset-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent to-transparent" />
          )}

          {/* Header */}
          <div className="border-border mb-4 flex items-center justify-between border-b pb-2.5">
            <h3 className="font-heading text-popover-foreground font-medium tracking-tight">
              Export Progress
            </h3>
            {(phase === 'completed' || phase === 'failed') && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon size={14} />
              </Button>
            )}
          </div>

          {/* Content / States */}
          {phase === 'failed' ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="bg-destructive/10 text-destructive mb-3 animate-pulse rounded-none p-3.5">
                <WarningIcon size={32} weight="fill" />
              </div>
              <p className="text-foreground font-semibold">
                Export Process Failed
              </p>
              <p className="text-muted-foreground mt-1.5 max-w-xs text-xs/relaxed break-all">
                {errorMessage ||
                  'An unexpected error occurred during rendering.'}
              </p>
            </div>
          ) : phase === 'completed' ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="mb-3 rounded-none bg-emerald-500/10 p-3.5 text-emerald-500">
                <CheckCircleIcon
                  size={32}
                  weight="fill"
                  className="animate-pulse"
                />
              </div>
              <p className="text-foreground font-semibold">
                Export Finished Successfully
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Your video has been rendered and saved.
              </p>
            </div>
          ) : (
            <div>
              {/* Vertical Progress Phases list */}
              <div className="mb-5 space-y-3.5">
                {PHASES.map((p, idx) => {
                  const isCompleted = idx < currentPhaseIndex;
                  const isActive = idx === currentPhaseIndex;
                  const isPending = idx > currentPhaseIndex;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-start gap-3 transition-opacity duration-200 ${
                        isPending ? 'opacity-30' : 'opacity-100'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className="mt-0.5 flex items-center justify-center">
                        {isCompleted ? (
                          <CheckCircleIcon
                            size={16}
                            className="text-emerald-500"
                            weight="fill"
                          />
                        ) : isActive ? (
                          <CircleNotchIcon
                            size={16}
                            className="text-primary animate-spin"
                          />
                        ) : (
                          <div className="border-border bg-muted/30 h-3.5 w-3.5 rounded-none border" />
                        )}
                      </div>

                      {/* Label */}
                      <div className="flex-1">
                        <p
                          className={`text-xs/normal transition-colors duration-200 ${
                            isActive
                              ? 'text-foreground font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {p.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase">
                  <span>Overall Completion</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="bg-muted h-1 w-full overflow-hidden rounded-none">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="border-border mt-5 flex justify-end gap-2 border-t pt-3.5">
            {['preparing', 'video', 'audio', 'muxing'].includes(phase) && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="h-9 w-full cursor-pointer py-2 text-xs font-semibold"
              >
                Cancel Export
              </Button>
            )}
            {(phase === 'completed' || phase === 'failed') && (
              <Button
                variant="default"
                onClick={onClose}
                className="h-9 w-full cursor-pointer py-2 text-xs font-semibold"
              >
                Close
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
