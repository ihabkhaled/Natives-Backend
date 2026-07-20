import { canSeeWidget } from '../domain/widget-visibility.policy';
import {
  DASHBOARD_LABEL_KEYS,
  DASHBOARD_TASK_IDS,
} from '../model/dashboard.constants';
import { DashboardWidgetKind } from '../model/dashboard.enums';
import type {
  DashboardInputs,
  DashboardSignalBundle,
  DashboardSummary,
  DashboardWidget,
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

/**
 * Assemble the summary: build every widget the caller's permissions reveal, in a
 * stable order, and drop the rest. Pure — the signals and the clock reading are
 * inputs, so the same request always produces the same document.
 */
export function assembleSummary(
  inputs: DashboardInputs,
  signals: DashboardSignalBundle,
): DashboardSummary {
  const candidates = buildCandidates(signals);
  const widgets = candidates.filter(widget =>
    canSeeWidget(widget.kind, inputs.permissions),
  );
  return {
    persona: inputs.persona,
    generatedAt: inputs.generatedAt,
    widgets,
  };
}

function buildCandidates(
  signals: DashboardSignalBundle,
): readonly DashboardWidget[] {
  return [
    memberScheduleWidget(signals.practices),
    memberAttendanceWidget(signals.practices),
    memberStandingWidget(signals.points),
    memberActivityWidget(signals.points),
    memberFeedbackWidget(signals.assessments),
    memberProfileWidget(signals.members),
    ...buildStaffCandidates(signals),
  ];
}

function buildStaffCandidates(
  signals: DashboardSignalBundle,
): readonly DashboardWidget[] {
  const drafts = signals.practices.draftSessions;
  const sheets = signals.practices.openAttendanceSheets;
  const reviews = signals.assessments.awaitingReview;
  const invited = signals.members.invitedMembers;
  return [
    backlogWidget(
      DashboardWidgetKind.CoachSessions,
      DASHBOARD_TASK_IDS.planSessions,
      DASHBOARD_LABEL_KEYS.taskPlanSession,
      drafts.count,
      drafts.asOf,
    ),
    backlogWidget(
      DashboardWidgetKind.CoachAttention,
      DASHBOARD_TASK_IDS.finalizeAttendance,
      DASHBOARD_LABEL_KEYS.taskFinalizeAttendance,
      sheets.count,
      sheets.asOf,
    ),
    backlogWidget(
      DashboardWidgetKind.CoachAssessments,
      DASHBOARD_TASK_IDS.completeAssessments,
      DASHBOARD_LABEL_KEYS.taskCompleteAssessments,
      reviews.count,
      reviews.asOf,
    ),
    backlogWidget(
      DashboardWidgetKind.CoachRoster,
      DASHBOARD_TASK_IDS.updateRoster,
      DASHBOARD_LABEL_KEYS.taskUpdateRoster,
      invited.count,
      invited.asOf,
    ),
    backlogWidget(
      DashboardWidgetKind.AdminLifecycle,
      DASHBOARD_TASK_IDS.reviewInvitations,
      DASHBOARD_LABEL_KEYS.taskReviewInvitations,
      invited.count,
      invited.asOf,
    ),
  ];
}
