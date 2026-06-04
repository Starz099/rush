import { create } from 'zustand'
import { projectApi } from '@/api/project'
import type { Project, ResolutionValue, FPSValue } from '@/types/project'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  setActiveProject: (project: Project | null) => void
  createProject: (
    name: string,
    resolution: ResolutionValue,
    fps: FPSValue,
  ) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,

  setActiveProject: (project) => set({ activeProject: project }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await projectApi.getAll()
      set({ projects, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  createProject: async (name, resolution, fps) => {
    await projectApi.create(name, resolution, fps)
    await get().fetchProjects()
  },

  deleteProject: async (id) => {
    await projectApi.delete(id)
    await get().fetchProjects()
  },

  renameProject: async (id, name) => {
    await projectApi.updateName(id, name)
    await get().fetchProjects()
  },
}))
