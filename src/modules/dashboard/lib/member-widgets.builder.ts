import type { AssessmentDashboardSignals } from '@modules/assessments';
import type { MemberDashboardSignals } from '@modules/members';
import type { PointsStandingSignal } from '@modules/points';
import type { PracticeDashboardSignals } from '@modules/practices';

import {
  toneForBacklog,
  toneForCompleteness,
  toneForStanding,
} from '../domain/dashboard-tone.policy';
import {
  ATTENDANCE_BREAKDOWN_KEYS,
  ATTENDANCE_LABEL_KEY_BY_STATUS,
  DASHBOARD_LABEL_KEYS,
  DASHBOARD_TASK_IDS,
} from '../model/dashboard.constants';
import {
  DashboardMetricUnit,
  DashboardTone,
  DashboardWidgetKind,
} from '../model/dashboard.enums';
import type {
  DashboardBreakdownRow,
  DashboardTask,
  DashboardWidget,
} from '../model/dashboard.types';
import {
  formatCount,
  formatPercent,
  formatPoints,
  formatRank,
  unitFor,
} from './dashboard-value.formatters';
import {
  breakdownWidget,
  metricWidget,
  tasksWidget,
} from './dashboard-widget.builders';

/**
 * Pure builders for the member-facing widgets. Each takes an already-collected
 * signal and shapes it: null measurements stay null, counts a member has never
 * scored stay null rather than becoming zero, and every widget carries the
 * as-of instant its own source reported.
 */

export function memberScheduleWidget(
  signals: PracticeDashboardSignals,
): DashboardWidget {
  const tasks: DashboardTask[] = signals.upcomingSessions.map(session => ({
    id: `${DASHBOARD_TASK_IDS.sessionPrefix}-${session.sessionId}`,
    labelKey: session.hasRsvp
      ? DASHBOARD_LABEL_KEYS.taskRsvpMatch
      : DASHBOARD_LABEL_KEYS.taskConfirmPractice,
    count: null,
    tone: session.hasRsvp ? DashboardTone.Neutral : DashboardTone.Attention,
    occurredAt: session.startsAt,
  }));
  const first = signals.upcomingSessions[0];
  return tasksWidget(
    DashboardWidgetKind.MemberSchedule,
    tasks,
    first === undefined ? null : first.startsAt,
  );
}

export function memberAttendanceWidget(
  signals: PracticeDashboardSignals,
): DashboardWidget {
  const counted = new Map(
    signals.attendanceCounts.map(entry => [entry.status, entry.count]),
  );
  const rows: DashboardBreakdownRow[] = ATTENDANCE_BREAKDOWN_KEYS.map(key => {
    const value = counted.get(key) ?? null;
    return {
      key,
      labelKey: ATTENDANCE_LABEL_KEY_BY_STATUS.get(key) ?? key,
      value,
      displayValue: formatCount(value),
    };
  });
  return breakdownWidget(
    DashboardWidgetKind.MemberAttendance,
    rows,
    signals.attendanceAsOf,
  );
}

export function memberStandingWidget(
  standing: PointsStandingSignal,
): DashboardWidget {
  return metricWidget(
    DashboardWidgetKind.MemberStanding,
    {
      value: standing.rank,
      displayValue: formatRank(standing.rank, standing.population),
      unit: unitFor(standing.rank, DashboardMetricUnit.Rank),
      tone: toneForStanding(standing.rank),
    },
    standing.asOf,
  );
}

export function memberActivityWidget(
  standing: PointsStandingSignal,
): DashboardWidget {
  return metricWidget(
    DashboardWidgetKind.MemberActivity,
    {
      value: standing.total,
      displayValue: formatPoints(standing.total),
      unit: unitFor(standing.total, DashboardMetricUnit.Points),
      tone: DashboardTone.Neutral,
    },
    standing.asOf,
  );
}

export function memberFeedbackWidget(
  signals: AssessmentDashboardSignals,
): DashboardWidget {
  const published = signals.publishedForViewer;
  const tasks: readonly DashboardTask[] =
    published.count === null
      ? []
      : [
          {
            id: DASHBOARD_TASK_IDS.reviewFeedback,
            labelKey: DASHBOARD_LABEL_KEYS.taskReviewFeedback,
            count: published.count,
            tone: DashboardTone.Neutral,
            occurredAt: published.asOf,
          },
        ];
  return tasksWidget(DashboardWidgetKind.MemberFeedback, tasks, published.asOf);
}

export function memberProfileWidget(
  signals: MemberDashboardSignals,
): DashboardWidget {
  const percent = signals.profileCompletenessPercent;
  return metricWidget(
    DashboardWidgetKind.MemberProfile,
    {
      value: percent,
      displayValue: formatPercent(percent),
      unit: unitFor(percent, DashboardMetricUnit.Percent),
      tone: toneForCompleteness(percent),
    },
    signals.profileAsOf,
  );
}

/** Shared shape for the coach/admin backlog widgets: one counted task or none. */
export function backlogWidget(
  kind: DashboardWidgetKind,
  taskId: string,
  labelKey: string,
  count: number | null,
  asOf: Date | null,
): DashboardWidget {
  const tasks: readonly DashboardTask[] =
    count === null
      ? []
      : [
          {
            id: taskId,
            labelKey,
            count,
            tone: toneForBacklog(count),
            occurredAt: asOf,
          },
        ];
  return tasksWidget(kind, tasks, asOf);
}
