import { logger } from './logger';

export interface InterpolationSettings {
  insertFrames: number;
  easing: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out';
  smoothLoop: boolean;
}

const easingFunctions = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

export const blendFrames = async (
  frame1Base64: string,
  frame2Base64: string,
  t: number,
  easing: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out' = 'ease-in-out'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img1 = new Image();
    const img2 = new Image();
    let loaded = 0;

    const onBothLoaded = () => {
      loaded++;
      if (loaded < 2) return;

      try {
        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);

        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const outputCanvas = document.createElement('canvas');

        canvas1.width = canvas2.width = outputCanvas.width = width;
        canvas1.height = canvas2.height = outputCanvas.height = height;

        const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
        const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
        const ctxOut = outputCanvas.getContext('2d', { willReadFrequently: true });

        if (!ctx1 || !ctx2 || !ctxOut) {
          reject(new Error('Canvas context failed'));
          return;
        }

        ctx1.drawImage(img1, 0, 0, width, height);
        ctx2.drawImage(img2, 0, 0, width, height);

        const imageData1 = ctx1.getImageData(0, 0, width, height);
        const imageData2 = ctx2.getImageData(0, 0, width, height);
        const outputData = ctxOut.createImageData(width, height);

        const data1 = imageData1.data;
        const data2 = imageData2.data;
        const dataOut = outputData.data;
        const easedT = easingFunctions[easing](t);

        for (let i = 0; i < data1.length; i += 4) {
          const r1 = data1[i];
          const g1 = data1[i + 1];
          const b1 = data1[i + 2];
          const a1 = data1[i + 3];

          const r2 = data2[i];
          const g2 = data2[i + 1];
          const b2 = data2[i + 2];
          const a2 = data2[i + 3];

          const alpha1 = a1 / 255;
          const alpha2 = a2 / 255;
          const outAlpha = alpha1 * (1 - easedT) + alpha2 * easedT;

          if (outAlpha > 0) {
            const weight1 = alpha1 * (1 - easedT);
            const weight2 = alpha2 * easedT;
            const totalWeight = weight1 + weight2;

            if (totalWeight > 0) {
              dataOut[i] = Math.round((r1 * weight1 + r2 * weight2) / totalWeight);
              dataOut[i + 1] = Math.round((g1 * weight1 + g2 * weight2) / totalWeight);
              dataOut[i + 2] = Math.round((b1 * weight1 + b2 * weight2) / totalWeight);
            } else {
              dataOut[i] = 0;
              dataOut[i + 1] = 0;
              dataOut[i + 2] = 0;
            }
            dataOut[i + 3] = Math.round(outAlpha * 255);
          } else {
            dataOut[i] = 0;
            dataOut[i + 1] = 0;
            dataOut[i + 2] = 0;
            dataOut[i + 3] = 0;
          }
        }

        ctxOut.putImageData(outputData, 0, 0);
        resolve(outputCanvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img1.onload = onBothLoaded;
    img2.onload = onBothLoaded;
    img1.onerror = () => reject(new Error('Failed to load frame 1 for blending'));
    img2.onerror = () => reject(new Error('Failed to load frame 2 for blending'));

    img1.crossOrigin = 'anonymous';
    img2.crossOrigin = 'anonymous';
    img1.src = frame1Base64;
    img2.src = frame2Base64;
  });
};

export const interpolateFrames = async (
  keyframes: string[],
  settings: InterpolationSettings
): Promise<string[]> => {
  if (keyframes.length < 2) return keyframes;

  const { insertFrames, easing, smoothLoop } = settings;
  if (insertFrames <= 0) return keyframes;

  const result: string[] = [];
  const frameCount = keyframes.length;

  for (let i = 0; i < frameCount; i++) {
    result.push(keyframes[i]);
    const nextIndex = (i + 1) % frameCount;
    if (!smoothLoop && i === frameCount - 1) continue;

    for (let j = 1; j <= insertFrames; j++) {
      const t = j / (insertFrames + 1);
      try {
        const blendedFrame = await blendFrames(keyframes[i], keyframes[nextIndex], t, easing);
        result.push(blendedFrame);
      } catch (err) {
        logger.error(`Failed to blend frame ${i} -> ${nextIndex} at t=${t}`, err);
      }
    }
  }

  return result;
};

export const createLoopingAnimation = (
  frames: string[],
  mode: 'loop' | 'pingpong' = 'loop'
): string[] => {
  if (frames.length < 2) return frames;
  if (mode === 'pingpong') {
    const reversed = frames.slice(1, -1).reverse();
    return [...frames, ...reversed];
  }
  return frames;
};

export const generateSmoothAnimation = async (
  keyframes: string[],
  options: {
    interpolationFrames?: number;
    easing?: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out';
    loopMode?: 'loop' | 'pingpong' | 'none';
    targetFps?: number;
    originalFps?: number;
  } = {}
): Promise<string[]> => {
  const {
    interpolationFrames = 2,
    easing = 'ease-in-out',
    loopMode = 'loop',
    targetFps = 24,
    originalFps = 12,
  } = options;

  let framesToInsert = interpolationFrames;
  if (targetFps && originalFps && targetFps > originalFps) {
    framesToInsert = Math.max(1, Math.round(targetFps / originalFps) - 1);
  }

  const interpolatedFrames = await interpolateFrames(keyframes, {
    insertFrames: framesToInsert,
    easing,
    smoothLoop: loopMode === 'loop',
  });

  if (loopMode === 'pingpong') {
    return createLoopingAnimation(interpolatedFrames, 'pingpong');
  }
  return interpolatedFrames;
};
