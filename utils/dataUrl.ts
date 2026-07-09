/** Parse MIME from a data URL (defaults to image/png). */
export function parseDataUrlMime(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? 'image/png';
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
}
