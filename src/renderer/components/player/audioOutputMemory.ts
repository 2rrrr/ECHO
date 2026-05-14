import type { AudioDeviceInfo, AudioLatencyProfile, AudioOutputMode, AudioOutputSettings } from '../../../shared/types/audio';

const storageKey = 'echo-next.audio-output-memory';

export type RememberedAudioOutput = {
  enabled: boolean;
  outputMode: AudioOutputMode;
  latencyProfile?: AudioLatencyProfile;
  deviceIndex?: number;
  deviceName?: string;
};

export const readRememberedAudioOutput = (): RememberedAudioOutput => {
  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return { enabled: false, outputMode: 'shared', latencyProfile: 'stable' };
    }

    const parsed = JSON.parse(raw) as Partial<RememberedAudioOutput>;
    const outputMode = parsed.outputMode === 'exclusive' || parsed.outputMode === 'asio' ? parsed.outputMode : 'shared';
    const latencyProfile =
      parsed.latencyProfile === 'balanced' || parsed.latencyProfile === 'lowLatency' ? parsed.latencyProfile : 'stable';

    return {
      enabled: parsed.enabled === true,
      outputMode,
      latencyProfile,
      deviceIndex: Number.isInteger(Number(parsed.deviceIndex)) ? Number(parsed.deviceIndex) : undefined,
      deviceName: typeof parsed.deviceName === 'string' && parsed.deviceName.trim() ? parsed.deviceName : undefined,
    };
  } catch {
    return { enabled: false, outputMode: 'shared', latencyProfile: 'stable' };
  }
};

export const writeRememberedAudioOutput = (settings: RememberedAudioOutput): void => {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
};

export const createOutputSettings = (
  outputMode: AudioOutputMode,
  device: AudioDeviceInfo | null,
  latencyProfile: AudioLatencyProfile = 'stable',
): AudioOutputSettings => {
  const settings: AudioOutputSettings = { outputMode, latencyProfile };

  if (device) {
    settings.deviceIndex = device.index;
    settings.deviceName = device.name;
  }

  return settings;
};
