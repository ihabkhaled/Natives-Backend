import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoreSourceRepository } from './score-source.repository';

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ScoreSourceRepository() };
}

describe('ScoreSourceRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists active memberships for a team', async () => {
    harness.scope.run.mockResolvedValueOnce([{ membership_id: 'mem-1' }]);
    await expect(
      harness.repository.listActiveMemberships(
        harness.scope as never,
        'team-1',
      ),
    ).resolves.toEqual([{ membership_id: 'mem-1' }]);
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('"status" = \'active\'');
  });

  it('aggregates category sources for the whole team, filtered to known categories', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        membership_id: 'mem-1',
        category_key: 'training',
        values: ['4'],
        total_metrics: 1,
      },
    ]);
    await expect(
      harness.repository.categorySourcesForTeam(
        harness.scope as never,
        'team-1',
      ),
    ).resolves.toHaveLength(1);
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('pa."status" = \'published\'');
    expect(sql).toContain('cat."category_key" = ANY($2)');
    expect(sql).not.toContain('pa."membership_id" = $3');
  });

  it('aggregates category sources for one membership', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await harness.repository.categorySourcesForMembership(
      harness.scope as never,
      'team-1',
      'mem-1',
    );
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('pa."membership_id" = $3');
  });

  it('aggregates attendance counts for the whole team from finalized sheets', async () => {
    harness.scope.run.mockResolvedValueOnce([
      { membership_id: 'mem-1', attended: 3, absent: 1, excused: 2 },
    ]);
    await expect(
      harness.repository.attendanceCountsForTeam(
        harness.scope as never,
        'team-1',
      ),
    ).resolves.toHaveLength(1);
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('"attendance_records"');
    expect(sql).toContain('sh."state" = ANY($5)');
    expect(sql).not.toContain('ar."membership_id" = $6');
  });

  it('aggregates attendance counts for one membership', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await harness.repository.attendanceCountsForMembership(
      harness.scope as never,
      'team-1',
      'mem-1',
    );
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('ar."membership_id" = $6');
  });
});
