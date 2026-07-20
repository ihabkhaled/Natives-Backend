import {
  DashboardPresentation,
  type DashboardTone,
  type DashboardWidgetKind,
  DashboardWidgetStatus,
} from '../model/dashboard.enums';
import type {
  DashboardBreakdownRow,
  DashboardBreakdownWidget,
  DashboardMetric,
  DashboardMetricWidget,
  DashboardTask,
  DashboardTasksWidget,
} from '../model/dashboard.types';

/**
 * Pure constructors for the three widget shapes. They decide status from the
 * payload so no builder repeats the rule: a metric with no value and a list with
 * no entries are `empty`, everything else is `ready`. Null is preserved
 * throughout — a widget never invents a zero to look populated.
 */

export function metricWidget(
  kind: DashboardWidgetKind,
  metric: DashboardMetric,
  asOf: Date | null,
): DashboardMetricWidget {
  return {
    kind,
    presentation: DashboardPresentation.Metric,
    status:
      metric.value === null
        ? DashboardWidgetStatus.Empty
        : DashboardWidgetStatus.Ready,
    asOf,
    metric,
  };
}

export function breakdownWidget(
  kind: DashboardWidgetKind,
  rows: readonly DashboardBreakdownRow[],
  asOf: Date | null,
): DashboardBreakdownWidget {
  const hasValue = rows.some(row => row.value !== null);
  return {
    kind,
    presentation: DashboardPresentation.Breakdown,
    status: hasValue
      ? DashboardWidgetStatus.Ready
      : DashboardWidgetStatus.Empty,
    asOf,
    rows,
  };
}

export function tasksWidget(
  kind: DashboardWidgetKind,
  tasks: readonly DashboardTask[],
  asOf: Date | null,
): DashboardTasksWidget {
  return {
    kind,
    presentation: DashboardPresentation.Tasks,
    status:
      tasks.length === 0
        ? DashboardWidgetStatus.Empty
        : DashboardWidgetStatus.Ready,
    asOf,
    tasks,
  };
}

/** A metric with no measurement: null value, null display, neutral-safe tone. */
export function emptyMetric(tone: DashboardTone): DashboardMetric {
  return { value: null, displayValue: null, unit: null, tone };
}
