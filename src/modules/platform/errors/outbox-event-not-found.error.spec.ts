import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { OUTBOX_EVENT_NOT_FOUND_MESSAGE_KEY } from '../model/platform.constants';
import { OutboxEventNotFoundError } from './outbox-event-not-found.error';

describe('OutboxEventNotFoundError', () => {
  it('is a 404 with the outbox event not-found message key', () => {
    const error = new OutboxEventNotFoundError();
    expect(error.status).toBe(HttpStatus.NOT_FOUND);
    expect(error.messageKey).toBe(OUTBOX_EVENT_NOT_FOUND_MESSAGE_KEY);
  });
});
