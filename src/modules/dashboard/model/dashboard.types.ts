import type { AssessmentDashboardSignals } from '@modules/assessments';
import type { MemberDashboardSignals } from '@modules/members';
import type { PointsStandingSignal } from '@modules/points';
import type { PracticeDashboardSignals } from '@modules/practices';

import type {
  DashboardMetricUnit,
  DashboardPersona,
  DashboardPresentation,
  DashboardTone,
  DashboardWidgetKind,
  DashboardWidgetStatus,
} from './dashboard.enums';

/**
 * Wire model for the dashboard summary. Every numeric field is nullable and null
 * means "not evaluated" — it is never coerced to zero. `displayValue` is the
 * server-rounded string the client renders verbatim so no client recomputes a
 * score. The whole document is a projection; nothing here is stored or editable.
 */

export interface DashboardMetric {
  readonly value: number | null;
  readonly displayValue: string | null;
  readonly unit: DashboardMetricUnit | null;
  readonly tone: DashboardTone;
}

export interface DashboardBreakdownRow {
  readonly key: string;
  /** i18n key for the row label; raw server copy is never rendered. */
  readonly labelKey: string;
  readonly value: number | null;
  readonly displayValue: string | null;
}

export interface DashboardTask {
  readonly id: string;
  readonly labelKey: string;
  readonly count: number | null;
  readonly tone: DashboardTone;
  /** The instant the task refers to, or null when it is not time-bound. */
  readonly occurredAt: Date | null;
}

interface DashboardWidgetBase {
  readonly kind: DashboardWidgetKind;
  readonly status: DashboardWidgetStatus;
  /** Per-widget freshness instant, or null when the source reported none. */
  readonly asOf: Date | null;
}

export interface DashboardMetricWidget extends DashboardWidgetBase {
  readonly presentation: DashboardPresentation.Metric;
  readonly metric: DashboardMetric;
}

export interface DashboardBreakdownWidget extends DashboardWidgetBase {
  readonly presentation: DashboardPresentation.Breakdown;
  readonly rows: readonly DashboardBreakdownRow[];
}

export interface DashboardTasksWidget extends DashboardWidgetBase {
  readonly presentation: DashboardPresentation.Tasks;
  readonly tasks: readonly DashboardTask[];
}

export type DashboardWidget =
  DashboardMetricWidget | DashboardBreakdownWidget | DashboardTasksWidget;

export interface DashboardSummary {
  readonly persona: DashboardPersona;
  readonly generatedAt: Date;
  readonly widgets: readonly DashboardWidget[];
}

/**
 * The team/season/membership the summary is computed for, resolved from the
 * caller's own memberships — never from a client-supplied identity.
 */
export interface DashboardScope {
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string | null;
}

/** Everything the widget builders need, gathered once per request. */
export interface DashboardInputs {
  readonly persona: DashboardPersona;
  readonly permissions: ReadonlySet<string>;
  readonly generatedAt: Date;
}

/**
 * The signals the summary is projected from, each collected once through its
 * owning module's public surface. No widget re-queries: this bundle is the whole
 * input set for one request.
 */
export interface DashboardSignalBundle {
  readonly practices: PracticeDashboardSignals;
  readonly assessments: AssessmentDashboardSignals;
  readonly points: PointsStandingSignal;
  readonly members: MemberDashboardSignals;
}
