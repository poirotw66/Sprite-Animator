import { describe, expect, it } from 'vitest';
import {
  fitEnTitle,
  fitZhDescription,
  fitZhTitle,
  prepareShopListing,
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
    expect(listing.descEn).toContain('Sticker set.');
    expect(listing.descEn.length).toBeLessThanOrEqual(160);
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
