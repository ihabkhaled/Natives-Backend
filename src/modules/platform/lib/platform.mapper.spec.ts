import { describe, expect, it } from 'vitest';

import {
  AuditOutcome,
  IdempotencyStatus,
  JobOutcome,
  NotificationCategory,
  NotificationChannel,
  OutboxStatus,
} from '../model/platform.enums';
import type {
  AuditEntryRow,
  IdempotencyRow,
  NotificationRow,
  OutboxEventRow,
  PreferenceRow,
  StatusCountRow,
} from '../model/platform.rows';
import {
  toAuditEntry,
  toDeadLetter,
  toEventEnvelope,
  toFailureCode,
  toIdempotencyRecord,
  toJobHeartbeat,
  toLeasedEvent,
  toNotification,
  toNotificationView,
  toOutboxMetrics,
  toPreference,
} from './platform.mapper';

const ISO = '2026-06-01T12:00:00.000Z';
const DATE = new Date(ISO);

describe('platform.mapper', () => {
  it('maps an audit row', () => {
    const row: AuditEntryRow = {
      id: 'a-1',
      actor_user_id: 'admin-1',
      action: 'outbox.replayed',
      resource_type: 'outbox_event',
      resource_id: 'ev-1',
      team_id: 'team-1',
      season_id: null,
      correlation_id: 'corr-1',
      outcome: 'success',
      diff: { eventType: 'member.invited' },
      occurred_at: ISO,
    };
    const entry = toAuditEntry(row);
    expect(entry.outcome).toBe(AuditOutcome.Success);
    expect(entry.occurredAt).toEqual(DATE);
    expect(entry.diff).toEqual({ eventType: 'member.invited' });
  });

  it('maps an outbox row to an envelope and a leased event', () => {
    const row: OutboxEventRow = {
      id: 'ev-1',
      aggregate_type: 'membership',
      aggregate_id: 'mem-1',
      event_type: 'member.invited',
      event_version: 2,
      actor_user_id: 'admin-1',
      team_id: 'team-1',
      season_id: null,
      correlation_id: null,
      causation_id: null,
      payload: { membershipId: 'mem-1' },
      status: 'processing',
      attempts: 3,
      occurred_at: DATE,
    };
    expect(toEventEnvelope(row).eventVersion).toBe(2);
    const leased = toLeasedEvent(row);
    expect(leased.status).toBe(OutboxStatus.Processing);
    expect(leased.attempts).toBe(3);
    expect(leased.envelope.eventId).toBe('ev-1');
  });

  it('maps an idempotency row with and without a result', () => {
    const base: IdempotencyRow = {
      id: 'rec-1',
      idempotency_key: 'k-1',
      request_hash: 'h-1',
      principal_user_id: 'user-1',
      scope_key: 'team-1',
      status: 'completed',
      status_code: 200,
      result: { ok: true },
      expires_at: ISO,
      created_at: ISO,
    };
    expect(toIdempotencyRecord(base).status).toBe(IdempotencyStatus.Completed);
    expect(toIdempotencyRecord(base).result).toEqual({ ok: true });
    const inProgress = toIdempotencyRecord({
      ...base,
      status: 'in_progress',
      status_code: null,
      result: null,
    });
    expect(inProgress.status).toBe(IdempotencyStatus.InProgress);
    expect(inProgress.result).toBeNull();
  });

  it('maps a notification row (read and unread) and projects a view', () => {
    const row: NotificationRow = {
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
      created_at: ISO,
    };
    const unread = toNotification(row);
    expect(unread.category).toBe(NotificationCategory.MemberLifecycle);
    expect(unread.readAt).toBeNull();
    const read = toNotification({ ...row, read_at: ISO });
    expect(read.readAt).toEqual(DATE);

    const view = toNotificationView(unread);
    expect(view).not.toHaveProperty('dedupeKey');
    expect(view.eventType).toBe('member.invited');
  });

  it('maps a preference row', () => {
    const row: PreferenceRow = {
      user_id: 'user-1',
      category: 'practice',
      channel: 'in_app',
      enabled: false,
    };
    const pref = toPreference(row);
    expect(pref.category).toBe(NotificationCategory.Practice);
    expect(pref.channel).toBe(NotificationChannel.InApp);
    expect(pref.enabled).toBe(false);
  });

  it('folds status counts into dense metrics with zero defaults', () => {
    const rows: StatusCountRow[] = [
      { status: 'pending', count: 5 },
      { status: 'dead_lettered', count: 2 },
    ];
    expect(toOutboxMetrics(rows)).toEqual({
      pending: 5,
      processing: 0,
      completed: 0,
      deadLettered: 2,
    });
  });

  it('classifies a recorded error as handler_failed, absence as unknown', () => {
    expect(toFailureCode('handler boom: stack trace')).toBe('handler_failed');
    expect(toFailureCode(null)).toBe('unknown');
  });

  it('maps a dead-letter row without leaking the raw error text', () => {
    const deadLetter = toDeadLetter({
      id: 'ev-1',
      event_type: 'member.invited',
      attempts: 5,
      dead_lettered_at: ISO,
      last_error: 'secret stack trace',
    });

    expect(deadLetter).toEqual({
      eventId: 'ev-1',
      eventType: 'member.invited',
      attempts: 5,
      failedAt: DATE,
      failureCode: 'handler_failed',
    });
    expect(JSON.stringify(deadLetter)).not.toContain('secret stack trace');
  });

  it('maps a job heartbeat row with a parsed outcome', () => {
    expect(
      toJobHeartbeat({
        job_key: 'outbox.dispatcher',
        last_run_at: ISO,
        last_outcome: 'failed',
        failure_count: 2,
      }),
    ).toEqual({
      jobKey: 'outbox.dispatcher',
      lastRunAt: DATE,
      lastOutcome: JobOutcome.Failed,
      failureCount: 2,
    });
  });
});
