import { describe, expect, it } from 'vitest';
import { createEmptyComicProject } from './comicPanelSchema';
import {
  buildComicDownloadFilename,
  pickComicCharacterLabel,
  sanitizeComicFilenameSegment,
} from './comicDownloadFilenames';

describe('comicDownloadFilenames', () => {
  it('uses character concept for the filename label', () => {
    const project = createEmptyComicProject();
    project.characterConcept = '圓潤奶油色水獺，頑皮愛撒嬌';
    expect(pickComicCharacterLabel(project)).toBe('圓潤奶油色水獺，頑皮愛撒嬌');
    expect(
      buildComicDownloadFilename(project, 'character-sheet', Date.parse('2026-07-09T14:30:00'))
    ).toBe('一頁式漫畫_圓潤奶油色水獺，頑皮愛撒嬌_設定圖_20260709-1430.png');
  });

  it('falls back to synopsis when concept is empty', () => {
    const project = createEmptyComicProject();
    project.synopsis = '狐狸上班一路出包';
    expect(
      buildComicDownloadFilename(project, 'page', Date.parse('2026-07-09T09:05:00'))
    ).toBe('一頁式漫畫_狐狸上班一路出包_四格漫畫頁_20260709-0905.png');
  });

  it('strips forbidden filesystem characters', () => {
    expect(sanitizeComicFilenameSegment('bad/name:test')).toBe('badnametest');
  });

  it('uses generic name when no label is available', () => {
    const project = createEmptyComicProject();
    expect(
      buildComicDownloadFilename(project, 'page', Date.parse('2026-07-09T00:00:00'))
    ).toBe('一頁式漫畫_四格漫畫頁_20260709-0000.png');
  });
});
