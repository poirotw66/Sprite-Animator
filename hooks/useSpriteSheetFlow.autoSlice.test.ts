import { describe, expect, it, vi } from 'vitest';

import type { SliceSettings } from '../utils/imageUtils';
import type { AutoSliceImageData, AutoSliceScoredCandidate } from '../utils/autoSlice/types';
import {
  applyAutoSliceCandidateToSettings,
  applyAutoSliceHintToSettings,
  buildAutoSliceAttemptKey,
  resolveAutoSlicePipelineForSettings,
} from './autoSliceIntegration';

function createScoredCandidate(): AutoSliceScoredCandidate {
  return {
    candidate: {
      cols: 4,
      rows: 4,
      shiftX: 1,
      shiftY: -1,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    score: 88,
    metrics: {
      bboxStability: 0.9,
      centroidDrift: 0.8,
      foregroundOccupancy: 0.85,
      edgePenalty: 0.9,
      temporalConsistency: 0.8,
    },
  };
}

describe('sprite sheet auto-slice integration helpers', () => {
  const sliceSettings: SliceSettings = {
    cols: 4,
    rows: 4,
    paddingX: 1,
    paddingY: 2,
    paddingLeft: 1,
    paddingRight: 3,
    paddingTop: 2,
    paddingBottom: 4,
    shiftX: 5,
    shiftY: -6,
  };

  it('passes image data and base candidate into the pipeline contract', async () => {
    const imageData: AutoSliceImageData = {
      width: 8,
      height: 8,
      pixels: new Uint8ClampedArray(8 * 8 * 4).fill(255),
    };
    const runPipeline = vi.fn().mockResolvedValue({
      status: 'accepted',
      confidence: 'high',
      selected: createScoredCandidate(),
    });

    const result = await resolveAutoSlicePipelineForSettings(
      'data:image/png;base64,accepted-sheet',
      sliceSettings,
      {
        loadImageData: async () => imageData,
        runPipeline,
        timeoutMs: 321,
      }
    );

    expect(runPipeline).toHaveBeenCalledWith({
      base64Image: 'data:image/png;base64,accepted-sheet',
      cols: 4,
      rows: 4,
      timeoutMs: 321,
      baseCandidate: {
        shiftX: 5,
        shiftY: -6,
        paddingLeft: 1,
        paddingRight: 3,
        paddingTop: 2,
        paddingBottom: 4,
      },
      imageData,
    });
    expect(result).toMatchObject({
      status: 'accepted',
      confidence: 'high',
    });
  });

  it('skips the pipeline when image data is unavailable', async () => {
    const runPipeline = vi.fn();

    const result = await resolveAutoSlicePipelineForSettings(
      'data:image/png;base64,missing-image-data',
      sliceSettings,
      {
        loadImageData: async () => null,
        runPipeline,
      }
    );

    expect(result).toBeNull();
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it('changes attempt key when shift settings change', () => {
    const baseKey = buildAutoSliceAttemptKey('data:image/png;base64,sheet', sliceSettings);
    const shiftedKey = buildAutoSliceAttemptKey('data:image/png;base64,sheet', {
      ...sliceSettings,
      shiftX: sliceSettings.shiftX + 1,
    });

    expect(shiftedKey).not.toBe(baseKey);
  });

  it('changes attempt key when effective padding changes', () => {
    const baseKey = buildAutoSliceAttemptKey('data:image/png;base64,sheet', sliceSettings);
    const paddedKey = buildAutoSliceAttemptKey('data:image/png;base64,sheet', {
      ...sliceSettings,
      paddingLeft: (sliceSettings.paddingLeft ?? 0) + 1,
    });

    expect(paddedKey).not.toBe(baseKey);
  });

  it('maps an accepted candidate back into slice settings', () => {
    const nextSettings = applyAutoSliceCandidateToSettings(sliceSettings, {
      cols: 5,
      rows: 3,
      shiftX: 2,
      shiftY: -3,
      paddingLeft: 6,
      paddingRight: 2,
      paddingTop: 7,
      paddingBottom: 1,
    });

    expect(nextSettings).toMatchObject({
      cols: 5,
      rows: 3,
      shiftX: 2,
      shiftY: -3,
      paddingLeft: 6,
      paddingRight: 2,
      paddingTop: 7,
      paddingBottom: 1,
      paddingX: 4,
      paddingY: 4,
    });
  });

  it('applies fallback hint without overwriting padding settings', () => {
    const nextSettings = applyAutoSliceHintToSettings(sliceSettings, {
      suggestedCols: 6,
      suggestedRows: 2,
      suggestedShiftX: 3,
      suggestedShiftY: 4,
      reason: 'low_confidence',
    });

    expect(nextSettings).toMatchObject({
      cols: 6,
      rows: 2,
      shiftX: 3,
      shiftY: 4,
      paddingX: 1,
      paddingY: 2,
      paddingLeft: 1,
      paddingRight: 3,
      paddingTop: 2,
      paddingBottom: 4,
    });
  });
});
