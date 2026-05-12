// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TrackRow } from './TrackRow';
import type { LibraryTrack } from '../../../shared/types/library';

const track = (overrides: Partial<LibraryTrack> = {}): LibraryTrack => ({
  id: 'track-1',
  path: 'D:\\Music\\song.flac',
  title: 'Afraid',
  artist: '2hollis / Nate Sib',
  album: 'afraid',
  albumArtist: '2hollis / Nate Sib',
  trackNo: 7,
  discNo: 1,
  year: 2025,
  genre: null,
  duration: 178,
  codec: 'flac',
  sampleRate: 96000,
  bitDepth: 24,
  bitrate: 900000,
  coverId: null,
  coverThumb: null,
  fieldSources: {},
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe('TrackRow', () => {
  it('renders the old ECHO-style row with cover, copy, hifi tags, duration, and actions', () => {
    render(<TrackRow isPlaying={false} track={track()} />);

    expect(screen.getByText('Afraid')).toBeTruthy();
    expect(screen.getByText('2hollis / Nate Sib - afraid')).toBeTruthy();
    expect(screen.getByText('FLAC')).toBeTruthy();
    expect(screen.getByText('24bit / 96kHz')).toBeTruthy();
    expect(screen.getByText('900kbps')).toBeTruthy();
    expect(screen.getByText('2:58')).toBeTruthy();
    expect(screen.getByRole('button', { name: '喜欢 Afraid' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '加入队列 Afraid' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '更多 Afraid' })).toBeTruthy();
  });

  it('handles missing cover and playing state safely', () => {
    render(<TrackRow isPlaying track={track({ coverThumb: null })} />);

    expect(screen.getByRole('listitem').getAttribute('data-playing')).toBe('true');
    expect(screen.getByText('Afraid')).toBeTruthy();
  });

  it('calls onPlay from click and double click without action button bubbling', () => {
    const onPlay = vi.fn();
    render(<TrackRow isPlaying={false} track={track()} onPlay={onPlay} />);

    fireEvent.click(screen.getByRole('listitem'));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'track-1' }));

    onPlay.mockClear();
    fireEvent.doubleClick(screen.getByRole('listitem'));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'track-1' }));

    onPlay.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '喜欢 Afraid' }));
    expect(onPlay).not.toHaveBeenCalled();
  });
});
