import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SpriteSheetViewer } from './SpriteSheetViewer';

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      processingChromaKey: 'Processing background removal...',
      spriteSheetTitle: 'Sprite Sheet',
      spriteSheetOriginal: 'Original Preview',
      spriteSheetProcessed: 'Processed Preview',
      showProcessed: 'Show Processed',
      showOriginal: 'Show Original',
      downloadOriginal: 'Download Original',
      downloadProcessed: 'Download Processed',
      spriteSheetEdit: 'Edit sprite sheet',
      spriteSheetPlaceholder: 'Placeholder',
      dragHint: 'Drag hint',
      gridSliceSettings: 'Grid Slice Settings',
      autoCenter: 'Auto Center',
      center: 'Center',
      resetScaleAndShift: 'Reset Scale and Shift',
      resetSettings: 'Reset',
      gridSize: 'Grid Size',
      frames: 'frames',
      cols: 'Cols',
      rows: 'Rows',
      horizontalAxis: 'Horizontal Axis',
      verticalAxis: 'Vertical Axis',
      scalePadding: 'Scale',
      removeEdge: 'Remove edges',
      autoOptimized: 'Auto Optimized',
      shiftPosition: 'Shift',
      fineTunePosition: 'Fine-tune position',
      paddingX: 'Padding X',
      shiftX: 'Shift X',
      paddingY: 'Padding Y',
      shiftY: 'Shift Y',
      cellSize: 'Cell Size',
      effectiveArea: 'Effective Area',
      totalFrames: 'Total Frames',
      autoSliceLowConfidence: 'Auto slice confidence is low.',
      autoSliceSuggestedAdjustment: 'Suggestion: 5x2, X +3, Y -4',
      autoSliceApplySuggestion: 'Apply suggestion and preview',
    },
  }),
}));

describe('SpriteSheetViewer auto-slice hint banner', () => {
  const baseProps = {
    spriteSheetImage: 'data:image/png;base64,test',
    originalSpriteSheet: null,
    isGenerating: false,
    sheetDimensions: { width: 100, height: 80 },
    sliceSettings: {
      cols: 4,
      rows: 4,
      paddingX: 0,
      paddingY: 0,
      shiftX: 0,
      shiftY: 0,
    },
    setSliceSettings: vi.fn(),
    onImageLoad: vi.fn(),
    onDownload: vi.fn(),
  } as const;

  it('renders low-confidence hint content and apply action', () => {
    const html = renderToStaticMarkup(
      React.createElement(SpriteSheetViewer, {
        ...baseProps,
        autoSliceHint: {
          suggestedCols: 5,
          suggestedRows: 2,
          suggestedShiftX: 3,
          suggestedShiftY: -4,
          reason: 'low_confidence',
        },
        onApplyAutoSliceHint: vi.fn(),
      })
    );

    expect(html).toContain('Auto slice confidence is low.');
    expect(html).toContain('Suggestion: 5x2, X +3, Y -4');
    expect(html).toContain('Apply suggestion and preview');
  });

  it('does not render the banner when no hint is present', () => {
    const html = renderToStaticMarkup(React.createElement(SpriteSheetViewer, baseProps));

    expect(html).not.toContain('Apply suggestion and preview');
  });
});
