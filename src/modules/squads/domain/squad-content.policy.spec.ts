import { describe, expect, it } from 'vitest';

import { SquadValidationError } from '../errors/squad-validation.error';
import type { SquadContent } from '../model/squads.types';
import { assertSquadContent } from './squad-content.policy';

function content(thresholdPct: number): SquadContent {
  return {
    name: 'Squad',
    seasonId: 'season-1',
    competitionId: null,
    attendanceThresholdPct: thresholdPct,
    selectionDeadline: null,
    notes: null,
  };
}

describe('assertSquadContent', () => {
  it('accepts a threshold within the percentage range', () => {
    expect(() => assertSquadContent(content(70))).not.toThrow();
    expect(() => assertSquadContent(content(0))).not.toThrow();
    expect(() => assertSquadContent(content(100))).not.toThrow();
  });

  it('rejects a threshold below zero or above one hundred', () => {
    expect(() => assertSquadContent(content(-1))).toThrow(SquadValidationError);
    expect(() => assertSquadContent(content(101))).toThrow(
      SquadValidationError,
    );
  });
});
