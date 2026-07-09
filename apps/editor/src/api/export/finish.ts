import { invoke } from '@tauri-apps/api/core';

export const finishExport = (): Promise<void> => invoke('finish_export');
