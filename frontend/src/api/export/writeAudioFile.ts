import { invoke } from '@tauri-apps/api/core';

export const writeAudioFile = (fileBytes: Uint8Array): Promise<void> =>
  invoke('write_audio_file', fileBytes);
