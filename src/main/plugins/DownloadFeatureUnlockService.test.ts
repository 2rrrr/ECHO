import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadFeatureUnlockStatus } from '../../shared/constants/featureUnlocks';

const mocks = vi.hoisted(() => ({
  downloadStatus: null as DownloadFeatureUnlockStatus | null,
}));

vi.mock('./privateEntitlements', () => ({
  getPrivateEntitlementsProvider: () => ({
    getDownloadStatus: () => mocks.downloadStatus,
  }),
}));

describe('DownloadFeatureUnlockService', () => {
  beforeEach(() => {
    mocks.downloadStatus = null;
    vi.resetModules();
  });

  it('blocks when the downloads unlock plugin is missing', async () => {
    const { DownloadFeatureUnlockService } = await import('./DownloadFeatureUnlockService');
    const service = new DownloadFeatureUnlockService();

    const status = service.getStatus();

    expect(status).toMatchObject({
      unlocked: false,
      pluginInstalled: false,
      pluginEnabled: false,
      reason: 'plugin-missing',
    });
  });

  it('does not unlock from the legacy downloads plugin anymore', async () => {
    const { DownloadFeatureUnlockService } = await import('./DownloadFeatureUnlockService');
    const service = new DownloadFeatureUnlockService();

    const status = service.getStatus();

    expect(status).toMatchObject({
      unlocked: false,
      pluginInstalled: false,
      pluginEnabled: false,
      reason: 'plugin-missing',
    });
  });

  it('unlocks only when the private overlay reports Pro plus plugin authorization', async () => {
    mocks.downloadStatus = {
      featureId: 'downloads',
      pluginId: 'echo.downloads-unlock',
      requiredVersion: 'plugin:echo.downloads-unlock:v1',
      unlocked: true,
      pluginInstalled: true,
      pluginEnabled: true,
      reason: 'unlocked',
      checkedAt: '2026-06-21T00:00:00.000Z',
    };
    const { DownloadFeatureUnlockService } = await import('./DownloadFeatureUnlockService');
    const service = new DownloadFeatureUnlockService();

    expect(service.getStatus()).toMatchObject({
      unlocked: true,
      pluginInstalled: true,
      pluginEnabled: true,
      reason: 'unlocked',
    });
  });

  it('throws the legacy lock error when asserted', async () => {
    const { DownloadFeatureUnlockService } = await import('./DownloadFeatureUnlockService');
    const service = new DownloadFeatureUnlockService();

    expect(() => service.assertUnlocked()).toThrow('downloads_plugin_unlock_required');
  });
});
