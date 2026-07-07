import { describe, expect, it } from 'vitest';
import {
  defaultTitleZhFromPhraseSet,
  resolveThemeKey,
  resolveVoiceKey,
  suggestDescZh,
  suggestPhraseSetNameZh,
  suggestSetNameEn,
} from './lineStickerSetNaming';

describe('lineStickerSetNaming', () => {
  it('resolves Chinese voice aliases', () => {
    expect(resolveVoiceKey('企鵝')).toBe('penguin');
    expect(resolveVoiceKey('咖波')).toBe('capoo');
    expect(resolveVoiceKey('戲謔')).toBe('nishimura');
    expect(resolveVoiceKey('nishimura')).toBe('nishimura');
  });

  it('resolves Chinese theme aliases', () => {
    expect(resolveThemeKey('日常')).toBe('daily');
    expect(resolveThemeKey('美食')).toBe('food');
    expect(resolveThemeKey('daily')).toBe('daily');
  });

  it('suggests readable Traditional Chinese set names', () => {
    expect(
      suggestPhraseSetNameZh({
        themeKey: 'daily',
        voiceKey: 'penguin',
      })
    ).toBe('日常聊天·企鵝療癒風');

    expect(
      suggestPhraseSetNameZh({
        themeKey: 'daily',
        voiceKey: 'nishimura',
        characterName: '奶油獺',
      })
    ).toBe('奶油獺·日常聊天');
  });

  it('builds English set slug when title is Chinese', () => {
    expect(
      suggestSetNameEn({
        titleZh: '奶油獺·日常聊天',
        themeKey: 'daily',
        voiceKey: 'nishimura',
        characterName: 'Cream Otter',
      })
    ).toBe('Cream Otter Daily Chat');
  });

  it('defaults shop title from phrase-set name or first phrase', () => {
    expect(defaultTitleZhFromPhraseSet('奶油貓日常', ['早安'])).toBe('奶油貓日常');
    expect(defaultTitleZhFromPhraseSet(undefined, ['又遲到', '晚安'])).toBe('又遲到貼圖');
    expect(defaultTitleZhFromPhraseSet('My Set', ['OK'])).toBe('My Set');
  });

  it('formats description with 貼圖組 suffix', () => {
    expect(suggestDescZh('奶油獺日常')).toBe('奶油獺日常 貼圖組');
    expect(suggestDescZh('已含貼圖組')).toBe('已含貼圖組');
  });
});
