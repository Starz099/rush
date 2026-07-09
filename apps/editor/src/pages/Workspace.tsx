import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { projectApi } from '@/api/project';
import { LeftPanel } from '@/components/left-panel';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { TimelinePanel } from '@/components/timeline/TimelinePanel';
import { CaretLeftIcon } from '@phosphor-icons/react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExportEngine } from '@rush/engine';
import { save } from '@tauri-apps/plugin-dialog';
import { ExportModal } from '@/components/export/ExportModal';
import type { ExportPhase } from '@/types/export';
import { RightPanel } from '@/components/right-panel';
import { listen } from '@tauri-apps/api/event';
import { cn } from '@/lib/utils';
import { fpsToNumeric } from '@/helpers/fps';

interface ActiveTask {
  id: string;
  taskType: string;
  assetId: string | null;
  progress: number;
  message: string;
  status: string;
}

const Workspace = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const activeProject = useProjectStore((state) => state.activeProject);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const fetchAssets = useProjectStore((state) => state.fetchAssets);
  const deleteClip = useProjectStore((state) => state.deleteClip);
  const assets = useProjectStore((state) => state.assets);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle');
  const [exportError, setExportError] = useState<string | undefined>();
  const exportEngineRef = useRef<ExportEngine | null>(null);

  // Background asset preprocessor and model download tasks state
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selClipId = useWorkspaceStore.getState().selectedClipId;
        const selTrackId = useWorkspaceStore.getState().selectedTrackId;
        if (selClipId && selTrackId) {
          deleteClip(selTrackId, selClipId);
          useWorkspaceStore.getState().clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteClip]);

  useEffect(() => {
    if (!activeProject || !assets) return;

    const unlistenPromise = listen<{
      requestId: string;
      startFrame: number;
      endFrame: number;
      stepFrames: number;
    }>('inspect_timeline_request', async (event) => {
      const { requestId, startFrame, endFrame, stepFrames } = event.payload;
      console.log(
        `[Workspace] Received agent inspect timeline request:`,
        event.payload,
      );

      try {
        const framerate = fpsToNumeric(activeProject.framerate);
        const spanFrames = endFrame - startFrame;
        const spanSeconds = spanFrames / framerate;

        // Dynamic step adjustment:
        // Target around 24 scan candidates across the span for wide queries to keep execution
        // speed under 500ms, while retaining dense strides for narrow queries.
        let candidateIntervalSeconds = stepFrames / framerate;
        if (spanSeconds > 5.0) {
          candidateIntervalSeconds = Math.max(0.5, spanSeconds / 24.0);
        }

        const exporter = new ExportEngine(
          activeProject.viewport_width,
          activeProject.viewport_height,
        );
        await exporter.initialize();

        const result = await exporter.generateStoryboard(
          activeProject,
          assets,
          {
            startFrame,
            endFrame,
            candidateIntervalSeconds,
            tileWidth: 320,
            tileHeight: 180,
            columns: 6,
            maxTiles: 36,
          },
        );

        // Convert the raw storyboard pixels to a base64 JPEG image using a canvas
        const canvas = document.createElement('canvas');
        canvas.width = result.width;
        canvas.height = result.height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
          throw new Error('Failed to get 2D context for base64 conversion');

        const imgData = ctx.createImageData(result.width, result.height);
        imgData.data.set(result.pixels);
        ctx.putImageData(imgData, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];

        // Submit back to agent
        const { commands } = await import('@/api/bindings');
        await commands.submitTimelineSnapshots(requestId, base64);
        console.log(
          `[Workspace] Successfully submitted timeline snapshots for request ${requestId}`,
        );
      } catch (err) {
        console.error(
          '[Workspace] Failed to process agent inspect request:',
          err,
        );
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [activeProject, assets]);

  const handleExport = async () => {
    if (!activeProject) return;

    const outputPath = await save({
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4'],
        },
      ],
      defaultPath: 'output.mp4',
    });
    if (!outputPath) return;

    setIsRendering(true);
    setRenderProgress(0);
    setExportPhase('preparing');
    setExportError(undefined);

    const exportEngine = new ExportEngine(
      activeProject.viewport_width,
      activeProject.viewport_height,
    );
    exportEngineRef.current = exportEngine;

    try {
      await exportEngine.initialize();
      const { useAppStore } = await import('@/store/timelineStore');
      const extractedAudios = useAppStore.getState().extractedAudios;

      await exportEngine.exportTimeline(
        activeProject,
        assets,
        outputPath,
        extractedAudios,
        (progress) => {
          setRenderProgress(progress * 100);
        },
        (phase) => {
          setExportPhase(phase);
        },
      );
    } catch (error: any) {
      if (error.message === 'cancelled') {
        console.log('[Workspace] Export cancelled.');
      } else {
        console.error('Export failed:', error);
        setExportPhase('failed');
        setExportError(error.toString());
      }
    } finally {
      exportEngine.dispose();
      exportEngineRef.current = null;
      if (exportPhase !== 'failed' && exportPhase !== 'completed') {
        setIsRendering(false);
        setExportPhase('idle');
      }
    }
  };

  const handleCancelExport = () => {
    if (exportEngineRef.current) {
      exportEngineRef.current.dispose();
    }
    setIsRendering(false);
    setExportPhase('idle');
  };

  useEffect(() => {
    if (!projectId) {
      navigate('/');
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);

      try {
        const loadedProject = await projectApi.getById(projectId);

        if (!isMounted) return;

        setActiveProject(loadedProject);

        // Sync playhead position to timelineStore
        const { useAppStore } = await import('@/store/timelineStore');
        useAppStore
          .getState()
          .setPlayhead(loadedProject.timeline_state.playhead_position);

        await fetchAssets(projectId);
      } catch (error) {
        if (!isMounted) return;

        console.error('Failed to load project data:', error);
        navigate('/');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [navigate, projectId, setActiveProject]);

  useEffect(() => {
    const unlistenPromise = listen<{
      assetId: string | null;
      taskType: string;
      progress: number;
      status: 'started' | 'progressing' | 'completed' | 'error';
      message: string;
    }>('asset_process_status', (event) => {
      const payload = event.payload;
      const taskId = `${payload.taskType}-${payload.assetId || 'global'}`;

      setActiveTasks((prev) => {
        if (payload.status === 'completed' || payload.status === 'error') {
          const exists = prev.some((t) => t.id === taskId);
          const next = exists
            ? prev.map((t) => {
                if (t.id === taskId) {
                  return {
                    ...t,
                    progress: 100,
                    status: payload.status,
                    message: payload.message,
                  };
                }
                return t;
              })
            : [
                ...prev,
                {
                  id: taskId,
                  taskType: payload.taskType,
                  assetId: payload.assetId,
                  progress: 100,
                  message: payload.message,
                  status: payload.status,
                },
              ];

          setTimeout(() => {
            setActiveTasks((current) => current.filter((t) => t.id !== taskId));
          }, 3000);

          return next;
        } else {
          const exists = prev.some((t) => t.id === taskId);
          if (exists) {
            return prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  progress: payload.progress,
                  message: payload.message,
                  status: payload.status,
                };
              }
              return t;
            });
          } else {
            return [
              ...prev,
              {
                id: taskId,
                taskType: payload.taskType,
                assetId: payload.assetId,
                progress: payload.progress,
                message: payload.message,
                status: payload.status,
              },
            ];
          }
        }
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

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

      {/* Main Content Area */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left Sidebar */}
        <ResizablePanel maxSize={15} className="border-r">
          <LeftPanel projectId={projectId!} />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center Content */}
        <ResizablePanel maxSize={60} className="flex flex-col bg-black/10">
          <ResizablePanelGroup orientation="vertical" className="flex-1">
            <ResizablePanel maxSize={60} className="border-b">
              <PreviewPanel />
            </ResizablePanel>

            <ResizablePanel maxSize={40} className="border-t">
              <TimelinePanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Sidebar */}
        <ResizablePanel maxSize={25} className="border-l">
          <RightPanel projectId={activeProject.id} />
        </ResizablePanel>
      </ResizablePanelGroup>
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
