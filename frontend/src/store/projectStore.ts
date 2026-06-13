import { create } from 'zustand'
import { projectApi } from '@/api/project'
import { assetApi } from '@/api/asset'
import type { Project, ResolutionValue, FPSValue } from '@/types/project'
import type { Asset, Clip } from '@/api/bindings'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  assets: Asset[]
  isLoading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  setActiveProject: (project: Project | null) => void
  fetchAssets: (projectId: string) => Promise<void>
  createProject: (
    name: string,
    resolution: ResolutionValue,
    fps: FPSValue,
  ) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  saveTimeline: (id: string, timelineState: any) => Promise<void>
  setPlayheadOnly: (position: number) => void
  addAsset: (asset: Asset) => void
  removeAsset: (assetId: string) => void
  updateClipProperties: (
    trackId: string,
    clipId: string,
    properties: Partial<Clip>,
    persist?: boolean,
  ) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  assets: [],
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

  fetchAssets: async (projectId) => {
    try {
      const assets = await assetApi.getAll(projectId)
      set({ assets })
    } catch (err) {
      console.error('Failed to fetch assets:', err)
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

  saveTimeline: async (id, timelineState) => {
    await projectApi.saveTimeline(id, timelineState)
    // Update active project locally to avoid flickering or slow updates
    const active = get().activeProject
    if (active && active.id === id) {
      set({ activeProject: { ...active, timeline_state: timelineState } })
    }
  },

  setPlayheadOnly: (position) => {
    const active = get().activeProject
    if (active) {
      set({
        activeProject: {
          ...active,
          timeline_state: {
            ...active.timeline_state,
            playhead_position: position,
          },
        },
      })
    }
  },

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  removeAsset: (assetId) =>
    set((state) => ({ assets: state.assets.filter((a) => a.id !== assetId) })),
  updateAsset: (asset: any) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === asset.id ? asset : a)),
    })),

  updateClipProperties: async (
    trackId: string,
    clipId: string,
    properties: Partial<Clip>,
    persist: boolean = true,
  ) => {
    const project = get().activeProject
    if (!project) return

    const timeline = project.timeline_state

    // Find the target clip's info for syncing
    let targetAssetId: string | null = null
    let targetOriginalTimelineIn: number | null = null

    const sourceTrack = timeline.tracks.find((t: any) => t.id === trackId)
    if (sourceTrack) {
      const sourceClip = sourceTrack.clips.find((c: Clip) => c.id === clipId)
      if (sourceClip) {
        targetAssetId = sourceClip.asset_id
        targetOriginalTimelineIn = sourceClip.timeline_in
      }
    }

    const updatedTracks = timeline.tracks.map((track: any) => {
      // Logic: Update if it's the target clip OR if it's a "linked" clip
      // Linked = same asset_id and same original timeline_in
      return {
        ...track,
        clips: track.clips.map((clip: Clip) => {
          const isTargetClip = track.id === trackId && clip.id === clipId
          const isLinkedClip =
            targetAssetId &&
            clip.asset_id === targetAssetId &&
            clip.timeline_in === targetOriginalTimelineIn

          if (!isTargetClip && !isLinkedClip) return clip

          const updatedClip = { ...clip, ...properties }

          if (
            properties.timeline_in !== undefined &&
            properties.timeline_out === undefined
          ) {
            const duration = clip.timeline_out - clip.timeline_in
            updatedClip.timeline_out = updatedClip.timeline_in + duration
          }

          const timelineDuration =
            updatedClip.timeline_out - updatedClip.timeline_in
          updatedClip.source_out = updatedClip.source_in + timelineDuration

          return updatedClip
        }),
      }
    })

    const updatedTimeline = { ...timeline, tracks: updatedTracks }

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    })

    if (persist === true) {
      await get().saveTimeline(project.id, updatedTimeline)
    }
  },
}))
