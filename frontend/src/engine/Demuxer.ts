import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'

export class VideoDemuxer {
  private mp4boxfile: any
  private decoder: VideoDecoder
  private filePath: string
  private renderer?: { draw: (frame: VideoFrame) => void; dispose?: () => void }
  private decoderConfigured = false
  private disposed = false

  private samples: any[] = []
  private currentSampleIndex = 0
  private videoTrack: any
  private seekTargetTimestamp: number | null = null

  constructor(
    filePath: string,
    renderer?: { draw: (frame: VideoFrame) => void; dispose?: () => void },
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

        // QUIET SEEK: If we are seeking to a specific time,
        // skip rendering all intermediate frames.
        if (
          this.seekTargetTimestamp !== null &&
          frame.timestamp < this.seekTargetTimestamp
        ) {
          frame.close()
          return
        }

        // Once we hit or pass our target, we stop filtering
        this.seekTargetTimestamp = null

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
    if (this.renderer?.dispose) {
      this.renderer.dispose()
    }
  }

  public async initialize(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Metadata
      this.mp4boxfile.onReady = (info: any) => {
        this.videoTrack = info.videoTracks[0]
        if (!this.videoTrack) return reject('No video track found')

        this.mp4boxfile.setExtractionOptions(this.videoTrack.id, null, {
          nbSamples: 10000,
        })
        this.mp4boxfile.start()

        // Return basic metadata
        resolve({
          codec: this.videoTrack.codec,
          timescale: info.timescale,
          duration: info.duration,
        })
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

  public decodeNextFrame() {
    this.decodeAtIndex(this.currentSampleIndex)
    this.currentSampleIndex++
  }

  /**
   * Jumps to a specific frame and renders it immediately.
   * This is used for scrubbing (clicking the timeline while paused).
   */
  public async seekAndDisplay(frameIndex: number) {
    if (this.disposed || frameIndex < 0 || frameIndex >= this.samples.length) {
      return
    }

    const targetSample = this.samples[frameIndex]
    this.seekTargetTimestamp = targetSample.cts

    // Find the nearest preceding Keyframe (Sync frame)
    let syncIndex = frameIndex
    while (syncIndex > 0 && !this.samples[syncIndex].is_sync) {
      syncIndex--
    }

    // Reset the hardware decoder to clear old state and abort pending decodes
    if (this.decoder.state !== 'unconfigured') {
      this.decoder.reset()
      this.decoderConfigured = false
    }

    // Decode from the Keyframe up to our target frame
    for (let i = syncIndex; i <= frameIndex; i++) {
      this.decodeAtIndex(i)
    }

    // Update our sequential pointer so "Play" continues from here
    this.currentSampleIndex = frameIndex + 1
  }

  private decodeAtIndex(index: number) {
    if (this.disposed || index < 0 || index >= this.samples.length) return

    const sample = this.samples[index]

    if (!this.decoderConfigured) {
      if (!sample.is_sync) return // Wait for a keyframe

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
  ): { description?: ArrayBufferLike } | null {
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
