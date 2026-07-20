import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CompetitionInvalidTransitionError } from './competition-invalid-transition.error';
import { CompetitionNotFoundError } from './competition-not-found.error';
import { CompetitionScopeNotFoundError } from './competition-scope-not-found.error';
import { CompetitionValidationError } from './competition-validation.error';
import { CompetitionVersionConflictError } from './competition-version-conflict.error';
import { FixtureInvalidTransitionError } from './fixture-invalid-transition.error';
import { FixtureNotFoundError } from './fixture-not-found.error';
import { FixtureScheduleError } from './fixture-schedule.error';
import { FixtureVersionConflictError } from './fixture-version-conflict.error';
import { OpponentConflictError } from './opponent-conflict.error';
import { OpponentNotFoundError } from './opponent-not-found.error';

describe('competitions errors', () => {
  it('maps not-found errors to 404 with a stable message key', () => {
    const cases = [
      [
        new CompetitionNotFoundError(),
        'errors.competitions.competitionNotFound',
      ],
      [
        new CompetitionScopeNotFoundError(),
        'errors.competitions.scopeNotFound',
      ],
      [new OpponentNotFoundError(), 'errors.competitions.opponentNotFound'],
      [new FixtureNotFoundError(), 'errors.competitions.fixtureNotFound'],
    ] as const;
    for (const [error, key] of cases) {
      expect(error.status).toBe(HttpStatus.NOT_FOUND);
      expect(error.messageKey).toBe(key);
    }
  });

  it('maps conflict errors to 409 with a stable message key', () => {
    const cases = [
      [
        new CompetitionInvalidTransitionError(),
        'errors.competitions.competitionInvalidTransition',
      ],
      [
        new CompetitionVersionConflictError(),
        'errors.competitions.competitionVersionConflict',
      ],
      [new OpponentConflictError(), 'errors.competitions.opponentConflict'],
      [
        new FixtureInvalidTransitionError(),
        'errors.competitions.fixtureInvalidTransition',
      ],
      [
        new FixtureVersionConflictError(),
        'errors.competitions.fixtureVersionConflict',
      ],
    ] as const;
    for (const [error, key] of cases) {
      expect(error.status).toBe(HttpStatus.CONFLICT);
      expect(error.messageKey).toBe(key);
    }
  });

  it('maps validation errors to 400 with a stable message key', () => {
    const cases = [
      [new CompetitionValidationError(), 'errors.competitions.validation'],
      [new FixtureScheduleError(), 'errors.competitions.fixtureSchedule'],
    ] as const;
    for (const [error, key] of cases) {
      expect(error.status).toBe(HttpStatus.BAD_REQUEST);
      expect(error.messageKey).toBe(key);
    }
  });
});
