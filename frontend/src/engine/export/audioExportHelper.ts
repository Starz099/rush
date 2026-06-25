import type { Clip, Asset, Project } from '@/api/bindings';
import { assetApi } from '@/api/asset';
import { useAppStore } from '../../store/timelineStore';
import { fpsToNumeric } from '../../helpers/fps';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Helper to fetch and decode audio bytes for a clip using the OfflineAudioContext
 */
export async function loadAudioBufferForClip(
  clip: Clip,
  assets: Asset[],
  offlineCtx: OfflineAudioContext,
  framerate: number,
): Promise<AudioBuffer | null> {
  const asset = assets.find((a) => a.id === clip.asset_id);
  if (!asset) return null;

  // Use the lightweight cached MP3 audio file if available, otherwise fall back to original path
  const extractedAudioPath = useAppStore.getState().extractedAudios[asset.id];
  const audioPathToUse = extractedAudioPath || asset.file_path;

  // Calculate source slice range
  const sourceInSeconds = clip.source_in / framerate;
  const clipDuration = (clip.timeline_out - clip.timeline_in) / framerate;

  console.log(
    `[ExportEngine] Slicing audio asset on backend: ${asset.name} at start=${sourceInSeconds.toFixed(2)}s, duration=${clipDuration.toFixed(2)}s`,
  );

  // Request the backend to slice the audio file using FFmpeg to avoid decoding full assets
  const slicedAudioPath = await assetApi.sliceAudio(
    audioPathToUse,
    sourceInSeconds,
    clipDuration,
  );

  // Fetch the sliced file bytes over Tauri's custom asset protocol
  const url = convertFileSrc(slicedAudioPath);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  return await offlineCtx.decodeAudioData(arrayBuffer);
}

/**
 * Converts Float32 AudioBuffer channels into signed 16-bit PCM (s16le) format bytes
 */
export function audioBufferToPCM16(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const numSamples = buffer.length;

  const arrayBuffer = new ArrayBuffer(numSamples * numChannels * 2); // 2 bytes per sample (16-bit)
  const view = new DataView(arrayBuffer);

  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 0;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];

      // Clamp floats to prevent noise distortion
      sample = Math.max(-1.0, Math.min(1.0, sample));

      // Map Float [-1.0, 1.0] to Int16 [-32768, 32767]
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcmSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

/**
 * Compiles and saves the audio in PCM chunks for a specific range of the timeline
 */
export async function exportAudioChunk(
  activeProject: Project,
  assets: Asset[],
  startTimeSeconds: number,
  durationSeconds: number,
): Promise<Uint8Array> {
  const timeline = activeProject.timeline_state;
  const framerate = fpsToNumeric(activeProject.framerate);
  const sampleRate = 48000;

  const offlineCtx = new OfflineAudioContext(
    2,
    sampleRate * durationSeconds,
    sampleRate,
  );

  const endTimeSeconds = startTimeSeconds + durationSeconds;

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipInSec = clip.timeline_in / framerate;
      const clipOutSec = clip.timeline_out / framerate;

      // Check if clip falls within this chunk window
      const overlaps =
        clipInSec < endTimeSeconds && clipOutSec > startTimeSeconds;
      if (!overlaps) continue;

      const audioBuffer = await loadAudioBufferForClip(
        clip,
        assets,
        offlineCtx,
        framerate,
      );
      if (!audioBuffer) continue;

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);

      // 1. Where in the chunk context to start playing (0-based relative to startTimeSeconds)
      const scheduleTime = Math.max(0, clipInSec - startTimeSeconds);

      // 2. Where inside the source buffer we start playing.
      // Since our source buffer is ALREADY sliced to match the clip's timeline window [clipInSec, clipOutSec],
      // the beginning of this buffer corresponds to clipInSec.
      // If the clip started before our chunk (clipInSec < startTimeSeconds), we need to skip the portion
      // of the buffer that has already played: (startTimeSeconds - clipInSec) seconds.
      const bufferOffset = Math.max(0, startTimeSeconds - clipInSec);

      // 3. How long to play this clip in the current chunk window
      const playDuration = Math.min(
        clipOutSec - startTimeSeconds - scheduleTime,
        durationSeconds - scheduleTime,
      );

      source.start(scheduleTime, bufferOffset, playDuration);
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToPCM16(renderedBuffer);
}
