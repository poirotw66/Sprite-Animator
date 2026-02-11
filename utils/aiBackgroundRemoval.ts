import { pipeline, env } from '@huggingface/transformers';
import { logger } from './logger';
import { CHROMA_KEY_COLORS } from './constants';

const ENGINE_VERSION = '2026.02.11.V8.1_STABLE';

// Configure environment
(env as any).allowLocalModels = false;
(env as any).useBrowserCache = true;

// Shared segmenter state
let segmenter: any = null;
let currentModelId: string | null = null;
let lastUsedToken: string | null = null;

/**
 * Initialize and load the AI background removal model.
 */
export async function getSegmenter() {
    // VERSION BANNER - If you see this, the cache is clear!
    console.log(`%c 🚀 [AI ENGINE V8.1 - FINAL] %c STATUS: BOOTING %c VER: ${ENGINE_VERSION} `,
        'background: #7C3AED; color: #FFF; font-weight: bold; padding: 4px; border-radius: 4px 0 0 4px;',
        'background: #8B5CF6; color: #FFF; padding: 4px; border-radius: 0;',
        'background: #A78BFA; color: #1E1B4B; padding: 4px; border-radius: 0 4px 4px 0;'
    );

    // 1. Sanitize Token
    const rawVal = localStorage.getItem('hf_token') || '';
    const hfToken = (rawVal.trim() === 'null' || rawVal.trim() === '') ? null : rawVal.trim();

    // Choose model
    let targetModel = hfToken ? 'briaai/RMBG-2.0' : 'briaai/RMBG-1.4';

    // 2. Set Token in env
    if (hfToken && hfToken.startsWith('hf_')) {
        (env as any).token = hfToken;
        (env as any).allowRemoteModels = true;
    } else {
        (env as any).token = null;
    }

    // 3. Determine if reload is needed
    const needsReload = !segmenter || (currentModelId !== targetModel) || (lastUsedToken !== hfToken);
    if (!needsReload) return segmenter;

    if (segmenter) segmenter = null;

    currentModelId = targetModel;
    lastUsedToken = hfToken;

    // 4. Silent Permission Test (No whoami, direct repo check)
    if (hfToken && targetModel === 'briaai/RMBG-2.0') {
        try {
            logger.info(`Validating library access...`);

            // Testing config file access with cache buster
            const res = await fetch(`https://huggingface.co/briaai/RMBG-2.0/resolve/main/config.json?cache_break=${Date.now()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${hfToken}` },
                cache: 'no-store'
            });

            if (!res.ok) {
                logger.warn(`[HF Auth] 2.0 Access DENIED. Reverting to public model 1.4.`);
                // Force fallback to public model 1.4
                targetModel = 'briaai/RMBG-1.4';
                currentModelId = 'briaai/RMBG-1.4';
                (env as any).token = null;
            } else {
                logger.info(`[HF Auth] 2.0 Access verified.`);
            }
        } catch (e) {
            logger.warn(`[Auth] Permission check failed. Reverting to public model 1.4.`);
            targetModel = 'briaai/RMBG-1.4';
            currentModelId = 'briaai/RMBG-1.4';
            (env as any).token = null;
        }
    }

    logger.info(`Loading: ${targetModel}`);

    try {
        const config: any = {
            device: 'webgpu',
            dtype: 'fp32',
        };

        if (targetModel === 'briaai/RMBG-2.0' && hfToken) {
            config.token = hfToken;
        }

        segmenter = await pipeline('image-segmentation', targetModel, config);
        logger.info(`${targetModel} initialized.`);
        return segmenter;
    } catch (err: any) {
        logger.warn(`${targetModel} load failed. Final fallback to public 1.4...`, err);

        try {
            // Final fallback to 1.4
            segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', { device: 'webgpu', dtype: 'fp32' });
            currentModelId = 'briaai/RMBG-1.4';
            return segmenter;
        } catch (fatal: any) {
            logger.error(`[CRITICAL] All models failed to initialize.`, fatal);
            throw fatal;
        }
    }
}

/**
 * Load image helper
 */
async function loadImageData(url: string): Promise<{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas context failure'));
            ctx.drawImage(img, 0, 0);
            resolve({ canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) });
        };
        img.onerror = () => reject(new Error('Image decode failure'));
        img.src = url;
    });
}

/**
 * Main Background Removal function
 */
export async function removeBackgroundAI(base64Image: string, chromaKeyType?: 'magenta' | 'green'): Promise<string> {
    try {
        const pipe = await getSegmenter();

        // 1. Inference
        const output = await pipe(base64Image);
        const result = Array.isArray(output) ? output[0] : output;
        if (!result) throw new Error('AI produced no result data');

        // 2. Handle original image
        const { canvas, ctx } = await loadImageData(base64Image);
        const { width, height } = canvas;

        // 3. Render mask
        const target = result.mask || result;
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = target.width;
        maskCanvas.height = target.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error('Mask canvas error');

        const totalPixels = target.width * target.height;
        const channels = target.data.length / totalPixels;
        const maskRGBA = new Uint8ClampedArray(totalPixels * 4);

        for (let i = 0; i < totalPixels; ++i) {
            let alpha: number;
            if (channels === 1) alpha = target.data[i];
            else if (channels === 4) alpha = target.data[i * 4 + 3];
            else alpha = (target.data[i * 3] + target.data[i * 3 + 1] + target.data[i * 3 + 2]) / 3;

            maskRGBA[i * 4] = 0;
            maskRGBA[i * 4 + 1] = 0;
            maskRGBA[i * 4 + 2] = 0;
            maskRGBA[i * 4 + 3] = alpha;
        }

        maskCtx.putImageData(new ImageData(maskRGBA, target.width, target.height), 0, 0);

        // 4. Composite
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0, width, height);
        ctx.restore();

        // 5. Cleanup residue
        if (chromaKeyType) {
            const targetColor = CHROMA_KEY_COLORS[chromaKeyType];
            const finalData = ctx.getImageData(0, 0, width, height);
            const pixels = finalData.data;
            const threshold = 120;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] === 0) continue;
                const dr = pixels[i] - targetColor.r;
                const dg = pixels[i + 1] - targetColor.g;
                const db = pixels[i + 2] - targetColor.b;
                const distSq = dr * dr + dg * dg + db * db;

                if (distSq < threshold * threshold) {
                    const factor = distSq / (threshold * threshold);
                    pixels[i + 3] = Math.min(pixels[i + 3], Math.floor(pixels[i + 3] * factor));
                }
            }
            ctx.putImageData(finalData, 0, 0);
        }

        return canvas.toDataURL('image/png');
    } catch (err) {
        logger.error('Background removal failed:', err);
        throw err;
    }
}
