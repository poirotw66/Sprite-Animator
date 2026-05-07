import { describe, expect, it } from 'vitest';
import {
  buildDeterministicActionFallback,
  isNearDuplicateAction,
  normalizeActionKey,
  parseActionDescriptionsFromText,
  postProcessActionDescriptions,
} from './actionDescriptions';

describe('parseActionDescriptionsFromText', () => {
  it('parses strict JSON array with action field', () => {
    const parsed = parseActionDescriptionsFromText(
      JSON.stringify([
        { phrase: '收到', action: 'nod with thumbs up' },
        { phrase: '稍等', action: 'raise hand to pause' },
      ])
    );

    expect(parsed).toEqual(['nod with thumbs up', 'raise hand to pause']);
  });

  it('parses JSON inside fenced block', () => {
    const parsed = parseActionDescriptionsFromText(
      '```json\n[{"action":"wave hand with smile"}]\n```'
    );

    expect(parsed).toEqual(['wave hand with smile']);
  });

  it('falls back to plain lines when JSON is invalid', () => {
    const parsed = parseActionDescriptionsFromText(
      '1. wave hand\n2. tilt head confused'
    );

    expect(parsed).toEqual(['wave hand', 'tilt head confused']);
  });
});

describe('normalizeActionKey', () => {
  it('normalizes punctuation and casing for dedupe', () => {
    const keyA = normalizeActionKey('Wave-hand!');
    const keyB = normalizeActionKey(' wave hand ');

    expect(keyA).toBe(keyB);
  });
});

describe('buildDeterministicActionFallback', () => {
  it('returns gesture based on phrase semantics', () => {
    expect(buildDeterministicActionFallback('謝謝你', 0)).toContain('bow');
    const refuseAction = buildDeterministicActionFallback('不要', 1);
    expect(
      refuseAction.includes('cross arms') || refuseAction.includes('decline')
    ).toBe(true);
  });
});

describe('postProcessActionDescriptions', () => {
  it('replaces duplicates and empties with deterministic fallback', () => {
    const result = postProcessActionDescriptions(
      ['wave hand', 'wave hand', '   '],
      ['哈囉', '謝謝', '等等']
    );

    expect(result).toHaveLength(3);
    expect(new Set(result.map((line) => normalizeActionKey(line))).size).toBe(3);
  });

  it('treats semantically similar actions as near duplicates', () => {
    expect(
      isNearDuplicateAction('waving hand with smile', ['wave hand smiling'])
    ).toBe(true);
  });

  it('replaces near-duplicate action lines with alternatives', () => {
    const result = postProcessActionDescriptions(
      ['wave hand smiling', 'waving hand with smile'],
      ['哈囉', '謝謝']
    );

    expect(result).toHaveLength(2);
    expect(result[1]?.toLowerCase()).not.toContain('wave hand');
  });

  it('honors threshold level when deciding near duplicates', () => {
    const strictResult = postProcessActionDescriptions(
      ['wave hand with smile', 'wave hand'],
      ['哈囉', '收到'],
      0.8
    );
    const aggressiveResult = postProcessActionDescriptions(
      ['wave hand with smile', 'wave hand'],
      ['哈囉', '收到'],
      0.5
    );

    expect(strictResult[1]).toBe('wave hand');
    expect(aggressiveResult[1]).not.toBe('wave hand');
  });
});
