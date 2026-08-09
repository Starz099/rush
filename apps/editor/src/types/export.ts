export type ExportPhase =
  | 'idle'
  | 'preparing'
  | 'video'
  | 'audio'
  | 'muxing'
  | 'completed'
  | 'failed';
