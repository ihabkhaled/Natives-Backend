import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RosterAvailabilityMembershipNotFoundError } from './roster-availability-membership-not-found.error';
import { RosterCandidateNotFoundError } from './roster-candidate-not-found.error';
import { RosterConstraintError } from './roster-constraint.error';
import { RosterEntryNotFoundError } from './roster-entry-not-found.error';
import { RosterInvalidTransitionError } from './roster-invalid-transition.error';
import { RosterJerseyConflictError } from './roster-jersey-conflict.error';
import { RosterLockedError } from './roster-locked.error';
import { RosterNotFoundError } from './roster-not-found.error';
import { RosterOverrideRequiredError } from './roster-override-required.error';
import { RosterScopeNotFoundError } from './roster-scope-not-found.error';
import { RosterSnapshotImmutableError } from './roster-snapshot-immutable.error';
import { RosterValidationError } from './roster-validation.error';
import { RosterVersionConflictError } from './roster-version-conflict.error';

describe('rosters errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new RosterNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.rosters.rosterNotFound',
      },
      {
        error: new RosterScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.rosters.scopeNotFound',
      },
      {
        error: new RosterEntryNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.rosters.entryNotFound',
      },
      {
        error: new RosterCandidateNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.rosters.candidateNotFound',
      },
      {
        error: new RosterAvailabilityMembershipNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.rosters.availabilityMembershipNotFound',
      },
      {
        error: new RosterValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.rosters.validation',
      },
      {
        error: new RosterInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.rosterInvalidTransition',
      },
      {
        error: new RosterVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.rosterVersionConflict',
      },
      {
        error: new RosterLockedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.rosterLocked',
      },
      {
        error: new RosterConstraintError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.rosterConstraint',
      },
      {
        error: new RosterOverrideRequiredError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.overrideRequired',
      },
      {
        error: new RosterJerseyConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.jerseyConflict',
      },
      {
        error: new RosterSnapshotImmutableError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.rosters.snapshotImmutable',
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
      new RosterNotFoundError().message,
      new RosterLockedError().message,
      new RosterSnapshotImmutableError().message,
      new RosterJerseyConflictError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
