import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const saveProjectTimeline = async (
  id: string,
  timelineState: any,
): Promise<any> => {
  return await unwrap(commands.saveProjectTimeline(id, timelineState));
};
