import type { ConnectDonatorUnlockStatus } from '../../shared/constants/featureUnlocks';
import {
  createPrivateFeatureError,
  getDefaultConnectDonatorUnlockStatus,
  getPrivateEntitlementsProvider,
} from './privateEntitlements';
import { getPluginService } from './PluginService';

export class ConnectDonatorUnlockService {
  constructor(_userDataPath?: string) {}

  getStatus(): ConnectDonatorUnlockStatus {
    try {
      const proLicenseStatus = getPluginService().getEchoProLicenseStatus();
      if (proLicenseStatus.valid && proLicenseStatus.enabled && proLicenseStatus.features.includes('connect')) {
        return {
          featureId: 'connect',
          pluginId: 'echo.connect-donator-unlock',
          requiredVersion: 'plugin:echo.connect-donator-unlock:v1',
          unlocked: true,
          pluginInstalled: true,
          pluginEnabled: true,
          hwidHash: proLicenseStatus.machineCode,
          reason: 'unlocked',
          checkedAt: proLicenseStatus.checkedAt,
        };
      }
    } catch {
      // If the plugin host is unavailable, keep the feature locked.
    }
    return getPrivateEntitlementsProvider()?.getConnectStatus?.() ?? getDefaultConnectDonatorUnlockStatus();
  }

  async refreshStatus(): Promise<ConnectDonatorUnlockStatus> {
    try {
      const proLicenseStatus = getPluginService().getEchoProLicenseStatus();
      if (proLicenseStatus.valid && proLicenseStatus.enabled && proLicenseStatus.features.includes('connect')) {
        return this.getStatus();
      }
    } catch {
      // Fall back to the private provider/default locked status.
    }
    const provider = getPrivateEntitlementsProvider();
    if (provider?.refreshConnectStatus) {
      return provider.refreshConnectStatus();
    }
    return provider?.getConnectStatus?.() ?? getDefaultConnectDonatorUnlockStatus();
  }

  assertUnlocked(): ConnectDonatorUnlockStatus {
    return this.getStatus();
  }

  close(): void {}
}

let defaultConnectDonatorUnlockService: ConnectDonatorUnlockService | null = null;

export const getConnectDonatorUnlockService = (): ConnectDonatorUnlockService => {
  defaultConnectDonatorUnlockService ??= new ConnectDonatorUnlockService();
  return defaultConnectDonatorUnlockService;
};

export const closeDefaultConnectDonatorUnlockService = (): void => {
  defaultConnectDonatorUnlockService?.close();
  defaultConnectDonatorUnlockService = null;
};
