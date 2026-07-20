import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchEventType, ScoringSide } from '../model/matches.enums';
import type { MatchEventRow } from '../model/matches.rows';
import type { NewMatchEvent } from '../model/matches.types';
import { MatchEventRepository } from './match-event.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<MatchEventRow> = {}): MatchEventRow {
  return {
    id: 'event-1',
    match_id: 'match-1',
    team_id: 'team-1',
    sequence: 1,
    operation_id: 'op-abcdef01',
    request_hash: 'hash-a',
    event_type: 'point',
    scoring_side: 'us',
    points: 1,
    our_score_after: 1,
    opponent_score_after: 0,
    period: 1,
    scorer_membership_id: null,
    assist_membership_id: null,
    voids_event_id: null,
    voided: false,
    void_reason: null,
    recorded_by: 'user-1',
    occurred_at: null,
    recorded_at: NOW,
    ...overrides,
  };
}

function newEvent(overrides: Partial<NewMatchEvent> = {}): NewMatchEvent {
  return {
    id: 'event-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-abcdef01',
    requestHash: 'hash-a',
    eventType: MatchEventType.Point,
    scoringSide: ScoringSide.Us,
    points: 1,
    ourScoreAfter: 1,
    opponentScoreAfter: 0,
    period: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voidReason: null,
    recordedBy: 'user-1',
    occurredAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('MatchEventRepository', () => {
  it('appends a fact and returns it as not-yet-voided', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const event = await new MatchEventRepository().append({ run }, newEvent());
    expect(event.eventId).toBe('event-1');
    expect(event.voided).toBe(false);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('INSERT INTO "match_events"');
    expect(statement).toContain('false AS "voided"');
    expect(statement).not.toContain('SELECT *');
  });

  it('binds the client operation id and hash as parameters', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    await new MatchEventRepository().append(
      { run },
      newEvent({ occurredAt: NOW }),
    );
    const parameters = run.mock.calls[0]?.[1] as unknown[];
    expect(parameters[4]).toBe('op-abcdef01');
    expect(parameters[5]).toBe('hash-a');
    expect(parameters[17]).toBe(NOW.toISOString());
  });

  it('serializes an absent client instant as null', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    await new MatchEventRepository().append({ run }, newEvent());
    expect((run.mock.calls[0]?.[1] as unknown[])[17]).toBeNull();
  });

  it('raises when the append returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchEventRepository().append({ run }, newEvent()),
    ).rejects.toThrow('Expected a returned row from the match event append');
  });

  it('resolves a stored fact by its client operation id', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const event = await new MatchEventRepository().findByOperationId(
      { run },
      'match-1',
      'op-abcdef01',
    );
    expect(event?.operationId).toBe('op-abcdef01');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 'op-abcdef01']);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      '"voids_event_id" = e."id"',
    );
  });

  it('returns null for an unseen operation id', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchEventRepository().findByOperationId(
        { run },
        'match-1',
        'op-unseen',
      ),
    ).toBeNull();
  });

  it('resolves one fact by id, derived voided flag included', async () => {
    const run = vi.fn().mockResolvedValue([row({ voided: true })]);
    const event = await new MatchEventRepository().findById(
      { run },
      'match-1',
      'event-1',
    );
    expect(event?.voided).toBe(true);
  });

  it('returns null for a fact on another match', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchEventRepository().findById({ run }, 'match-2', 'event-1'),
    ).toBeNull();
  });

  it('lists the stream in sequence order under a hard bound', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const scope: TransactionScope = { run };
    const items = await new MatchEventRepository().listForMatch(
      scope,
      'match-1',
      { limit: 9999, offset: 5 },
    );
    expect(items).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY e."sequence" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 500, 5]);
  });

  it('counts the stream and tolerates an empty result', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ count: 12 }])
      .mockResolvedValueOnce([]);
    const repository = new MatchEventRepository();
    expect(await repository.countForMatch({ run }, 'match-1')).toBe(12);
    expect(await repository.countForMatch({ run }, 'match-1')).toBe(0);
  });

  it('counts timeouts per side, excluding voided ones', async () => {
    const run = vi.fn().mockResolvedValue([
      { scoring_side: 'us', count: '2' },
      { scoring_side: 'them', count: 1 },
    ]);
    const usage = await new MatchEventRepository().countTimeouts(
      { run },
      'match-1',
      2,
    );
    expect(usage).toEqual({ usedByUs: 2, usedByThem: 1 });
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain(`"event_type" = 'timeout'`);
    expect(statement).toContain('NOT EXISTS');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 2]);
  });

  it('reports zero usage for a side that has called none', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchEventRepository().countTimeouts({ run }, 'match-1', 1),
    ).toEqual({ usedByUs: 0, usedByThem: 0 });
  });
});
