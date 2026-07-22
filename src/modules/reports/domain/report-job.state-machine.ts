import { MAX_RETRIES } from '../model/reports.constants';
import { ReportStatus } from '../model/reports.enums';

/**
 * The report-job state machine (UN-701). Pure and total.
 *
 *   queued → running → completed
 *                   └→ failed → (retry) → running
 *   completed → expired
 *
 * Every path ends in a TERMINAL state — completed, failed after exhausted
 * retries, or expired — so a job is never stuck in an endless loading state. A
 * failed job may be retried only while retries remain.
 */
const ALLOWED: ReadonlyMap<ReportStatus, readonly ReportStatus[]> = new Map([
  [ReportStatus.Queued, [ReportStatus.Running]],
  [ReportStatus.Running, [ReportStatus.Completed, ReportStatus.Failed]],
  [ReportStatus.Completed, [ReportStatus.Expired]],
  [ReportStatus.Failed, [ReportStatus.Running]],
  [ReportStatus.Expired, []],
]);

export function canTransitionJob(
  from: ReportStatus,
  to: ReportStatus,
): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

/** Whether a completed job may still be downloaded at this instant. */
export function isDownloadable(
  status: ReportStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  return (
    status === ReportStatus.Completed && expiresAt.getTime() > now.getTime()
  );
}

/** Whether a failed job may be retried given its retry count. */
export function canRetry(status: ReportStatus, retryCount: number): boolean {
  return status === ReportStatus.Failed && retryCount < MAX_RETRIES;
}

/** Whether a completed job's download window has elapsed. */
export function isExpired(
  status: ReportStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  if (status !== ReportStatus.Completed) {
    return false;
  }
  return expiresAt.getTime() <= now.getTime();
}
