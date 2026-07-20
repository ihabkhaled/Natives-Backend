import { describe, expect, it } from 'vitest';

import {
  DashboardMetricUnit,
  DashboardPresentation,
  DashboardTone,
  DashboardWidgetKind,
  DashboardWidgetStatus,
} from '../model/dashboard.enums';
import {
  breakdownWidget,
  emptyMetric,
  metricWidget,
  tasksWidget,
} from './dashboard-widget.builders';

const ASOF = new Date('2026-07-20T12:00:00.000Z');

describe('metricWidget', () => {
  it('is ready when a value was measured', () => {
    const widget = metricWidget(
      DashboardWidgetKind.MemberProfile,
      {
        value: 80,
        displayValue: '80%',
        unit: DashboardMetricUnit.Percent,
        tone: DashboardTone.Positive,
      },
      ASOF,
    );

    expect(widget.presentation).toBe(DashboardPresentation.Metric);
    expect(widget.status).toBe(DashboardWidgetStatus.Ready);
    expect(widget.asOf).toBe(ASOF);
  });

  it('is empty when nothing was measured', () => {
    const widget = metricWidget(
      DashboardWidgetKind.MemberStanding,
      emptyMetric(DashboardTone.Neutral),
      null,
    );

    expect(widget.status).toBe(DashboardWidgetStatus.Empty);
    expect(widget.metric.value).toBeNull();
    expect(widget.metric.displayValue).toBeNull();
    expect(widget.metric.unit).toBeNull();
  });
});

describe('breakdownWidget', () => {
  it('is ready when at least one row carries a value', () => {
    const widget = breakdownWidget(
      DashboardWidgetKind.MemberAttendance,
      [
        { key: 'present', labelKey: 'k', value: 3, displayValue: '3' },
        { key: 'late', labelKey: 'k', value: null, displayValue: null },
      ],
      ASOF,
    );

    expect(widget.presentation).toBe(DashboardPresentation.Breakdown);
    expect(widget.status).toBe(DashboardWidgetStatus.Ready);
  });

  it('is empty when every row is unmeasured', () => {
    const widget = breakdownWidget(
      DashboardWidgetKind.MemberAttendance,
      [{ key: 'present', labelKey: 'k', value: null, displayValue: null }],
      null,
    );

    expect(widget.status).toBe(DashboardWidgetStatus.Empty);
  });

  it('is empty when there are no rows at all', () => {
    expect(
      breakdownWidget(DashboardWidgetKind.MemberAttendance, [], null).status,
    ).toBe(DashboardWidgetStatus.Empty);
  });
});

describe('tasksWidget', () => {
  it('is ready when at least one task exists', () => {
    const widget = tasksWidget(
      DashboardWidgetKind.MemberSchedule,
      [
        {
          id: 't1',
          labelKey: 'k',
          count: null,
          tone: DashboardTone.Attention,
          occurredAt: ASOF,
        },
      ],
      ASOF,
    );

    expect(widget.presentation).toBe(DashboardPresentation.Tasks);
    expect(widget.status).toBe(DashboardWidgetStatus.Ready);
  });

  it('is empty when there is nothing to do', () => {
    expect(
      tasksWidget(DashboardWidgetKind.MemberSchedule, [], null).status,
    ).toBe(DashboardWidgetStatus.Empty);
  });
});
