import { describe, expect, it, vi } from 'vitest';

import { MatchRosterRepository } from './match-roster.repository';

describe('MatchRosterRepository', () => {
  it('lists every rostered member of the match, bounded and ordered', async () => {
    const run = vi.fn().mockResolvedValue([
      { membership_id: 'ana', roster_entry_id: 'entry-ana' },
      { membership_id: 'bo', roster_entry_id: null },
    ]);
    const members = await new MatchRosterRepository().listMembers(
      { run },
      'match-1',
    );
    expect(members).toEqual([
      { membershipId: 'ana', rosterEntryId: 'entry-ana' },
      { membershipId: 'bo', rosterEntryId: null },
    ]);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY e."membership_id" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 200]);
  });

  it('returns an empty roster when the match has none attached', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const members = await new MatchRosterRepository().listMembers(
      { run },
      'match-1',
    );
    expect(members).toEqual([]);
  });

  it('confirms whether a membership is on the match roster', async () => {
    const present = vi.fn().mockResolvedValue([{ id: 'entry-1' }]);
    const absent = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchRosterRepository().isRostered(
        { run: present },
        'match-1',
        'ana',
      ),
    ).resolves.toBe(true);
    await expect(
      new MatchRosterRepository().isRostered({ run: absent }, 'match-1', 'zed'),
    ).resolves.toBe(false);
  });

  it('resolves the roster entry a lineup row should cite', async () => {
    const run = vi.fn().mockResolvedValue([{ id: 'entry-1' }]);
    const found = await new MatchRosterRepository().findEntryId(
      { run },
      'match-1',
      'ana',
    );
    expect(found).toBe('entry-1');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 'ana']);
  });

  it('leaves the roster entry null when the match has no roster', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const found = await new MatchRosterRepository().findEntryId(
      { run },
      'match-1',
      'ana',
    );
    expect(found).toBeNull();
  });
});
