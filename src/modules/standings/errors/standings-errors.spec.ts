import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AchievementInvalidTransitionError } from './achievement-invalid-transition.error';
import { AchievementNotFoundError } from './achievement-not-found.error';
import { StandingNotFoundError } from './standing-not-found.error';
import { StandingsProvenanceError } from './standings-provenance.error';
import { StandingsRuleNotFoundError } from './standings-rule-not-found.error';
import { StandingsScopeNotFoundError } from './standings-scope-not-found.error';
import { StandingsValidationError } from './standings-validation.error';
import { StandingsVersionConflictError } from './standings-version-conflict.error';

describe('standings errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new StandingNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.standings.standingNotFound',
      },
      {
        error: new StandingsRuleNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.standings.ruleNotFound',
      },
      {
        error: new StandingsScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.standings.scopeNotFound',
      },
      {
        error: new AchievementNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.standings.achievementNotFound',
      },
      {
        error: new StandingsValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.standings.validation',
      },
      {
        error: new StandingsProvenanceError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.standings.provenanceRequired',
      },
      {
        error: new AchievementInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.standings.achievementInvalidTransition',
      },
      {
        error: new StandingsVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.standings.versionConflict',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('never leaks SQL, vendor text, or personal data in a message', () => {
    const messages = [
      new StandingNotFoundError().message,
      new StandingsProvenanceError().message,
      new AchievementNotFoundError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
