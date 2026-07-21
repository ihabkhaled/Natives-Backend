import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { MatchEventNotFoundError } from './match-event-not-found.error';
import { MatchFinalizedError } from './match-finalized.error';
import { MatchInvalidTransitionError } from './match-invalid-transition.error';
import { MatchLineupInvalidError } from './match-lineup-invalid.error';
import { MatchNotFoundError } from './match-not-found.error';
import { MatchNotScoringError } from './match-not-scoring.error';
import { MatchOperationConflictError } from './match-operation-conflict.error';
import { MatchPlayNotFoundError } from './match-play-not-found.error';
import { MatchPointAlreadyOpenError } from './match-point-already-open.error';
import { MatchPointNotOpenError } from './match-point-not-open.error';
import { MatchReopenNotAllowedError } from './match-reopen-not-allowed.error';
import { MatchRulesetNotFoundError } from './match-ruleset-not-found.error';
import { MatchScopeNotFoundError } from './match-scope-not-found.error';
import { MatchTimeoutsExhaustedError } from './match-timeouts-exhausted.error';
import { MatchValidationError } from './match-validation.error';
import { MatchVersionConflictError } from './match-version-conflict.error';

describe('matches errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new MatchNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.matches.matchNotFound',
      },
      {
        error: new MatchScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.matches.scopeNotFound',
      },
      {
        error: new MatchRulesetNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.matches.rulesetNotFound',
      },
      {
        error: new MatchEventNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.matches.eventNotFound',
      },
      {
        error: new MatchValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.matches.validation',
      },
      {
        error: new MatchInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.matchInvalidTransition',
      },
      {
        error: new MatchVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.matchVersionConflict',
      },
      {
        error: new MatchFinalizedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.matchFinalized',
      },
      {
        error: new MatchNotScoringError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.matchNotScoring',
      },
      {
        error: new MatchOperationConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.operationConflict',
      },
      {
        error: new MatchTimeoutsExhaustedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.timeoutsExhausted',
      },
      {
        error: new MatchReopenNotAllowedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.reopenNotAllowed',
      },
      {
        error: new MatchPointNotOpenError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.pointNotOpen',
      },
      {
        error: new MatchPointAlreadyOpenError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.matches.pointAlreadyOpen',
      },
      {
        error: new MatchPlayNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.matches.playNotFound',
      },
      {
        error: new MatchLineupInvalidError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.matches.lineupInvalid',
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
      new MatchNotFoundError().message,
      new MatchFinalizedError().message,
      new MatchOperationConflictError().message,
      new MatchTimeoutsExhaustedError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
