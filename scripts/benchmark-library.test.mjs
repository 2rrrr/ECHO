import { describe, expect, it } from 'vitest';
import { generateFakeTracks, runBenchmark } from './benchmark-library.mjs';

describe('benchmark-library', () => {
  it('generates fake tracks', () => {
    const tracks = generateFakeTracks(12);

    expect(tracks).toHaveLength(12);
    expect(tracks[0].path).toContain('FakeLibrary');
  });

  it('runs a small fake-data benchmark', () => {
    const result = runBenchmark(25);

    expect(result.tracks).toBe(25);
    expect(result.albumsCount).toBeGreaterThan(0);
    expect(result.unchangedScanSkipped).toBe(25);
  });
});
