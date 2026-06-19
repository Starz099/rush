export class FrameQueue {
  private queue: VideoFrame[] = []
  private maxSize: number
  public minTimestamp: number | null = null

  constructor(maxSize: number = 60) {
    this.maxSize = maxSize
  }

  /**
   * Pushes a newly decoded frame into the queue.
   * Keeps the queue sorted by timestamp.
   */
  public push(frame: VideoFrame) {
    if (
      this.minTimestamp !== null &&
      frame.timestamp < this.minTimestamp - 30000
    ) {
      console.log(
        `[FrameQueue] Discarding intermediate frame for seek at timestamp=${(frame.timestamp / 1e6).toFixed(3)}s (minTimestamp=${(this.minTimestamp / 1e6).toFixed(3)}s)`,
      )
      frame.close()
      return
    }

    console.log(
      `[FrameQueue] push timestamp=${(frame.timestamp / 1e6).toFixed(3)}s queueSizeBefore=${this.queue.length}`,
    )

    // Deduplicate: If a frame with the same timestamp is already in the queue, discard this one
    const isDuplicate = this.queue.some((f) => f.timestamp === frame.timestamp)
    if (isDuplicate) {
      console.log(
        `[FrameQueue] Discarding duplicate frame at timestamp=${(frame.timestamp / 1e6).toFixed(3)}s`,
      )
      frame.close()
      return
    }

    if (this.queue.length >= this.maxSize) {
      frame.close() // Release the frame if the queue is full
      return
    }

    const idx = this.queue.findIndex((f) => f.timestamp > frame.timestamp)
    if (idx === -1) {
      this.queue.push(frame)
    } else {
      this.queue.splice(idx, 0, frame)
    }
  }

  /**
   * Retrieves the best frame for the given playhead time (in microseconds).
   * Automatically discards and closes any frames that are in the past.
   */
  public getFrameForTime(timeInMicroseconds: number): VideoFrame | null {
    let bestFrame: VideoFrame | null = null
    const origQueueLength = this.queue.length

    while (this.queue.length > 0) {
      const nextFrame = this.queue[0]

      // If the next frame is in the future (with 30ms tolerance), we stop looking.
      if (nextFrame.timestamp > timeInMicroseconds + 30000) {
        break
      }

      // If we already found a frame that is closer to the target,
      // close the older one we were holding.
      if (bestFrame) {
        bestFrame.close()
      }

      // Hold this frame as the best candidate so far, and remove it from queue
      bestFrame = this.queue.shift() || null
    }

    if (bestFrame || origQueueLength > 0) {
      console.log(
        `[FrameQueue] getFrameForTime query=${(timeInMicroseconds / 1e6).toFixed(3)}s resultTimestamp=${bestFrame ? (bestFrame.timestamp / 1e6).toFixed(3) : 'null'} queueSizeAfter=${this.queue.length}`,
      )
    }

    return bestFrame
  }

  /**
   * Checks if the queue contains a frame with a timestamp >= targetTimestamp.
   */
  public hasDecodedFrame(targetTimestampMicros: number): boolean {
    return this.queue.some((f) => f.timestamp >= targetTimestampMicros - 30000)
  }

  /**
   * Checks if the queue is full.
   */
  public isFull(): boolean {
    return this.queue.length >= this.maxSize
  }
  /**
   * Gets the current size of the queue.
   */
  public get size(): number {
    return this.queue.length
  }

  /**
   * Shifts the absolute first frame out of the queue regardless of timestamp.
   */
  public shiftFirstFrame(): VideoFrame | null {
    return this.queue.shift() || null
  }

  /**
   * Empties and closes all frames in the queue (crucial when seeking or stopping).
   */
  public clear() {
    for (const frame of this.queue) {
      frame.close()
    }
    this.queue = []
  }
}
