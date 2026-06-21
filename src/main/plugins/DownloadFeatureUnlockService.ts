import {
  downloadFeatureUnlockFeatureId,
  downloadFeatureUnlockPluginId,
  downloadFeatureUnlockVersion,
  type DownloadFeatureUnlockReason,
  type DownloadFeatureUnlockStatus,
} from '../../shared/constants/featureUnlocks';
import { getPrivateEntitlementsProvider } from './privateEntitlements';

const nowIso = (): string => new Date().toISOString();

export class DownloadFeatureUnlockService {
  getStatus(): DownloadFeatureUnlockStatus {
    const privateStatus = getPrivateEntitlementsProvider()?.getDownloadStatus?.();
    if (privateStatus) {
      return privateStatus;
    }

    const checkedAt = nowIso();
    const baseStatus = {
      featureId: downloadFeatureUnlockFeatureId,
      pluginId: downloadFeatureUnlockPluginId,
      requiredVersion: downloadFeatureUnlockVersion,
      checkedAt,
      pluginInstalled: false,
      pluginEnabled: false,
    } satisfies Omit<DownloadFeatureUnlockStatus, 'reason' | 'unlocked'>;

    return this.finishStatus(baseStatus, false, 'plugin-missing');
  }

  assertUnlocked(): DownloadFeatureUnlockStatus {
    const status = this.getStatus();
    if (!status.unlocked) {
      throw new Error('downloads_plugin_unlock_required');
    }
    return status;
  }

  private finishStatus(
    status: Omit<DownloadFeatureUnlockStatus, 'reason' | 'unlocked'>,
    unlocked: boolean,
    reason: DownloadFeatureUnlockReason,
  ): DownloadFeatureUnlockStatus {
    return { ...status, unlocked, reason };
  }
}

let defaultDownloadFeatureUnlockService: DownloadFeatureUnlockService | null = null;

export const getDownloadFeatureUnlockService = (): DownloadFeatureUnlockService => {
  defaultDownloadFeatureUnlockService ??= new DownloadFeatureUnlockService();
  return defaultDownloadFeatureUnlockService;
};

export const resetDefaultDownloadFeatureUnlockService = (): void => {
  defaultDownloadFeatureUnlockService = null;
};
