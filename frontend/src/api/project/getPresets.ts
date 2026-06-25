import { commands } from '../bindings';
import type { PresetsConfig } from '../bindings';

export const getPresets = (): Promise<PresetsConfig> => commands.getPresets();
