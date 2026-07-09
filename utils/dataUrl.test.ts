import { describe, expect, it } from 'vitest';
import { dataUrlToBase64, parseDataUrlMime } from './dataUrl';

describe('dataUrl', () => {
  it('parses jpeg mime from data url', () => {
    expect(parseDataUrlMime('data:image/jpeg;base64,/9j/4AAQ')).toBe('image/jpeg');
  });

  it('strips base64 prefix for webp', () => {
    expect(dataUrlToBase64('data:image/webp;base64,UklGR')).toBe('UklGR');
  });
});
