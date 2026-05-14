// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { LyricsView } from './LyricsView';
import type { LyricsState } from './lyricsTypes';

const makeRect = (top: number, height: number): DOMRect => ({
  bottom: top + height,
  height,
  left: 0,
  right: 320,
  top,
  width: 320,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const lyrics: LyricsState = {
  kind: 'synced',
  source: 'placeholder',
  offsetMs: 0,
  lines: [
    { timeMs: 0, text: 'First line' },
    { timeMs: 1000, text: 'Second line' },
    { timeMs: 2000, text: 'Third line' },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LyricsView', () => {
  it('preserves the active lyric screen position when display settings change', () => {
    let frameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });

    const { container } = render(
      <LyricsView
        durationMs={3000}
        hideEmptyState={false}
        lyrics={lyrics}
        positionMs={1000}
        onSeek={vi.fn()}
      />,
    );
    const scrollContainer = container.querySelector('.lyrics-scroll') as HTMLElement;
    const activeLine = container.querySelector('.lyrics-line[data-active="true"]') as HTMLButtonElement;
    let activeTop = 200;

    Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, 'scrollHeight', { configurable: true, value: 1200 });
    scrollContainer.getBoundingClientRect = vi.fn(() => makeRect(0, 400));
    activeLine.getBoundingClientRect = vi.fn(() => makeRect(activeTop, 42));
    scrollContainer.scrollTop = 120;

    act(() => {
      window.dispatchEvent(new CustomEvent('lyrics:display-settings-changed', { detail: { lyricsFontSizePx: 44 } }));
    });

    activeTop = 164;
    act(() => {
      for (const [id, callback] of Array.from(frames.entries())) {
        frames.delete(id);
        callback(16);
      }
    });

    expect(scrollContainer.scrollTop).toBe(84);
  });
});
