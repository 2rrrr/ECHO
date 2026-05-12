// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AlbumsPage } from './AlbumsPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AlbumsPage', () => {
  it('reads paged albums without grouping tracks in the renderer', async () => {
    const getAlbums = vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 60,
      total: 0,
      hasMore: false,
    });
    const getTracks = vi.fn();

    window.echo = {
      library: {
        getAlbums,
        getTracks,
        getAlbumTracks: vi.fn(),
        getSummary: vi.fn(),
        chooseFolder: vi.fn(),
        addFolder: vi.fn(),
        getFolders: vi.fn(),
        removeFolder: vi.fn(),
        scanFolder: vi.fn(),
        getScanStatus: vi.fn(),
        cancelScan: vi.fn(),
        getDiagnostics: vi.fn(),
      },
    } as unknown as Window['echo'];

    render(<AlbumsPage />);

    await waitFor(() => expect(getAlbums).toHaveBeenCalledWith({ page: 1, pageSize: 60, search: '', sort: 'title' }));
    expect(getTracks).not.toHaveBeenCalled();
  });

  it('loads every album page up front so the album wall has a stable final height', async () => {
    const getAlbums = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            id: 'album-1',
            albumKey: 'artist/album-1',
            title: 'Album 1',
            albumArtist: 'Artist',
            year: 2026,
            trackCount: 1,
            duration: 120,
            coverId: null,
            coverThumb: null,
          },
        ],
        page: 1,
        pageSize: 60,
        total: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'album-2',
            albumKey: 'artist/album-2',
            title: 'Album 2',
            albumArtist: 'Artist',
            year: 2026,
            trackCount: 1,
            duration: 120,
            coverId: null,
            coverThumb: null,
          },
        ],
        page: 2,
        pageSize: 60,
        total: 2,
        hasMore: false,
      });

    window.echo = {
      library: {
        getAlbums,
        getTracks: vi.fn(),
        getAlbumTracks: vi.fn(),
        getSummary: vi.fn(),
        chooseFolder: vi.fn(),
        addFolder: vi.fn(),
        getFolders: vi.fn(),
        removeFolder: vi.fn(),
        scanFolder: vi.fn(),
        getScanStatus: vi.fn(),
        cancelScan: vi.fn(),
        getDiagnostics: vi.fn(),
      },
    } as unknown as Window['echo'];

    render(<AlbumsPage />);

    await waitFor(() => expect(getAlbums).toHaveBeenCalledTimes(2));
    expect(getAlbums).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 60, search: '', sort: 'title' });
    expect(getAlbums).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 60, search: '', sort: 'title' });
  });

  it('renders album coverThumb as a lazy image and stops rendering it after error', async () => {
    const getAlbums = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'album-1',
          albumKey: 'artist/album',
          title: 'Album',
          albumArtist: 'Artist',
          year: 2026,
          trackCount: 1,
          duration: 120,
          coverId: 'cover-1',
          coverThumb: 'echo-cover://album/cover-1',
        },
      ],
      page: 1,
      pageSize: 60,
      total: 1,
      hasMore: false,
    });

    window.echo = {
      library: {
        getAlbums,
        getTracks: vi.fn(),
        getAlbumTracks: vi.fn(),
        getSummary: vi.fn(),
        chooseFolder: vi.fn(),
        addFolder: vi.fn(),
        getFolders: vi.fn(),
        removeFolder: vi.fn(),
        scanFolder: vi.fn(),
        getScanStatus: vi.fn(),
        cancelScan: vi.fn(),
        getDiagnostics: vi.fn(),
      },
    } as unknown as Window['echo'];

    const { container } = render(<AlbumsPage />);

    await waitFor(() => expect(container.querySelector('.album-cover img')).toBeTruthy());
    const img = container.querySelector('.album-cover img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('echo-cover://album/cover-1');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('width')).toBe('320');
    expect(img.getAttribute('height')).toBe('320');
    expect(img.draggable).toBe(false);

    fireEvent.error(img);
    expect(container.querySelector('.album-cover img')).toBeNull();
    expect(container.querySelector('.album-cover')?.getAttribute('data-empty')).toBe('true');
  });
});
