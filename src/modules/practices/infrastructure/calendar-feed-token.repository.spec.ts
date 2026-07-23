import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CALENDAR_TOKEN_MAX_ACTIVE_PER_USER_TEAM } from '../model/calendar.constants';
import type {
  CalendarFeedMetadataRow,
  CalendarFeedTokenRow,
} from '../model/calendar.rows';
import type { NewCalendarFeedToken } from '../model/calendar.types';
import { CalendarFeedTokenRepository } from './calendar-feed-token.repository';

const NOW = new Date('2026-07-18T10:00:00.000Z');
const TOKEN: NewCalendarFeedToken = {
  id: 'feed-1',
  tokenDigest: 'a'.repeat(64),
  userId: 'user-1',
  teamId: 'team-1',
  seasonId: null,
  timezone: 'Africa/Cairo',
  expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  revokedAt: null,
  createdAt: NOW,
};
const ROW: CalendarFeedTokenRow = {
  id: TOKEN.id,
  token_digest: TOKEN.tokenDigest,
  user_id: TOKEN.userId,
  team_id: TOKEN.teamId,
  season_id: TOKEN.seasonId,
  timezone: TOKEN.timezone,
  expires_at: TOKEN.expiresAt,
  revoked_at: null,
  created_at: TOKEN.createdAt,
};

function scope() {
  return { run: vi.fn() };
}

describe('CalendarFeedTokenRepository', () => {
  let repository: CalendarFeedTokenRepository;
  let transaction: ReturnType<typeof scope>;

  beforeEach(() => {
    repository = new CalendarFeedTokenRepository();
    transaction = scope();
  });

  it('inserts a digest-only token row', async () => {
    transaction.run.mockResolvedValue([]);
    await repository.insert(transaction as never, TOKEN);
    expect(transaction.run.mock.calls[0]?.[1]).toContain(TOKEN.tokenDigest);
    expect(transaction.run.mock.calls[0]?.[0]).not.toContain('raw_token');
  });

  it('counts active credentials for one owner and team', async () => {
    transaction.run.mockResolvedValue([{ count: 2 }]);
    await expect(
      repository.countActive(
        transaction as never,
        TOKEN.userId,
        TOKEN.teamId,
        NOW,
      ),
    ).resolves.toBe(2);
  });

  it('lists own active feeds as bounded metadata without credential material', async () => {
    const metadataRow: CalendarFeedMetadataRow = {
      id: TOKEN.id,
      season_id: null,
      timezone: TOKEN.timezone,
      expires_at: TOKEN.expiresAt,
      created_at: TOKEN.createdAt,
    };
    transaction.run.mockResolvedValue([metadataRow]);
    const items = await repository.listActiveByUser(
      transaction as never,
      TOKEN.userId,
      TOKEN.teamId,
      NOW,
    );
    const [sql, params] = transaction.run.mock.calls[0] as [
      string,
      readonly unknown[],
    ];
    expect(sql).not.toContain('token_digest');
    expect(sql).toContain('"user_id" = $1 AND "team_id" = $2');
    expect(sql).toContain('"revoked_at" IS NULL');
    expect(params).toEqual([
      TOKEN.userId,
      TOKEN.teamId,
      NOW.toISOString(),
      CALENDAR_TOKEN_MAX_ACTIVE_PER_USER_TEAM,
    ]);
    expect(items).toEqual([
      {
        id: TOKEN.id,
        seasonId: null,
        timezone: TOKEN.timezone,
        expiresAt: TOKEN.expiresAt,
        createdAt: TOKEN.createdAt,
      },
    ]);
  });

  it('revokes only an owned team-scoped credential', async () => {
    transaction.run.mockResolvedValue([{ id: TOKEN.id }]);
    await expect(
      repository.revokeOwned(
        transaction as never,
        TOKEN.id,
        TOKEN.userId,
        TOKEN.teamId,
        NOW,
      ),
    ).resolves.toBe(true);
    transaction.run.mockResolvedValue([]);
    await expect(
      repository.revokeOwned(
        transaction as never,
        TOKEN.id,
        TOKEN.userId,
        'other-team',
        NOW,
      ),
    ).resolves.toBe(false);
  });

  it('loads only usable credentials with a current active membership', async () => {
    transaction.run.mockResolvedValue([ROW]);
    await expect(
      repository.findUsableByDigest(
        transaction as never,
        TOKEN.tokenDigest,
        NOW,
      ),
    ).resolves.toMatchObject({ id: TOKEN.id, teamId: TOKEN.teamId });
    expect(transaction.run.mock.calls[0]?.[0]).toContain(
      '"memberships"."status" =',
    );
    transaction.run.mockResolvedValue([]);
    await expect(
      repository.findUsableByDigest(
        transaction as never,
        TOKEN.tokenDigest,
        NOW,
      ),
    ).resolves.toBeNull();
  });
});
