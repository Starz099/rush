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
import { useWorkspaceStore } from '../workspaceStore';

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
    persist?: boolean,
  ) => Promise<void>;
  deleteClip: (trackId: string, clipId: string) => Promise<void>;
  moveClipToTrack: (
    sourceTrackId: string,
    targetTrackId: string,
    clipId: string,
  ) => Promise<void>;
  addCrossClipTransition: (
    trackId: string,
    fromClipId: string,
    toClipId: string,
    transitionType: any,
  ) => Promise<string | undefined>;
  updateTransitionProperties: (
    trackId: string,
    transitionId: string,
    properties: any,
  ) => Promise<void>;
  deleteTransition: (trackId: string, transitionId: string) => Promise<void>;
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
            sourceTrack &&
            track.track_type !== sourceTrack.track_type &&
            clip.asset_id === targetAssetId &&
            clip.timeline_in === targetOriginalTimelineIn;

          if (!isTargetClip && !isLinkedClip) return clip;

          return calculateClipPropertiesUpdate(clip, properties);
        }),
      };
    });

    const validatedTracks = validateAndSortClipsLocal(updatedTracks);
    const updatedTimeline = { ...timeline, tracks: validatedTracks };

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

    // Edge case: Update transitions referencing the split clip
    const updatedTransitions = (track.transitions || []).map((t: any) => {
      let nextT = { ...t };
      if (t.from_clip_id === clipId) {
        nextT.from_clip_id = clipB.id; // Transitions leaving the split clip now start from B
      }
      if (t.to_clip_id === clipId) {
        nextT.to_clip_id = clipA.id; // Transitions entering the split clip now end at A
      }
      return nextT;
    });

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id === trackId) {
        return { ...t, clips: updatedClips, transitions: updatedTransitions };
      }
      return t;
    });

    const validatedTracks = validateAndSortClipsLocal(updatedTracks);
    const updatedTimeline = { ...timeline, tracks: validatedTracks };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    await get().saveTimeline(project.id, updatedTimeline);
  },

  trimClip: async (trackId, clipId, edge, newFrameValue, persist = true) => {
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
      // Find preceding non-gap clip on this track to prevent overlap
      const prevClip = track.clips
        .filter((c: Clip) => {
          if (c.id === clipId || c.timeline_out > clip.timeline_in)
            return false;
          const isEffectTrack = track.track_type?.toLowerCase() === 'effects';
          const isGap = isEffectTrack
            ? !c.asset_id &&
              !c.transform &&
              (c.speed_factor === undefined ||
                c.speed_factor === null ||
                c.speed_factor === 1.0)
            : !c.asset_id;
          return !isGap;
        })
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
      // Find succeeding non-gap clip on this track to prevent overlap
      const nextClip = track.clips
        .filter((c: Clip) => {
          if (c.id === clipId || c.timeline_in < clip.timeline_out)
            return false;
          const isEffectTrack = track.track_type?.toLowerCase() === 'effects';
          const isGap = isEffectTrack
            ? !c.asset_id &&
              !c.transform &&
              (c.speed_factor === undefined ||
                c.speed_factor === null ||
                c.speed_factor === 1.0)
            : !c.asset_id;
          return !isGap;
        })
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

      const delta = timeline_out - clip.timeline_out;

      const updatedClips = track.clips.map((c: Clip) => {
        if (c.id === clipId) {
          return {
            ...c,
            timeline_out,
            source_out,
          };
        }
        // If it starts after the trimmed clip's old timeline_out, shift it by delta
        if (c.timeline_in >= clip.timeline_out) {
          return {
            ...c,
            timeline_in: c.timeline_in + delta,
            timeline_out: c.timeline_out + delta,
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

    const validatedTracks = validateAndSortClipsLocal(updatedTimeline.tracks);
    updatedTimeline = {
      ...updatedTimeline,
      tracks: validatedTracks,
    };

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

  deleteClip: async (trackId, clipId) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const track = timeline.tracks.find((t: any) => t.id === trackId);
    if (!track) return;

    const clipToDelete = track.clips.find((c: Clip) => c.id === clipId);
    if (!clipToDelete) return;

    const deleteDuration = clipToDelete.timeline_out - clipToDelete.timeline_in;

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id !== trackId) return t;
      const filteredClips = t.clips.filter((clip: Clip) => clip.id !== clipId);
      const shiftedClips = filteredClips.map((clip: Clip) => {
        if (clip.timeline_in >= clipToDelete.timeline_out) {
          return {
            ...clip,
            timeline_in: clip.timeline_in - deleteDuration,
            timeline_out: clip.timeline_out - deleteDuration,
          };
        }
        return clip;
      });

      // Edge case: Delete transitions referencing the deleted clip
      const filteredTransitions = (t.transitions || []).filter(
        (trans: any) =>
          trans.from_clip_id !== clipId && trans.to_clip_id !== clipId,
      );

      return {
        ...t,
        clips: shiftedClips,
        transitions: filteredTransitions,
      };
    });

    const validatedTracks = validateAndSortClipsLocal(updatedTracks);
    const updatedTimeline = { ...timeline, tracks: validatedTracks };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    await get().saveTimeline(project.id, updatedTimeline);
  },

  moveClipToTrack: async (sourceTrackId, targetTrackId, clipId) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const sourceTrack = timeline.tracks.find(
      (t: any) => t.id === sourceTrackId,
    );
    const targetTrack = timeline.tracks.find(
      (t: any) => t.id === targetTrackId,
    );
    if (!sourceTrack || !targetTrack) return;

    const clipToMove = sourceTrack.clips.find((c: any) => c.id === clipId);
    if (!clipToMove) return;

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id === sourceTrackId) {
        // Clean up transitions referencing the moved clip on the source track
        const remainingTransitions = (t.transitions || []).filter(
          (trans: any) =>
            trans.from_clip_id !== clipId && trans.to_clip_id !== clipId,
        );
        return {
          ...t,
          clips: t.clips.filter((c: any) => c.id !== clipId),
          transitions: remainingTransitions,
        };
      }
      if (t.id === targetTrackId) {
        return {
          ...t,
          clips: [...t.clips, clipToMove],
        };
      }
      return t;
    });

    const validatedTracks = validateAndSortClipsLocal(updatedTracks);
    const updatedTimeline = {
      ...timeline,
      tracks: validatedTracks,
    };

    set({
      activeProject: {
        ...project,
        timeline_state: updatedTimeline,
      },
    });

    useWorkspaceStore.getState().setClipSelection(targetTrackId, clipId);
    await get().saveTimeline(project.id, updatedTimeline);
  },

  addCrossClipTransition: async (
    trackId,
    fromClipId,
    toClipId,
    transitionType,
  ) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const transitionId = crypto.randomUUID();

    const updatedTracks = timeline.tracks.map((track: any) => {
      if (track.id !== trackId) return track;

      const newTransition = {
        id: transitionId,
        from_clip_id: fromClipId,
        to_clip_id: toClipId,
        transition_type: transitionType,
        duration_frames: 30, // 1 second default at 30fps
        ease_curve: 'ease_in_out' as any,
        alignment: 'center' as any,
        config: null,
      };

      return {
        ...track,
        transitions: [...(track.transitions || []), newTransition],
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
    return transitionId;
  },

  updateTransitionProperties: async (trackId, transitionId, properties) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const updatedTracks = timeline.tracks.map((track: any) => {
      if (track.id !== trackId) return track;

      return {
        ...track,
        transitions: (track.transitions || []).map((t: any) => {
          if (t.id !== transitionId) return t;
          return { ...t, ...properties };
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

    await get().saveTimeline(project.id, updatedTimeline);
  },

  deleteTransition: async (trackId, transitionId) => {
    const project = get().activeProject;
    if (!project) return;

    const timeline = project.timeline_state;
    const updatedTracks = timeline.tracks.map((track: any) => {
      if (track.id !== trackId) return track;

      return {
        ...track,
        transitions: (track.transitions || []).filter(
          (t: any) => t.id !== transitionId,
        ),
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

function validateAndSortClipsLocal(tracks: any[]): any[] {
  return tracks.map((track) => {
    if (track.clips.length === 0) {
      return track;
    }

    const trackType = track.track_type;

    // 1. Separate clips into media (non-gap) and gap clips
    const mediaClips: any[] = [];
    const gapClips: any[] = [];

    track.clips.forEach((clip: any) => {
      const isEffectTrack = trackType?.toLowerCase() === 'effects';
      const isGap = isEffectTrack ? !clip.effect_type : !clip.asset_id;

      if (isGap) {
        gapClips.push(clip);
      } else {
        mediaClips.push(clip);
      }
    });

    // Sort media clips by timeline_in, then timeline_out
    mediaClips.sort(
      (a, b) =>
        a.timeline_in - b.timeline_in || a.timeline_out - b.timeline_out,
    );

    const validated: any[] = [];
    let currentTime = 0;

    // If there are no media clips, preserve the first gap
    if (mediaClips.length === 0 && gapClips.length > 0) {
      const gapClip = { ...gapClips[0] };
      const duration = gapClip.timeline_out - gapClip.timeline_in;
      if (duration > 0) {
        gapClip.transform = null;
        gapClip.effect_type = null;
        gapClip.effect_config = null;
        gapClip.speed_factor = 1.0;
        gapClip.asset_id = null;
        gapClip.timeline_in = 0;
        gapClip.timeline_out = duration;
        validated.push(gapClip);
      }
    }

    mediaClips.forEach((clip) => {
      const duration = clip.timeline_out - clip.timeline_in;
      if (duration <= 0) return;

      if (clip.timeline_in > currentTime) {
        const gapDuration = clip.timeline_in - currentTime;
        const gapSpaceStart = currentTime;
        const gapSpaceEnd = clip.timeline_in;

        // Find intersecting gap clip
        const existingGapIdx = gapClips.findIndex((g) => {
          const start = Math.max(g.timeline_in, gapSpaceStart);
          const end = Math.min(g.timeline_out, gapSpaceEnd);
          return start < end;
        });

        let gapClip: any;
        if (existingGapIdx !== -1) {
          gapClip = { ...gapClips[existingGapIdx] };
          gapClips.splice(existingGapIdx, 1);
        } else {
          gapClip = {
            id: crypto.randomUUID(),
            asset_id: null,
            timeline_in: currentTime,
            timeline_out: currentTime + gapDuration,
            source_in: 0,
            source_out: gapDuration,
            transform: null,
            speed_factor: 1.0,
            effect_type: null,
            effect_config: null,
          };
        }

        gapClip.transform = null;
        gapClip.effect_type = null;
        gapClip.effect_config = null;
        gapClip.speed_factor = 1.0;
        gapClip.asset_id = null;
        gapClip.timeline_in = currentTime;
        gapClip.timeline_out = currentTime + gapDuration;
        gapClip.source_in = 0;
        gapClip.source_out = gapDuration;

        validated.push(gapClip);
        currentTime = clip.timeline_in;
      }

      const updatedClip = { ...clip };
      updatedClip.timeline_in = currentTime;
      updatedClip.timeline_out = currentTime + duration;
      currentTime = updatedClip.timeline_out;
      validated.push(updatedClip);
    });

    return {
      ...track,
      clips: validated,
    };
  });
}
