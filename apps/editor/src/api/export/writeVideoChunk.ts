import { invoke } from '@tauri-apps/api/core';

export const writeVideoChunk = (chunk: Uint8Array): Promise<void> =>
  invoke('write_video_chunk', chunk);
