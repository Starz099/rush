import { commands } from '../bindings';
import type { Project } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const getProjects = (): Promise<Project[]> =>
  unwrap(commands.getProjects());
