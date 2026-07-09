import { invoke } from '@tauri-apps/api/core';

export const startExport = (
  width: number,
  height: number,
  fps: number,
  outputPath: string,
  speedBlocks: any[],
): Promise<void> =>
  invoke('start_export', {
    width,
    height,
    fps,
    outputPath,
    speedBlocks,
  });
