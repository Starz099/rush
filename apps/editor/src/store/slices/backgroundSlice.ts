import type { StateCreator } from 'zustand';
import type { BackgroundConfig } from '@/api/bindings';
import type { ProjectSlice } from './projectSlice';

export interface BackgroundSlice {
  updateBackground: (
    background: BackgroundConfig,
    persist?: boolean,
  ) => Promise<void>;
}

type CombinedState = ProjectSlice & BackgroundSlice;

export const createBackgroundSlice: StateCreator<
  CombinedState,
  [],
  [],
  BackgroundSlice
> = (set, get) => ({
  updateBackground: async (background, persist = true) => {
    const project = get().activeProject;
    if (!project) return;

    const updatedTimeline = {
      ...project.timeline_state,
      background,
    };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    if (persist) {
      await get().saveTimeline(project.id, updatedTimeline);
    }
  },
});
