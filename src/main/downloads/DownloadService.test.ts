import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DownloadService } from './DownloadService';

const tempRoots: string[] = [];

const makeToolPath = (): string => {
  const root = join(tmpdir(), `echo-next-download-service-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  tempRoots.push(root);
  const toolPath = join(root, 'yt-dlp.exe');
  writeFileSync(toolPath, 'stub');
  return toolPath;
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('DownloadService yt-dlp probe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it('checks the bundled yt-dlp path with --version', async () => {
    const ytDlpPath = makeToolPath();
    const commandRunner = vi.fn(() => ({
      promise: Promise.resolve({ stdout: '2026.05.01\n', stderr: '', exitCode: 0 }),
      kill: vi.fn(),
    }));
    const service = new DownloadService(commandRunner, () => ytDlpPath);

    const tools = await service.checkTools();

    expect(commandRunner).toHaveBeenCalledWith(ytDlpPath, ['--version']);
    expect(tools.ytDlpAvailable).toBe(true);
    expect(tools.ytDlpVersion).toBe('2026.05.01');
    expect(tools.ytDlpPath).toBe(ytDlpPath);
  });

  it('probes URL metadata before continuing the simulated queue', async () => {
    const ytDlpPath = makeToolPath();
    const commandRunner = vi.fn(() => ({
      promise: Promise.resolve({
        stdout: JSON.stringify({
          title: 'Probe Song',
          duration: 245,
          thumbnail: 'https://img.example/cover.jpg',
          webpage_url: 'https://www.youtube.com/watch?v=probe',
        }),
        stderr: '',
        exitCode: 0,
      }),
      kill: vi.fn(),
    }));
    const service = new DownloadService(commandRunner, () => ytDlpPath);

    const job = service.createUrlJob('https://www.youtube.com/watch?v=probe');
    await flushMicrotasks();

    const probedJob = service.getJobs().find((item) => item.id === job.id)!;
    expect(commandRunner).toHaveBeenCalledWith(ytDlpPath, ['--dump-json', '--no-playlist', 'https://www.youtube.com/watch?v=probe']);
    expect(probedJob.title).toBe('Probe Song');
    expect(probedJob.durationSeconds).toBe(245);
    expect(probedJob.thumbnailUrl).toBe('https://img.example/cover.jpg');

    await vi.advanceTimersByTimeAsync(2600);
    expect(service.getJobs().find((item) => item.id === job.id)?.status).toBe('completed');
  });

  it('marks the job failed when yt-dlp probe fails', async () => {
    const ytDlpPath = makeToolPath();
    const service = new DownloadService(
      () => ({
      promise: Promise.resolve({ stdout: '', stderr: 'Unsupported URL', exitCode: 1 }),
      kill: vi.fn(),
      }),
      () => ytDlpPath,
    );

    const job = service.createUrlJob('https://example.com/video');
    await flushMicrotasks();

    const failedJob = service.getJobs().find((item) => item.id === job.id)!;
    expect(failedJob.status).toBe('failed');
    expect(failedJob.error).toBe('Unsupported URL');
  });

  it('kills an active probe process when the job is cancelled', async () => {
    const ytDlpPath = makeToolPath();
    const kill = vi.fn();
    const service = new DownloadService(
      () => ({
        promise: new Promise(() => {}),
        kill,
      }),
      () => ytDlpPath,
    );

    const job = service.createUrlJob('https://www.bilibili.com/video/BV1ECHO');
    const cancelledJob = service.cancelJob(job.id);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(cancelledJob?.status).toBe('cancelled');
  });
});
