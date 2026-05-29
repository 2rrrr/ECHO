import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosticPerformanceStallPayload } from '../../shared/types/diagnostics';

vi.mock('electron', () => ({
  app: {
    getPath: () => 'D:\\ECHO\\UserData',
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

vi.mock('./ExceptionRecorder', () => ({
  recordDiagnosticConsoleProblem: vi.fn(),
}));

import { beginMainBackgroundTask } from './PlaybackPerformanceDiagnostics';
import { clearDevConsole, getDevConsoleSnapshot, recordPerformanceStall } from './DevConsoleService';

describe('DevConsoleService performance stalls', () => {
  beforeEach(() => {
    clearDevConsole();
  });

  it('adds a probable cause and action hint to stall logs', () => {
    const clearBackgroundTask = beginMainBackgroundTask('data-protection:snapshot');
    const payload: DiagnosticPerformanceStallPayload = {
      source: 'main',
      kind: 'event_loop',
      durationMs: 1250,
      thresholdMs: 750,
      timestamp: '2026-05-29T00:00:00.000Z',
      details: {
        expectedIntervalMs: 1000,
      },
    };

    try {
      const entry = recordPerformanceStall(payload, {
        state: 'idle',
        outputMode: 'system',
      });

      expect(entry?.message).toContain('probableCause: main_background_task');
      expect(entry?.message).toContain('why: main event loop stalled while data-protection:snapshot was active');
      expect(entry?.message).toContain('actionHint: Move or slice this background task');
      const latest = getDevConsoleSnapshot().entries.slice(-1)[0];
      expect(latest?.message).toBe(entry?.message);
    } finally {
      clearBackgroundTask();
    }
  });
});
