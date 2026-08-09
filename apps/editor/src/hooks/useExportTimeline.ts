import { useState, useRef } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { ExportEngine } from '@rush/engine';
import { save } from '@tauri-apps/plugin-dialog';
import type { ExportPhase } from '@/types/export';

export const useExportTimeline = () => {
  const activeProject = useProjectStore((state) => state.activeProject);
  const assets = useProjectStore((state) => state.assets);

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle');
  const [exportError, setExportError] = useState<string | undefined>();
  const exportEngineRef = useRef<ExportEngine | null>(null);

  const handleExport = async () => {
    if (!activeProject || !assets) return;

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

  return {
    isRendering,
    renderProgress,
    exportPhase,
    exportError,
    handleExport,
    handleCancelExport,
    setIsRendering,
    setExportPhase,
  };
};
