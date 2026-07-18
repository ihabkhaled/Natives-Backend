import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY } from '../model/rbac.constants';
import { AssignmentNotFoundError } from './assignment-not-found.error';

describe('AssignmentNotFoundError', () => {
  it('is a 404 with the assignment-not-found message key', () => {
    const error = new AssignmentNotFoundError();

    expect(error.status).toBe(HttpStatus.NOT_FOUND);
    expect(error.messageKey).toBe(RBAC_ASSIGNMENT_NOT_FOUND_MESSAGE_KEY);
  });
});
