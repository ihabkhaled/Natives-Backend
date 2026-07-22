import {
  DisciplineStatus,
  DisciplineTransition,
  MeetingStatus,
  MeetingTransition,
  TaskStatus,
  TaskTransition,
} from '../model/governance.enums';

/**
 * The governance state machines (UN-602, UN-603). Pure and total.
 *
 * Discipline is a FAIR process, so the vocabulary is explicit: a case is
 * notified, the member acknowledges and responds, a reviewer (never the opener)
 * reviews, and it is resolved — after which it may still be appealed or expunged.
 * A metric can never drive any of these transitions; only a human does.
 */
const DISCIPLINE_ALLOWED: ReadonlyMap<
  DisciplineStatus,
  readonly DisciplineStatus[]
> = new Map([
  [
    DisciplineStatus.Open,
    [DisciplineStatus.Notified, DisciplineStatus.Expunged],
  ],
  [
    DisciplineStatus.Notified,
    [DisciplineStatus.Acknowledged, DisciplineStatus.UnderReview],
  ],
  [
    DisciplineStatus.Acknowledged,
    [DisciplineStatus.Responded, DisciplineStatus.UnderReview],
  ],
  [DisciplineStatus.Responded, [DisciplineStatus.UnderReview]],
  [
    DisciplineStatus.UnderReview,
    [DisciplineStatus.Resolved, DisciplineStatus.Expunged],
  ],
  [
    DisciplineStatus.Resolved,
    [DisciplineStatus.Appealed, DisciplineStatus.Expunged],
  ],
  [
    DisciplineStatus.Appealed,
    [DisciplineStatus.Resolved, DisciplineStatus.Expunged],
  ],
  [DisciplineStatus.Expunged, []],
]);

const DISCIPLINE_TARGETS: ReadonlyMap<DisciplineTransition, DisciplineStatus> =
  new Map([
    [DisciplineTransition.Notify, DisciplineStatus.Notified],
    [DisciplineTransition.Acknowledge, DisciplineStatus.Acknowledged],
    [DisciplineTransition.Respond, DisciplineStatus.Responded],
    [DisciplineTransition.Review, DisciplineStatus.UnderReview],
    [DisciplineTransition.Resolve, DisciplineStatus.Resolved],
    [DisciplineTransition.Appeal, DisciplineStatus.Appealed],
    [DisciplineTransition.Expunge, DisciplineStatus.Expunged],
  ]);

const MEETING_ALLOWED: ReadonlyMap<MeetingStatus, readonly MeetingStatus[]> =
  new Map([
    [MeetingStatus.Scheduled, [MeetingStatus.Held, MeetingStatus.Cancelled]],
    [MeetingStatus.Held, [MeetingStatus.Minuted, MeetingStatus.Cancelled]],
    [MeetingStatus.Minuted, [MeetingStatus.Approved, MeetingStatus.Held]],
    [MeetingStatus.Approved, []],
    [MeetingStatus.Cancelled, []],
  ]);

const MEETING_TARGETS: ReadonlyMap<MeetingTransition, MeetingStatus> = new Map([
  [MeetingTransition.Hold, MeetingStatus.Held],
  [MeetingTransition.Minute, MeetingStatus.Minuted],
  [MeetingTransition.Approve, MeetingStatus.Approved],
  [MeetingTransition.Cancel, MeetingStatus.Cancelled],
]);

const TASK_ALLOWED: ReadonlyMap<TaskStatus, readonly TaskStatus[]> = new Map([
  [
    TaskStatus.Open,
    [
      TaskStatus.InProgress,
      TaskStatus.Blocked,
      TaskStatus.Completed,
      TaskStatus.Cancelled,
    ],
  ],
  [
    TaskStatus.InProgress,
    [TaskStatus.Blocked, TaskStatus.Completed, TaskStatus.Cancelled],
  ],
  [TaskStatus.Blocked, [TaskStatus.InProgress, TaskStatus.Cancelled]],
  [TaskStatus.Completed, [TaskStatus.Open]],
  [TaskStatus.Cancelled, [TaskStatus.Open]],
]);

const TASK_TARGETS: ReadonlyMap<TaskTransition, TaskStatus> = new Map([
  [TaskTransition.Start, TaskStatus.InProgress],
  [TaskTransition.Block, TaskStatus.Blocked],
  [TaskTransition.Complete, TaskStatus.Completed],
  [TaskTransition.Cancel, TaskStatus.Cancelled],
  [TaskTransition.Reopen, TaskStatus.Open],
]);

export function disciplineTargetOf(
  transition: DisciplineTransition,
): DisciplineStatus {
  return DISCIPLINE_TARGETS.get(transition) ?? DisciplineStatus.Open;
}

export function canTransitionDiscipline(
  from: DisciplineStatus,
  to: DisciplineStatus,
): boolean {
  return (DISCIPLINE_ALLOWED.get(from) ?? []).includes(to);
}

export function meetingTargetOf(transition: MeetingTransition): MeetingStatus {
  return MEETING_TARGETS.get(transition) ?? MeetingStatus.Scheduled;
}

export function canTransitionMeeting(
  from: MeetingStatus,
  to: MeetingStatus,
): boolean {
  return (MEETING_ALLOWED.get(from) ?? []).includes(to);
}

export function taskTargetOf(transition: TaskTransition): TaskStatus {
  return TASK_TARGETS.get(transition) ?? TaskStatus.Open;
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (TASK_ALLOWED.get(from) ?? []).includes(to);
}

export function isResolveTarget(status: DisciplineStatus): boolean {
  return status === DisciplineStatus.Resolved;
}

export function isReviewTarget(status: DisciplineStatus): boolean {
  return status === DisciplineStatus.UnderReview;
}

export function isRespondTarget(status: DisciplineStatus): boolean {
  return status === DisciplineStatus.Responded;
}

export function isAppealTarget(status: DisciplineStatus): boolean {
  return status === DisciplineStatus.Appealed;
}

export function isExpungeTarget(status: DisciplineStatus): boolean {
  return status === DisciplineStatus.Expunged;
}

export function isMinuteTarget(status: MeetingStatus): boolean {
  return status === MeetingStatus.Minuted;
}

export function isApproveTarget(status: MeetingStatus): boolean {
  return status === MeetingStatus.Approved;
}

export function isCompleteTarget(status: TaskStatus): boolean {
  return status === TaskStatus.Completed;
}
