import { commands } from '../bindings';
import type { Project, ResolutionPreset, FpsPreset } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const createProject = (
  name: string,
  resolution: ResolutionPreset,
  fps: FpsPreset,
): Promise<Project> => unwrap(commands.createProject(name, resolution, fps));
