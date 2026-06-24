import { commands } from '../bindings';
import type { Project } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const getProject = (id: string): Promise<Project> =>
  unwrap(commands.getProject(id));
