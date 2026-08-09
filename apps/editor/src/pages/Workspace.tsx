import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { LeftPanel } from '@/components/left-panel';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { TimelinePanel } from '@/components/timeline/TimelinePanel';
import { CaretLeftIcon, SidebarIcon } from '@phosphor-icons/react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExportModal } from '@/components/export/ExportModal';
import { RightPanel } from '@/components/right-panel';
import { cn } from '@/lib/utils';
import { useLoadProject } from '@/hooks/useLoadProject';
import { useExportTimeline } from '@/hooks/useExportTimeline';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { useAgentInspectTimeline } from '@/hooks/useAgentInspectTimeline';
import { useWorkspaceHotkeys } from '@/hooks/useWorkspaceHotkeys';

const Workspace = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const activeProject = useProjectStore((state) => state.activeProject);

  // Custom workspace logic encapsulated in hooks
  const { isLoading } = useLoadProject(projectId);
  const {
    isRendering,
    renderProgress,
    exportPhase,
    exportError,
    handleExport,
    handleCancelExport,
    setIsRendering,
    setExportPhase,
  } = useExportTimeline();
  const { activeTasks } = useBackgroundTasks();
  useAgentInspectTimeline();
  useWorkspaceHotkeys();

  // Custom workspace sizing and collapse states (matching rush-v2)
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(250);
  const isResizingRef = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= 140 && newHeight <= 500) {
      setTimelineHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  if (isLoading || !activeProject) {
    return (
      <div className="bg-background text-foreground flex h-screen items-center justify-center">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate('/')}
            title="Back to Home"
          >
            <CaretLeftIcon weight="bold" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">{activeProject.name}</h1>
          <Badge variant="outline" className="h-5 py-0 text-[10px]">
            {activeProject.viewport_width}x{activeProject.viewport_height} @{' '}
            {activeProject.framerate}fps
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isRendering}
            onClick={handleExport}
          >
            {isRendering
              ? `Exporting (${Math.round(renderProgress)}%)`
              : 'Export'}
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout (Custom resizing & sidebars matching rush-v2) */}
      <div className="flex flex-1 overflow-hidden bg-black">
        {/* Left Sidebar */}
        {leftCollapsed ? (
          <div className="flex w-10 shrink-0 flex-col items-center justify-start border-r border-white/5 bg-[#111] pt-2">
            <button
              onClick={() => setLeftCollapsed(false)}
              className="cursor-pointer rounded border border-transparent p-2 text-white/40 transition-all hover:border-white/10 hover:bg-white/5 hover:text-white"
              title="Expand Left Panel"
            >
              <SidebarIcon size={15} weight="bold" />
            </button>
            <div className="mt-6 flex flex-col items-center gap-6 font-mono text-[9px] font-bold tracking-widest text-white/30 uppercase select-none [writing-mode:vertical-lr]">
              LEFT PANEL
            </div>
          </div>
        ) : (
          <div className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#111]">
            <LeftPanel
              projectId={projectId!}
              onCollapse={() => setLeftCollapsed(true)}
            />
          </div>
        )}

        {/* Center: Preview Port & Timeline */}
        <div className="flex flex-1 flex-col overflow-hidden bg-black/10">
          {/* Preview Panel */}
          <div className="relative min-h-0 flex-1">
            <PreviewPanel />
          </div>

          {/* Resizer Handle */}
          <div
            onMouseDown={startResize}
            className="hover:bg-primary relative z-40 h-1 w-full shrink-0 cursor-ns-resize bg-white/5 transition-colors"
            title="Drag to resize timeline height"
          ></div>

          {/* Timeline Panel */}
          <div
            style={{ height: `${timelineHeight}px` }}
            className="relative flex-none shrink-0"
          >
            <TimelinePanel />
          </div>
        </div>

        {/* Right Sidebar */}
        {rightCollapsed ? (
          <div className="flex w-10 shrink-0 flex-col items-center justify-start border-l border-white/5 bg-[#111] pt-2">
            <button
              onClick={() => setRightCollapsed(false)}
              className="cursor-pointer rounded border border-transparent p-2 text-white/40 transition-all hover:border-white/10 hover:bg-white/5 hover:text-white"
              title="Expand Right Panel"
            >
              <SidebarIcon size={15} weight="bold" />
            </button>
            <div className="mt-6 flex flex-col items-center gap-6 font-mono text-[9px] font-bold tracking-widest text-white/30 uppercase select-none [writing-mode:vertical-lr]">
              RIGHT PANEL
            </div>
          </div>
        ) : (
          <div className="flex w-96 shrink-0 flex-col border-l border-white/5 bg-[#111]">
            <RightPanel
              projectId={activeProject.id}
              onCollapse={() => setRightCollapsed(true)}
            />
          </div>
        )}
      </div>
      <ExportModal
        isOpen={isRendering}
        phase={exportPhase}
        progress={renderProgress}
        errorMessage={exportError}
        onCancel={handleCancelExport}
        onClose={() => {
          setIsRendering(false);
          setExportPhase('idle');
        }}
      />

      {/* Background Processing Progress Toast Overlay */}
      {activeTasks.length > 0 && (
        <div className="fixed bottom-4 left-4 z-[100] flex w-80 flex-col gap-2.5">
          {activeTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isError = task.status === 'error';
            return (
              <div
                key={task.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded border bg-[#1e1e24] p-3 text-white shadow-lg transition-all duration-300',
                  isCompleted
                    ? 'border-green-500/30 bg-green-950/15'
                    : isError
                      ? 'border-red-500/30 bg-red-950/15'
                      : 'border-white/10',
                )}
              >
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-white/50 uppercase">
                  <span>
                    {task.taskType
                      .replace('download_whisper', 'Whisper Model Download')
                      .replace('download_clip_vision', 'CLIP Vision Download')
                      .replace('download_clip_text', 'CLIP Text Download')
                      .replace('transcribe_audio', 'Transcribing Speech')
                      .replace('visual_indexing', 'Visual Indexing')}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold',
                      isCompleted
                        ? 'text-green-400'
                        : isError
                          ? 'text-red-400'
                          : 'text-blue-400',
                    )}
                  >
                    {isCompleted
                      ? 'Done'
                      : isError
                        ? 'Error'
                        : `${Math.round(task.progress)}%`}
                  </span>
                </div>
                <p className="truncate text-[11px] leading-relaxed text-white/95">
                  {task.message}
                </p>
                {!isCompleted && !isError && (
                  <div className="h-1 w-full overflow-hidden rounded bg-white/10">
                    <div
                      className="h-full rounded bg-blue-500 transition-all duration-150"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Workspace;
