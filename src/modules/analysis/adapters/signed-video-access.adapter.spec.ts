import type { AppConfigService } from '@config/app-config.service';
import { describe, expect, it } from 'vitest';

import { VideoProvider } from '../model/analysis.enums';
import { SignedVideoAccessAdapter } from './signed-video-access.adapter';

const NOW = new Date('2025-03-01T12:00:00.000Z');

function adapter(): SignedVideoAccessAdapter {
  return new SignedVideoAccessAdapter({
    security: { jwtSecret: 'test-secret' },
  } as unknown as AppConfigService);
}

describe('SignedVideoAccessAdapter', () => {
  it('mints an expiring provider URL without proxying the recording', () => {
    const ticket = adapter().createAccessTicket({
      provider: VideoProvider.YouTube,
      externalRef: 'abc 123',
      now: NOW,
    });
    expect(ticket.url).toContain('https://www.youtube.com/watch/abc%20123');
    expect(ticket.url).toContain('signature=');
    expect(ticket.expiresAt.getTime()).toBe(NOW.getTime() + 900_000);
  });

  it('produces a different signature for a different reference', () => {
    const first = adapter().createAccessTicket({
      provider: VideoProvider.Vimeo,
      externalRef: 'one',
      now: NOW,
    });
    const second = adapter().createAccessTicket({
      provider: VideoProvider.Vimeo,
      externalRef: 'two',
      now: NOW,
    });
    expect(first.url).not.toBe(second.url);
  });

  it('signs every known provider', () => {
    for (const provider of [
      VideoProvider.Drive,
      VideoProvider.ObjectStorage,
      VideoProvider.External,
    ]) {
      expect(
        adapter().createAccessTicket({ provider, externalRef: 'x', now: NOW })
          .url,
      ).toContain('expires=');
    }
  });
});
