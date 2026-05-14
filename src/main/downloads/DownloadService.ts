import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';
import type {
  CreateDownloadUrlJobOptions,
  DownloadJob,
  DownloadJobStatus,
  DownloadSettings,
  DownloadSourceProvider,
  DownloadToolsStatus,
} from '../../shared/types/downloads';

const defaultSettings: DownloadSettings = {
  audioStrategy: 'best_available',
  importToLibrary: false,
  bindMvAfterImport: true,
  outputDirectory: null,
};

const terminalStatuses = new Set<DownloadJobStatus>(['completed', 'failed', 'cancelled']);
const cancellableStatuses = new Set<DownloadJobStatus>(['queued', 'probing', 'downloading', 'extracting_audio', 'tagging', 'importing', 'binding_mv']);

const simulationSteps: Array<{ status: DownloadJobStatus; progress: number }> = [
  { status: 'downloading', progress: 32 },
  { status: 'downloading', progress: 58 },
  { status: 'downloading', progress: 78 },
  { status: 'extracting_audio', progress: 92 },
  { status: 'completed', progress: 100 },
];

const inferProvider = (url: string): DownloadSourceProvider => {
  const normalized = url.toLowerCase();

  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
    return 'youtube';
  }

  if (normalized.includes('bilibili.com') || normalized.includes('b23.tv')) {
    return 'bilibili';
  }

  return 'unknown';
};

const cloneJob = (job: DownloadJob): DownloadJob => ({ ...job });

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type RunningCommand = {
  promise: Promise<CommandResult>;
  kill: () => void;
};

type CommandRunner = (command: string, args: string[]) => RunningCommand;

type ToolResolver = () => string | null;

type YtDlpProbeResult = {
  title?: unknown;
  duration?: unknown;
  thumbnail?: unknown;
  webpage_url?: unknown;
};

const maxCommandOutputBytes = 1024 * 1024 * 4;

const ytDlpFileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

const getProcessResourcesPath = (): string | null => {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return typeof resourcesPath === 'string' && resourcesPath.trim() ? resourcesPath : null;
};

const resolveBundledYtDlpPath: ToolResolver = () => {
  const resourcesPath = getProcessResourcesPath();
  const candidates = [
    resourcesPath ? resolve(resourcesPath, 'tools', ytDlpFileName) : null,
    resourcesPath ? resolve(resourcesPath, ytDlpFileName) : null,
    resolve(process.cwd(), 'electron-app', 'tools', ytDlpFileName),
    resolve(process.cwd(), 'tools', ytDlpFileName),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const runCommand: CommandRunner = (command, args) => {
  const child = spawn(command, args, {
    windowsHide: true,
    shell: false,
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;

  const appendChunk = (chunks: Buffer[], chunk: Buffer, currentBytes: number): number => {
    if (currentBytes >= maxCommandOutputBytes) {
      return currentBytes;
    }

    const remaining = maxCommandOutputBytes - currentBytes;
    const nextChunk = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
    chunks.push(nextChunk);
    return currentBytes + nextChunk.byteLength;
  };

  const promise = new Promise<CommandResult>((resolve) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBytes = appendChunk(stdoutChunks, chunk, stdoutBytes);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBytes = appendChunk(stderrChunks, chunk, stderrBytes);
    });
    child.on('error', (error) => {
      resolve({ stdout: '', stderr: error.message, exitCode: -1 });
    });
    child.on('close', (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode,
      });
    });
  });

  return {
    promise,
    kill: () => {
      if (!child.killed) {
        child.kill();
      }
    },
  };
};

export class DownloadService extends EventEmitter {
  private jobs: DownloadJob[] = [];

  private settings: DownloadSettings = { ...defaultSettings };

  private timers = new Map<string, NodeJS.Timeout>();

  private runningCommands = new Map<string, RunningCommand>();

  constructor(
    private readonly commandRunner: CommandRunner = runCommand,
    private readonly ytDlpPathResolver: ToolResolver = resolveBundledYtDlpPath,
  ) {
    super();
  }

  getJobs(): DownloadJob[] {
    return this.jobs.map(cloneJob);
  }

  createUrlJob(url: string, options: CreateDownloadUrlJobOptions = {}): DownloadJob {
    const sourceUrl = url.trim();

    if (!sourceUrl) {
      throw new Error('download URL must be a non-empty string');
    }

    const now = new Date().toISOString();
    const job: DownloadJob = {
      id: randomUUID(),
      sourceUrl,
      provider: inferProvider(sourceUrl),
      audioStrategy: this.settings.audioStrategy,
      status: 'queued',
      title: null,
      durationSeconds: null,
      thumbnailUrl: null,
      webpageUrl: null,
      progress: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    this.jobs = [job, ...this.jobs];
    this.emitJobs();
    this.startProbe(job.id);
    return cloneJob(job);
  }

  cancelJob(jobId: string): DownloadJob | null {
    const job = this.jobs.find((item) => item.id === jobId);

    if (!job) {
      return null;
    }

    if (!cancellableStatuses.has(job.status)) {
      return cloneJob(job);
    }

    this.clearTimer(jobId);
    this.clearCommand(jobId);
    this.updateJob(jobId, {
      status: 'cancelled',
      error: null,
      completedAt: new Date().toISOString(),
    });
    return cloneJob(this.jobs.find((item) => item.id === jobId)!);
  }

  clearCompleted(): DownloadJob[] {
    for (const job of this.jobs) {
      if (terminalStatuses.has(job.status)) {
        this.clearTimer(job.id);
        this.clearCommand(job.id);
      }
    }

    this.jobs = this.jobs.filter((job) => !terminalStatuses.has(job.status));
    this.emitJobs();
    return this.getJobs();
  }

  getSettings(): DownloadSettings {
    return { ...this.settings };
  }

  setSettings(patch: Partial<DownloadSettings>): DownloadSettings {
    const nextSettings: DownloadSettings = {
      ...this.settings,
      ...patch,
      audioStrategy: 'best_available',
      outputDirectory:
        typeof patch.outputDirectory === 'string'
          ? patch.outputDirectory.trim() || null
          : patch.outputDirectory === null
            ? null
            : this.settings.outputDirectory,
      importToLibrary: typeof patch.importToLibrary === 'boolean' ? patch.importToLibrary : this.settings.importToLibrary,
      bindMvAfterImport: typeof patch.bindMvAfterImport === 'boolean' ? patch.bindMvAfterImport : this.settings.bindMvAfterImport,
    };

    this.settings = nextSettings;
    return this.getSettings();
  }

  async checkTools(): Promise<DownloadToolsStatus> {
    const ffmpegPath = typeof ffmpegStaticPath === 'string' && ffmpegStaticPath.length > 0 ? ffmpegStaticPath : null;
    const ytDlpPath = this.ytDlpPathResolver();
    let ytDlpVersion: string | null = null;

    if (ytDlpPath && existsSync(ytDlpPath)) {
      const result = await this.commandRunner(ytDlpPath, ['--version']).promise;
      if (result.exitCode === 0) {
        ytDlpVersion = result.stdout.trim().split(/\s+/)[0] || null;
      }
    }

    return {
      ytDlpAvailable: Boolean(ytDlpVersion),
      ffmpegAvailable: Boolean(ffmpegPath && existsSync(ffmpegPath)),
      ytDlpVersion,
      ytDlpPath,
      ffmpegPath,
    };
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
    for (const command of this.runningCommands.values()) {
      command.kill();
    }
    this.runningCommands.clear();
  }

  private startProbe(jobId: string): void {
    this.updateJob(jobId, { status: 'probing', progress: 12 });

    const ytDlpPath = this.ytDlpPathResolver();
    if (!ytDlpPath || !existsSync(ytDlpPath)) {
      this.updateJob(jobId, { title: 'Untitled download' });
      this.scheduleSimulation(jobId, 0);
      return;
    }

    const command = this.commandRunner(ytDlpPath, ['--dump-json', '--no-playlist', this.jobs.find((job) => job.id === jobId)?.sourceUrl ?? '']);
    this.runningCommands.set(jobId, command);
    void command.promise.then((result) => {
      if (this.runningCommands.get(jobId) !== command) {
        return;
      }

      this.runningCommands.delete(jobId);
      const job = this.jobs.find((item) => item.id === jobId);
      if (!job || terminalStatuses.has(job.status)) {
        return;
      }

      if (result.exitCode !== 0) {
        this.updateJob(jobId, {
          status: 'failed',
          progress: 100,
          error: result.stderr.trim() || 'yt-dlp probe failed',
          completedAt: new Date().toISOString(),
        });
        return;
      }

      const metadata = this.parseProbeResult(result.stdout);
      this.updateJob(jobId, {
        title: metadata.title,
        durationSeconds: metadata.durationSeconds,
        thumbnailUrl: metadata.thumbnailUrl,
        webpageUrl: metadata.webpageUrl,
      });
      this.scheduleSimulation(jobId, 0);
    });
  }

  private scheduleSimulation(jobId: string, stepIndex: number): void {
    this.clearTimer(jobId);

    const job = this.jobs.find((item) => item.id === jobId);
    if (!job || terminalStatuses.has(job.status) || stepIndex >= simulationSteps.length) {
      return;
    }

    const delayMs = 300 + Math.floor(Math.random() * 201);
    const timer = setTimeout(() => {
      this.timers.delete(jobId);
      const step = simulationSteps[stepIndex];
      const completedAt = step.status === 'completed' ? new Date().toISOString() : null;

      this.updateJob(jobId, {
        status: step.status,
        progress: step.progress,
        title: job.title ?? 'Untitled download',
        completedAt,
      });

      if (!terminalStatuses.has(step.status)) {
        this.scheduleSimulation(jobId, stepIndex + 1);
      }
    }, delayMs);

    this.timers.set(jobId, timer);
  }

  private updateJob(jobId: string, patch: Partial<DownloadJob>): void {
    this.jobs = this.jobs.map((job) =>
      job.id === jobId
        ? {
            ...job,
            ...patch,
            progress: Math.max(0, Math.min(100, patch.progress ?? job.progress)),
            updatedAt: new Date().toISOString(),
          }
        : job,
    );
    this.emitJobs();
  }

  private emitJobs(): void {
    this.emit('jobs-updated', this.getJobs());
  }

  private clearTimer(jobId: string): void {
    const timer = this.timers.get(jobId);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  private clearCommand(jobId: string): void {
    const command = this.runningCommands.get(jobId);

    if (command) {
      command.kill();
      this.runningCommands.delete(jobId);
    }
  }

  private parseProbeResult(stdout: string): Pick<DownloadJob, 'title' | 'durationSeconds' | 'thumbnailUrl' | 'webpageUrl'> {
    try {
      const parsed = JSON.parse(stdout) as YtDlpProbeResult;
      const duration = Number(parsed.duration);

      return {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Untitled download',
        durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
        thumbnailUrl: typeof parsed.thumbnail === 'string' && parsed.thumbnail.trim() ? parsed.thumbnail.trim() : null,
        webpageUrl: typeof parsed.webpage_url === 'string' && parsed.webpage_url.trim() ? parsed.webpage_url.trim() : null,
      };
    } catch {
      return {
        title: 'Untitled download',
        durationSeconds: null,
        thumbnailUrl: null,
        webpageUrl: null,
      };
    }
  }
}

let downloadService: DownloadService | null = null;

export const getDownloadService = (): DownloadService => {
  downloadService ??= new DownloadService();
  return downloadService;
};
