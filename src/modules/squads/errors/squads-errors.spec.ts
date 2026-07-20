import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AvailabilityMembershipNotFoundError } from './availability-membership-not-found.error';
import { CandidateNotFoundError } from './candidate-not-found.error';
import { EligibilityOverrideRequiredError } from './eligibility-override-required.error';
import { SelectionNotFoundError } from './selection-not-found.error';
import { SquadInvalidTransitionError } from './squad-invalid-transition.error';
import { SquadLockedError } from './squad-locked.error';
import { SquadNotFoundError } from './squad-not-found.error';
import { SquadScopeNotFoundError } from './squad-scope-not-found.error';
import { SquadValidationError } from './squad-validation.error';
import { SquadVersionConflictError } from './squad-version-conflict.error';

describe('squads errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new SquadNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.squads.squadNotFound',
      },
      {
        error: new SquadScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.squads.scopeNotFound',
      },
      {
        error: new CandidateNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.squads.candidateNotFound',
      },
      {
        error: new SelectionNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.squads.selectionNotFound',
      },
      {
        error: new AvailabilityMembershipNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.squads.availabilityMembershipNotFound',
      },
      {
        error: new SquadValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.squads.validation',
      },
      {
        error: new SquadInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.squads.squadInvalidTransition',
      },
      {
        error: new SquadVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.squads.squadVersionConflict',
      },
      {
        error: new SquadLockedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.squads.squadLocked',
      },
      {
        error: new EligibilityOverrideRequiredError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.squads.eligibilityOverrideRequired',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
