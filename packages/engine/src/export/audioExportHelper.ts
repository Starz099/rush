import type { Asset, Project } from '@/api/bindings';
import { fpsToNumeric } from '../helpers/fps';
import { convertFileSrc } from '@tauri-apps/api/core';

// Cache of decoded AudioBuffers, keyed by asset.id
const assetAudioBufferCache = new Map<string, AudioBuffer>();

export function clearAudioExportCache() {
  assetAudioBufferCache.clear();
}

export async function getAudioBufferForAsset(
  asset: Asset,
  offlineCtx: BaseAudioContext,
  extractedAudios: Record<string, string>,
): Promise<AudioBuffer | null> {
  const cached = assetAudioBufferCache.get(asset.id);
  if (cached) return cached;

  const extractedAudioPath = extractedAudios[asset.id];
  const audioPathToUse = extractedAudioPath || asset.file_path;

  try {
    console.log(
      `[ExportEngine] Fetching and decoding full audio for asset ${asset.name} (path: ${audioPathToUse})...`,
    );
    const url = convertFileSrc(audioPathToUse);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
    assetAudioBufferCache.set(asset.id, audioBuffer);
    return audioBuffer;
  } catch (err) {
    console.error(
      `[ExportEngine] Error decoding audio for asset ${asset.name}:`,
      err,
    );
    return null;
  }
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
  extractedAudios: Record<string, string>,
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
    if (track.is_muted) continue;

    for (const clip of track.clips) {
      if (!clip.asset_id) continue;
      const clipInSec = clip.timeline_in / framerate;
      const clipOutSec = clip.timeline_out / framerate;

      // Check if clip falls within this chunk window
      const overlaps =
        clipInSec < endTimeSeconds && clipOutSec > startTimeSeconds;
      if (!overlaps) continue;

      const asset = assets.find((a) => a.id === clip.asset_id);
      if (!asset) continue;

      const audioBuffer = await getAudioBufferForAsset(
        asset,
        offlineCtx,
        extractedAudios,
      );
      if (!audioBuffer) continue;

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);

      // 1. Where in the chunk context to start playing (0-based relative to startTimeSeconds)
      const scheduleTime = Math.max(0, clipInSec - startTimeSeconds);

      // 2. Where inside the source buffer we start playing.
      const bufferSeek = Math.max(0, startTimeSeconds - clipInSec);
      const sourceStart = clip.source_in / framerate + bufferSeek;

      // 3. How long to play this clip in the current chunk window
      const playDuration = Math.min(
        clipOutSec - startTimeSeconds - scheduleTime,
        durationSeconds - scheduleTime,
      );

      if (playDuration > 0) {
        source.start(scheduleTime, sourceStart, playDuration);
      }
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToPCM16(renderedBuffer);
}
