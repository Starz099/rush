import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'

export class VideoDemuxer {
  private mp4boxfile: any
  decoder: VideoDecoder
  private filePath: string
  private renderer?: { draw: (frame: VideoFrame) => void; dispose?: () => void }
  private decoderConfigured = false
  private disposed = false

  private samples: any[] = []
  private currentSampleIndex = 0
  public videoTrack: any
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
        // We use a 100 microsecond epsilon to avoid precision issues.
        if (
          this.seekTargetTimestamp !== null &&
          frame.timestamp < this.seekTargetTimestamp - 100
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
    // We no longer dispose the renderer here as it is shared
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
    if (this.disposed || !this.videoTrack) return
    this.decodeAtIndex(this.currentSampleIndex)
    this.currentSampleIndex++
  }

  private isSeeking = false
  private pendingSeekTime: number | null = null

  /**
   * Renders the frame corresponding to a specific time in the source file.
   * This is the key to perfect A/V sync and Nearest Neighbor Time Sampling.
   */
  public async displayAtTime(timeInSeconds: number) {
    if (this.disposed || !this.videoTrack) return

    // If we are already seeking, just record the latest target
    if (this.isSeeking) {
      this.pendingSeekTime = timeInSeconds
      return
    }

    const timescale = this.videoTrack.timescale || 1
    const targetCts = timeInSeconds * timescale

    // HIGH PERFORMANCE SEARCH: Binary Search for the nearest sample (O(log N))
    let low = 0
    let high = this.samples.length - 1
    let frameIndex = -1

    while (low <= high) {
      const mid = (low + high) >>> 1
      const sample = this.samples[mid]

      if (sample.cts <= targetCts && sample.cts + sample.duration > targetCts) {
        frameIndex = mid
        break
      } else if (sample.cts > targetCts) {
        high = mid - 1
      } else {
        low = mid + 1
      }
    }

    if (frameIndex === -1) return

    // If we are already showing this frame, skip
    if (frameIndex === this.currentSampleIndex - 1) return

    // --- DEPENDENCY-AWARE DECODING LOGIC ---
    const currentPos = this.currentSampleIndex - 1

    // 1. If we are moving BACKWARDS: We MUST reset and seek from Keyframe.
    const isMovingBackwards = frameIndex < currentPos

    // 2. If we are jumping FAR FORWARD (> 15 frames): Reset and seek to save CPU.
    const isJumpingFar = frameIndex > currentPos + 15

    // 3. If the decoder isn't ready: Seek.
    if (!this.decoderConfigured || isMovingBackwards || isJumpingFar) {
      await this.seekByTime(timeInSeconds)
    }
    // 4. CATCH-UP: If we are slightly ahead (e.g. jumped 1-14 frames),
    // we MUST decode all frames in between to maintain P/B frame integrity.
    else if (frameIndex > currentPos) {
      for (let i = currentPos + 1; i <= frameIndex; i++) {
        this.decodeAtIndex(i)
      }
      this.currentSampleIndex = frameIndex + 1
    }
    // 5. If frameIndex == currentPos: We are already showing it, do nothing.
  }

  /**
   * Jumps to a specific time and renders the corresponding frame immediately.
   */
  public async seekByTime(timeInSeconds: number) {
    if (this.disposed || !this.videoTrack || this.isSeeking) {
      if (this.isSeeking) this.pendingSeekTime = timeInSeconds
      return
    }

    this.isSeeking = true

    try {
      const timescale = this.videoTrack.timescale || 1
      const targetCts = timeInSeconds * timescale

      // Binary Search for the target frame
      let low = 0
      let high = this.samples.length - 1
      let frameIndex = -1

      while (low <= high) {
        const mid = (low + high) >>> 1
        const sample = this.samples[mid]
        if (
          sample.cts <= targetCts &&
          sample.cts + sample.duration > targetCts
        ) {
          frameIndex = mid
          break
        } else if (sample.cts > targetCts) {
          high = mid - 1
        } else {
          low = mid + 1
        }
      }

      if (frameIndex === -1) return

      const targetSample = this.samples[frameIndex]
      this.seekTargetTimestamp = (targetSample.cts * 1e6) / timescale

      // Find the nearest preceding Keyframe (Sync frame)
      let syncIndex = frameIndex
      while (syncIndex > 0 && !this.samples[syncIndex].is_sync) {
        syncIndex--
      }

      // Reset the hardware decoder IMMEDIATELY (synchronous)
      if (this.decoder.state !== 'unconfigured') {
        this.decoder.reset()
        this.decoderConfigured = false
      }

      // Decode from the Keyframe up to our target frame
      // Note: The first call to decodeAtIndex will call configure()
      // because we just set decoderConfigured = false
      for (let i = syncIndex; i <= frameIndex; i++) {
        this.decodeAtIndex(i)
      }

      // Update our sequential pointer so "Play" continues from here
      this.currentSampleIndex = frameIndex + 1
    } finally {
      this.isSeeking = false

      // If another seek was requested while we were busy, handle it now
      if (this.pendingSeekTime !== null) {
        const nextTime = this.pendingSeekTime
        this.pendingSeekTime = null
        await this.displayAtTime(nextTime)
      }
    }
  }

  private decodeAtIndex(index: number) {
    if (this.disposed || index < 0 || index >= this.samples.length) return

    const sample = this.samples[index]
    const timescale = this.videoTrack.timescale || 1

    if (!this.decoderConfigured) {
      if (!sample.is_sync) return // Wait for a keyframe

      // Use sample-specific description if available, otherwise fallback to track-level
      const description =
        this.getDecoderDescription(sample) ?? this.getTrackDescription()

      const config: VideoDecoderConfig = {
        codec: this.videoTrack.codec,
        codedWidth: this.videoTrack.video.width,
        codedHeight: this.videoTrack.video.height,
      }

      if (description) {
        config.description = description
      }

      this.decoder.configure(config)
      this.decoderConfigured = true
    }

    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1e6) / timescale,
      duration: (sample.duration * 1e6) / timescale,
      data: sample.data,
    })

    this.decoder.decode(chunk)
  }

  private getTrackDescription(): ArrayBuffer | null {
    // Some tracks might store the global description in the sample entries
    const entry = this.videoTrack?.mdia?.minf?.stbl?.stsd?.entries?.[0]
    const avcC = entry?.avcC ?? entry?.hvcC
    if (!avcC) return null

    const DataStream = (MP4Box as any).DataStream
    if (!DataStream) return null

    const stream = new DataStream()
    avcC.write(stream)

    // Ensure we return a clean ArrayBuffer
    return stream.buffer.slice(avcC.hdr_size ?? 8, stream.byteLength)
  }

  private getDecoderDescription(sample: any): ArrayBuffer | null {
    const avcConfiguration =
      sample?.description?.avcC ?? sample?.description?.hvcC
    if (!avcConfiguration) return null

    const DataStream = (MP4Box as any).DataStream
    if (!DataStream) return null

    const stream = new DataStream()
    avcConfiguration.write(stream)

    return stream.buffer.slice(
      avcConfiguration.hdr_size ?? 8,
      stream.byteLength,
    )
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
}
