import { invoke } from '@tauri-apps/api/core';

export const writeAudioChunk = (chunk: Uint8Array): Promise<void> =>
  invoke('write_audio_chunk', chunk);
