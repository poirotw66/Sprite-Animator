import { describe, expect, it } from 'vitest';

import {
  parseBoolFlag,
  resolvePipelineSteps,
  resolveSubmitEnabled,
} from './uploadPipeline.mts';

describe('uploadPipeline', () => {
  it('parseBoolFlag accepts common truthy/falsy strings', () => {
    expect(parseBoolFlag('true', false)).toBe(true);
    expect(parseBoolFlag('false', true)).toBe(false);
    expect(parseBoolFlag(undefined, true)).toBe(true);
  });

  it('resolveSubmitEnabled honors CLI over env', () => {
    expect(
      resolveSubmitEnabled({
        step: 'all',
        cliSubmit: 'false',
        envSubmit: 'true',
      })
    ).toBe(false);
  });

  it('resolvePipelineSteps omits submit when disabled', () => {
    expect(resolvePipelineSteps('all', false)).toEqual(['gdrive', 'provision', 'zip']);
    expect(resolvePipelineSteps('all', true)).toEqual([
      'gdrive',
      'provision',
      'zip',
      'submit',
    ]);
    expect(resolvePipelineSteps('submit', false)).toEqual(['submit']);
  });
});
