import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Disc3, Folder, FolderOpen, ListMusic, ListPlus, RefreshCw, Search, UserRound } from 'lucide-react';
import type {
  LibraryInboxAlbumSummary,
  LibraryInboxBatch,
  LibraryInboxFilterKind,
  LibraryInboxItemStatus,
  LibraryInboxIssueReason,
  LibraryInboxScope,
  LibraryInboxStatusFilter,
  LibraryInboxTrackItem,
  LibraryInboxTrackPage,
} from '../../shared/types/library';
import { getLibraryBridge } from '../utils/echoBridge';
import { usePlaybackQueue } from '../stores/PlaybackQueueProvider';
import { useImeAwareDebouncedSearch } from '../utils/imeInput';

const pageSize = 60;

const emptyInboxPage = (scope: LibraryInboxScope, filter: LibraryInboxFilterKind): LibraryInboxTrackPage => ({
  items: [],
  page: 1,
  pageSize,
  total: 0,
  hasMore: false,
  batches: [],
  selectedBatch: null,
  scope,
  filter,
  status: 'all',
  story: {
    trackCount: 0,
    albumCount: 0,
    artistCount: 0,
    folderCount: 0,
    missingCoverCount: 0,
    metadataIssueCount: 0,
    unknownArtistCount: 0,
    unknownAlbumCount: 0,
    suspiciousCount: 0,
    pendingCount: 0,
    processedCount: 0,
    ignoredCount: 0,
    coverCompleteness: 0,
    metadataCompleteness: 0,
    totalDuration: 0,
    topFolders: [],
    topArtists: [],
  },
  albums: [],
  facets: {
    folders: [],
    albums: [],
    artists: [],
  },
});

const filterOptions: Array<{ value: LibraryInboxFilterKind; label: string }> = [
  { value: 'all', label: '全部新增' },
  { value: 'missing_cover', label: '缺封面' },
  { value: 'metadata_issue', label: '资料异常' },
  { value: 'unknown_artist', label: '未知艺人' },
  { value: 'unknown_album', label: '未知专辑' },
  { value: 'suspicious_file', label: '疑似异常' },
];

const statusOptions: Array<{ value: LibraryInboxStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'processed', label: '已处理' },
  { value: 'ignored', label: '已忽略' },
];

const reasonLabels: Record<LibraryInboxIssueReason, string> = {
  missing_cover: '缺封面',
  missing_title: '缺标题',
  missing_artist: '缺艺人',
  missing_album: '缺专辑',
  missing_album_artist: '缺专辑艺人',
  missing_track_no: '缺音轨号',
  missing_disc_no: '缺碟号',
  missing_year: '缺年份',
  missing_genre: '缺流派',
  unknown_artist: '未知艺人',
  filename_fallback: '文件名回退',
  unknown_field: '未知字段',
  metadata_fallback: '元数据回退',
  unknown_album: '未知专辑',
  embedded_metadata_error: '内嵌标签读取失败',
  embedded_cover_error: '内嵌封面读取失败',
  network_metadata_candidate: '网络元数据候选',
  network_cover_candidate: '网络封面候选',
  suspicious_file: '疑似异常',
};

const formatReason = (reason: LibraryInboxIssueReason): string => reasonLabels[reason] ?? reason;

const statusLabels: Record<LibraryInboxItemStatus, string> = {
  pending: '待处理',
  processed: '已处理',
  ignored: '已忽略',
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '尚无记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const folderLabel = (batch: LibraryInboxBatch | null): string => batch?.folderName ?? '最近新增';

const batchSelectValue = (scope: LibraryInboxScope, batchId: string | null): string =>
  scope === 'all' ? '__all__' : scope === 'latest' ? '__latest__' : batchId ?? '__latest__';

const readTrackPath = (item: LibraryInboxTrackItem): string => item.track.path;

const formatDurationHours = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0h';
  }

  const hours = seconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
};

const buildStoryLine = (
  scopeLabel: string,
  story: LibraryInboxTrackPage['story'],
): string => {
  if (story.trackCount <= 0) {
    return '完成一次扫描后，ECHO 会把新增歌曲、专辑和资料问题整理在这里。';
  }

  const pieces = [
    `${scopeLabel}新增 ${story.trackCount} 首`,
    `${story.albumCount} 张专辑`,
    `${story.artistCount} 位艺人`,
  ];
  const warnings = [
    story.missingCoverCount > 0 ? `${story.missingCoverCount} 首缺封面` : null,
    story.metadataIssueCount > 0 ? `${story.metadataIssueCount} 首资料异常` : null,
  ].filter((value): value is string => Boolean(value));

  return `${pieces.join('、')}。${warnings.length > 0 ? `其中 ${warnings.join('、')}。` : '资料看起来很干净。'}`;
};

const albumKey = (album: LibraryInboxAlbumSummary): string => `${album.album}\0${album.albumArtist}`;

const inboxItemKey = (item: Pick<LibraryInboxTrackItem, 'batchId' | 'track'>): string => `${item.batchId}\0${item.track.id}`;

const formatPercent = (value: number): string => `${Math.max(0, Math.min(100, Math.round(value)))}%`;

export const InboxPage = (): JSX.Element => {
  const queue = usePlaybackQueue();
  const [scope, setScope] = useState<LibraryInboxScope>('latest');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryInboxFilterKind>('all');
  const [status, setStatus] = useState<LibraryInboxStatusFilter>('all');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [album, setAlbum] = useState<string | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const {
    search,
    searchInputProps,
    setSearch,
    setSearchInput,
  } = useImeAwareDebouncedSearch(220);
  const [pageData, setPageData] = useState<LibraryInboxTrackPage>(() => emptyInboxPage('latest', 'all'));
  const [items, setItems] = useState<LibraryInboxTrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, LibraryInboxTrackItem>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadInbox = useCallback(
    async (nextPage: number, mode: 'replace' | 'append'): Promise<void> => {
      const library = getLibraryBridge();
      if (!library?.getLibraryInboxTracks) {
        setPageData(emptyInboxPage(scope, filter));
        setItems([]);
        setError('桌面桥接暂不可用，无法读取新歌收件箱。');
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const result = await library.getLibraryInboxTracks({
          scope,
          batchId: scope === 'batch' ? batchId : null,
          filter,
          status,
          folderId,
          album,
          artist,
          page: nextPage,
          pageSize,
          search,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setPageData(result);
        setItems((current) => (mode === 'append' ? [...current, ...result.items] : result.items));
      } catch (loadError) {
        if (requestIdRef.current === requestId) {
          setPageData(emptyInboxPage(scope, filter));
          setItems([]);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [album, artist, batchId, filter, folderId, scope, search, status],
  );

  useEffect(() => {
    void loadInbox(1, 'replace');
  }, [loadInbox]);

  useEffect(() => {
    setSelectedItems({});
  }, [album, artist, batchId, filter, folderId, scope, search, status]);

  useEffect(() => {
    const unsubscribe = getLibraryBridge()?.onLibraryChanged?.(() => {
      void loadInbox(1, 'replace');
    });

    return () => unsubscribe?.();
  }, [loadInbox]);

  const selectedBatch = pageData.selectedBatch;
  const story = pageData.story;
  const albumSummaries = pageData.albums;
  const hasFilters = filter !== 'all' || status !== 'all' || Boolean(folderId || album || artist || search);
  const visibleCount = items.length;
  const selectedItemList = useMemo(() => Object.values(selectedItems), [selectedItems]);
  const selectedCount = selectedItemList.length;
  const allVisibleSelected = items.length > 0 && items.every((item) => Boolean(selectedItems[inboxItemKey(item)]));

  const currentInboxQuery = useMemo(
    () => ({
      scope,
      batchId: scope === 'batch' ? batchId : null,
      filter,
      status,
      folderId,
      album,
      artist,
      search,
    }),
    [album, artist, batchId, filter, folderId, scope, search, status],
  );

  const selectedScopeLabel = useMemo(() => {
    if (scope === 'all') {
      return '最近全部扫描';
    }
    if (scope === 'latest') {
      return '最新扫描';
    }
    return selectedBatch ? folderLabel(selectedBatch) : '指定扫描';
  }, [scope, selectedBatch]);

  const storyLine = useMemo(() => buildStoryLine(selectedScopeLabel, story), [selectedScopeLabel, story]);

  const handleSelectBatch = (value: string): void => {
    setMessage(null);
    setFolderId(null);
    setAlbum(null);
    setArtist(null);

    if (value === '__all__') {
      setScope('all');
      setBatchId(null);
      return;
    }
    if (value === '__latest__') {
      setScope('latest');
      setBatchId(null);
      return;
    }

    setScope('batch');
    setBatchId(value);
  };

  const handleCreatePlaylist = useCallback(async (): Promise<void> => {
    const library = getLibraryBridge();
    if (!library?.createPlaylistFromLibraryInbox) {
      setError('桌面桥接暂不可用，无法生成歌单。');
      return;
    }

    setIsCreatingPlaylist(true);
    setMessage(null);
    setError(null);

    try {
      const result = await library.createPlaylistFromLibraryInbox({
        ...currentInboxQuery,
        name: '新歌待听清单',
      });
      const suffix = result.truncated ? `，已按性能保护加入前 ${result.limit} 首` : '';
      setMessage(`已生成歌单「${result.playlist.name}」，加入 ${result.addedCount} 首${suffix}。`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingPlaylist(false);
    }
  }, [currentInboxQuery]);

  const handleAddToQueue = useCallback(async (): Promise<void> => {
    const library = getLibraryBridge();
    const source = { type: 'manual' as const, label: '新歌收件箱' };

    setIsAddingToQueue(true);
    setMessage(null);
    setError(null);

    try {
      if (selectedItemList.length > 0) {
        queue.appendTracksToQueue(selectedItemList.map((item) => item.track), source);
        setMessage(`已加入队列 ${selectedItemList.length} 首。`);
        return;
      }

      if (!library?.addLibraryInboxToQueue) {
        setError('桌面桥接暂不可用，无法加入队列。');
        return;
      }

      const result = await library.addLibraryInboxToQueue(currentInboxQuery);
      if (result.tracks.length === 0) {
        setError('当前筛选没有可加入队列的本地歌曲。');
        return;
      }

      queue.appendTracksToQueue(result.tracks, source);
      const suffix = result.truncated ? `，已按性能保护加入前 ${result.limit} 首` : '';
      setMessage(`已加入队列 ${result.addedCount} 首${suffix}。`);
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : String(queueError));
    } finally {
      setIsAddingToQueue(false);
    }
  }, [currentInboxQuery, queue, selectedItemList]);

  const handleUpdateState = useCallback(
    async (nextStatus: LibraryInboxItemStatus): Promise<void> => {
      const library = getLibraryBridge();
      if (!library?.updateLibraryInboxItemState) {
        setError('桌面桥接暂不可用，无法更新收件箱状态。');
        return;
      }

      setIsUpdatingState(true);
      setMessage(null);
      setError(null);

      try {
        const result = await library.updateLibraryInboxItemState({
          status: nextStatus,
          items: selectedItemList.length > 0
            ? selectedItemList.map((item) => ({ batchId: item.batchId, trackId: item.track.id }))
            : undefined,
          query: selectedItemList.length > 0 ? undefined : currentInboxQuery,
        });
        setSelectedItems({});
        await loadInbox(1, 'replace');
        const suffix = result.truncated ? `，已按上限处理前 ${result.limit} 首` : '';
        setMessage(`已标记为${statusLabels[nextStatus]} ${result.updatedCount} 首${suffix}。`);
      } catch (stateError) {
        setError(stateError instanceof Error ? stateError.message : String(stateError));
      } finally {
        setIsUpdatingState(false);
      }
    },
    [currentInboxQuery, loadInbox, selectedItemList],
  );

  const handleOpenTrack = useCallback(async (trackId: string): Promise<void> => {
    const library = getLibraryBridge();
    if (!library?.openTrackInFolder) {
      setError('桌面桥接暂不可用，无法定位歌曲。');
      return;
    }

    try {
      await library.openTrackInFolder(trackId);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }, []);

  const clearFilters = (): void => {
    setFilter('all');
    setStatus('all');
    setFolderId(null);
    setAlbum(null);
    setArtist(null);
    setSearchInput('');
    setSearch('');
    setMessage(null);
  };

  const selectAlbumSummary = (summary: LibraryInboxAlbumSummary): void => {
    setMessage(null);
    setAlbum(summary.album === 'Unknown Album' ? null : summary.album);
    setArtist(null);
  };

  const toggleSelectedItem = (item: LibraryInboxTrackItem): void => {
    const key = inboxItemKey(item);
    setSelectedItems((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: item };
    });
  };

  const toggleVisibleSelection = (): void => {
    setSelectedItems((current) => {
      if (allVisibleSelected) {
        const next = { ...current };
        items.forEach((item) => {
          delete next[inboxItemKey(item)];
        });
        return next;
      }

      const next = { ...current };
      items.forEach((item) => {
        next[inboxItemKey(item)] = item;
      });
      return next;
    });
  };

  const openSingleSelected = async (): Promise<void> => {
    const selectedItem = selectedItemList[0];
    if (selectedItemList.length !== 1 || !selectedItem) {
      return;
    }
    await handleOpenTrack(selectedItem.track.id);
  };

  return (
    <div className="inbox-page">
      <header className="inbox-hero">
        <div className="inbox-hero-copy">
          <span className="panel-kicker">Library Inbox</span>
          <h1>新歌收件箱</h1>
          <div className="inbox-hero-meta">
            <span>{selectedScopeLabel}</span>
            <span>{formatDateTime(selectedBatch?.finishedAt ?? pageData.batches[0]?.finishedAt)}</span>
          </div>
        </div>
        <div className="inbox-stats" aria-label="新歌收件箱摘要">
          <span>
            <strong>{pageData.total}</strong>
            <em>当前结果</em>
          </span>
          <span>
            <strong>{selectedBatch?.addedCount ?? pageData.batches.reduce((sum, batch) => sum + batch.addedCount, 0)}</strong>
            <em>新增歌曲</em>
          </span>
          <span>
            <strong>{selectedBatch?.missingCoverCount ?? pageData.batches.reduce((sum, batch) => sum + batch.missingCoverCount, 0)}</strong>
            <em>缺封面</em>
          </span>
        </div>
      </header>

      <section className="inbox-story-panel" aria-label="入库故事">
        <div className="inbox-story-copy">
          <span className="panel-kicker">Import Story</span>
          <strong>{storyLine}</strong>
          <div className="inbox-story-tags">
            {story.topFolders.slice(0, 3).map((folder) => (
              <button key={folder.value} onClick={() => setFolderId(folder.value)} type="button">
                {folder.label} · {folder.count}
              </button>
            ))}
            {story.topArtists.slice(0, 3).map((artistFacet) => (
              <button key={artistFacet.value} onClick={() => setArtist(artistFacet.value)} type="button">
                {artistFacet.label} · {artistFacet.count}
              </button>
            ))}
          </div>
        </div>
        <div className="inbox-story-numbers">
          <span>
            <strong>{story.albumCount}</strong>
            <em>新增专辑</em>
          </span>
          <span>
            <strong>{story.artistCount}</strong>
            <em>新增艺人</em>
          </span>
          <span>
            <strong>{formatDurationHours(story.totalDuration)}</strong>
            <em>总时长</em>
          </span>
        </div>
      </section>

      <section className="inbox-processing-panel" aria-label="本批待处理">
        <div className="inbox-processing-cards">
          <button
            className="inbox-processing-card"
            data-active={status === 'pending' ? 'true' : undefined}
            onClick={() => {
              setFilter('all');
              setStatus('pending');
            }}
            type="button"
          >
            <Clock3 size={18} />
            <span>
              <strong>{story.pendingCount}</strong>
              <em>待听 / 待处理</em>
            </span>
          </button>
          <button
            className="inbox-processing-card"
            data-active={filter === 'missing_cover' ? 'true' : undefined}
            onClick={() => setFilter('missing_cover')}
            type="button"
          >
            <Disc3 size={18} />
            <span>
              <strong>{story.missingCoverCount}</strong>
              <em>缺封面</em>
            </span>
          </button>
          <button
            className="inbox-processing-card"
            data-active={filter === 'metadata_issue' ? 'true' : undefined}
            onClick={() => setFilter('metadata_issue')}
            type="button"
          >
            <CheckCircle2 size={18} />
            <span>
              <strong>{story.metadataIssueCount}</strong>
              <em>资料异常</em>
            </span>
          </button>
          <button
            className="inbox-processing-card"
            data-active={filter === 'suspicious_file' ? 'true' : undefined}
            onClick={() => setFilter('suspicious_file')}
            type="button"
          >
            <AlertTriangle size={18} />
            <span>
              <strong>{story.suspiciousCount}</strong>
              <em>疑似异常文件</em>
            </span>
          </button>
        </div>
        <div className="inbox-quality-summary" aria-label="入库质量摘要">
          <span>
            <strong>{formatPercent(story.coverCompleteness)}</strong>
            <em>封面完整率</em>
          </span>
          <span>
            <strong>{formatPercent(story.metadataCompleteness)}</strong>
            <em>资料完整率</em>
          </span>
          <span>
            <strong>{story.unknownArtistCount + story.unknownAlbumCount}</strong>
            <em>未知艺人 / 专辑</em>
          </span>
          <span>
            <strong>{story.processedCount}</strong>
            <em>已处理</em>
          </span>
        </div>
      </section>

      <section className="inbox-toolbar" aria-label="新歌收件箱筛选">
        <label className="inbox-select-field">
          <span>批次</span>
          <select value={batchSelectValue(scope, batchId)} onChange={(event) => handleSelectBatch(event.target.value)}>
            <option value="__latest__">最新扫描</option>
            <option value="__all__">最近全部扫描</option>
            {pageData.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.folderName} · {batch.addedCount}
              </option>
            ))}
          </select>
        </label>

        <label className="inbox-search-field">
          <Search size={16} />
          <input
            aria-label="搜索新歌收件箱"
            placeholder="搜索标题、艺人、专辑、路径"
            type="search"
            {...searchInputProps}
          />
        </label>

        <button className="inbox-icon-button" disabled={isLoading} onClick={() => void loadInbox(1, 'replace')} title="刷新收件箱" type="button">
          <RefreshCw size={17} />
        </button>
        <button
          className="inbox-command-button"
          disabled={isCreatingPlaylist || pageData.total === 0}
          onClick={() => void handleCreatePlaylist()}
          type="button"
        >
          <ListPlus size={17} />
          <span>生成待听歌单</span>
        </button>
        <button
          className="inbox-command-button"
          disabled={isAddingToQueue || pageData.total === 0}
          onClick={() => void handleAddToQueue()}
          type="button"
        >
          <ListMusic size={17} />
          <span>加入队列</span>
        </button>
      </section>

      <section className="inbox-filter-row" aria-label="问题分类筛选">
        {filterOptions.map((option) => (
          <button
            className="list-filter-chip"
            data-active={filter === option.value ? 'true' : undefined}
            key={option.value}
            onClick={() => {
              setMessage(null);
              setFilter(option.value);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
        {hasFilters ? (
          <button className="list-filter-chip" onClick={clearFilters} type="button">
            清空筛选
          </button>
        ) : null}
      </section>

      <section className="inbox-filter-row" aria-label="处理状态筛选">
        {statusOptions.map((option) => (
          <button
            className="list-filter-chip"
            data-active={status === option.value ? 'true' : undefined}
            key={option.value}
            onClick={() => {
              setMessage(null);
              setStatus(option.value);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="inbox-facet-row" aria-label="新歌收件箱维度筛选">
        <label>
          <Folder size={15} />
          <select value={folderId ?? ''} onChange={(event) => setFolderId(event.target.value || null)}>
            <option value="">全部文件夹</option>
            {pageData.facets.folders.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.label} · {facet.count}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Disc3 size={15} />
          <select value={album ?? ''} onChange={(event) => setAlbum(event.target.value || null)}>
            <option value="">全部专辑</option>
            {pageData.facets.albums.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.label} · {facet.count}
              </option>
            ))}
          </select>
        </label>
        <label>
          <UserRound size={15} />
          <select value={artist ?? ''} onChange={(event) => setArtist(event.target.value || null)}>
            <option value="">全部艺人</option>
            {pageData.facets.artists.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.label} · {facet.count}
              </option>
            ))}
          </select>
        </label>
      </section>

      {albumSummaries.length > 0 ? (
        <section className="inbox-album-wall" aria-label="新增专辑墙">
          <div className="inbox-section-heading">
            <span className="panel-kicker">New Albums</span>
            <strong>新增专辑墙</strong>
          </div>
          <div className="inbox-album-grid">
            {albumSummaries.map((summary) => (
              <button
                className="inbox-album-card"
                key={albumKey(summary)}
                onClick={() => selectAlbumSummary(summary)}
                type="button"
              >
                <span className="inbox-album-art" data-empty={!summary.coverThumb ? 'true' : undefined}>
                  {summary.coverThumb ? <img alt="" loading="lazy" src={summary.coverThumb} /> : <Disc3 size={24} />}
                </span>
                <span className="inbox-album-copy">
                  <strong>{summary.album}</strong>
                  <em>{summary.albumArtist}</em>
                  <small>
                    {summary.trackCount} 首 · {formatDurationHours(summary.duration)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {message ? <div className="inbox-notice">{message}</div> : null}
      {error ? (
        <div className="inbox-notice inbox-notice--error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {items.length > 0 ? (
        <section className="inbox-bulk-bar" aria-label="收件箱批量操作">
          <button className="inbox-selection-toggle" onClick={toggleVisibleSelection} type="button">
            {allVisibleSelected ? '取消本页选择' : '选择本页'}
          </button>
          <span>{selectedCount > 0 ? `已选 ${selectedCount} 首` : `当前筛选 ${pageData.total} 首`}</span>
          <button className="inbox-command-button" disabled={isAddingToQueue} onClick={() => void handleAddToQueue()} type="button">
            <ListMusic size={16} />
            <span>加入队列</span>
          </button>
          <button className="inbox-command-button" disabled={selectedCount !== 1} onClick={() => void openSingleSelected()} type="button">
            <FolderOpen size={16} />
            <span>定位文件</span>
          </button>
          <button className="inbox-command-button" disabled={isUpdatingState} onClick={() => void handleUpdateState('processed')} type="button">
            标记已处理
          </button>
          <button className="inbox-command-button" disabled={isUpdatingState} onClick={() => void handleUpdateState('ignored')} type="button">
            忽略问题
          </button>
          <button className="inbox-command-button" disabled={isUpdatingState} onClick={() => void handleUpdateState('pending')} type="button">
            设为待处理
          </button>
        </section>
      ) : null}

      <section className="inbox-list" aria-label="新歌列表" data-loading={isLoading ? 'true' : undefined}>
        {items.length === 0 ? (
          <div className="inbox-empty-state">
            <strong>{isLoading ? '正在读取收件箱...' : pageData.batches.length === 0 ? '还没有新增记录' : '没有匹配的新歌'}</strong>
            <span>{pageData.batches.length === 0 ? '完成一次曲库扫描后，这里会出现新增歌曲。' : '换个筛选条件再看看。'}</span>
          </div>
        ) : (
          items.map((item) => (
            <article className="inbox-track-row" key={`${item.batchId}:${item.track.id}`}>
              <label className="inbox-row-check">
                <input
                  checked={Boolean(selectedItems[inboxItemKey(item)])}
                  onChange={() => toggleSelectedItem(item)}
                  type="checkbox"
                />
                <span />
              </label>
              <div className="inbox-track-cover" data-empty={!item.track.coverThumb ? 'true' : undefined}>
                {item.track.coverThumb ? <img alt="" loading="lazy" src={item.track.coverThumb} /> : <Disc3 size={20} />}
              </div>
              <div className="inbox-track-main">
                <div className="inbox-track-title">
                  <strong>{item.track.title}</strong>
                  <span>{formatDateTime(item.addedAt)}</span>
                </div>
                <div className="inbox-track-meta">
                  <span>{item.track.artist || 'Unknown Artist'}</span>
                  <span>{item.track.album || 'Unknown Album'}</span>
                </div>
                <div className="inbox-track-path">{readTrackPath(item)}</div>
                <div className="inbox-reason-row">
                  <span data-status={item.inboxStatus}>{statusLabels[item.inboxStatus]}</span>
                  {item.reasons.slice(0, 4).map((reason) => (
                    <span key={reason}>{formatReason(reason)}</span>
                  ))}
                </div>
                {item.reasons.length > 4 ? (
                  <div className="inbox-reason-row">
                    <span>还有 {item.reasons.length - 4} 项</span>
                  </div>
                ) : null}
              </div>
              <button className="inbox-icon-button" onClick={() => void handleOpenTrack(item.track.id)} title="定位歌曲" type="button">
                <FolderOpen size={17} />
              </button>
            </article>
          ))
        )}
      </section>

      {pageData.hasMore ? (
        <button className="inbox-load-more" disabled={isLoading} onClick={() => void loadInbox(pageData.page + 1, 'append')} type="button">
          {isLoading ? '正在读取...' : `继续加载 ${visibleCount}/${pageData.total}`}
        </button>
      ) : null}
    </div>
  );
};
