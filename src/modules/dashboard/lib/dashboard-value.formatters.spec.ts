import { describe, expect, it } from 'vitest';

import { DashboardMetricUnit } from '../model/dashboard.enums';
import {
  formatCount,
  formatPercent,
  formatPoints,
  formatRank,
  unitFor,
} from './dashboard-value.formatters';

describe('formatCount', () => {
  it('renders a real count, including a genuine zero', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(8)).toBe('8');
  });

  it('renders nothing when the value was never measured', () => {
    expect(formatCount(null)).toBeNull();
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(37.4)).toBe('37%');
  });

  it('renders nothing for a null percentage', () => {
    expect(formatPercent(null)).toBeNull();
  });
});

describe('formatPoints', () => {
  it('rounds a ledger total to a whole number', () => {
    expect(formatPoints(14.6)).toBe('15');
  });

  it('renders nothing for a member with no ledger history', () => {
    expect(formatPoints(null)).toBeNull();
  });
});

describe('formatRank', () => {
  it('renders the position out of the ranked population', () => {
    expect(formatRank(2, 11)).toBe('2/11');
  });

  it('renders nothing when either side is unknown', () => {
    expect(formatRank(null, 11)).toBeNull();
    expect(formatRank(2, null)).toBeNull();
  });
});

describe('unitFor', () => {
  it('attaches the unit once there is a value', () => {
    expect(unitFor(5, DashboardMetricUnit.Points)).toBe(
      DashboardMetricUnit.Points,
    );
  });

  it('omits the unit when nothing was measured', () => {
    expect(unitFor(null, DashboardMetricUnit.Points)).toBeNull();
  });
});
