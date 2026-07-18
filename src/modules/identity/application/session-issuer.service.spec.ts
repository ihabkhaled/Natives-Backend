import { createHash } from 'node:crypto';

import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { SessionIssuerService } from './session-issuer.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const REFRESH_TTL_SECONDS = 1000;
const RAW_TOKEN = 'rawtoken';

const USER: User = {
  id: 'user-1',
  email: 'coach@example.test',
  role: Role.Admin,
  status: UserStatus.Active,
  displayName: 'Coach',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('session-id') };
  const secureRandom = {
    generateToken: vi.fn().mockReturnValue(RAW_TOKEN),
  };
  const tokenPort = {
    sign: vi.fn().mockResolvedValue('jwt'),
    verify: vi.fn(),
  };
  const sessions = { insert: vi.fn() };
  const config = {
    identity: {
      refreshTokenTtlSeconds: REFRESH_TTL_SECONDS,
      invitationTtlSeconds: 1000,
      passwordResetTtlSeconds: 1000,
      maxFailedLoginAttempts: 3,
      failedLoginWindowSeconds: 900,
      accountLockoutSeconds: 900,
    },
  };

  const service = new SessionIssuerService(
    clock,
    idGenerator,
    secureRandom,
    tokenPort,
    sessions as never,
    config as never,
  );

  return { service, clock, idGenerator, secureRandom, tokenPort, sessions };
}

describe('SessionIssuerService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('persists the hashed refresh token and returns the raw token plus jwt', async () => {
    const scope = { marker: 'scope' };
    const expectedHash = createHash('sha256').update(RAW_TOKEN).digest('hex');

    const result = await harness.service.issue(
      scope as never,
      USER,
      'iphone',
      'family-1',
    );

    expect(harness.sessions.insert).toHaveBeenCalledWith(scope, {
      id: 'session-id',
      userId: 'user-1',
      tokenHash: expectedHash,
      familyId: 'family-1',
      deviceLabel: 'iphone',
      issuedAt: NOW,
      expiresAt: new Date(NOW.getTime() + REFRESH_TTL_SECONDS * 1000),
    });

    expect(result).toEqual({
      accessToken: 'jwt',
      refreshToken: RAW_TOKEN,
      refreshTokenExpiresAt: new Date(
        NOW.getTime() + REFRESH_TTL_SECONDS * 1000,
      ),
      userId: 'user-1',
    });
  });

  it('signs an access token from the user identity claims', async () => {
    await harness.service.issue({} as never, USER, null, 'family-1');

    expect(harness.tokenPort.sign).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'coach@example.test',
      roles: [Role.Admin],
      sessionId: 'session-id',
    });
  });

  it('never stores the raw token, only its hash', async () => {
    await harness.service.issue({} as never, USER, null, 'family-1');

    const insertedRecord = harness.sessions.insert.mock.calls[0]?.[1] as {
      tokenHash: string;
    };
    expect(insertedRecord.tokenHash).not.toBe(RAW_TOKEN);
    expect(insertedRecord.tokenHash).toBe(
      createHash('sha256').update(RAW_TOKEN).digest('hex'),
    );
  });
});
