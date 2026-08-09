import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '@/store/projectStore';
import { ExportEngine } from '@rush/engine';
import { fpsToNumeric } from '@/helpers/fps';

export const useAgentInspectTimeline = () => {
  const activeProject = useProjectStore((state) => state.activeProject);
  const assets = useProjectStore((state) => state.assets);

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
        `[useAgentInspectTimeline] Received agent inspect timeline request:`,
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
          `[useAgentInspectTimeline] Successfully submitted timeline snapshots for request ${requestId}`,
        );
      } catch (err) {
        console.error(
          '[useAgentInspectTimeline] Failed to process agent inspect request:',
          err,
        );
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [activeProject, assets]);
};
