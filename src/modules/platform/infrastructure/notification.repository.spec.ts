import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationCategory } from '../model/platform.enums';
import type { NotificationRow } from '../model/platform.rows';
import type { NewNotification } from '../model/platform.types';
import { NotificationRepository } from './notification.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

const NEW_NOTIFICATION: NewNotification = {
  id: 'n-1',
  userId: 'user-1',
  teamId: 'team-1',
  category: NotificationCategory.MemberLifecycle,
  eventType: 'member.invited',
  titleKey: 'notifications.member.invited.title',
  bodyKey: 'notifications.member.invited.body',
  params: { membershipId: 'mem-1' },
  dedupeKey: 'member.invited:mem-1:user-1',
  now: NOW,
};

const ROW: NotificationRow = {
  id: 'n-1',
  user_id: 'user-1',
  team_id: 'team-1',
  category: 'member_lifecycle',
  event_type: 'member.invited',
  title_key: 'notifications.member.invited.title',
  body_key: 'notifications.member.invited.body',
  params: { membershipId: 'mem-1' },
  dedupe_key: 'member.invited:mem-1:user-1',
  read_at: null,
  created_at: NOW,
};

describe('NotificationRepository', () => {
  let repo: NotificationRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new NotificationRepository();
    scope = buildScope();
  });

  it('inserts a notification and maps the returned row', async () => {
    scope.run.mockResolvedValueOnce([ROW]);
    const inserted = await repo.insert(scope as never, NEW_NOTIFICATION);
    expect(inserted?.id).toBe('n-1');
    expect(scope.run.mock.calls[0]?.[0]).toContain('ON CONFLICT');
  });

  it('returns null when the dedupe conflict suppresses the insert', async () => {
    scope.run.mockResolvedValueOnce([]);
    expect(await repo.insert(scope as never, NEW_NOTIFICATION)).toBeNull();
  });

  it('lists a bounded page for the user with a total', async () => {
    scope.run
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{ count: 1 }]);
    const result = await repo.listForUser(scope as never, 'user-1', {
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.category).toBe(
      NotificationCategory.MemberLifecycle,
    );
  });

  it('defaults the total to zero when no count row returns', async () => {
    scope.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await repo.listForUser(scope as never, 'user-1', {
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(0);
  });

  it('marks a notification read or returns null when not owned', async () => {
    scope.run.mockResolvedValueOnce([{ ...ROW, read_at: NOW }]);
    const marked = await repo.markRead(scope as never, 'user-1', 'n-1', NOW);
    expect(marked?.readAt).toEqual(NOW);

    scope.run.mockResolvedValueOnce([]);
    expect(
      await repo.markRead(scope as never, 'user-1', 'ghost', NOW),
    ).toBeNull();
  });
});
