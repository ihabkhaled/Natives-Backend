import { describe, expect, it, vi } from 'vitest';

import { MatchRevisionAction, MatchStatus } from '../model/matches.enums';
import type { MatchRevisionRow } from '../model/matches.rows';
import type { NewMatchRevision } from '../model/matches.types';
import { MatchRevisionRepository } from './match-revision.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<MatchRevisionRow> = {}): MatchRevisionRow {
  return {
    id: 'revision-1',
    match_id: 'match-1',
    team_id: 'team-1',
    sequence: 1,
    revision: 1,
    action: 'finalized',
    reason: 'published',
    from_status: 'completed',
    to_status: 'finalized',
    our_score_before: 15,
    opponent_score_before: 12,
    our_score_after: 15,
    opponent_score_after: 12,
    stream_version: 27,
    actor_user_id: 'admin-1',
    created_at: NOW,
    ...overrides,
  };
}

function newRevision(): NewMatchRevision {
  return {
    id: 'revision-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    revision: 1,
    action: MatchRevisionAction.Finalized,
    reason: 'published',
    fromStatus: MatchStatus.Completed,
    toStatus: MatchStatus.Finalized,
    ourScoreBefore: 15,
    opponentScoreBefore: 12,
    ourScoreAfter: 15,
    opponentScoreAfter: 12,
    streamVersion: 27,
    actorUserId: 'admin-1',
    now: NOW,
  };
}

describe('MatchRevisionRepository', () => {
  it('appends a revision row with bound parameters', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const revision = await new MatchRevisionRepository().append(
      { run },
      newRevision(),
    );
    expect(revision.action).toBe(MatchRevisionAction.Finalized);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "match_revisions"',
    );
    expect(run.mock.calls[0]?.[1]).toEqual([
      'revision-1',
      'match-1',
      'team-1',
      1,
      1,
      MatchRevisionAction.Finalized,
      'published',
      MatchStatus.Completed,
      MatchStatus.Finalized,
      15,
      12,
      15,
      12,
      27,
      'admin-1',
      NOW.toISOString(),
    ]);
  });

  it('raises when the append returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchRevisionRepository().append({ run }, newRevision()),
    ).rejects.toThrow('Expected a returned row from the match revision append');
  });

  it('lists the trail oldest first under a hard bound', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const items = await new MatchRevisionRepository().listForMatch(
      { run },
      'match-1',
      { limit: 500, offset: 0 },
    );
    expect(items).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain('ORDER BY "sequence" ASC');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 100, 0]);
  });

  it('starts a new trail at one and increments an existing one', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ value: null }])
      .mockResolvedValueOnce([{ value: '2' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchRevisionRepository();
    expect(await repository.nextSequence({ run }, 'match-1')).toBe(1);
    expect(await repository.nextSequence({ run }, 'match-1')).toBe(3);
    expect(await repository.nextSequence({ run }, 'match-1')).toBe(1);
  });

  it('counts the trail and tolerates an empty result', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([]);
    const repository = new MatchRevisionRepository();
    expect(await repository.countForMatch({ run }, 'match-1')).toBe(2);
    expect(await repository.countForMatch({ run }, 'match-1')).toBe(0);
  });
});
