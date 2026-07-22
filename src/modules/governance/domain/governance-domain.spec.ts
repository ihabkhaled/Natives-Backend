import { describe, expect, it } from 'vitest';

import {
  DisciplineStatus,
  DisciplineTransition,
  MeetingStatus,
  MeetingTransition,
  MeetingVisibility,
  TaskStatus,
  TaskTransition,
} from '../model/governance.enums';
import type {
  GovernanceMeeting,
  GovernanceViewer,
} from '../model/governance.types';
import {
  canTransitionDiscipline,
  canTransitionMeeting,
  canTransitionTask,
  disciplineTargetOf,
  isApproveTarget,
  isCompleteTarget,
  isExpungeTarget,
  isMinuteTarget,
  isResolveTarget,
  isReviewTarget,
  meetingTargetOf,
  taskTargetOf,
} from './governance.state-machine';
import {
  applyMeetingVisibility,
  audienceOf,
  canViewMeeting,
  isBelowEligibilityThreshold,
  titleGrantsPermission,
} from './governance-policy';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function meeting(
  overrides: Partial<GovernanceMeeting> = {},
): GovernanceMeeting {
  return {
    meetingId: 'meeting-1',
    teamId: 'team-1',
    title: 'Board sync',
    scheduledAt: NOW,
    agenda: 'budget',
    minutes: 'confidential minutes',
    decisions: [{ ref: 'D1', text: 'approve budget' }],
    visibility: MeetingVisibility.Board,
    status: MeetingStatus.Approved,
    recurrence: 'monthly' as GovernanceMeeting['recurrence'],
    recordVersion: 1,
    createdBy: 'user-1',
    minutesApprovedBy: 'user-2',
    minutesApprovedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('governance policy', () => {
  it('treats attendance as an eligibility signal, never a punishment', () => {
    expect(isBelowEligibilityThreshold(0.6)).toBe(true);
    expect(isBelowEligibilityThreshold(0.7)).toBe(false);
    expect(isBelowEligibilityThreshold(0.9)).toBe(false);
    expect(isBelowEligibilityThreshold(null)).toBe(false);
  });

  it('never grants application permission from a governance title', () => {
    expect(titleGrantsPermission()).toBe(false);
  });

  it('hides board minutes from a caller without the board tier', () => {
    const player: GovernanceViewer = { canManage: false, canReadBoard: false };
    expect(canViewMeeting(meeting(), player)).toBe(false);
    const redacted = applyMeetingVisibility(meeting(), player);
    expect(redacted.minutes).toBeNull();
    expect(redacted.decisions).toEqual([]);
  });

  it('shows board minutes to the board tier and to a manager', () => {
    const board: GovernanceViewer = { canManage: false, canReadBoard: true };
    expect(canViewMeeting(meeting(), board)).toBe(true);
    expect(applyMeetingVisibility(meeting(), board).minutes).toBe(
      'confidential minutes',
    );
    const manager: GovernanceViewer = { canManage: true, canReadBoard: false };
    expect(applyMeetingVisibility(meeting(), manager).minutes).toBe(
      'confidential minutes',
    );
  });

  it('lets any team member see a non-board meeting', () => {
    const player: GovernanceViewer = { canManage: false, canReadBoard: false };
    expect(
      canViewMeeting(meeting({ visibility: MeetingVisibility.Team }), player),
    ).toBe(true);
    expect(
      canViewMeeting(meeting({ visibility: MeetingVisibility.Staff }), player),
    ).toBe(false);
  });

  it('maps the caller to a governance audience', () => {
    expect(audienceOf({ canManage: true, canReadBoard: false })).toBe('staff');
    expect(audienceOf({ canManage: false, canReadBoard: true })).toBe('board');
    expect(audienceOf({ canManage: false, canReadBoard: false })).toBe('team');
  });
});

describe('governance state machines', () => {
  it('walks the discipline process and refuses illegal moves', () => {
    expect(disciplineTargetOf(DisciplineTransition.Notify)).toBe(
      DisciplineStatus.Notified,
    );
    expect(disciplineTargetOf(DisciplineTransition.Resolve)).toBe(
      DisciplineStatus.Resolved,
    );
    expect(
      canTransitionDiscipline(
        DisciplineStatus.Notified,
        DisciplineStatus.Acknowledged,
      ),
    ).toBe(true);
    expect(
      canTransitionDiscipline(DisciplineStatus.Open, DisciplineStatus.Resolved),
    ).toBe(false);
    expect(
      canTransitionDiscipline(
        DisciplineStatus.Expunged,
        DisciplineStatus.Resolved,
      ),
    ).toBe(false);
    expect(isResolveTarget(DisciplineStatus.Resolved)).toBe(true);
    expect(isReviewTarget(DisciplineStatus.UnderReview)).toBe(true);
    expect(isExpungeTarget(DisciplineStatus.Expunged)).toBe(true);
  });

  it('walks the meeting lifecycle', () => {
    expect(meetingTargetOf(MeetingTransition.Minute)).toBe(
      MeetingStatus.Minuted,
    );
    expect(
      canTransitionMeeting(MeetingStatus.Scheduled, MeetingStatus.Held),
    ).toBe(true);
    expect(
      canTransitionMeeting(MeetingStatus.Approved, MeetingStatus.Held),
    ).toBe(false);
    expect(isMinuteTarget(MeetingStatus.Minuted)).toBe(true);
    expect(isApproveTarget(MeetingStatus.Approved)).toBe(true);
  });

  it('walks the task lifecycle', () => {
    expect(taskTargetOf(TaskTransition.Complete)).toBe(TaskStatus.Completed);
    expect(canTransitionTask(TaskStatus.Open, TaskStatus.InProgress)).toBe(
      true,
    );
    expect(canTransitionTask(TaskStatus.Completed, TaskStatus.Open)).toBe(true);
    expect(canTransitionTask(TaskStatus.Cancelled, TaskStatus.InProgress)).toBe(
      false,
    );
    expect(isCompleteTarget(TaskStatus.Completed)).toBe(true);
  });
});
