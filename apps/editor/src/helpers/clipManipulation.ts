import type { Clip } from '@/api/bindings';

/**
 * Calculates the resulting segments A & B when splitting a clip at a specific timeline playhead frame.
 *
 * @param clip The source clip to split.
 * @param splitPlayheadFrame The timeline frame index where the split should occur.
 * @param speed The clip's speed factor multiplier.
 * @returns An object containing the left (clipA) and right (clipB) segments.
 */
export function calculateSplit(
  clip: Clip,
  splitPlayheadFrame: number,
  speed: number = 1.0,
): { clipA: Clip; clipB: Clip } {
  const offsetTimeline = splitPlayheadFrame - clip.timeline_in;
  const offsetSource = Math.round(offsetTimeline * speed);

  const clipA: Clip = {
    ...clip,
    timeline_out: splitPlayheadFrame,
    source_out: clip.source_in + offsetSource,
  };

  const clipB: Clip = {
    ...clip,
    id: crypto.randomUUID(),
    timeline_in: splitPlayheadFrame,
    source_in: clip.source_in + offsetSource,
  };

  return { clipA, clipB };
}

/**
 * Calculates the new start timeline and source start frame when trimming a clip from its left edge.
 * Clamps the bounds to prevent overlap with the preceding clip and start-of-asset limits.
 *
 * @param clip The clip being trimmed.
 * @param prevClip The preceding clip on the track, or undefined if none.
 * @param newFrameValue The target timeline frame position.
 * @param speed The clip's speed factor multiplier.
 * @returns An object containing the new timeline_in and source_in.
 */
export function calculateTrimLeft(
  clip: Clip,
  prevClip: Clip | undefined,
  newFrameValue: number,
  speed: number = 1.0,
): { timeline_in: number; source_in: number } {
  const minTimelineIn = prevClip ? prevClip.timeline_out : 0;
  let finalTimelineIn = Math.max(minTimelineIn, newFrameValue);

  // Clamp so we do not trim past start of source asset (source_in cannot go below 0)
  const maxDeltaSourceIn = clip.source_in;
  const maxTimelineDeltaLeft = Math.round(maxDeltaSourceIn / speed);
  finalTimelineIn = Math.max(
    finalTimelineIn,
    clip.timeline_in - maxTimelineDeltaLeft,
  );

  // Clamp so duration is at least 1 frame
  finalTimelineIn = Math.min(finalTimelineIn, clip.timeline_out - 1);

  const delta = finalTimelineIn - clip.timeline_in;
  const newSourceIn = clip.source_in + Math.round(delta * speed);

  return {
    timeline_in: finalTimelineIn,
    source_in: newSourceIn,
  };
}

/**
 * Calculates the new end timeline and source end frame when trimming a clip from its right edge.
 * Clamps the bounds to prevent overlap with the succeeding clip and end-of-asset limits.
 *
 * @param clip The clip being trimmed.
 * @param nextClip The succeeding clip on the track, or undefined if none.
 * @param newFrameValue The target timeline frame position.
 * @param assetDurationMs The raw asset duration in milliseconds.
 * @param framerate The project framerate.
 * @param speed The clip's speed factor multiplier.
 * @returns An object containing the new timeline_out and source_out.
 */
export function calculateTrimRight(
  clip: Clip,
  nextClip: Clip | undefined,
  newFrameValue: number,
  assetDurationMs: number | undefined,
  framerate: number,
  speed: number = 1.0,
): { timeline_out: number; source_out: number } {
  const maxTimelineOut = nextClip ? nextClip.timeline_in : Infinity;
  let finalTimelineOut = Math.min(maxTimelineOut, newFrameValue);

  // Clamp based on asset duration if known
  if (assetDurationMs) {
    const maxSourceFrames = Math.round((assetDurationMs / 1000) * framerate);
    const maxDeltaSourceOut = maxSourceFrames - clip.source_out;
    const maxTimelineDeltaRight = Math.round(maxDeltaSourceOut / speed);
    finalTimelineOut = Math.min(
      finalTimelineOut,
      clip.timeline_out + maxTimelineDeltaRight,
    );
  }

  // Clamp so duration is at least 1 frame
  finalTimelineOut = Math.max(finalTimelineOut, clip.timeline_in + 1);

  const delta = finalTimelineOut - clip.timeline_out;
  const newSourceOut = clip.source_out + Math.round(delta * speed);

  return {
    timeline_out: finalTimelineOut,
    source_out: newSourceOut,
  };
}

/**
 * Calculates updated clip properties, syncing source durations and timeline bounds based on speed modifications.
 *
 * @param clip The source clip.
 * @param properties The modified properties dictionary.
 * @returns The fully updated Clip object.
 */
export function calculateClipPropertiesUpdate(
  clip: Clip,
  properties: Partial<Clip>,
): Clip {
  const updatedClip = { ...clip, ...properties };

  if (
    properties.timeline_in !== undefined &&
    properties.timeline_out === undefined
  ) {
    const duration = clip.timeline_out - clip.timeline_in;
    updatedClip.timeline_out = updatedClip.timeline_in + duration;
  }

  const timelineDuration = updatedClip.timeline_out - updatedClip.timeline_in;
  updatedClip.source_out =
    updatedClip.source_in +
    Math.round(timelineDuration * (updatedClip.speed_factor ?? 1.0));

  return updatedClip;
}
