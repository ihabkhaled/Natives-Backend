import type { AssessmentDashboardSignals } from '@modules/assessments';
import type { MemberDashboardSignals } from '@modules/members';
import type { PointsStandingSignal } from '@modules/points';
import type { PracticeDashboardSignals } from '@modules/practices';
import { describe, expect, it } from 'vitest';

import { DASHBOARD_LABEL_KEYS } from '../model/dashboard.constants';
import {
  DashboardMetricUnit,
  DashboardPresentation,
  DashboardTone,
  DashboardWidgetKind,
  DashboardWidgetStatus,
} from '../model/dashboard.enums';
import type {
  DashboardBreakdownWidget,
  DashboardMetricWidget,
  DashboardTasksWidget,
} from '../model/dashboard.types';
import {
  backlogWidget,
  memberActivityWidget,
  memberAttendanceWidget,
  memberFeedbackWidget,
  memberProfileWidget,
  memberScheduleWidget,
  memberStandingWidget,
} from './member-widgets.builder';

const STARTS_AT = new Date('2026-07-21T17:00:00.000Z');
const ASOF = new Date('2026-07-20T12:00:00.000Z');

const EMPTY_PRACTICES: PracticeDashboardSignals = {
  upcomingSessions: [],
  attendanceCounts: [],
  attendanceAsOf: null,
  draftSessions: { count: null, asOf: null },
  openAttendanceSheets: { count: null, asOf: null },
};

function tasksOf(widget: { presentation: DashboardPresentation }) {
  return (widget as DashboardTasksWidget).tasks;
}

function rowsOf(widget: { presentation: DashboardPresentation }) {
  return (widget as DashboardBreakdownWidget).rows;
}

function metricOf(widget: { presentation: DashboardPresentation }) {
  return (widget as DashboardMetricWidget).metric;
}

describe('memberScheduleWidget', () => {
  it('asks for a confirmation on a session the member has not answered', () => {
    const widget = memberScheduleWidget({
      ...EMPTY_PRACTICES,
      upcomingSessions: [
        { sessionId: 'session-1', startsAt: STARTS_AT, hasRsvp: false },
      ],
    });

    expect(widget.status).toBe(DashboardWidgetStatus.Ready);
    expect(widget.asOf).toBe(STARTS_AT);
    expect(tasksOf(widget)[0]).toEqual({
      id: 'session-session-1',
      labelKey: DASHBOARD_LABEL_KEYS.taskConfirmPractice,
      count: null,
      tone: DashboardTone.Attention,
      occurredAt: STARTS_AT,
    });
  });

  it('stays neutral for a session the member already answered', () => {
    const widget = memberScheduleWidget({
      ...EMPTY_PRACTICES,
      upcomingSessions: [
        { sessionId: 'session-1', startsAt: STARTS_AT, hasRsvp: true },
      ],
    });

    expect(tasksOf(widget)[0]?.tone).toBe(DashboardTone.Neutral);
    expect(tasksOf(widget)[0]?.labelKey).toBe(
      DASHBOARD_LABEL_KEYS.taskRsvpMatch,
    );
  });

  it('is empty with no as-of instant when nothing is scheduled', () => {
    const widget = memberScheduleWidget(EMPTY_PRACTICES);

    expect(widget.status).toBe(DashboardWidgetStatus.Empty);
    expect(widget.asOf).toBeNull();
  });
});

describe('memberAttendanceWidget', () => {
  it('reports every status, leaving unrecorded ones null rather than zero', () => {
    const widget = memberAttendanceWidget({
      ...EMPTY_PRACTICES,
      attendanceCounts: [{ status: 'present', count: 8 }],
      attendanceAsOf: ASOF,
    });

    expect(rowsOf(widget)).toEqual([
      {
        key: 'present',
        labelKey: DASHBOARD_LABEL_KEYS.attendancePresent,
        value: 8,
        displayValue: '8',
      },
      {
        key: 'late',
        labelKey: DASHBOARD_LABEL_KEYS.attendanceLate,
        value: null,
        displayValue: null,
      },
      {
        key: 'excused',
        labelKey: DASHBOARD_LABEL_KEYS.attendanceExcused,
        value: null,
        displayValue: null,
      },
      {
        key: 'absent',
        labelKey: DASHBOARD_LABEL_KEYS.attendanceAbsent,
        value: null,
        displayValue: null,
      },
    ]);
    expect(widget.asOf).toBe(ASOF);
  });

  it('is empty when the member has never been marked', () => {
    expect(memberAttendanceWidget(EMPTY_PRACTICES).status).toBe(
      DashboardWidgetStatus.Empty,
    );
  });
});

describe('memberStandingWidget and memberActivityWidget', () => {
  const standing: PointsStandingSignal = {
    total: 14,
    rank: 2,
    population: 9,
    asOf: ASOF,
  };

  it('renders the rank out of the ranked population', () => {
    const widget = memberStandingWidget(standing);

    expect(metricOf(widget)).toEqual({
      value: 2,
      displayValue: '2/9',
      unit: DashboardMetricUnit.Rank,
      tone: DashboardTone.Positive,
    });
  });

  it('renders the ledger total as points', () => {
    expect(metricOf(memberActivityWidget(standing))).toEqual({
      value: 14,
      displayValue: '14',
      unit: DashboardMetricUnit.Points,
      tone: DashboardTone.Neutral,
    });
  });

  it('stays null for a member with no ledger history', () => {
    const empty: PointsStandingSignal = {
      total: null,
      rank: null,
      population: null,
      asOf: null,
    };

    expect(memberStandingWidget(empty).status).toBe(
      DashboardWidgetStatus.Empty,
    );
    expect(metricOf(memberActivityWidget(empty)).displayValue).toBeNull();
  });
});

describe('memberFeedbackWidget', () => {
  const signals: AssessmentDashboardSignals = {
    publishedForViewer: { count: 2, asOf: ASOF },
    awaitingReview: { count: null, asOf: null },
  };

  it('offers one task carrying the published count', () => {
    const widget = memberFeedbackWidget(signals);

    expect(tasksOf(widget)[0]).toEqual({
      id: 'review-feedback',
      labelKey: DASHBOARD_LABEL_KEYS.taskReviewFeedback,
      count: 2,
      tone: DashboardTone.Neutral,
      occurredAt: ASOF,
    });
  });

  it('is empty when nothing has been published for the member', () => {
    const widget = memberFeedbackWidget({
      ...signals,
      publishedForViewer: { count: null, asOf: null },
    });

    expect(widget.status).toBe(DashboardWidgetStatus.Empty);
    expect(tasksOf(widget)).toEqual([]);
  });
});

describe('memberProfileWidget', () => {
  it('renders the completeness percentage with its tone', () => {
    const signals: MemberDashboardSignals = {
      profileCompletenessPercent: 38,
      profileAsOf: ASOF,
      invitedMembers: { count: null, asOf: null },
    };

    expect(metricOf(memberProfileWidget(signals))).toEqual({
      value: 38,
      displayValue: '38%',
      unit: DashboardMetricUnit.Percent,
      tone: DashboardTone.Attention,
    });
  });

  it('is empty when the member has no profile row', () => {
    const signals: MemberDashboardSignals = {
      profileCompletenessPercent: null,
      profileAsOf: null,
      invitedMembers: { count: null, asOf: null },
    };

    expect(memberProfileWidget(signals).status).toBe(
      DashboardWidgetStatus.Empty,
    );
  });
});

describe('backlogWidget', () => {
  it('offers one counted task whose tone follows the backlog size', () => {
    const widget = backlogWidget(
      DashboardWidgetKind.CoachAttention,
      'finalize-attendance',
      DASHBOARD_LABEL_KEYS.taskFinalizeAttendance,
      6,
      ASOF,
    );

    expect(tasksOf(widget)[0]?.count).toBe(6);
    expect(tasksOf(widget)[0]?.tone).toBe(DashboardTone.Critical);
  });

  it('is empty when the backlog is clear', () => {
    const widget = backlogWidget(
      DashboardWidgetKind.CoachAttention,
      'finalize-attendance',
      DASHBOARD_LABEL_KEYS.taskFinalizeAttendance,
      null,
      null,
    );

    expect(widget.status).toBe(DashboardWidgetStatus.Empty);
    expect(tasksOf(widget)).toEqual([]);
  });
});
