import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { EqBridge } from './EqBridge';

const tempDirs: string[] = [];

const createBridge = (): EqBridge => {
  const dir = mkdtempSync(join(tmpdir(), 'echo-next-eq-'));
  tempDirs.push(dir);
  return new EqBridge(dir);
};

const expectedBuiltInCurves: Record<string, { preampDb: number; gains: number[] }> = {
  flat: { preampDb: 0, gains: Array(10).fill(0) as number[] },
  'bass-boost': { preampDb: -8, gains: [7.5, 6.8, 5, 2.3, 0.5, -0.4, -1, -1.6, -2.2, -2.8] },
  'vocal-clear': { preampDb: -6, gains: [-6, -5, -3, 0.5, 2.8, 4.5, 3.8, 2, -0.8, -2.8] },
  'treble-sparkle': { preampDb: -7, gains: [-3, -2.5, -1.8, -0.8, 0, 0.8, 2.8, 4.8, 6.2, 5.5] },
  loudness: { preampDb: -8, gains: [7.5, 6.8, 4.4, 1.2, -1.6, -1.8, 0.6, 2.8, 4.6, 5.2] },
  night: { preampDb: -2, gains: [-6.5, -5.8, -3.6, -1.2, 0, 1.2, 0.6, -1.8, -4.5, -6.5] },
  'headphone-warm': { preampDb: -6, gains: [5, 5.3, 4, 2, 0.5, -0.4, -1.1, -1.8, -2.6, -3.5] },
  'anime-jpop': { preampDb: -6, gains: [3, 2.3, 0.5, -1.8, -2.2, 1.2, 3.8, 5.5, 4.6, 2.2] },
  rock: { preampDb: -6, gains: [5.5, 4.6, 1.8, -2, -3, -0.6, 2.2, 4.5, 3.8, 2] },
  classical: { preampDb: -4, gains: [1.8, 1.4, 0.3, -0.4, -1, -0.5, 1, 2.8, 3.5, 2.2] },
  'harman-target': { preampDb: -6, gains: [6, 5.8, 4.5, 2, 0.5, 0, 2.5, 3.5, 2, 0.5] },
  'harman-in-ear': { preampDb: -8, gains: [8, 7, 5.5, 2.5, 0, -0.5, 2.5, 4, 3, 1.5] },
  'diffuse-field': { preampDb: -7, gains: [-5.5, -4.8, -2.8, -0.8, 0.6, 2, 5.5, 6.2, 3.8, 0.8] },
  'bk-room-curve': { preampDb: -6, gains: [5.5, 4.8, 3.4, 1.7, 0.5, -0.8, -2, -3.2, -4.4, -5.4] },
  'studio-neutral': { preampDb: -2, gains: [-1.5, -1.8, -1, -0.2, 0.2, 1.1, 2, 1.6, 0.2, -1.2] },
  'classic-smiley': { preampDb: -8, gains: [7, 6, 3, -2.8, -4.5, -3.2, 1, 4, 6.2, 7] },
  'vinyl-warmth': { preampDb: -6, gains: [5, 4.4, 2.8, 1, 0, -0.7, -1.6, -2.8, -4, -5.2] },
  'broadcast-voice': { preampDb: -6, gains: [-8, -6.5, -3.4, 1.5, 4, 5.5, 4.4, 1.5, -2.5, -5.5] },
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('EqBridge protocol validation', () => {
  it('rejects invalid band indexes', async () => {
    const bridge = createBridge();

    await expect(bridge.setBandGain({ band: 99, gainDb: 2 })).rejects.toThrow('invalid_eq_band_index');
  });

  it('clamps gain and preamp ranges before updating state', async () => {
    const bridge = createBridge();

    await bridge.setBandGain({ band: 2, gainDb: 50 });
    await bridge.setPreamp(-40);

    const state = bridge.getState();
    expect(state.bands[2].gainDb).toBe(12);
    expect(state.preampDb).toBe(-12);
  });

  it('clamps editable band frequencies before updating state', async () => {
    const bridge = createBridge();

    await bridge.setBandFrequency({ band: 2, frequencyHz: 50000 });

    expect(bridge.getState().bands[2].frequencyHz).toBe(20000);
  });

  it('refuses malformed preset data', () => {
    const bridge = createBridge();

    expect(() =>
      bridge.savePreset({
        name: 'Broken',
        preampDb: 0,
        bands: [{ frequencyHz: 31, gainDb: 0, q: 1 }],
      }),
    ).toThrow('invalid_eq_preset');
  });

  it('persists user presets outside the audio callback path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echo-next-eq-'));
    tempDirs.push(dir);
    const bridge = new EqBridge(dir);
    const state = bridge.getState();

    bridge.savePreset({
      name: 'Desk Headphones',
      preampDb: -2,
      bands: state.bands,
    });

    const reloaded = new EqBridge(dir);
    expect(reloaded.listPresets().some((preset) => preset.name === 'Desk Headphones')).toBe(true);
  });

  it('includes professional target curves as read-only built-in presets', async () => {
    const bridge = createBridge();
    const presets = bridge.listPresets();
    const harman = presets.find((preset) => preset.id === 'harman-target');
    const classicSmiley = presets.find((preset) => preset.id === 'classic-smiley');

    expect(harman).toMatchObject({
      name: 'Harman Target',
      preampDb: -6,
      readonly: true,
    });
    expect(harman?.bands.map((band) => band.gainDb)).toEqual(expectedBuiltInCurves['harman-target'].gains);
    expect(classicSmiley).toMatchObject({
      name: 'Classic Smiley',
      readonly: true,
    });

    await bridge.setPreset('harman-target');

    expect(bridge.getState()).toMatchObject({
      presetId: 'harman-target',
      presetName: 'Harman Target',
      preampDb: -6,
    });
  });

  it('keeps every built-in preset locked to intentional 10-band curve data', () => {
    const bridge = createBridge();
    const builtInPresets = bridge.listPresets().filter((preset) => preset.readonly);

    expect(builtInPresets).toHaveLength(Object.keys(expectedBuiltInCurves).length);
    for (const preset of builtInPresets) {
      const expected = expectedBuiltInCurves[preset.id];
      expect(expected, preset.name).toBeDefined();
      expect(preset.preampDb, preset.name).toBe(expected.preampDb);
      expect(preset.bands).toHaveLength(10);
      expect(preset.bands.map((band) => band.gainDb), preset.name).toEqual(expected.gains);

      if (preset.id === 'flat') {
        continue;
      }

      const gains = preset.bands.map((band) => band.gainDb);
      expect(Math.max(...gains) - Math.min(...gains), preset.name).toBeGreaterThanOrEqual(3.5);
      expect(gains.filter((gainDb) => Math.abs(gainDb) >= 1).length, preset.name).toBeGreaterThanOrEqual(6);
    }
  });

  it('clamps channel balance parameters before updating state', async () => {
    const bridge = createBridge();

    await bridge.setChannelBalanceState({
      enabled: true,
      balance: 5,
      leftGainDb: -80,
      rightGainDb: 12,
      monoMode: 'sum',
      constantPower: false,
    });

    expect(bridge.getChannelBalanceState()).toMatchObject({
      enabled: true,
      balance: 1,
      leftGainDb: -12,
      rightGainDb: 6,
      monoMode: 'sum',
      constantPower: false,
    });
  });

  it('resets channel balance to a transparent default', async () => {
    const bridge = createBridge();

    await bridge.setChannelBalanceState({
      enabled: true,
      balance: -0.5,
      swapLeftRight: true,
      monoMode: 'left',
      invertRight: true,
    });
    await bridge.resetChannelBalance();

    expect(bridge.getChannelBalanceState()).toMatchObject({
      enabled: false,
      balance: 0,
      leftGainDb: 0,
      rightGainDb: 0,
      swapLeftRight: false,
      monoMode: 'off',
      invertLeft: false,
      invertRight: false,
      constantPower: true,
    });
  });
});
