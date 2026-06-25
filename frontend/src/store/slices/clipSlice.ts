import type { StateCreator } from 'zustand';
import type { Clip } from '@/api/bindings';
import type { ProjectSlice } from './projectSlice';
import type { AssetSlice } from './assetSlice';
import {
  calculateClipPropertiesUpdate,
  calculateSplit,
  calculateTrimLeft,
  calculateTrimRight,
} from '@/helpers/clipManipulation';

export interface ClipSlice {
  updateClipProperties: (
    trackId: string,
    clipId: string,
    properties: Partial<Clip>,
    persist?: boolean,
  ) => Promise<void>;
  splitClip: (
    trackId: string,
    clipId: string,
    splitPlayheadFrame: number,
  ) => Promise<void>;
  trimClip: (
    trackId: string,
    clipId: string,
    edge: 'left' | 'right',
    newFrameValue: number,
  ) => Promise<void>;
  deleteClip: (trackId: string, clipId: string) => Promise<void>;
}

type CombinedState = ProjectSlice & AssetSlice & ClipSlice;

export const createClipSlice: StateCreator<CombinedState, [], [], ClipSlice> = (
  set,
  get,
) => ({
  updateClipProperties: async (trackId, clipId, properties, persist = true) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;

    // Find the target clip's info for syncing
    let targetAssetId: string | null = null;
    let targetOriginalTimelineIn: number | null = null;

    const sourceTrack = timeline.tracks.find((t: any) => t.id === trackId);
    if (sourceTrack) {
      const sourceClip = sourceTrack.clips.find((c: Clip) => c.id === clipId);
      if (sourceClip) {
        targetAssetId = sourceClip.asset_id;
        targetOriginalTimelineIn = sourceClip.timeline_in;
      }
    }

    const updatedTracks = timeline.tracks.map((track: any) => {
      // Logic: Update if it's the target clip OR if it's a "linked" clip
      // Linked = same asset_id and same original timeline_in
      return {
        ...track,
        clips: track.clips.map((clip: Clip) => {
          const isTargetClip = track.id === trackId && clip.id === clipId;
          const isLinkedClip =
            targetAssetId &&
            clip.asset_id === targetAssetId &&
            clip.timeline_in === targetOriginalTimelineIn;

          if (!isTargetClip && !isLinkedClip) return clip;

          return calculateClipPropertiesUpdate(clip, properties);
        }),
      };
    });

    const updatedTimeline = { ...timeline, tracks: updatedTracks };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    if (persist === true) {
      await get().saveTimeline(project.id, updatedTimeline);
    }
  },

  splitClip: async (trackId, clipId, splitPlayheadFrame) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const track = timeline.tracks.find((t: any) => t.id === trackId);
    if (!track) {
      console.error('Track not found for splitting');
      return;
    }

    const clip = track.clips.find((c: Clip) => c.id === clipId);
    if (!clip) {
      console.error('Clip not found for splitting');
      return;
    }

    if (
      splitPlayheadFrame <= clip.timeline_in ||
      splitPlayheadFrame >= clip.timeline_out
    ) {
      console.error('Split position is outside the clip bounds');
      return;
    }

    const speed = clip.speed_factor ?? 1.0;
    const { clipA, clipB } = calculateSplit(clip, splitPlayheadFrame, speed);

    // Replace original clip with A & B, then sort chronologically
    const updatedClips = track.clips
      .reduce((acc: Clip[], c: Clip) => {
        if (c.id === clipId) {
          acc.push(clipA, clipB);
        } else {
          acc.push(c);
        }
        return acc;
      }, [])
      .sort((a: Clip, b: Clip) => a.timeline_in - b.timeline_in);

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id === trackId) {
        return { ...t, clips: updatedClips };
      }
      return t;
    });

    const updatedTimeline = { ...timeline, tracks: updatedTracks };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    await get().saveTimeline(project.id, updatedTimeline);
  },

  trimClip: async (trackId, clipId, edge, newFrameValue) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const track = timeline.tracks.find((t: any) => t.id === trackId);
    if (!track) return;

    const clip = track.clips.find((c: Clip) => c.id === clipId);
    if (!clip) return;

    const speed = clip.speed_factor ?? 1.0;
    let updatedTimeline = timeline;

    if (edge === 'left') {
      // Find preceding clip on this track to prevent overlap
      const prevClip = track.clips
        .filter(
          (c: Clip) => c.timeline_out <= clip.timeline_in && c.id !== clip.id,
        )
        .sort((a: Clip, b: Clip) => b.timeline_in - a.timeline_in)[0];

      const { timeline_in, source_in } = calculateTrimLeft(
        clip,
        prevClip,
        newFrameValue,
        speed,
      );

      const updatedClips = track.clips.map((c: Clip) => {
        if (c.id === clipId) {
          return {
            ...c,
            timeline_in,
            source_in,
          };
        }
        return c;
      });

      updatedTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((t: any) =>
          t.id === trackId ? { ...t, clips: updatedClips } : t,
        ),
      };
    } else {
      // Trimming Right Edge
      // Find succeeding clip on this track to prevent overlap
      const nextClip = track.clips
        .filter(
          (c: Clip) => c.timeline_in >= clip.timeline_out && c.id !== clip.id,
        )
        .sort((a: Clip, b: Clip) => a.timeline_in - b.timeline_in)[0];

      const asset = get().assets.find((a) => a.id === clip.asset_id);
      const assetDurationMs = asset?.duration_ms;

      const { timeline_out, source_out } = calculateTrimRight(
        clip,
        nextClip,
        newFrameValue,
        assetDurationMs ?? undefined,
        project.framerate,
        speed,
      );

      const updatedClips = track.clips.map((c: Clip) => {
        if (c.id === clipId) {
          return {
            ...c,
            timeline_out,
            source_out,
          };
        }
        return c;
      });

      updatedTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((t: any) =>
          t.id === trackId ? { ...t, clips: updatedClips } : t,
        ),
      };
    }

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    await get().saveTimeline(project.id, updatedTimeline);
  },

  deleteClip: async (trackId, clipId) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const updatedTracks = timeline.tracks.map((track: any) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.filter((clip: Clip) => clip.id !== clipId),
      };
    });

    const updatedTimeline = { ...timeline, tracks: updatedTracks };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    await get().saveTimeline(project.id, updatedTimeline);
  },
});
