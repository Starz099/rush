import { RESOLUTIONS, FPS_OPTIONS } from '@/constants/project'
import type { Project as ProjectBinding } from '@/api/bindings'

export type ResolutionValue = (typeof RESOLUTIONS)[number]['value']
export type ProjectWidth = (typeof RESOLUTIONS)[number]['width']
export type ProjectHeight = (typeof RESOLUTIONS)[number]['height']
export type FPSValue = `${(typeof FPS_OPTIONS)[number]}`

export type Project = ProjectBinding
