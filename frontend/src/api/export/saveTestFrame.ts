import { invoke } from '@tauri-apps/api/core';

export const saveTestFrame = (
  frameData: Uint8Array,
  width: number,
  height: number,
  format: string,
): Promise<void> =>
  invoke('save_test_frame', frameData, {
    headers: {
      'x-width': width.toString(),
      'x-height': height.toString(),
      'x-format': format,
    },
  });
