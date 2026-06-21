import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPrivateEntitlementsProvider,
  getDefaultConnectDonatorUnlockStatus,
  installPrivateEntitlementsProvider,
} from './privateEntitlements';
import { ConnectDonatorUnlockService } from './ConnectDonatorUnlockService';

describe('ConnectDonatorUnlockService public stub', () => {
  afterEach(() => {
    clearPrivateEntitlementsProvider();
  });

  it('stays locked when the private entitlement overlay is not installed', async () => {
    const service = new ConnectDonatorUnlockService();

    expect(service.getStatus()).toMatchObject({
      unlocked: false,
      pluginInstalled: false,
      pluginEnabled: false,
      reason: 'license-invalid',
      hwidHash: 'private-overlay',
    });
    await expect(service.refreshStatus()).resolves.toMatchObject({ unlocked: false });
    expect(() => service.assertUnlocked()).toThrow('echo_pro_required');
  });

  it('delegates status checks to an installed private entitlement overlay', async () => {
    const unlockedStatus = {
      ...getDefaultConnectDonatorUnlockStatus(),
      unlocked: true,
      reason: 'unlocked' as const,
      hwidHash: 'overlay-owned',
    };
    installPrivateEntitlementsProvider({
      getConnectStatus: () => unlockedStatus,
      refreshConnectStatus: async () => unlockedStatus,
    });

    const service = new ConnectDonatorUnlockService();

    expect(service.getStatus()).toBe(unlockedStatus);
    await expect(service.refreshStatus()).resolves.toBe(unlockedStatus);
    expect(service.assertUnlocked()).toBe(unlockedStatus);
  });
});
