import { RangeDemuxer } from '../demuxers/RangeDemuxer';
import { DemuxerFactory } from '../demuxers/DemuxerFactory';
import { VideoDecoderWrapper } from '../decoders/VideoDecoder';
import { FrameQueue } from './FrameQueue';
import type { Project, Clip, Asset } from '@/api/bindings';
import { fpsToNumeric } from '../helpers/fps';
import { isVideoTrack } from '../helpers/track';

interface ActiveClipSession {
  clip: Clip;
  demuxer: RangeDemuxer;
  decoder: VideoDecoderWrapper;
  queue: FrameQueue;
  isDecoding: boolean;
  lastDecodedIndex: number;
  currentFrame: VideoFrame | null;
  seekId: number;
}

export class LookAheadManager {
  private sessions: Map<string, ActiveClipSession> = new Map();
  private demuxerCache: Map<string, RangeDemuxer> = new Map(); // Shared demuxers per Asset ID
  private mountingClips: Map<string, Promise<void>> = new Map();
  private disposed = false;
  private globalSeekId = 0;
  private activeTickSeekId: number | null = null;

  /**
   * Refreshes the active look-ahead window, mounts new clips, and unmounts old ones.
   */
  public async tick(
    playheadFrame: number,
    activeProject: Project,
    assets: Asset[],
  ) {
    if (this.disposed) return;

    if (this.activeTickSeekId === this.globalSeekId) {
      return;
    }
    const tickSeekId = this.globalSeekId;
    this.activeTickSeekId = tickSeekId;

    try {
      const timeline = activeProject.timeline_state;
      const framerate = fpsToNumeric(activeProject.framerate);
      const playheadSeconds = playheadFrame / framerate;

      // 1. Calculate the Look-Ahead Buffer Window (1s trailing, 5s ahead)
      const lookAheadStart = Math.max(0, playheadSeconds - 1.0);
      const lookAheadEnd = playheadSeconds + 5.0;

      // 2. Identify all video clips intersecting with this window
      const videoTracks = timeline.tracks.filter(isVideoTrack);
      const clipsInWindow: Clip[] = [];

      for (const track of videoTracks) {
        for (const clip of track.clips) {
          if (!clip.asset_id) continue;
          // Convert clip timeline positions from frames to seconds
          const clipInSec = clip.timeline_in / framerate;
          const clipOutSec = clip.timeline_out / framerate;

          const intersects =
            clipInSec < lookAheadEnd && clipOutSec > lookAheadStart;
          if (intersects) {
            clipsInWindow.push(clip);
          }
        }
      }

      const clipsInWindowIds = new Set(clipsInWindow.map((c) => c.id));

      if (this.globalSeekId !== tickSeekId || this.disposed) return;

      // 3. UNMOUNT clips that are no longer in the look-ahead window
      for (const [clipId, session] of this.sessions.entries()) {
        if (!clipsInWindowIds.has(clipId)) {
          console.log(
            `[LookAhead] Unmounting clip ${clipId} (moved out of buffer)`,
          );
          this.unmountSession(session);
          this.sessions.delete(clipId);
        }
      }

      // 4. MOUNT new clips entering the window, and check for modified clips
      const mountPromises: Promise<void>[] = [];
      for (const clip of clipsInWindow) {
        const existingSession = this.sessions.get(clip.id);

        let needsRemount = false;
        if (existingSession) {
          const oldClip = existingSession.clip;
          if (
            oldClip.asset_id !== clip.asset_id ||
            oldClip.timeline_in !== clip.timeline_in ||
            oldClip.timeline_out !== clip.timeline_out ||
            oldClip.source_in !== clip.source_in ||
            oldClip.source_out !== clip.source_out
          ) {
            needsRemount = true;
          }
        }

        if (needsRemount && existingSession) {
          console.log(`[LookAhead] Remounting modified clip ${clip.id}`);
          this.unmountSession(existingSession);
          this.sessions.delete(clip.id);
        }

        if (!this.sessions.has(clip.id)) {
          let p = this.mountingClips.get(clip.id);
          if (!p) {
            p = this.mountClip(clip, assets).finally(() => {
              this.mountingClips.delete(clip.id);
            });
            this.mountingClips.set(clip.id, p);
          }
          mountPromises.push(p);
        } else if (existingSession && !needsRemount) {
          // Update cached clip object to pick up other properties (opacity, transforms, etc.)
          existingSession.clip = clip;
        }
      }
      if (mountPromises.length > 0) {
        await Promise.all(mountPromises);
      }

      if (this.globalSeekId !== tickSeekId || this.disposed) return;

      // 5. DECODE upcoming frames for mounted sessions (Backpressure Aware)
      for (const session of this.sessions.values()) {
        await this.fillQueueForSession(session, playheadSeconds, framerate);
      }
    } finally {
      if (this.activeTickSeekId === tickSeekId) {
        this.activeTickSeekId = null;
      }
    }
  }

  /**
   * Initializes a RangeDemuxer, VideoDecoder, and FrameQueue for a clip.
   */
  private async mountClip(clip: Clip, assets: Asset[]) {
    console.log(`[LookAhead] Mounting clip ${clip.id}`);

    const asset = assets.find((a) => a.id === clip.asset_id);
    if (!asset) {
      console.warn(`[LookAhead] Asset not found for clip ${clip.id}`);
      return;
    }

    // A. Share demuxer if other clips use the same asset to save metadata parsing time
    let demuxer = this.demuxerCache.get(asset.id);
    if (!demuxer) {
      demuxer = DemuxerFactory.createDemuxer(asset.file_path);
      await demuxer.initialize();
      if (this.disposed) {
        demuxer.dispose();
        return;
      }
      this.demuxerCache.set(asset.id, demuxer);
    }

    if (this.disposed) return;

    // B. Create the FrameQueue
    const queue = new FrameQueue(60);

    // C. Create the VideoDecoder
    const decoder = new VideoDecoderWrapper((frame) => {
      queue.push(frame);
    });

    // Read metadata directly from the initialized demuxer
    if (demuxer.metadata) {
      decoder.configure(
        demuxer.metadata.codec,
        demuxer.metadata.width,
        demuxer.metadata.height,
        demuxer.metadata.description,
      );
    }

    this.sessions.set(clip.id, {
      clip,
      demuxer,
      decoder,
      queue,
      isDecoding: false,
      lastDecodedIndex: -1,
      currentFrame: null,
      seekId: 0,
    });
  }

  /**
   * Prefetches slices and decodes upcoming frames until the queue is full.
   */
  private async fillQueueForSession(
    session: ActiveClipSession,
    playheadSeconds: number,
    framerate: number,
  ) {
    if (session.isDecoding || session.queue.isFull()) {
      return; // Throttling (Backpressure)
    }

    const currentSeekId = session.seekId;
    session.isDecoding = true;

    try {
      const clip = session.clip;
      const clipInSec = clip.timeline_in / framerate;

      const firstCts = session.demuxer.samples[0]?.cts || 0;
      const timescale = session.demuxer.metadata?.timescale || 90000;

      // Calculate where the playhead currently sits in terms of sample index
      const playheadCts = Math.round(
        (playheadSeconds - clipInSec + clip.source_in / framerate) * timescale +
          firstCts,
      );
      let playheadIdx = -1;

      if (playheadCts <= session.demuxer.samples[0].cts) {
        playheadIdx = 0;
      } else if (
        playheadCts >=
        session.demuxer.samples[session.demuxer.samples.length - 1].cts
      ) {
        playheadIdx = session.demuxer.samples.length - 1;
      } else {
        let low = 0;
        let high = session.demuxer.samples.length - 1;
        while (low <= high) {
          const mid = low + Math.floor((high - low) / 2);
          const sample = session.demuxer.samples[mid];
          if (
            sample.cts <= playheadCts &&
            sample.cts + sample.duration > playheadCts
          ) {
            playheadIdx = mid;
            break;
          } else if (sample.cts > playheadCts) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
      }

      if (playheadIdx === -1) {
        playheadIdx = 0;
      }

      if (session.lastDecodedIndex === -1) {
        // Initial decode/Seek: start from playhead position and decode full GOP
        let sourceTimeSeconds =
          playheadSeconds - clipInSec + clip.source_in / framerate;
        if (sourceTimeSeconds < clip.source_in / framerate) {
          sourceTimeSeconds = clip.source_in / framerate;
        }

        console.log(
          `[LookAhead] Seek/Initial GOP fetch clip=${clip.id} playhead=${playheadSeconds.toFixed(3)}s sourcePlayhead=${sourceTimeSeconds.toFixed(3)}s`,
        );

        const { chunks, targetTimestampMicros } =
          await session.demuxer.getGopForTime(sourceTimeSeconds);

        if (session.seekId !== currentSeekId || this.disposed) return;

        session.queue.minTimestamp = targetTimestampMicros;

        for (const { chunk, info } of chunks) {
          if (info.index <= session.lastDecodedIndex) {
            continue;
          }
          session.decoder.decode(chunk);
          session.lastDecodedIndex = info.index;
        }

        // Wait for the targeted playback frame to be fully decoded before returning,
        // so that the very first frame render can draw the decoded texture immediately.
        await this.waitForFrame(session, targetTimestampMicros);

        if (session.seekId !== currentSeekId || this.disposed) return;

        session.queue.minTimestamp = null;
      } else {
        // Sequential decode: pre-decode next frames one by one up to look-ahead limit (e.g. playheadIdx + 60)
        const maxBufferSize = 60;
        while (!session.queue.isFull()) {
          const nextIndex = session.lastDecodedIndex + 1;
          if (nextIndex >= session.demuxer.samples.length) {
            break; // Reached end of video
          }

          // Backpressure limit: Do not submit chunks too far ahead of the current playhead
          if (nextIndex > playheadIdx + maxBufferSize) {
            break;
          }

          const nextSample = session.demuxer.samples[nextIndex];
          const sourceTime = (nextSample.cts - firstCts) / timescale;
          if (sourceTime >= clip.source_out / framerate) {
            break; // Past the clip's end time
          }

          // Fetch and decode only this single frame
          const chunk = await session.demuxer.getSingleFrame(nextIndex);

          if (session.seekId !== currentSeekId || this.disposed) return;

          session.decoder.decode(chunk);
          session.lastDecodedIndex = nextIndex;
        }
      }
    } catch (e) {
      console.error(
        `[LookAhead] Decode loop failed for clip ${session.clip.id}:`,
        e,
      );
    } finally {
      if (session.seekId === currentSeekId) {
        session.isDecoding = false;
      }
    }
  }

  /**
   * Helper to wait for a frame to finish decoding asynchronously on the WebCodecs thread.
   */
  private async waitForFrame(
    session: ActiveClipSession,
    targetTimestampMicros: number,
    timeoutMs = 1500,
  ): Promise<void> {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (session.queue.hasDecodedFrame(targetTimestampMicros)) {
        return;
      }
      // Yield to the event loop so decoding callbacks can fire
      await new Promise((resolve) => setTimeout(resolve, 4));
    }
    console.warn(
      `[LookAhead] waitForFrame timed out waiting for timestamp=${(targetTimestampMicros / 1e6).toFixed(3)}s`,
    );
  }

  /**
   * Retrieves a decoded frame for a specific clip at a timeline frame count.
   */
  public getFrame(
    clipId: string,
    playheadFrame: number,
    framerate: number,
  ): VideoFrame | null {
    const session = this.sessions.get(clipId);
    if (!session) return null;

    const clip = session.clip;
    const clipInSec = clip.timeline_in / framerate;
    const playheadSeconds = playheadFrame / framerate;
    const sourcePlayheadSeconds =
      playheadSeconds - clipInSec + clip.source_in / framerate;
    const sourcePlayheadMicroseconds = Math.round(sourcePlayheadSeconds * 1e6);

    let newFrame = session.queue.getFrameForTime(sourcePlayheadMicroseconds);
    if (!newFrame && !session.currentFrame && session.queue.size > 0) {
      // Fallback: If we don't have any cached frame yet, grab the first frame in the queue.
      // This avoids a black frame delay when a clip first starts playing.
      newFrame = session.queue.shiftFirstFrame();
    }

    if (newFrame) {
      console.log(
        `[LookAhead] getFrame clip=${clipId} playhead=${playheadSeconds.toFixed(3)}s newFrameTimestamp=${(newFrame.timestamp / 1e6).toFixed(3)}s`,
      );
      if (session.currentFrame) {
        session.currentFrame.close();
      }
      session.currentFrame = newFrame;
    } else {
      if (!session.currentFrame) {
        console.warn(
          `[LookAhead] getFrame clip=${clipId} playhead=${playheadSeconds.toFixed(3)}s sourcePlayhead=${sourcePlayheadSeconds.toFixed(3)}s - NO FRAME AVAILABLE (Queue Empty & No Cache)`,
        );
      }
    }

    return session.currentFrame;
  }

  public reset() {
    this.globalSeekId++;
    for (const session of this.sessions.values()) {
      session.decoder.reset();
      session.queue.clear();
      session.queue.minTimestamp = null;
      session.lastDecodedIndex = -1;
      if (session.currentFrame) {
        session.currentFrame.close();
        session.currentFrame = null;
      }
      session.isDecoding = false;
      session.seekId++;
    }
  }

  public dispose() {
    this.disposed = true;
    for (const session of this.sessions.values()) {
      this.unmountSession(session);
    }
    this.sessions.clear();
    for (const demuxer of this.demuxerCache.values()) {
      demuxer.dispose();
    }
    this.demuxerCache.clear();
  }

  /**
   * Helper to release all resource decoders and frame buffers for a clip session.
   */
  private unmountSession(session: ActiveClipSession) {
    session.decoder.close();
    session.queue.clear();
    if (session.currentFrame) {
      session.currentFrame.close();
      session.currentFrame = null;
    }
  }
}
