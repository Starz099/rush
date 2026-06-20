import React from 'react'
import {
  FilmStripIcon,
  SpeakerHighIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import type { TrackType } from '@/api/bindings'

export interface TrackUIConfig {
  type: TrackType
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  bgClass: string
  borderClass: string
  textClass: string
}

export const TRACK_UI_CONFIGS: Record<TrackType, TrackUIConfig> = {
  video: {
    type: 'video',
    label: 'Video',
    icon: FilmStripIcon,
    iconColor: 'text-blue-400',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-200/70',
  },
  audio: {
    type: 'audio',
    label: 'Audio',
    icon: SpeakerHighIcon,
    iconColor: 'text-green-400',
    bgClass: 'bg-green-500/20',
    borderClass: 'border-green-500/40',
    textClass: 'text-green-200/70',
  },
  effects: {
    type: 'effects',
    label: 'Effects',
    icon: SparkleIcon,
    iconColor: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-200/70',
  },
}

export const getTrackType = (track: any): TrackType | null => {
  const typeStr = track?.track_type?.toLowerCase()
  if (typeStr === 'video') return 'video'
  if (typeStr === 'audio') return 'audio'
  if (typeStr === 'effects') return 'effects'
  return null
}

export const getTrackUIConfig = (track: any): TrackUIConfig | null => {
  const type = getTrackType(track)
  return type ? TRACK_UI_CONFIGS[type] : null
}

export const isVideoTrack = (track: any): boolean =>
  getTrackType(track) === 'video'
export const isAudioTrack = (track: any): boolean =>
  getTrackType(track) === 'audio'
export const isEffectsTrack = (track: any): boolean =>
  getTrackType(track) === 'effects'
