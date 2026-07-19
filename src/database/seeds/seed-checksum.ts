import { createHash } from 'node:crypto';

const CHECKSUM_ALGORITHM = 'sha256';
const CHECKSUM_ENCODING = 'hex';

/**
 * Deterministic, content-derived fingerprint of a seeder definition. Used to
 * detect that a seeder's definition changed after it was already applied so the
 * framework can warn (auditable) instead of silently re-running.
 */
export function computeSeedChecksum(content: string): string {
  return createHash(CHECKSUM_ALGORITHM)
    .update(content)
    .digest(CHECKSUM_ENCODING);
}
