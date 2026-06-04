import { commands } from './bindings'
import type { Project } from '@/types/project'

/**
 * Helper to unwrap specta responses.
 * If status is "error", it throws the error string so the UI can catch it.
 */
const unwrap = async <T>(
  promise: Promise<{ status: 'ok'; data: T } | { status: 'error'; error: string }>,
): Promise<T> => {
  const result = await promise
  if (result.status === 'ok') return result.data
  throw new Error(result.error)
}

export const projectApi = {
  create: (name: string, width: number, height: number, fps: number): Promise<Project> =>
    unwrap(commands.createProject(name, width, height, fps)),

  getAll: (): Promise<Project[]> => unwrap(commands.getProjects()),

  delete: async (id: string): Promise<void> => {
    await unwrap(commands.deleteProject(id))
  },

  updateName: async (id: string, name: string): Promise<void> => {
    await unwrap(commands.updateProjectName(id, name))
  },
}
