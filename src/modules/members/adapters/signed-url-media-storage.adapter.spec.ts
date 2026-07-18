import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MEDIA_SIGNATURE_ALGORITHM,
  MEDIA_STORAGE_BASE_URL,
} from '../model/members.constants';
import { SignedUrlMediaStorageAdapter } from './signed-url-media-storage.adapter';

const SECRET = 'test-signing-secret-value-1234567890';
const NOW = new Date('2026-06-01T00:00:00.000Z');

function build(): SignedUrlMediaStorageAdapter {
  const config = { security: { jwtSecret: SECRET } };
  return new SignedUrlMediaStorageAdapter(config as never);
}

describe('SignedUrlMediaStorageAdapter', () => {
  it('mints a short-lived signed upload URL scoped to the key and method', () => {
    const adapter = build();
    const result = adapter.createUploadUrl({
      storageKey: 'members/team-1/mem-1/md-1',
      contentType: 'image/png',
      now: NOW,
    });

    expect(result.url.startsWith(MEDIA_STORAGE_BASE_URL)).toBe(true);
    expect(result.url).toContain('method=PUT');
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + 300 * 1000);

    const expiryEpoch = Math.floor(result.expiresAt.getTime() / 1000);
    const expected = createHmac(MEDIA_SIGNATURE_ALGORITHM, SECRET)
      .update(`PUT:members/team-1/mem-1/md-1:${expiryEpoch}`)
      .digest('hex');
    expect(result.url).toContain(`signature=${expected}`);
  });

  it('mints a download URL with the GET method', () => {
    const adapter = build();
    const result = adapter.createDownloadUrl({
      storageKey: 'members/team-1/mem-1/md-1',
      now: NOW,
    });
    expect(result.url).toContain('method=GET');
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + 300 * 1000);
  });

  it('produces different signatures for upload vs download of the same key', () => {
    const adapter = build();
    const up = adapter.createUploadUrl({
      storageKey: 'k',
      contentType: 'image/png',
      now: NOW,
    });
    const down = adapter.createDownloadUrl({ storageKey: 'k', now: NOW });
    expect(up.url).not.toBe(down.url);
  });
});
