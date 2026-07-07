import { describe, expect, it } from 'vitest';
import {
  buildStickerVoicePromptBlock,
  DEFAULT_STICKER_VOICE_KEY,
  listStickerVoiceKeys,
  resolveStickerVoice,
  STICKER_VOICE_PRESETS,
} from './lineStickerVoicePresets';

describe('lineStickerVoicePresets', () => {
  it('includes nishimura as default', () => {
    expect(DEFAULT_STICKER_VOICE_KEY).toBe('nishimura');
    expect(STICKER_VOICE_PRESETS.nishimura).toBeDefined();
  });

  it('includes LINE mascot voice presets', () => {
    expect(STICKER_VOICE_PRESETS.penguin?.label).toContain('企鵝');
    expect(STICKER_VOICE_PRESETS.capoo?.label).toBe('咖波');
    expect(STICKER_VOICE_PRESETS.kana?.label).toBe('卡娜');
  });

  it('resolves known voice', () => {
    const voice = resolveStickerVoice('sweet');
    expect(voice.key).toBe('sweet');
    expect(voice.label).toContain('撒嬌');
  });

  it('uses custom voice context when provided', () => {
    const voice = resolveStickerVoice('nishimura', '老公俠吐槽風格');
    expect(voice.key).toBe('custom');
    expect(voice.intro).toBe('老公俠吐槽風格');
  });

  it('throws on unknown voice', () => {
    expect(() => resolveStickerVoice('unknown-voice')).toThrow(/Unknown voice/);
  });

  it('builds prompt block with examples', () => {
    const block = buildStickerVoicePromptBlock(STICKER_VOICE_PRESETS.meme);
    expect(block).toContain('迷因');
    expect(block).toContain('真香');
  });
});
