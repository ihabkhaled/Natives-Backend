import { describe, expect, it, vi } from 'vitest';

import type { MatchPointLineupRow } from '../model/matches.rows';
import type { NewMatchPointLineupEntry } from '../model/matches.types';
import { MatchPointLineupRepository } from './match-point-lineup.repository';

const NOW = new Date('2026-05-01T10:00:00.000Z');

function row(
  overrides: Partial<MatchPointLineupRow> = {},
): MatchPointLineupRow {
  return {
    id: 'line-1',
    match_id: 'match-1',
    play_id: 'play-1',
    point_number: 1,
    membership_id: 'member-1',
    roster_entry_id: 'entry-1',
    puller: true,
    ...overrides,
  };
}

function newEntry(): NewMatchPointLineupEntry {
  return {
    id: 'line-1',
    matchId: 'match-1',
    teamId: 'team-1',
    playId: 'play-1',
    pointNumber: 1,
    membershipId: 'member-1',
    rosterEntryId: 'entry-1',
    puller: true,
    now: NOW,
  };
}

describe('MatchPointLineupRepository', () => {
  it('inserts a line member against its point-start fact', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const entry = await new MatchPointLineupRepository().insert(
      { run },
      newEntry(),
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "match_point_lineups"',
    );
    expect(run.mock.calls[0]?.[1]).toEqual([
      'line-1',
      'match-1',
      'team-1',
      'play-1',
      1,
      'member-1',
      'entry-1',
      true,
      NOW.toISOString(),
    ]);
    expect(entry.puller).toBe(true);
    expect(entry.membershipId).toBe('member-1');
  });

  it('raises when the insert returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchPointLineupRepository().insert({ run }, newEntry()),
    ).rejects.toThrow('Expected a returned row from the lineup write');
  });

  it('lists the line of one point deterministically', async () => {
    const run = vi.fn().mockResolvedValue([row(), row({ id: 'line-2' })]);
    const items = await new MatchPointLineupRepository().listForPlay(
      { run },
      'play-1',
    );
    expect(items).toHaveLength(2);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "membership_id" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual(['play-1']);
  });

  it('reads every recorded line of a match under a hard cap', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const items = await new MatchPointLineupRepository().listForMatch(
      { run },
      'match-1',
    );
    expect(items).toHaveLength(1);
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 4000]);
    expect(String(run.mock.calls[0]?.[0])).toContain('"point_number" ASC');
  });

  it('preserves an unrecorded roster entry as null', async () => {
    const run = vi.fn().mockResolvedValue([row({ roster_entry_id: null })]);
    const items = await new MatchPointLineupRepository().listForPlay(
      { run },
      'play-1',
    );
    expect(items[0]?.rosterEntryId).toBeNull();
  });
});
