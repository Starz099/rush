import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const updateProjectName = async (
  id: string,
  name: string,
): Promise<void> => {
  await unwrap(commands.updateProjectName(id, name));
};
