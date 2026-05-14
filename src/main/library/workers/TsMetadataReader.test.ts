import { describe, expect, it } from 'vitest';
import { decodeWaveInfoText } from './TsMetadataReader';

describe('TsMetadataReader WAV INFO text decoding', () => {
  it('recovers legacy GBK-encoded Japanese WAV INFO text', () => {
    const raw = Buffer.from(
      'd0c78644a4a2a4aba4ea2028b3e0ceb2a4d2a4aba4eb292c20bbcab3c7a5bba5c4a5ca2028b0cb8e86a5a2a5f3a5ca292c20b8df9e81c0e6be772028bec3b1a3a5e6a5eaa5ab292c20b0d8c4bec3c081842028bacd9ae2a4a2a4baceb4292c20967ceb85a4c4a4e0a4ae2028bacdc8aaef4cbba82900',
      'hex',
    );

    expect(decodeWaveInfoText(raw)).toBe(
      '星咲あかり (赤尾ひかる), 皇城セツナ (八巻アンナ), 高瀬梨緒 (久保ユリカ), 柏木美亜 (和氣あず未), 東雲つむぎ (和泉風花)',
    );
  });

  it('keeps ordinary UTF-8 and ASCII WAV INFO text unchanged', () => {
    expect(decodeWaveInfoText(Buffer.from('Transcend Lights\0', 'utf8'))).toBe('Transcend Lights');
    expect(decodeWaveInfoText(Buffer.from('ONGEKI Sound Collection 06\0', 'utf8'))).toBe('ONGEKI Sound Collection 06');
  });
});
