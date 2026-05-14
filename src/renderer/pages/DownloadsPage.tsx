import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileAudio, Link2, Search, Settings2, Square, Wrench, XCircle } from 'lucide-react';
import type { DownloadJob, DownloadJobStatus, DownloadSettings, DownloadToolsStatus } from '../../shared/types/downloads';
import { EmptyState } from '../components/ui/EmptyState';
import { getDownloadsBridge } from '../utils/echoBridge';

const terminalStatuses = new Set<DownloadJobStatus>(['completed', 'failed', 'cancelled']);
const runningStatuses = new Set<DownloadJobStatus>(['queued', 'probing', 'downloading', 'extracting_audio', 'tagging', 'importing', 'binding_mv']);

const defaultSettings: DownloadSettings = {
  audioStrategy: 'best_available',
  importToLibrary: false,
  bindMvAfterImport: true,
  outputDirectory: null,
};

const statusLabels: Record<DownloadJobStatus, string> = {
  queued: '排队中',
  probing: '解析链接',
  downloading: '下载模拟中',
  extracting_audio: '提取音频',
  tagging: '写入标签',
  importing: '导入曲库',
  binding_mv: '绑定 MV',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const providerLabels: Record<DownloadJob['provider'], string> = {
  youtube: 'YouTube',
  bilibili: 'Bilibili',
  unknown: 'URL',
};

const formatError = (error: unknown): string => (error instanceof Error ? error.message : String(error || '下载操作失败'));

const formatPath = (path: string | null): string => path || '未设置';

const formatDuration = (seconds: number | null): string | null => {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
};

const ToolStatus = ({ label, ready, detail }: { label: string; ready: boolean; detail: string }): JSX.Element => (
  <span className="download-tool-pill" data-ready={ready}>
    {ready ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
    <strong>{label}</strong>
    <em>{detail}</em>
  </span>
);

const JobRow = ({ job, onCancel }: { job: DownloadJob; onCancel: (jobId: string) => void }): JSX.Element => {
  const canCancel = runningStatuses.has(job.status);
  const duration = formatDuration(job.durationSeconds);

  return (
    <article className="download-job-row" data-status={job.status}>
      <div className="download-job-main">
        <span className="download-job-icon">
          <FileAudio size={18} />
        </span>
        <div className="download-job-copy">
          <strong>{job.title ?? 'Untitled download'}</strong>
          <span title={job.sourceUrl}>{job.sourceUrl}</span>
          {duration ? <small>{duration}</small> : null}
        </div>
        <span className="download-provider-chip">{providerLabels[job.provider]}</span>
      </div>

      <div className="download-job-progress">
        <div className="download-progress-track" aria-label={`${job.progress}%`}>
          <span style={{ width: `${job.progress}%` }} />
        </div>
        <div className="download-job-meta">
          <span>{statusLabels[job.status]}</span>
          <em>{job.progress}%</em>
        </div>
        {job.error ? <p>{job.error}</p> : null}
      </div>

      <button className="download-icon-button" type="button" disabled={!canCancel} onClick={() => onCancel(job.id)} aria-label="取消任务" title="取消任务">
        <Square size={15} />
      </button>
    </article>
  );
};

export const DownloadsPage = (): JSX.Element => {
  const [url, setUrl] = useState('');
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [settings, setSettings] = useState<DownloadSettings>(defaultSettings);
  const [tools, setTools] = useState<DownloadToolsStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'create' | 'clear' | 'tools' | null>(null);

  const bridge = getDownloadsBridge();
  const completedCount = useMemo(() => jobs.filter((job) => terminalStatuses.has(job.status)).length, [jobs]);

  const refreshJobs = useCallback(async (): Promise<void> => {
    if (!bridge?.getJobs) {
      setJobs([]);
      return;
    }

    try {
      setJobs(await bridge.getJobs());
    } catch (jobsError) {
      setError(formatError(jobsError));
    }
  }, [bridge]);

  const refreshTools = useCallback(async (): Promise<void> => {
    if (!bridge?.checkTools) {
      setTools({ ytDlpAvailable: false, ffmpegAvailable: false, ytDlpVersion: null, ytDlpPath: null, ffmpegPath: null });
      return;
    }

    setBusyAction('tools');
    try {
      setTools(await bridge.checkTools());
    } catch (toolsError) {
      setError(formatError(toolsError));
    } finally {
      setBusyAction(null);
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) {
      setError('当前运行环境未暴露下载 IPC。');
      return undefined;
    }

    void refreshJobs();
    void bridge.getSettings?.().then(setSettings).catch((settingsError) => setError(formatError(settingsError)));
    void refreshTools();

    return bridge.onJobsUpdated?.((nextJobs) => {
      setJobs(nextJobs);
    });
  }, [bridge, refreshJobs, refreshTools]);

  const handleCreate = useCallback(async (): Promise<void> => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !bridge?.createUrlJob) {
      return;
    }

    setBusyAction('create');
    setError(null);
    setMessage(null);

    try {
      const job = await bridge.createUrlJob(trimmedUrl, {
        importToLibrary: settings.importToLibrary,
        bindMvAfterImport: settings.bindMvAfterImport,
      });
      setJobs((current) => (current.some((item) => item.id === job.id) ? current : [job, ...current]));
      setUrl('');
      setMessage('已创建任务，正在探测链接。');
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setBusyAction(null);
    }
  }, [bridge, settings, url]);

  const handleCancel = useCallback(
    async (jobId: string): Promise<void> => {
      if (!bridge?.cancelJob) {
        return;
      }

      try {
        const job = await bridge.cancelJob(jobId);
        if (job) {
          setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
        }
      } catch (cancelError) {
        setError(formatError(cancelError));
      }
    },
    [bridge],
  );

  const handleClearCompleted = useCallback(async (): Promise<void> => {
    if (!bridge?.clearCompleted) {
      return;
    }

    setBusyAction('clear');
    setError(null);

    try {
      setJobs(await bridge.clearCompleted());
      setMessage('已清除完成、失败和取消的任务。');
    } catch (clearError) {
      setError(formatError(clearError));
    } finally {
      setBusyAction(null);
    }
  }, [bridge]);

  const patchSettings = useCallback(
    async (patch: Partial<DownloadSettings>): Promise<void> => {
      const nextSettings = { ...settings, ...patch };
      setSettings(nextSettings);

      if (!bridge?.setSettings) {
        return;
      }

      try {
        setSettings(await bridge.setSettings(patch));
      } catch (settingsError) {
        setError(formatError(settingsError));
      }
    },
    [bridge, settings],
  );

  return (
    <div className="downloads-page">
      <header className="downloads-header">
        <div>
          <span className="panel-kicker">Downloader</span>
          <h1>下载</h1>
          <p>第一阶段只创建模拟任务，真实 yt-dlp / ffmpeg 下载将在后续接入。</p>
        </div>
        <button className="downloads-action-button" type="button" onClick={() => void refreshTools()} disabled={busyAction === 'tools'}>
          <Wrench size={16} />
          检测环境
        </button>
      </header>

      <main className="downloads-grid">
        <section className="downloads-panel downloads-url-panel">
          <div className="downloads-section-title">
            <Link2 size={17} />
            <h2>粘贴链接下载</h2>
          </div>
          <div className="downloads-url-box">
            <input
              type="url"
              value={url}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreate();
                }
              }}
            />
            <button className="primary-action" type="button" disabled={!url.trim() || busyAction === 'create'} onClick={() => void handleCreate()}>
              <Download size={16} />
              {busyAction === 'create' ? '创建中' : '加入队列'}
            </button>
          </div>
          {message ? <p className="downloads-note">{message}</p> : null}
          {error ? <p className="downloads-error">{error}</p> : null}
        </section>

        <section className="downloads-panel downloads-search-panel" aria-label="搜索下载">
          <div className="downloads-section-title">
            <Search size={17} />
            <h2>搜索下载</h2>
            <span>Coming soon</span>
          </div>
          <label className="downloads-search-box">
            <Search size={16} />
            <input disabled type="search" placeholder="搜索 YouTube / Bilibili" />
          </label>
        </section>

        <section className="downloads-panel downloads-queue-panel">
          <div className="downloads-section-title downloads-section-title--split">
            <div>
              <Download size={17} />
              <h2>下载队列</h2>
            </div>
            <button className="downloads-action-button" type="button" disabled={completedCount === 0 || busyAction === 'clear'} onClick={() => void handleClearCompleted()}>
              清除已完成
            </button>
          </div>

          <div className="download-job-list">
            {jobs.length === 0 ? (
              <EmptyState icon={Download} title="队列为空" description="粘贴链接后会在这里看到模拟任务状态。" meta="Idle" />
            ) : (
              jobs.map((job) => <JobRow job={job} key={job.id} onCancel={(jobId) => void handleCancel(jobId)} />)
            )}
          </div>
        </section>

        <aside className="downloads-side">
          <section className="downloads-panel">
            <div className="downloads-section-title">
              <Settings2 size={17} />
              <h2>下载设置</h2>
            </div>
            <div className="download-output-path">
              <em>音频策略</em>
              <strong>最高可用音质</strong>
            </div>
            <label className="download-toggle-row">
              <input type="checkbox" checked={settings.importToLibrary} onChange={(event) => void patchSettings({ importToLibrary: event.target.checked })} />
              <span>完成后导入曲库</span>
            </label>
            <label className="download-toggle-row">
              <input type="checkbox" checked={settings.bindMvAfterImport} onChange={(event) => void patchSettings({ bindMvAfterImport: event.target.checked })} />
              <span>导入后绑定源 URL 为 MV</span>
            </label>
            <div className="download-output-path">
              <em>输出目录</em>
              <strong title={formatPath(settings.outputDirectory)}>{formatPath(settings.outputDirectory)}</strong>
            </div>
          </section>

          <section className="downloads-panel">
            <div className="downloads-section-title">
              <Wrench size={17} />
              <h2>环境检测</h2>
            </div>
            <div className="download-tools-list">
              <ToolStatus label="yt-dlp" ready={tools?.ytDlpAvailable ?? false} detail={tools?.ytDlpVersion ?? '未随应用安装'} />
              <ToolStatus label="ffmpeg" ready={tools?.ffmpegAvailable ?? false} detail={tools?.ffmpegPath ?? '未检测到'} />
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
