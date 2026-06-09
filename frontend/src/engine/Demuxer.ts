import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'

export class VideoDemuxer {
  private mp4boxfile: any
  private decoder: VideoDecoder
  private filePath: string
  private renderer?: { draw: (frame: VideoFrame) => void }
  private decoderConfigured = false
  private disposed = false

  private samples: any[] = []
  private currentSampleIndex = 0
  private videoTrack: any

  constructor(
    filePath: string,
    renderer?: { draw: (frame: VideoFrame) => void },
  ) {
    this.filePath = filePath
    this.renderer = renderer
    this.mp4boxfile = MP4Box.createFile()
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        if (this.disposed) {
          frame.close()
          return
        }

        if (this.renderer) {
          this.renderer.draw(frame)
          return
        }

        console.log(
          `Decoded Frame at ${frame.timestamp}ms. Size: ${frame.codedWidth}x${frame.codedHeight}`,
        )
        frame.close()
      },
      error: (e) => console.error('Decoder error:', e),
    })
  }

  public dispose() {
    this.disposed = true
    if (this.decoder.state !== 'closed') {
      this.decoder.close()
    }
  }

  public async initialize(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Metadata
      this.mp4boxfile.onReady = (info: any) => {
        this.videoTrack = info.videoTracks[0]
        if (!this.videoTrack) return reject('No video track found')
        // Start extraction
        this.mp4boxfile.setExtractionOptions(this.videoTrack.id, null, {
          nbSamples: 180,
        })
        this.mp4boxfile.start()
        // Return basic metadata
        resolve({
          codec: this.videoTrack.codec,
          timescale: info.timescale,
          duration: info.duration,
        })
      }

      // Samples
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

  public decodeNextFrame() {
    if (this.disposed || this.currentSampleIndex >= this.samples.length) {
      return
    }

    const sample = this.samples[this.currentSampleIndex]

    if (!this.decoderConfigured) {
      if (!sample.is_sync) {
        this.currentSampleIndex++
        this.decodeNextFrame() // Skip until first sync frame
        return
      }

      this.decoder.configure({
        codec: this.videoTrack.codec,
        codedWidth: this.videoTrack.video.width,
        codedHeight: this.videoTrack.video.height,
        ...(this.getDecoderDescription(sample) ?? {}),
      })
      this.decoderConfigured = true
    }

    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: sample.cts,
      duration: sample.duration,
      data: sample.data,
    })

    this.decoder.decode(chunk)
    this.currentSampleIndex++
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

  private getDecoderDescription(
    sample: any,
  ): { description?: ArrayBuffer } | null {
    const avcConfiguration = sample?.description?.avcC
    if (!avcConfiguration) return null

    const DataStream = (MP4Box as any).DataStream
    if (!DataStream) return null

    const stream = new DataStream()
    avcConfiguration.write(stream)

    return {
      description: stream.buffer.slice(
        avcConfiguration.hdr_size ?? 8,
        stream.byteLength,
      ),
    }
  }
}
