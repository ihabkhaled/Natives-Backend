import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { TryoutAlreadyConvertedError } from './tryout-already-converted.error';
import { TryoutCandidateNotFoundError } from './tryout-candidate-not-found.error';
import { TryoutConsentError } from './tryout-consent.error';
import { TryoutDecisionRequiredError } from './tryout-decision-required.error';
import { TryoutDuplicateError } from './tryout-duplicate.error';
import { TryoutEventNotFoundError } from './tryout-event-not-found.error';
import { TryoutInvalidTransitionError } from './tryout-invalid-transition.error';
import { TryoutOfferNotFoundError } from './tryout-offer-not-found.error';
import { TryoutRegistrationRefusedError } from './tryout-registration-refused.error';
import { TryoutRestrictedError } from './tryout-restricted.error';
import { TryoutScopeNotFoundError } from './tryout-scope-not-found.error';
import { TryoutValidationError } from './tryout-validation.error';
import { TryoutVersionConflictError } from './tryout-version-conflict.error';

describe('tryouts errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new TryoutEventNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.tryouts.eventNotFound',
      },
      {
        error: new TryoutCandidateNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.tryouts.candidateNotFound',
      },
      {
        error: new TryoutScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.tryouts.scopeNotFound',
      },
      {
        error: new TryoutOfferNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.tryouts.offerNotFound',
      },
      {
        error: new TryoutValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.tryouts.validation',
      },
      {
        error: new TryoutConsentError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.tryouts.consentVersion',
      },
      {
        error: new TryoutRegistrationRefusedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.registrationRefused',
      },
      {
        error: new TryoutDuplicateError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.duplicateCandidate',
      },
      {
        error: new TryoutInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.invalidTransition',
      },
      {
        error: new TryoutVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.versionConflict',
      },
      {
        error: new TryoutAlreadyConvertedError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.alreadyConverted',
      },
      {
        error: new TryoutDecisionRequiredError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.tryouts.decisionRequired',
      },
      {
        error: new TryoutRestrictedError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.tryouts.restricted',
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
      new TryoutCandidateNotFoundError().message,
      new TryoutConsentError().message,
      new TryoutRestrictedError().message,
      new TryoutDuplicateError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
