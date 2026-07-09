export type TrackType = 'video' | 'audio' | 'effects';

export const getTrackType = (track: any): TrackType | null => {
  const typeStr = track?.track_type?.toLowerCase();
  if (typeStr === 'video') return 'video';
  if (typeStr === 'audio') return 'audio';
  if (typeStr === 'effects') return 'effects';
  return null;
};

export const isVideoTrack = (track: any): boolean =>
  getTrackType(track) === 'video';

export const isAudioTrack = (track: any): boolean =>
  getTrackType(track) === 'audio';

export const isEffectsTrack = (track: any): boolean =>
  getTrackType(track) === 'effects';
