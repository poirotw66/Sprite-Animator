import { describe, expect, it } from 'vitest';
import type { SavedProject } from '../types';
import { DEFAULT_CONFIG, DEFAULT_SLICE_SETTINGS } from './constants';
import { parseSavedProject, sortSavedProjects } from './projectHistoryStorage';

function project(id = 'test', createdAt = 1): SavedProject {
  return {
    id, name: id, createdAt,
    config: { ...DEFAULT_CONFIG }, sliceSettings: { ...DEFAULT_SLICE_SETTINGS },
    removeBackground: true, sourceImage: null, spriteSheetImage: null,
    frameModeFrames: [], frameOverrides: [], frameIncluded: [],
  };
}

describe('saved project validation', () => {
  it('preserves valid existing snapshots and frame overrides', () => {
    const snapshot = project();
    snapshot.frameOverrides = [{}, { offsetX: -1, scale: 1.2 }];
    expect(parseSavedProject(snapshot)).toBe(snapshot);
  });

  it.each([null, [], {}, { ...project(), frameModeFrames: [null] },
    { ...project(), config: { ...DEFAULT_CONFIG, speed: NaN } },
    { ...project(), sliceSettings: { ...DEFAULT_SLICE_SETTINGS, cols: 0 } },
    { ...project(), sliceSettings: { ...DEFAULT_SLICE_SETTINGS, manualXBounds: [0, 50, 20] } },
    { ...project(), sliceSettings: { ...DEFAULT_SLICE_SETTINGS, inferredCellRects: [{ x: 0, y: 0, width: -1, height: 3 }] } },
    { ...project(), frameOverrides: [null] },
  ])('rejects invalid editor payload %#', (snapshot) => {
    expect(parseSavedProject(snapshot)).toBeNull();
  });

  it('sorts newest first with stable id ordering for matching timestamps', () => {
    expect(sortSavedProjects([project('old', 1), project('a', 2), project('b', 2)]).map((item) => item.id))
      .toEqual(['b', 'a', 'old']);
  });
});
