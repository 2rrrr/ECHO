import type { LyricLine } from '../../shared/types/lyrics';

type KuroshiroInstance = {
  convert: (text: string, options: { to: 'romaji'; mode: 'spaced'; romajiSystem: 'hepburn' }) => Promise<string>;
};

const japanesePattern = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u;
let kuroshiroPromise: Promise<KuroshiroInstance | null> | null = null;

export const hasJapaneseText = (text: string): boolean => japanesePattern.test(text);

const normalizeRomanization = (value: string): string | null => {
  const normalized = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
};

const getKuroshiro = async (): Promise<KuroshiroInstance | null> => {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      try {
        const [{ default: Kuroshiro }, { default: KuromojiAnalyzer }] = await Promise.all([
          import('kuroshiro'),
          import('kuroshiro-analyzer-kuromoji'),
        ]);
        const kuroshiro = new Kuroshiro();
        await kuroshiro.init(new KuromojiAnalyzer());
        return kuroshiro;
      } catch {
        return null;
      }
    })();
  }

  return kuroshiroPromise;
};

export const fillMissingRomanization = async (lines: LyricLine[]): Promise<LyricLine[]> => {
  const missingJapaneseLines = lines.filter((line) => !line.romanization && hasJapaneseText(line.text));
  if (missingJapaneseLines.length === 0) {
    return lines;
  }

  const kuroshiro = await getKuroshiro();
  if (!kuroshiro) {
    return lines;
  }

  const converted = new Map<LyricLine, string>();
  await Promise.all(
    missingJapaneseLines.map(async (line) => {
      try {
        const romanization = normalizeRomanization(
          await kuroshiro.convert(line.text, {
            to: 'romaji',
            mode: 'spaced',
            romajiSystem: 'hepburn',
          }),
        );
        if (romanization && romanization !== line.text) {
          converted.set(line, romanization);
        }
      } catch {
        // Romanization is an enhancement; failed conversion must not block lyrics.
      }
    }),
  );

  if (converted.size === 0) {
    return lines;
  }

  return lines.map((line) => {
    const romanization = converted.get(line);
    return romanization ? { ...line, romanization } : line;
  });
};

export const hasMissingRomanization = (lines: LyricLine[]): boolean =>
  lines.some((line) => !line.romanization && hasJapaneseText(line.text));
