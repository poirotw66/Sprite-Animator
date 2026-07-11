import { describe, expect, it } from 'vitest';
import {
  fitEnTitle,
  fitZhDescription,
  fitZhTitle,
  prepareShopListing,
  stripShopMetaNotes,
} from './lineCreatorsListingText';

describe('lineCreatorsListingText', () => {
  it('fits Traditional Chinese titles to 20 characters', () => {
    const long = '奶油獺·日常聊天·戲謔風·加長測試標題還要更長';
    const fitted = fitZhTitle(long);
    expect(fitted.length).toBeLessThanOrEqual(20);
    expect(fitted).toBe('奶油獺·日常聊天·戲謔風');
  });

  it('builds engaging zh description within 80 characters', () => {
    const listing = prepareShopListing({
      titleZh: '柴犬哈士奇·情侶日常',
      titleEn: 'Shiba Husky Couple Daily',
      phrases: ['早安', '想你了', '晚安'],
      themeKey: 'daily',
    });
    expect(listing.titleZh.length).toBeLessThanOrEqual(20);
    expect(listing.descZh.length).toBeLessThanOrEqual(80);
    expect(listing.descZh).toContain('早安');
    expect(listing.descZh).not.toMatch(/模型繪字|程式疊字/);
    expect(listing.descEn).toContain('Sticker set.');
    expect(listing.descEn.length).toBeLessThanOrEqual(160);
    expect(listing.descEn).not.toMatch(/Model Text|programmatic/i);
  });

  it('strips pipeline meta notes from custom descriptions', () => {
    const listing = prepareShopListing({
      titleZh: '校園日常·俏皮篇',
      titleEn: 'School Daily Playful Chat',
      descZh: '校園日常俏皮篇。（模型繪字版）',
      descEn: 'Hand-drawn text version (model).',
      phrases: ['補眠中', '我不行了', '笑死根本沒'],
    });
    expect(listing.descZh).not.toContain('模型繪字');
    expect(listing.descEn).not.toMatch(/model|programmatic/i);
  });

  it('builds school-themed copy from phrase hooks', () => {
    const listing = prepareShopListing({
      titleZh: '校園日常·俏皮篇',
      titleEn: 'School Daily Playful Chat',
      phrases: ['補眠中', '我不行了', '笑死根本沒', '下課沒'],
      themeKey: 'daily',
    });
    expect(listing.descZh).toContain('補眠中');
    expect(listing.descZh).toContain('校園');
    expect(listing.descEn.toLowerCase()).toContain('school-life');
  });

  it('fits English title below 40 characters', () => {
    const fitted = fitEnTitle('Shiba Husky Couple Daily Chat Sticker Collection');
    expect(fitted.length).toBeLessThan(40);
    expect(fitted).toMatch(/^[ -~]+$/);
  });

  it('preserves custom descriptions when already within limits', () => {
    const listing = prepareShopListing({
      titleZh: '奶油貓日常',
      titleEn: 'Cream Cat Daily',
      descZh: '軟萌貓咪陪你聊天。',
      descEn: 'Soft cat vibes for chats.',
    });
    expect(listing.descZh).toBe('軟萌貓咪陪你聊天。');
    expect(listing.descZh.length).toBeLessThanOrEqual(80);
  });

  it('stripShopMetaNotes removes parenthetical pipeline labels', () => {
    expect(stripShopMetaNotes('俏皮篇（模型繪字版）')).toBe('俏皮篇');
    expect(stripShopMetaNotes('Playful (model text version)')).toBe('Playful');
  });

  it('reports warnings when text is trimmed', () => {
    const listing = prepareShopListing({
      titleZh: '這是一個超級無敵長的貼圖標題名稱測試',
      titleEn: 'A Very Long English Title That Should Be Trimmed For LINE',
      descZh: 'x'.repeat(90),
      descEn: 'y'.repeat(200),
    });
    expect(listing.warnings.length).toBeGreaterThan(0);
    expect(listing.descZh.length).toBeLessThanOrEqual(80);
  });
});
