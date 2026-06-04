import { commands } from './bindings'
import type { Project, ResolutionValue, FPSValue } from '@/types/project'

/**
 * Helper to unwrap specta responses.
 */
const unwrap = async <T>(
  promise: Promise<
    { status: 'ok'; data: T } | { status: 'error'; error: string }
  >,
): Promise<T> => {
  const result = await promise
  if (result.status === 'ok') return result.data
  throw new Error(result.error)
}

export const projectApi = {
  create: (
    name: string,
    resolution: ResolutionValue,
    fps: FPSValue,
  ): Promise<Project> => unwrap(commands.createProject(name, resolution, fps)),

  getAll: (): Promise<Project[]> => unwrap(commands.getProjects()),

  delete: async (id: string): Promise<void> => {
    await unwrap(commands.deleteProject(id))
  },

  updateName: async (id: string, name: string): Promise<void> => {
    await unwrap(commands.updateProjectName(id, name))
  },
}
