import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const deleteProject = async (id: string): Promise<void> => {
  await unwrap(commands.deleteProject(id));
};
