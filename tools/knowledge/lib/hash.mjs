import { createHash } from 'node:crypto';

// Stable content hashing for the knowledge generator. sha256, hex-encoded,
// prefixed so manifest consumers never have to guess the algorithm.
export function hashContent(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

// Combines an array of already-computed hashes into one order-independent
// tree hash — used for repository.json's top-level treeHash so a single
// number tells the resolver "has anything at all changed" before it bothers
// diffing individual file hashes.
export function hashTree(hashes) {
  const sorted = [...hashes].sort();
  return hashContent(sorted.join('\n'));
}
