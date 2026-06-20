import { commands } from './bindings';
import type { Project, ResolutionPreset, FpsPreset } from './bindings';
import { unwrap } from '@/helpers/specta';

export const projectApi = {
  create: (
    name: string,
    resolution: ResolutionPreset,
    fps: FpsPreset,
  ): Promise<Project> => unwrap(commands.createProject(name, resolution, fps)),

  getAll: (): Promise<Project[]> => unwrap(commands.getProjects()),

  getById: (id: string): Promise<Project> => unwrap(commands.getProject(id)),

  delete: async (id: string): Promise<void> => {
    await unwrap(commands.deleteProject(id));
  },

  updateName: async (id: string, name: string): Promise<void> => {
    await unwrap(commands.updateProjectName(id, name));
  },

  saveTimeline: async (id: string, timelineState: any): Promise<void> => {
    await unwrap(commands.saveProjectTimeline(id, timelineState));
  },

  export: async (id: string, outputPath: string): Promise<void> => {
    await unwrap(commands.exportProject(id, outputPath));
  },
};
