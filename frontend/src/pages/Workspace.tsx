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
import { ExportEngine } from '@/engine/export/ExportEngine';
import { save } from '@tauri-apps/plugin-dialog';
import { ExportModal } from '@/components/export/ExportModal';
import type { ExportPhase } from '@/types/export';
import { RightPanel } from '@/components/right-panel';

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
      await exportEngine.exportTimeline(
        activeProject,
        assets,
        outputPath,
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
    </div>
  );
};

export default Workspace;
