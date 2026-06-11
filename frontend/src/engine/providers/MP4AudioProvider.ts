import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'
import type { IAudioProvider, AudioMetadata, AudioSample } from './types'

export class MP4AudioProvider implements IAudioProvider {
  private mp4boxfile: any
  private filePath: string
  private samples: any[] = []
  private audioTrack: any
  private metadata?: AudioMetadata
  private disposed = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.mp4boxfile = MP4Box.createFile()
  }

  public async initialize(): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      this.mp4boxfile.onReady = (info: any) => {
        this.audioTrack = info.audioTracks[0]
        if (!this.audioTrack) return reject('No audio track found')

        const timescale = this.audioTrack.timescale || info.timescale || 1

        this.mp4boxfile.setExtractionOptions(this.audioTrack.id, null, {
          nbSamples: 10000,
        })
        this.mp4boxfile.start()

        this.metadata = {
          codec: this.audioTrack.codec,
          sampleRate: this.audioTrack.audio.sample_rate,
          channels: this.audioTrack.audio.channel_count,
          timescale: timescale,
          duration: info.duration,
          // Description will be extracted on demand or during first sample
        }

        resolve(this.metadata)
      }

      this.mp4boxfile.onSamples = (
        _track_id: number,
        _user: any,
        samples: any[],
      ) => {
        if (this.disposed) return
        this.samples.push(...samples)
      }

      this.mp4boxfile.onError = (e: string) => reject(e)

      this.fetchAndFeed()
    })
  }

  public getMetadata(): AudioMetadata {
    if (!this.metadata) throw new Error('Provider not initialized')

    // We try to extract description if it's not there yet
    if (!this.metadata.description && this.samples.length > 0) {
      const desc = this.getAudioDescription(this.samples[0])
      if (desc) {
        this.metadata.description = desc
      }
    }

    return this.metadata
  }

  public getSample(index: number): AudioSample | null {
    if (index < 0 || index >= this.samples.length) return null
    const s = this.samples[index]
    return {
      data: s.data,
      cts: s.cts,
      duration: s.duration,
      is_sync: s.is_sync,
    }
  }

  public getSampleCount(): number {
    return this.samples.length
  }

  public findSampleIndex(timeInSeconds: number): number {
    if (!this.metadata || !this.samples.length) return 0
    const targetCts = timeInSeconds * this.metadata.timescale
    let index = this.samples.findIndex(
      (s) => s.cts <= targetCts && s.cts + s.duration > targetCts,
    )

    if (index === -1) {
      if (targetCts < this.samples[0].cts) index = 0
      else index = this.samples.length - 1
    }
    return index
  }

  public dispose() {
    this.disposed = true
    // mp4box doesn't have a formal close, but we stop listening
    this.mp4boxfile.onReady = null
    this.mp4boxfile.onSamples = null
    this.samples = []
  }

  private async fetchAndFeed() {
    try {
      const fileBytes = await invoke<number[]>('read_asset_bytes', {
        filePath: this.filePath,
      })
      const buffer = new Uint8Array(fileBytes).buffer
      ;(buffer as any).fileStart = 0

      this.mp4boxfile.appendBuffer(buffer)
      this.mp4boxfile.flush()
    } catch (error) {
      console.error('Failed to read local file:', error)
    }
  }

  private getAudioDescription(sample?: any): ArrayBuffer | undefined {
    // 1. Try to get it from the provided sample first
    const esds = sample?.description?.esds
    if (esds?.data) {
      return this.extractAudioSpecificConfig(esds.data) ?? undefined
    }

    // 2. Fallback: try to find it in the track structure (moov)
    try {
      const moov = this.mp4boxfile.moov
      if (moov && this.audioTrack) {
        const trak = moov.traks.find(
          (t: any) => t.tkhd.track_id === this.audioTrack.id,
        )
        const stsdEntry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]
        const fallbackEsds = stsdEntry?.esds
        if (fallbackEsds?.data) {
          return this.extractAudioSpecificConfig(fallbackEsds.data) ?? undefined
        }
      }
    } catch (e) {
      console.warn('Failed to find esds in moov fallback:', e)
    }

    return undefined
  }

  private extractAudioSpecificConfig(data: Uint8Array): ArrayBuffer | null {
    let offset = 0
    while (offset < data.length) {
      const tag = data[offset]
      if (tag === 0x05) {
        const len = data[offset + 1]
        if (len > 0 && offset + 2 + len <= data.length) {
          // data.slice() returns a NEW Uint8Array with a NEW ArrayBuffer
          // This avoids SharedArrayBuffer issues and keeps the data clean.
          return data.slice(offset + 2, offset + 2 + len).buffer as ArrayBuffer
        }
      }
      offset++
    }
    return null
  }
}
