import { AnomalyStatus, AnomalyTransition } from '../model/dataquality.enums';

/**
 * The anomaly-queue state machine (UN-705). Pure and total.
 *
 *   open → acknowledged → resolved
 *   open/acknowledged → suppressed → (reopen) → open
 *   resolved → (reopen) → open
 *
 * A resolved or suppressed anomaly REOPENS if the underlying condition is
 * detected again — an anomaly is never silently closed for good while the data
 * is still wrong. Suppression is temporary and carries an expiry; it quiets an
 * alert, it does not erase the finding.
 */
const ALLOWED: ReadonlyMap<AnomalyStatus, readonly AnomalyStatus[]> = new Map([
  [
    AnomalyStatus.Open,
    [
      AnomalyStatus.Acknowledged,
      AnomalyStatus.Suppressed,
      AnomalyStatus.Resolved,
    ],
  ],
  [
    AnomalyStatus.Acknowledged,
    [AnomalyStatus.Resolved, AnomalyStatus.Suppressed],
  ],
  [AnomalyStatus.Resolved, [AnomalyStatus.Open]],
  [AnomalyStatus.Suppressed, [AnomalyStatus.Open]],
]);

const TARGETS: ReadonlyMap<AnomalyTransition, AnomalyStatus> = new Map([
  [AnomalyTransition.Acknowledge, AnomalyStatus.Acknowledged],
  [AnomalyTransition.Resolve, AnomalyStatus.Resolved],
  [AnomalyTransition.Suppress, AnomalyStatus.Suppressed],
  [AnomalyTransition.Reopen, AnomalyStatus.Open],
]);

export function anomalyTargetOf(transition: AnomalyTransition): AnomalyStatus {
  return TARGETS.get(transition) ?? AnomalyStatus.Open;
}

export function canTransitionAnomaly(
  from: AnomalyStatus,
  to: AnomalyStatus,
): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

export function isResolveTarget(status: AnomalyStatus): boolean {
  return status === AnomalyStatus.Resolved;
}

export function isSuppressTarget(status: AnomalyStatus): boolean {
  return status === AnomalyStatus.Suppressed;
}

export function isReopenTarget(status: AnomalyStatus): boolean {
  return status === AnomalyStatus.Open;
}

/** Whether a re-detected anomaly in this state should reopen. */
export function shouldReopen(
  status: AnomalyStatus,
  now: Date,
  suppressedUntil: Date | null,
): boolean {
  if (status === AnomalyStatus.Resolved) {
    return true;
  }
  if (status === AnomalyStatus.Suppressed) {
    return (
      suppressedUntil === null || suppressedUntil.getTime() <= now.getTime()
    );
  }
  return false;
}
