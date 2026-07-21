import { describe, expect, it } from 'vitest';

import { LINE_SIZE_MAX } from '../model/matches.constants';
import {
  hasUniqueMembers,
  isLineSizeValid,
  isLineupValid,
  isPullerOnLine,
} from './match-lineup.policy';

function line(size: number): readonly string[] {
  return Array.from({ length: size }, (_unused, index) => `m-${index}`);
}

describe('match lineup policy', () => {
  it('accepts a line inside the configured size bounds', () => {
    expect(isLineSizeValid(line(1))).toBe(true);
    expect(isLineSizeValid(line(7))).toBe(true);
    expect(isLineSizeValid(line(LINE_SIZE_MAX))).toBe(true);
  });

  it('rejects an empty line and one past the configured maximum', () => {
    expect(isLineSizeValid([])).toBe(false);
    expect(isLineSizeValid(line(LINE_SIZE_MAX + 1))).toBe(false);
  });

  it('rejects the same player listed twice on one line', () => {
    expect(hasUniqueMembers(['a', 'b', 'c'])).toBe(true);
    expect(hasUniqueMembers(['a', 'b', 'a'])).toBe(false);
  });

  it('requires a named puller to be on the line', () => {
    expect(isPullerOnLine(['a', 'b'], 'a')).toBe(true);
    expect(isPullerOnLine(['a', 'b'], 'c')).toBe(false);
  });

  it('treats an unrecorded puller as valid rather than missing data', () => {
    expect(isPullerOnLine(['a', 'b'], null)).toBe(true);
  });

  it('composes every constraint into one predicate', () => {
    expect(isLineupValid(['a', 'b'], 'b')).toBe(true);
    expect(isLineupValid([], null)).toBe(false);
    expect(isLineupValid(['a', 'a'], null)).toBe(false);
    expect(isLineupValid(['a'], 'z')).toBe(false);
  });
});
