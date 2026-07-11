import React from 'react';
import {
  FilmStripIcon,
  SpeakerHighIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import type { TrackType } from '@/api/bindings';

export interface TrackUIConfig {
  type: TrackType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export const TRACK_UI_CONFIGS: Record<TrackType, TrackUIConfig> = {
  video: {
    type: 'video',
    label: 'Video',
    icon: FilmStripIcon,
    iconColor: 'text-white/60',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/10',
    textClass: 'text-white/50',
  },
  audio: {
    type: 'audio',
    label: 'Audio',
    icon: SpeakerHighIcon,
    iconColor: 'text-white/60',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/10',
    textClass: 'text-white/50',
  },
  effects: {
    type: 'effects',
    label: 'Effects',
    icon: SparkleIcon,
    iconColor: 'text-white/60',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/10',
    textClass: 'text-white/50',
  },
};

export const getTrackType = (track: any): TrackType | null => {
  const typeStr = track?.track_type?.toLowerCase();
  if (typeStr === 'video') return 'video';
  if (typeStr === 'audio') return 'audio';
  if (typeStr === 'effects') return 'effects';
  return null;
};

export const getTrackUIConfig = (track: any): TrackUIConfig | null => {
  const type = getTrackType(track);
  return type ? TRACK_UI_CONFIGS[type] : null;
};

export const isVideoTrack = (track: any): boolean =>
  getTrackType(track) === 'video';
export const isAudioTrack = (track: any): boolean =>
  getTrackType(track) === 'audio';
export const isEffectsTrack = (track: any): boolean =>
  getTrackType(track) === 'effects';
