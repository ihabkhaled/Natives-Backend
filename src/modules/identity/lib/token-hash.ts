import { createHash } from 'node:crypto';

import {
  TOKEN_HASH_ALGORITHM,
  TOKEN_HASH_ENCODING,
} from '../model/identity.constants';

/**
 * Deterministic one-way hash for opaque tokens (invitations, refresh sessions,
 * password resets). Only the digest is ever persisted or compared; the plaintext
 * token never touches the database. Pure and stable so lookups by hash work and
 * tests can compute expected digests.
 */
export function hashOpaqueToken(token: string): string {
  return createHash(TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest(TOKEN_HASH_ENCODING);
}
