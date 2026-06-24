import type { StateCreator } from 'zustand';
import { projectApi } from '@/api/project';
import type { Project, ResolutionValue, FPSValue } from '@/types/project';

export interface ProjectSlice {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  createProject: (
    name: string,
    resolution: ResolutionValue,
    fps: FPSValue,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  saveTimeline: (id: string, timelineState: any) => Promise<void>;
  setPlayheadOnly: (position: number) => void;
}

export const createProjectSlice: StateCreator<
  ProjectSlice,
  [],
  [],
  ProjectSlice
> = (set, get) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,

  setActiveProject: (project) => set({ activeProject: project }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectApi.getAll();
      set({ projects, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createProject: async (name, resolution, fps) => {
    await projectApi.create(name, resolution, fps);
    await get().fetchProjects();
  },

  deleteProject: async (id) => {
    await projectApi.delete(id);
    await get().fetchProjects();
  },

  renameProject: async (id, name) => {
    await projectApi.updateName(id, name);
    await get().fetchProjects();
  },

  saveTimeline: async (id, timelineState) => {
    await projectApi.saveTimeline(id, timelineState);
    const active = get().activeProject;
    if (active && active.id === id) {
      set({ activeProject: { ...active, timeline_state: timelineState } });
    }
  },

  setPlayheadOnly: (position) => {
    const active = get().activeProject;
    if (active) {
      set({
        activeProject: {
          ...active,
          timeline_state: {
            ...active.timeline_state,
            playhead_position: position,
          },
        },
      });
    }
  },
});
