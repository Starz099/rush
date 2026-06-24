import { commands } from '../bindings';
import type { EditingRegistry } from '../bindings';

export const getEditingRegistry = (): Promise<EditingRegistry> =>
  commands.getEditingRegistry();
