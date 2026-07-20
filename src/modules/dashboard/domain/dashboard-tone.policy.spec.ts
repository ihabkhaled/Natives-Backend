import { describe, expect, it } from 'vitest';

import { DashboardTone } from '../model/dashboard.enums';
import {
  toneForBacklog,
  toneForCompleteness,
  toneForStanding,
} from './dashboard-tone.policy';

describe('toneForBacklog', () => {
  it.each([
    [null, DashboardTone.Neutral],
    [0, DashboardTone.Neutral],
    [1, DashboardTone.Attention],
    [4, DashboardTone.Attention],
    [5, DashboardTone.Critical],
    [50, DashboardTone.Critical],
  ])('maps a backlog of %s to %s', (count, expected) => {
    expect(toneForBacklog(count)).toBe(expected);
  });
});

describe('toneForCompleteness', () => {
  it.each([
    [null, DashboardTone.Neutral],
    [100, DashboardTone.Positive],
    [80, DashboardTone.Positive],
    [79, DashboardTone.Neutral],
    [50, DashboardTone.Neutral],
    [49, DashboardTone.Attention],
    [0, DashboardTone.Attention],
  ])('maps %s percent complete to %s', (percent, expected) => {
    expect(toneForCompleteness(percent)).toBe(expected);
  });
});

describe('toneForStanding', () => {
  it.each([
    [null, DashboardTone.Neutral],
    [1, DashboardTone.Positive],
    [3, DashboardTone.Positive],
    [4, DashboardTone.Neutral],
  ])('maps rank %s to %s', (rank, expected) => {
    expect(toneForStanding(rank)).toBe(expected);
  });
});
