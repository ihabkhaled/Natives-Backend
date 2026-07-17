import { describe, expect, it } from 'vitest';

import { hashContent, hashTree } from '../../../tools/knowledge/lib/hash.mjs';

describe('hash.mjs', () => {
  it('produces a stable sha256 hash for a fixed input', () => {
    expect(hashContent('hello world')).toBe(
      'sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('produces the same hash for the same content on repeated calls', () => {
    expect(hashContent('deterministic')).toBe(hashContent('deterministic'));
  });

  it('hashTree is order-independent', () => {
    const forward = hashTree(['sha256:aaa', 'sha256:bbb', 'sha256:ccc']);
    const shuffled = hashTree(['sha256:ccc', 'sha256:aaa', 'sha256:bbb']);
    expect(forward).toBe(shuffled);
  });

  it('hashTree changes when the input set changes', () => {
    const before = hashTree(['sha256:aaa', 'sha256:bbb']);
    const after = hashTree(['sha256:aaa', 'sha256:bbb', 'sha256:ccc']);
    expect(before).not.toBe(after);
  });
});
