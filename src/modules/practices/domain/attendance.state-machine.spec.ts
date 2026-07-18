import { describe, expect, it } from 'vitest';

import { AttendanceState } from '../model/attendance.enums';
import {
  allowedTransitions,
  canCorrect,
  canFinalize,
  canRecordInto,
  canTransition,
  isLocked,
} from './attendance.state-machine';

describe('allowedTransitions', () => {
  it('maps each state to its permitted next states', () => {
    expect(allowedTransitions(AttendanceState.Open)).toEqual([
      AttendanceState.Finalized,
    ]);
    expect(allowedTransitions(AttendanceState.Finalized)).toEqual([
      AttendanceState.Corrected,
    ]);
    expect(allowedTransitions(AttendanceState.Corrected)).toEqual([]);
  });
});

describe('canTransition', () => {
  it('permits open → finalized and finalized → corrected only', () => {
    expect(canTransition(AttendanceState.Open, AttendanceState.Finalized)).toBe(
      true,
    );
    expect(
      canTransition(AttendanceState.Finalized, AttendanceState.Corrected),
    ).toBe(true);
  });

  it('rejects illegal and self transitions', () => {
    expect(canTransition(AttendanceState.Open, AttendanceState.Corrected)).toBe(
      false,
    );
    expect(canTransition(AttendanceState.Open, AttendanceState.Open)).toBe(
      false,
    );
    expect(
      canTransition(AttendanceState.Corrected, AttendanceState.Finalized),
    ).toBe(false);
  });
});

describe('canRecordInto', () => {
  it('is true only for an open sheet', () => {
    expect(canRecordInto(AttendanceState.Open)).toBe(true);
    expect(canRecordInto(AttendanceState.Finalized)).toBe(false);
    expect(canRecordInto(AttendanceState.Corrected)).toBe(false);
  });
});

describe('canFinalize', () => {
  it('is true only for an open sheet', () => {
    expect(canFinalize(AttendanceState.Open)).toBe(true);
    expect(canFinalize(AttendanceState.Finalized)).toBe(false);
    expect(canFinalize(AttendanceState.Corrected)).toBe(false);
  });
});

describe('canCorrect', () => {
  it('is true for finalized or corrected, never open', () => {
    expect(canCorrect(AttendanceState.Finalized)).toBe(true);
    expect(canCorrect(AttendanceState.Corrected)).toBe(true);
    expect(canCorrect(AttendanceState.Open)).toBe(false);
  });
});

describe('isLocked', () => {
  it('is true once the sheet leaves the open state', () => {
    expect(isLocked(AttendanceState.Open)).toBe(false);
    expect(isLocked(AttendanceState.Finalized)).toBe(true);
    expect(isLocked(AttendanceState.Corrected)).toBe(true);
  });
});
