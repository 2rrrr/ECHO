import type { LyricLine as LyricLineType } from './lyricsTypes';

type LyricsLineProps = {
  line: LyricLineType;
  active: boolean;
  past: boolean;
  onSeek: (timeMs: number) => void;
  seekable?: boolean;
  showRomanization?: boolean;
};

const getLyricDensity = (line: LyricLineType): 'short' | 'medium' | 'long' | 'dense' => {
  const textLength = Array.from(line.text.replace(/\s+/g, ' ').trim()).length;
  const secondaryLength = Array.from(`${line.romanization ?? ''}${line.translation ?? ''}`.replace(/\s+/g, ' ').trim()).length;
  const weightedLength = textLength + Math.round(secondaryLength * 0.45);

  if (weightedLength >= 86) {
    return 'dense';
  }

  if (weightedLength >= 58) {
    return 'long';
  }

  if (weightedLength >= 36) {
    return 'medium';
  }

  return 'short';
};

export const LyricsLine = ({ active, line, onSeek, past, seekable = true, showRomanization = true }: LyricsLineProps): JSX.Element => {
  const density = getLyricDensity(line);

  return (
    <button
      className="lyrics-line"
      data-active={active}
      data-density={density}
      data-past={past}
      data-seekable={seekable}
      type="button"
      onClick={() => {
        if (seekable) {
          onSeek(line.timeMs);
        }
      }}
    >
      <span>{line.text}</span>
      {showRomanization && line.romanization ? <small>{line.romanization}</small> : null}
      {line.translation ? <em>{line.translation}</em> : null}
    </button>
  );
};
