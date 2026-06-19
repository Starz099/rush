import { create } from 'zustand'
import { projectApi } from '@/api/project'
import { assetApi } from '@/api/asset'
import type { Project, ResolutionValue, FPSValue } from '@/types/project'
import type { Asset, BackgroundConfig, Clip } from '@/api/bindings'

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
  renameAsset: (assetId: string, newName: string) => Promise<void>
  updateClipProperties: (
    trackId: string,
    clipId: string,
    properties: Partial<Clip>,
    persist?: boolean,
  ) => Promise<void>
  splitClip: (
    trackId: string,
    clipId: string,
    splitPlayheadFrame: number,
  ) => Promise<void>
  trimClip: (
    trackId: string,
    clipId: string,
    edge: 'left' | 'right',
    newFrameValue: number,
  ) => Promise<void>
  updateBackground: (
    background: BackgroundConfig,
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

  renameAsset: async (assetId: string, newName: string) => {
    await assetApi.rename(assetId, newName)
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId ? { ...a, name: newName } : a,
      ),
    }))
  },

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
          updatedClip.source_out =
            updatedClip.source_in +
            Math.round(timelineDuration * (clip.speed_factor ?? 1.0))

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

  splitClip: async (
    trackId: string,
    clipId: string,
    splitPlayheadFrame: number,
  ) => {
    const project = get().activeProject
    if (!project) return

    const timeline = project.timeline_state
    const track = timeline.tracks.find((t: any) => t.id === trackId)
    if (!track) {
      console.error('Track not found for splitting')
      return
    }

    const clip = track.clips.find((c: Clip) => c.id === clipId)
    if (!clip) {
      console.error('Clip not found for splitting')
      return
    }

    if (
      splitPlayheadFrame <= clip.timeline_in ||
      splitPlayheadFrame >= clip.timeline_out
    ) {
      console.error('Split position is outside the clip bounds')
      return
    }

    const speed = clip.speed_factor ?? 1.0
    const offsetTimeline = splitPlayheadFrame - clip.timeline_in
    const offsetSource = Math.round(offsetTimeline * speed)

    // Clip A: Left segment
    const clipA: Clip = {
      ...clip,
      timeline_out: splitPlayheadFrame,
      source_out: clip.source_in + offsetSource,
    }

    // Clip B: Right segment
    const clipB: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      timeline_in: splitPlayheadFrame,
      source_in: clip.source_in + offsetSource,
    }

    // Replace original clip with A & B, then sort chronologically
    const updatedClips = track.clips
      .reduce((acc: Clip[], c: Clip) => {
        if (c.id === clipId) {
          acc.push(clipA, clipB)
        } else {
          acc.push(c)
        }
        return acc
      }, [])
      .sort((a: Clip, b: Clip) => a.timeline_in - b.timeline_in)

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id === trackId) {
        return { ...t, clips: updatedClips }
      }
      return t
    })

    const updatedTimeline = { ...timeline, tracks: updatedTracks }

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    })

    await get().saveTimeline(project.id, updatedTimeline)
  },

  trimClip: async (
    trackId: string,
    clipId: string,
    edge: 'left' | 'right',
    newFrameValue: number,
  ) => {
    const project = get().activeProject
    if (!project) return

    const timeline = project.timeline_state
    const track = timeline.tracks.find((t: any) => t.id === trackId)
    if (!track) return

    const clip = track.clips.find((c: Clip) => c.id === clipId)
    if (!clip) return

    const speed = clip.speed_factor ?? 1.0
    let updatedTimeline = timeline

    if (edge === 'left') {
      // Find preceding clip on this track to prevent overlap
      const prevClip = track.clips
        .filter(
          (c: Clip) => c.timeline_out <= clip.timeline_in && c.id !== clip.id,
        )
        .sort((a: Clip, b: Clip) => b.timeline_in - a.timeline_in)[0]
      const minTimelineIn = prevClip ? prevClip.timeline_out : 0

      let finalTimelineIn = Math.max(minTimelineIn, newFrameValue)

      // Clamp so we do not trim past start of source asset (source_in cannot go below 0)
      const maxDeltaSourceIn = clip.source_in
      const maxTimelineDeltaLeft = Math.round(maxDeltaSourceIn / speed)
      finalTimelineIn = Math.max(
        finalTimelineIn,
        clip.timeline_in - maxTimelineDeltaLeft,
      )

      // Clamp so duration is at least 1 frame
      finalTimelineIn = Math.min(finalTimelineIn, clip.timeline_out - 1)

      const delta = finalTimelineIn - clip.timeline_in
      const newSourceIn = clip.source_in + Math.round(delta * speed)

      const updatedClips = track.clips.map((c: Clip) => {
        if (c.id === clipId) {
          return {
            ...c,
            timeline_in: finalTimelineIn,
            source_in: newSourceIn,
          }
        }
        return c
      })

      updatedTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((t: any) =>
          t.id === trackId ? { ...t, clips: updatedClips } : t,
        ),
      }
    } else {
      // Trimming Right Edge
      // Find succeeding clip on this track to prevent overlap
      const nextClip = track.clips
        .filter(
          (c: Clip) => c.timeline_in >= clip.timeline_out && c.id !== clip.id,
        )
        .sort((a: Clip, b: Clip) => a.timeline_in - b.timeline_in)[0]
      const maxTimelineOut = nextClip ? nextClip.timeline_in : Infinity

      let finalTimelineOut = Math.min(maxTimelineOut, newFrameValue)

      // Clamp based on asset duration if known
      const asset = get().assets.find((a) => a.id === clip.asset_id)
      if (asset && asset.duration_ms) {
        const maxSourceFrames = Math.round(
          (asset.duration_ms / 1000) * project.framerate,
        )
        const maxDeltaSourceOut = maxSourceFrames - clip.source_out
        const maxTimelineDeltaRight = Math.round(maxDeltaSourceOut / speed)
        finalTimelineOut = Math.min(
          finalTimelineOut,
          clip.timeline_out + maxTimelineDeltaRight,
        )
      }

      // Clamp so duration is at least 1 frame
      finalTimelineOut = Math.max(finalTimelineOut, clip.timeline_in + 1)

      const delta = finalTimelineOut - clip.timeline_out
      const newSourceOut = clip.source_out + Math.round(delta * speed)

      const updatedClips = track.clips.map((c: Clip) => {
        if (c.id === clipId) {
          return {
            ...c,
            timeline_out: finalTimelineOut,
            source_out: newSourceOut,
          }
        }
        return c
      })

      updatedTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((t: any) =>
          t.id === trackId ? { ...t, clips: updatedClips } : t,
        ),
      }
    }

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    })

    await get().saveTimeline(project.id, updatedTimeline)
  },

  updateBackground: async (
    background: BackgroundConfig,
    persist: boolean = true,
  ) => {
    const project = get().activeProject
    if (!project) return

    const updatedTimeline = {
      ...project.timeline_state,
      background,
    }

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    })

    if (persist) {
      await get().saveTimeline(project.id, updatedTimeline)
    }
  },
}))
