import { invoke } from '@tauri-apps/api/core';
import type { AudioMetadata, AudioSample, IAudioProvider } from './types';

export class StandaloneAudioProvider implements IAudioProvider {
  private filePath: string;
  private audioCtx: AudioContext;
  private metadata?: AudioMetadata;
  private audioSamples: AudioSample[] = [];
  private readonly FRAMES_PER_SAMPLE = 2048;

  public constructor(filePath: string, audioCtx: AudioContext) {
    this.filePath = filePath;
    this.audioCtx = audioCtx;
  }

  public async initialize(): Promise<AudioMetadata> {
    const fileBytes = await invoke<number[]>('read_asset_bytes', {
      filePath: this.filePath,
    });

    const audioBuffer = await this.audioCtx.decodeAudioData(
      new Uint8Array(fileBytes).buffer,
    );

    this.metadata = {
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      duration: audioBuffer.duration,
      isEncoded: false,
      codec: 'pcm',
      timescale: audioBuffer.sampleRate,
    };

    this.createSamples(audioBuffer);

    return this.metadata;
  }

  private createSamples(audioBuffer: AudioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const framesPerSample = this.FRAMES_PER_SAMPLE;

    for (
      let offset = 0;
      offset < audioBuffer.length;
      offset += framesPerSample
    ) {
      const actualFrames = Math.min(
        framesPerSample,
        audioBuffer.length - offset,
      );
      const planarData = new Float32Array(channels * actualFrames);

      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer
          .getChannelData(ch)
          .subarray(offset, offset + actualFrames);
        planarData.set(channelData, ch * actualFrames);
      }

      this.audioSamples.push({
        data: planarData.buffer,
        cts: offset,
        duration: actualFrames,
        is_sync: true,
      });
    }
  }

  public getMetadata(): AudioMetadata {
    if (!this.metadata) throw new Error('Provider not initialized');
    return this.metadata;
  }

  public getSample(index: number): AudioSample | null {
    if (index < 0 || index >= this.audioSamples.length) return null;
    return this.audioSamples[index];
  }

  public getSampleCount(): number {
    return this.audioSamples.length;
  }

  public findSampleIndex(timeInSeconds: number): number {
    if (!this.metadata) return 0;
    const frame = timeInSeconds * this.metadata.sampleRate;
    return Math.floor(frame / this.FRAMES_PER_SAMPLE);
  }

  public dispose() {
    this.audioSamples = [];
  }
}
