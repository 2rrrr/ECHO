import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizePlaybackFilePath } from './playbackPath';

describe('normalizePlaybackFilePath', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const makeTempRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), 'echo-playback-path-'));
    tempRoots.push(root);
    return root;
  };

  it('decodes percent-encoded local paths only when the decoded path exists', () => {
    const root = makeTempRoot();
    const folder = join(root, 'CloudMusic', '#ncm', 'unlock');
    const title = '\u738b\u83f2 \u6d41\u5e74';
    const decodedPath = join(folder, `${title}.flac`);
    mkdirSync(folder, { recursive: true });
    writeFileSync(decodedPath, 'fake audio');

    const encodedPath = decodedPath.replace(title, encodeURIComponent(title));

    expect(normalizePlaybackFilePath(encodedPath)).toBe(decodedPath);
    expect(normalizePlaybackFilePath(join(folder, '%E7%8E%8B%E8%8F%B2.flac'))).toBe(join(folder, '%E7%8E%8B%E8%8F%B2.flac'));
  });

  it('converts file URLs and leaves streaming URLs untouched', () => {
    const root = makeTempRoot();
    const filePath = join(root, 'space track.flac');
    writeFileSync(filePath, 'fake audio');

    expect(normalizePlaybackFilePath(pathToFileURL(filePath).toString())).toBe(filePath);
    expect(normalizePlaybackFilePath('https://example.test/song.flac?token=%E7%8E%8B')).toBe(
      'https://example.test/song.flac?token=%E7%8E%8B',
    );
  });
});
