// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
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
});
