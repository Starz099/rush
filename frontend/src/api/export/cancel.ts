import { invoke } from '@tauri-apps/api/core';

export const cancelExport = (): Promise<void> => invoke('cancel_export');
