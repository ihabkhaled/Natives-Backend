import { describe, expect, it, vi } from 'vitest';

import { MatchPlayType, PointStartingLine } from '../model/matches.enums';
import type {
  MatchPlayEventRow,
  OpenMatchPointRow,
} from '../model/matches.rows';
import type { NewMatchPlayEvent } from '../model/matches.types';
import { MatchPlayEventRepository } from './match-play-event.repository';

const NOW = new Date('2026-05-01T10:00:00.000Z');

function row(overrides: Partial<MatchPlayEventRow> = {}): MatchPlayEventRow {
  return {
    id: 'play-1',
    match_id: 'match-1',
    team_id: 'team-1',
    sequence: 1,
    operation_id: 'op-1',
    request_hash: 'hash-1',
    play_type: 'point_started',
    point_number: 1,
    period: 1,
    starting_line: 'offense',
    scoring_side: null,
    primary_membership_id: null,
    secondary_membership_id: null,
    assist_state: null,
    callahan: false,
    duration_seconds: null,
    corrects_play_id: null,
    correction_reason: null,
    retracted: false,
    notes: null,
    recorded_by: 'user-1',
    occurred_at: null,
    recorded_at: NOW,
    ...overrides,
  };
}

function newPlay(
  overrides: Partial<NewMatchPlayEvent> = {},
): NewMatchPlayEvent {
  return {
    id: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.PointStarted,
    pointNumber: 1,
    period: 1,
    startingLine: PointStartingLine.Offense,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('MatchPlayEventRepository', () => {
  it('appends a fact with bound parameters and never pre-retracts it', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const play = await new MatchPlayEventRepository().append(
      { run },
      newPlay({ occurredAt: NOW }),
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "match_play_events"',
    );
    expect(String(run.mock.calls[0]?.[0])).toContain('false AS "retracted"');
    expect(run.mock.calls[0]?.[1]).toEqual([
      'play-1',
      'match-1',
      'team-1',
      1,
      'op-1',
      'hash-1',
      'point_started',
      1,
      1,
      'offense',
      null,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      'user-1',
      NOW.toISOString(),
      NOW.toISOString(),
    ]);
    expect(play.retracted).toBe(false);
  });

  it('raises when the append returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchPlayEventRepository().append({ run }, newPlay()),
    ).rejects.toThrow('Expected a returned row from the match play append');
  });

  it('resolves a stored fact by its client operation id', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const found = await new MatchPlayEventRepository().findByOperationId(
      { run },
      'match-1',
      'op-1',
    );
    expect(found?.operationId).toBe('op-1');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 'op-1']);
  });

  it('returns null when the operation id is unknown', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const found = await new MatchPlayEventRepository().findByOperationId(
      { run },
      'match-1',
      'op-9',
    );
    expect(found).toBeNull();
  });

  it('derives retracted-ness from a compensating correction on read', async () => {
    const run = vi.fn().mockResolvedValue([row({ retracted: true })]);
    const found = await new MatchPlayEventRepository().findById(
      { run },
      'match-1',
      'play-1',
    );
    expect(String(run.mock.calls[0]?.[0])).toContain('"corrects_play_id"');
    expect(found?.retracted).toBe(true);
  });

  it('returns null when the play id is unknown', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const found = await new MatchPlayEventRepository().findById(
      { run },
      'match-1',
      'nope',
    );
    expect(found).toBeNull();
  });

  it('takes the next sequence one past the recorded high-water mark', async () => {
    const run = vi.fn().mockResolvedValue([{ value: 4 }]);
    const next = await new MatchPlayEventRepository().nextSequence(
      { run },
      'match-1',
    );
    expect(next).toBe(5);
  });

  it('starts the sequence at one on an empty stream', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const next = await new MatchPlayEventRepository().nextSequence(
      { run },
      'match-1',
    );
    expect(next).toBe(1);
  });

  it('counts only the point starts a correction has not retracted', async () => {
    const run = vi.fn().mockResolvedValue([{ count: 2 }]);
    const count = await new MatchPlayEventRepository().countEffectiveStarts(
      { run },
      'match-1',
    );
    expect(count).toBe(2);
    expect(String(run.mock.calls[0]?.[0])).toContain('NOT EXISTS');
    expect(String(run.mock.calls[0]?.[0])).toContain(`'point_started'`);
  });

  it('counts zero effective starts when the probe returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const count = await new MatchPlayEventRepository().countEffectiveStarts(
      { run },
      'match-1',
    );
    expect(count).toBe(0);
  });

  it('finds the open point and excludes completed and retracted ones', async () => {
    const open: OpenMatchPointRow = {
      id: 'play-3',
      point_number: 3,
      period: 1,
      starting_line: 'defense',
    };
    const run = vi.fn().mockResolvedValue([open]);
    const found = await new MatchPlayEventRepository().findOpenPoint(
      { run },
      'match-1',
    );
    expect(found).toEqual({
      playId: 'play-3',
      pointNumber: 3,
      period: 1,
      startingLine: PointStartingLine.Defense,
    });
    expect(String(run.mock.calls[0]?.[0])).toContain(`'point_completed'`);
  });

  it('returns null when no point is open', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const found = await new MatchPlayEventRepository().findOpenPoint(
      { run },
      'match-1',
    );
    expect(found).toBeNull();
  });

  it('lists the stream in sequence order under a hard page cap', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const items = await new MatchPlayEventRepository().listForMatch(
      { run },
      'match-1',
      { limit: 5000, offset: 10 },
    );
    expect(items).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY p."sequence" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 500, 10]);
  });

  it('reads the whole bounded stream for the statistics projection', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const items = await new MatchPlayEventRepository().listAllForMatch(
      { run },
      'match-1',
    );
    expect(items).toHaveLength(1);
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 2000]);
  });

  it('counts the recorded facts of a match', async () => {
    const run = vi.fn().mockResolvedValue([{ count: 7 }]);
    const total = await new MatchPlayEventRepository().countForMatch(
      { run },
      'match-1',
    );
    expect(total).toBe(7);
  });

  it('counts zero when the count probe returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const total = await new MatchPlayEventRepository().countForMatch(
      { run },
      'match-1',
    );
    expect(total).toBe(0);
  });
});
