import { invoke } from '@tauri-apps/api/core'
import type { Project } from '@/types/project'

export const projectApi = {
  create: (
    name: string,
    width: number,
    height: number,
    fps: number,
  ): Promise<Project> =>
    invoke('create_project', {
      name,
      width,
      height,
      fps,
    }),

  getAll: (): Promise<Project[]> => invoke('get_projects'),

  delete: (id: string): Promise<void> => invoke('delete_project', { id }),

  updateName: (id: string, name: string): Promise<void> =>
    invoke('update_project_name', { id, name }),
}
