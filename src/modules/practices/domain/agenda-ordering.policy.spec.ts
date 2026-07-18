import { describe, expect, it } from 'vitest';

import { isValidReorder, toPositionWrites } from './agenda-ordering.policy';

describe('agenda-ordering.policy', () => {
  describe('isValidReorder', () => {
    it('accepts an exact permutation of the current ids', () => {
      expect(isValidReorder(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
      expect(isValidReorder([], [])).toBe(true);
    });

    it('rejects a different length', () => {
      expect(isValidReorder(['a', 'b'], ['a'])).toBe(false);
      expect(isValidReorder(['a'], ['a', 'b'])).toBe(false);
    });

    it('rejects an unknown id', () => {
      expect(isValidReorder(['a', 'b'], ['a', 'z'])).toBe(false);
    });

    it('rejects a duplicated id', () => {
      expect(isValidReorder(['a', 'b'], ['a', 'a'])).toBe(false);
    });
  });

  describe('toPositionWrites', () => {
    it('derives dense 0-based positions in order', () => {
      expect(toPositionWrites(['x', 'y', 'z'])).toEqual([
        { id: 'x', position: 0 },
        { id: 'y', position: 1 },
        { id: 'z', position: 2 },
      ]);
    });
  });
});
