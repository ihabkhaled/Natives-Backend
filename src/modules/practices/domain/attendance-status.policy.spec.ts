import { describe, expect, it } from 'vitest';

import { AttendanceStatus } from '../model/attendance.enums';
import {
  allowsExcuseCategory,
  allowsLateness,
  isAbsent,
  isAttended,
  isExcused,
  isLate,
} from './attendance-status.policy';

describe('isAttended', () => {
  it('is true for present/approved statuses only', () => {
    expect(isAttended(AttendanceStatus.PresentOnTime)).toBe(true);
    expect(isAttended(AttendanceStatus.PresentLate)).toBe(true);
    expect(isAttended(AttendanceStatus.RemoteApproved)).toBe(true);
    expect(isAttended(AttendanceStatus.OtherApproved)).toBe(true);
    expect(isAttended(AttendanceStatus.Excused)).toBe(false);
    expect(isAttended(AttendanceStatus.Injured)).toBe(false);
    expect(isAttended(AttendanceStatus.Absent)).toBe(false);
  });
});

describe('isExcused', () => {
  it('is true for excused and injured only', () => {
    expect(isExcused(AttendanceStatus.Excused)).toBe(true);
    expect(isExcused(AttendanceStatus.Injured)).toBe(true);
    expect(isExcused(AttendanceStatus.PresentOnTime)).toBe(false);
    expect(isExcused(AttendanceStatus.Absent)).toBe(false);
  });
});

describe('isAbsent', () => {
  it('is true only for an explicit absence', () => {
    expect(isAbsent(AttendanceStatus.Absent)).toBe(true);
    expect(isAbsent(AttendanceStatus.Excused)).toBe(false);
    expect(isAbsent(AttendanceStatus.PresentLate)).toBe(false);
  });
});

describe('isLate', () => {
  it('is true only for present-late', () => {
    expect(isLate(AttendanceStatus.PresentLate)).toBe(true);
    expect(isLate(AttendanceStatus.PresentOnTime)).toBe(false);
  });
});

describe('allowsLateness', () => {
  it('allows lateness only for a present-late status', () => {
    expect(allowsLateness(AttendanceStatus.PresentLate)).toBe(true);
    expect(allowsLateness(AttendanceStatus.PresentOnTime)).toBe(false);
    expect(allowsLateness(AttendanceStatus.Absent)).toBe(false);
  });
});

describe('allowsExcuseCategory', () => {
  it('allows an excuse category only for excused/injured', () => {
    expect(allowsExcuseCategory(AttendanceStatus.Excused)).toBe(true);
    expect(allowsExcuseCategory(AttendanceStatus.Injured)).toBe(true);
    expect(allowsExcuseCategory(AttendanceStatus.Absent)).toBe(false);
    expect(allowsExcuseCategory(AttendanceStatus.PresentOnTime)).toBe(false);
  });
});
