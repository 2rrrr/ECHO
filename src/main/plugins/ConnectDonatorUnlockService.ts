import type { ConnectDonatorUnlockStatus } from '../../shared/constants/featureUnlocks';
import {
  createPrivateFeatureError,
  getDefaultConnectDonatorUnlockStatus,
  getPrivateEntitlementsProvider,
} from './privateEntitlements';

export class ConnectDonatorUnlockService {
  constructor(_userDataPath?: string) {}

  getStatus(): ConnectDonatorUnlockStatus {
    return getPrivateEntitlementsProvider()?.getConnectStatus?.() ?? getDefaultConnectDonatorUnlockStatus();
  }

  async refreshStatus(): Promise<ConnectDonatorUnlockStatus> {
    const provider = getPrivateEntitlementsProvider();
    if (provider?.refreshConnectStatus) {
      return provider.refreshConnectStatus();
    }
    return provider?.getConnectStatus?.() ?? getDefaultConnectDonatorUnlockStatus();
  }

  assertUnlocked(): ConnectDonatorUnlockStatus {
    const status = this.getStatus();
    if (!status.unlocked) {
      throw createPrivateFeatureError('echo-pro', 'echo_pro_required');
    }
    return status;
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
