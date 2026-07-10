/** Nearest-neighbor upscale / box-filter downscale for chroma-key antialiasing. */

export interface RgbaBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function scaleRgbaNearest(source: RgbaBuffer, factor: number): RgbaBuffer {
  const scale = Math.max(1, Math.floor(factor));
  const width = source.width * scale;
  const height = source.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, Math.floor(x / scale));
      const src = (sy * source.width + sx) * 4;
      const dst = (y * width + x) * 4;
      data[dst] = source.data[src]!;
      data[dst + 1] = source.data[src + 1]!;
      data[dst + 2] = source.data[src + 2]!;
      data[dst + 3] = source.data[src + 3]!;
    }
  }
  return { data, width, height };
}

/** Premultiplied box downscale — softens hard JPEG/chroma edges. */
export function scaleRgbaBoxDown(source: RgbaBuffer, factor: number): RgbaBuffer {
  const scale = Math.max(1, Math.floor(factor));
  const width = Math.floor(source.width / scale);
  const height = Math.floor(source.height / scale);
  const data = new Uint8ClampedArray(width * height * 4);
  const area = scale * scale;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = x * scale + dx;
          const sy = y * scale + dy;
          const src = (sy * source.width + sx) * 4;
          const a = source.data[src + 3]! / 255;
          sumR += source.data[src]! * a;
          sumG += source.data[src + 1]! * a;
          sumB += source.data[src + 2]! * a;
          sumA += a;
        }
      }
      const dst = (y * width + x) * 4;
      const avgA = sumA / area;
      if (avgA <= 0) continue;
      const invAvgA = 1 / avgA;
      data[dst] = Math.round((sumR / area) * invAvgA);
      data[dst + 1] = Math.round((sumG / area) * invAvgA);
      data[dst + 2] = Math.round((sumB / area) * invAvgA);
      data[dst + 3] = Math.round(avgA * 255);
    }
  }
  return { data, width, height };
}
