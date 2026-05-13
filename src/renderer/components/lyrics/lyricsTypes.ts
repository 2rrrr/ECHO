import type { LyricLine, LyricsKind } from '../../../shared/types/lyrics';

export type LyricsState = {
  kind: LyricsKind;
  source: 'none' | 'local' | 'online' | 'placeholder' | 'cached' | 'manual' | 'lrclib' | 'netease' | 'qqmusic' | 'musixmatch' | 'genius';
  lines: LyricLine[];
  offsetMs: number;
};

export type { LyricLine, LyricsKind, LyricsSearchCandidate, TrackLyrics } from '../../../shared/types/lyrics';
