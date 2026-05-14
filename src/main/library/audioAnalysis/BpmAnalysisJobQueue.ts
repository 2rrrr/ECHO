import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { applyTagsToFile } from 'taglib-wasm';
import type { LibraryStore } from '../LibraryStore';
import type { BpmAnalysisJobStatus, BpmAnalysisStartOptions, LibraryTrack } from '../libraryTypes';
import { BpmAnalyzer } from './BpmAnalyzer';

type MutableJobStatus = BpmAnalysisJobStatus;

const maxStoredErrors = 100;
const defaultLimit = 100;
const confidenceThreshold = 0.42;

const nowIso = (): string => new Date().toISOString();

export class BpmAnalysisJobQueue {
  private readonly analyzer: BpmAnalyzer;
  private readonly jobs = new Map<string, MutableJobStatus>();
  private runningJob: Promise<void> | null = null;

  constructor(private readonly store: LibraryStore, dependencies: { analyzer?: BpmAnalyzer } = {}) {
    this.analyzer = dependencies.analyzer ?? new BpmAnalyzer();
  }

  start(options: BpmAnalysisStartOptions = {}): BpmAnalysisJobStatus {
    const id = randomUUID();
    const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? defaultLimit)));
    const targets = this.store.findBpmAnalysisTargets(limit, options.trackIds, options.force === true);
    const job: MutableJobStatus = {
      id,
      status: 'queued',
      totalTracks: targets.length,
      processedTracks: 0,
      updatedTracks: 0,
      errorCount: 0,
      currentTrackTitle: null,
      startedAt: nowIso(),
      finishedAt: null,
      errors: [],
    };
    this.jobs.set(id, job);

    const run = async (): Promise<void> => {
      if (this.runningJob) {
        await this.runningJob.catch(() => undefined);
      }
      await this.runJob(job, targets);
    };

    this.runningJob = run().finally(() => {
      if (this.runningJob) {
        this.runningJob = null;
      }
    });

    return { ...job };
  }

  getStatus(jobId: string): BpmAnalysisJobStatus {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Unknown BPM analysis job ${jobId}`);
    }
    return { ...job, errors: [...job.errors] };
  }

  private async runJob(job: MutableJobStatus, tracks: LibraryTrack[]): Promise<void> {
    job.status = 'running';
    try {
      for (const track of tracks) {
        job.currentTrackTitle = track.title;
        this.store.markTrackAnalyzing(track.id);
        try {
          if (!existsSync(track.path)) {
            throw new Error('track_file_missing');
          }

          const result = await this.analyzer.analyze(track.path, track.duration);
          const status = result.confidence >= confidenceThreshold ? 'complete' : 'low_confidence';
          const bpm = result.bpm > 0 ? result.bpm : null;
          const beatOffsetMs = result.beatOffsetMs >= 0 ? result.beatOffsetMs : null;
          this.store.updateTrackBpmAnalysis(track.id, {
            bpm,
            confidence: result.confidence,
            beatOffsetMs,
            status,
          });
          if (bpm && status === 'complete') {
            await this.writeBpmTag(track.path, bpm).catch((error) => {
              this.pushError(job, `${track.path}: tag: ${error instanceof Error ? error.message : String(error)}`);
            });
          }
          job.updatedTracks += bpm ? 1 : 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.store.updateTrackBpmAnalysis(track.id, {
            bpm: null,
            confidence: 0,
            beatOffsetMs: null,
            status: 'error',
            error: message,
          });
          this.pushError(job, `${track.path}: ${message}`);
        } finally {
          job.processedTracks += 1;
        }
      }

      job.status = 'completed';
      job.finishedAt = nowIso();
      job.currentTrackTitle = null;
    } catch (error) {
      this.pushError(job, error instanceof Error ? error.message : String(error));
      job.status = 'failed';
      job.finishedAt = nowIso();
    }
  }

  private pushError(job: MutableJobStatus, message: string): void {
    job.errorCount += 1;
    job.errors.push(message);
    if (job.errors.length > maxStoredErrors) {
      job.errors.shift();
    }
  }

  private async writeBpmTag(filePath: string, bpm: number): Promise<void> {
    await applyTagsToFile(filePath, { bpm: Math.round(bpm) } as never);
  }
}
