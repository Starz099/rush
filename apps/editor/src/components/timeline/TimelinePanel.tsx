import { useProjectStore } from '@/store/projectStore';
import { useAppStore } from '@/store/timelineStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { PlayIcon, PauseIcon } from '@phosphor-icons/react';
import { getTrackUIConfig } from '@/constants/trackConfig';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fpsToNumeric } from '@/helpers/fps';
import {
  PIXELS_PER_SECOND,
  TICK_INTERVAL_SECONDS,
  TIMEBAR_HEIGHT_CLASS,
} from '@/constants/timeline';
import { TimelineTrack } from './TimelineTrack';

export const TimelinePanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject);
  const saveTimeline = useProjectStore((state) => state.saveTimeline);

  const isPlaying = useAppStore((state) => state.isPlaying);
  const togglePlayback = useAppStore((state) => state.togglePlayback);
  const playheadPosition = useAppStore((state) => state.playhead_position);
  const setPlayhead = useAppStore((state) => state.setPlayhead);
  const framerate = fpsToNumeric(activeProject?.framerate);

  const { clearSelection } = useWorkspaceStore();

  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({
    video: false,
    audio: false,
    effects: false,
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const handleAddTrack = async (type: 'video' | 'audio' | 'effects') => {
    if (!activeProject) return;
    const timeline = activeProject.timeline_state;

    const typeCount = timeline.tracks.filter(
      (t: any) => t.track_type?.toLowerCase() === type,
    ).length;

    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    const newTrack = {
      id: `${type}-${Date.now()}`,
      name: `${typeName} ${typeCount + 1}`,
      track_type: type,
      clips: [],
      transitions: [],
      is_muted: false,
      is_locked: false,
    };

    const updatedTimeline = {
      ...timeline,
      tracks: [...timeline.tracks, newTrack],
    };

    await saveTimeline(activeProject.id, updatedTimeline);
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!activeProject) return;
    const timeline = activeProject.timeline_state;
    const updatedTracks = timeline.tracks.filter((t: any) => t.id !== trackId);
    const updatedTimeline = { ...timeline, tracks: updatedTracks };
    await saveTimeline(activeProject.id, updatedTimeline);
  };

  const timelineContentRef = useRef<HTMLDivElement>(null);

  if (!activeProject) return null;

  const timeline = activeProject.timeline_state;

  const videoTracks = timeline.tracks.filter(
    (t: any) => t.track_type?.toLowerCase() === 'video',
  );
  const audioTracks = timeline.tracks.filter(
    (t: any) => t.track_type?.toLowerCase() === 'audio',
  );
  const effectsTracks = timeline.tracks.filter(
    (t: any) => t.track_type?.toLowerCase() === 'effects',
  );

  // Calculate total duration in frames
  const allClips = timeline.tracks.flatMap((t: any) => t.clips);
  const maxFrames = allClips.reduce(
    (max: number, clip: any) => Math.max(max, clip.timeline_out),
    0,
  );

  // Extend the timeline boundary to include the playhead so it remains visible and interactive
  const maxTimelineBound = Math.max(maxFrames, playheadPosition);

  // Fit timeline to boundary with a small 2-second tail padding (minimum 10 seconds total)
  const totalDurationSeconds = Math.max(maxTimelineBound / framerate + 2, 10);
  const timelineWidthPx = totalDurationSeconds * PIXELS_PER_SECOND;
  const numTicks = Math.ceil(totalDurationSeconds / TICK_INTERVAL_SECONDS) + 1;

  const handleTimelineClick = (e: React.MouseEvent) => {
    // If clicking on empty timeline space, clear selection
    if (
      e.target === e.currentTarget ||
      (e.target as HTMLElement).classList.contains('bg-black/20')
    ) {
      clearSelection();
    }

    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 0) return;

    // Convert pixel X to time (seconds) then to frame
    const timeInSeconds = x / PIXELS_PER_SECOND;
    const newFramePosition = Math.round(timeInSeconds * framerate);

    setPlayhead(newFramePosition);

    if (!isPlaying) {
      saveTimeline(activeProject.id, {
        ...timeline,
        playhead_position: newFramePosition,
      });
    }
  };

  // Format frames to HH:MM:SS:FF or MM:SS:FF
  const formatTime = (frame: number) => {
    const totalSeconds = Math.floor(frame / framerate);
    const f = frame % framerate;
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;

    return `${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const renderGroupHeaderLeft = (
    group: 'video' | 'audio' | 'effects',
    title: string,
    count: number,
  ) => {
    const isCollapsed = collapsedGroups[group];
    return (
      <div className="flex h-6 shrink-0 items-center justify-between border-b border-white/5 bg-white/[0.04] px-2 select-none">
        <button
          className="flex items-center gap-1 text-left text-[9px] font-bold tracking-wider text-white/50 uppercase hover:text-white"
          onClick={() => toggleGroup(group)}
        >
          <span className="mr-1 text-[7px] text-white/40">
            {isCollapsed ? '▶' : '▼'}
          </span>
          {title} ({count})
        </button>
        <button
          className="text-primary hover:text-primary/80 px-1 text-[9px] font-bold"
          onClick={() => handleAddTrack(group)}
        >
          + Add
        </button>
      </div>
    );
  };

  const renderGroupHeaderRight = () => {
    return (
      <div className="h-6 shrink-0 border-b border-white/5 bg-white/[0.01]" />
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#111] select-none">
      {/* Timeline Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/5 px-3">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Timeline
          </span>
          <div className="flex items-center gap-1 border-l border-white/5 pl-4">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/40 hover:bg-white/10"
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <PauseIcon weight="fill" className="size-3 text-white" />
              ) : (
                <PlayIcon weight="fill" className="size-3 text-white" />
              )}
            </Button>
          </div>
        </div>

        <div className="text-muted-foreground rounded bg-white/5 px-2 py-0.5 font-mono text-[10px]">
          {formatTime(playheadPosition)}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full" dir="ltr">
          <div className="flex min-h-full min-w-max">
            {/* Sticky Left Panel for Track Headers */}
            <div className="sticky left-0 z-20 flex w-40 shrink-0 flex-col border-r border-white/5 bg-[#111]">
              {/* Header Spacer for Timebar */}
              <div
                className={`${TIMEBAR_HEIGHT_CLASS} border-b border-white/5 bg-white/[0.02]`}
              />

              {/* Video Group */}
              {renderGroupHeaderLeft(
                'video',
                'Video Tracks',
                videoTracks.length,
              )}
              {!collapsedGroups.video &&
                videoTracks.map((track: any) => {
                  const config = getTrackUIConfig(track);
                  const Icon = config?.icon;
                  return (
                    <div
                      key={track.id}
                      className="group flex h-14 items-center justify-between border-b border-white/5 bg-white/[0.02] px-3"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {Icon && (
                          <Icon className={`size-4 ${config.iconColor}`} />
                        )}
                        <span className="truncate text-[11px] font-medium">
                          {track.name}
                        </span>
                      </div>
                      <button
                        className="px-1 text-[10px] text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                        onClick={() => handleDeleteTrack(track.id)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

              {/* Audio Group */}
              {renderGroupHeaderLeft(
                'audio',
                'Audio Tracks',
                audioTracks.length,
              )}
              {!collapsedGroups.audio &&
                audioTracks.map((track: any) => {
                  const config = getTrackUIConfig(track);
                  const Icon = config?.icon;
                  return (
                    <div
                      key={track.id}
                      className="group flex h-14 items-center justify-between border-b border-white/5 bg-white/[0.02] px-3"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {Icon && (
                          <Icon className={`size-4 ${config.iconColor}`} />
                        )}
                        <span className="truncate text-[11px] font-medium">
                          {track.name}
                        </span>
                      </div>
                      <button
                        className="px-1 text-[10px] text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                        onClick={() => handleDeleteTrack(track.id)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

              {/* Effects Group */}
              {renderGroupHeaderLeft(
                'effects',
                'Effects Tracks',
                effectsTracks.length,
              )}
              {!collapsedGroups.effects &&
                effectsTracks.map((track: any) => {
                  const config = getTrackUIConfig(track);
                  const Icon = config?.icon;
                  return (
                    <div
                      key={track.id}
                      className="group flex h-14 items-center justify-between border-b border-white/5 bg-white/[0.02] px-3"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {Icon && (
                          <Icon className={`size-4 ${config.iconColor}`} />
                        )}
                        <span className="truncate text-[11px] font-medium">
                          {track.name}
                        </span>
                      </div>
                      <button
                        className="px-1 text-[10px] text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                        onClick={() => handleDeleteTrack(track.id)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Right Panel for Tracks Content */}
            <div
              className="relative flex flex-col"
              ref={timelineContentRef}
              onClick={handleTimelineClick}
              style={{ width: `${timelineWidthPx}px` }}
            >
              {/* Timebar/Ruler */}
              <div
                className={`relative ${TIMEBAR_HEIGHT_CLASS} border-b border-white/5 bg-white/[0.01]`}
              >
                {/* Simple markers every few seconds */}
                {Array.from({ length: numTicks }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-white/10 pt-1 pl-1 text-[8px] text-white/20"
                    style={{
                      left: `${i * TICK_INTERVAL_SECONDS * PIXELS_PER_SECOND}px`,
                    }}
                  >
                    {i * TICK_INTERVAL_SECONDS}s
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-[2px] bg-red-500"
                style={{
                  left: `${(playheadPosition / framerate) * PIXELS_PER_SECOND}px`,
                }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 border-t-[8px] border-r-[6px] border-l-[6px] border-t-red-500 border-r-transparent border-l-transparent" />
              </div>

              {/* Video Lanes */}
              {renderGroupHeaderRight()}
              {!collapsedGroups.video &&
                videoTracks.map((track: any) => (
                  <TimelineTrack
                    key={track.id}
                    track={track}
                    framerate={framerate}
                  />
                ))}

              {/* Audio Lanes */}
              {renderGroupHeaderRight()}
              {!collapsedGroups.audio &&
                audioTracks.map((track: any) => (
                  <TimelineTrack
                    key={track.id}
                    track={track}
                    framerate={framerate}
                  />
                ))}

              {/* Effects Lanes */}
              {renderGroupHeaderRight()}
              {!collapsedGroups.effects &&
                effectsTracks.map((track: any) => (
                  <TimelineTrack
                    key={track.id}
                    track={track}
                    framerate={framerate}
                  />
                ))}

              {timeline.tracks.length === 0 && (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-white/10">
                  <span className="text-xs">No tracks found.</span>
                </div>
              )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    </div>
  );
};
