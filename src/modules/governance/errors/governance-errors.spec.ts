import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CaseNotFoundError } from './case-not-found.error';
import { DisciplineForbiddenError } from './discipline-forbidden.error';
import { GovernanceInvalidTransitionError } from './governance-invalid-transition.error';
import { GovernanceScopeNotFoundError } from './governance-scope-not-found.error';
import { GovernanceValidationError } from './governance-validation.error';
import { GovernanceVersionConflictError } from './governance-version-conflict.error';
import { MeetingNotFoundError } from './meeting-not-found.error';
import { PositionNotFoundError } from './position-not-found.error';
import { RuleAcknowledgementForbiddenError } from './rule-acknowledgement-forbidden.error';
import { RuleNotFoundError } from './rule-not-found.error';
import { SeparationOfDutiesError } from './separation-of-duties.error';
import { TaskNotFoundError } from './task-not-found.error';

describe('governance errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new RuleNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.ruleNotFound',
      },
      {
        error: new CaseNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.caseNotFound',
      },
      {
        error: new PositionNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.positionNotFound',
      },
      {
        error: new MeetingNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.meetingNotFound',
      },
      {
        error: new TaskNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.taskNotFound',
      },
      {
        error: new GovernanceScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.governance.scopeNotFound',
      },
      {
        error: new GovernanceValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.governance.validation',
      },
      {
        error: new GovernanceInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.governance.invalidTransition',
      },
      {
        error: new GovernanceVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.governance.versionConflict',
      },
      {
        error: new SeparationOfDutiesError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.governance.separationOfDuties',
      },
      {
        error: new DisciplineForbiddenError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.governance.disciplineForbidden',
      },
      {
        error: new RuleAcknowledgementForbiddenError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.governance.acknowledgementForbidden',
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
      new CaseNotFoundError().message,
      new SeparationOfDutiesError().message,
      new DisciplineForbiddenError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
