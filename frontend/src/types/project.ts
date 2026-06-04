import { RESOLUTIONS, FPS_OPTIONS } from '@/constants/project'

export type ResolutionValue = (typeof RESOLUTIONS)[number]['value']
export type ProjectWidth = (typeof RESOLUTIONS)[number]['width']
export type ProjectHeight = (typeof RESOLUTIONS)[number]['height']
export type FPSValue = `${(typeof FPS_OPTIONS)[number]}`

export interface Project {
  id: string
  name: string
  viewport_width: number
  viewport_height: number
  framerate: number
  created_at: string
  updated_at: string
}
