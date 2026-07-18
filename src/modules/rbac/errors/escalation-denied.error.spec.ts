import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_ESCALATION_DENIED_MESSAGE_KEY } from '../model/rbac.constants';
import { EscalationDeniedError } from './escalation-denied.error';

describe('EscalationDeniedError', () => {
  it('is a 403 with the escalation-denied message key', () => {
    const error = new EscalationDeniedError();

    expect(error.status).toBe(HttpStatus.FORBIDDEN);
    expect(error.messageKey).toBe(RBAC_ESCALATION_DENIED_MESSAGE_KEY);
  });
});
