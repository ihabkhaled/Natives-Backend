import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { NOTIFICATION_NOT_FOUND_MESSAGE_KEY } from '../model/platform.constants';
import { NotificationNotFoundError } from './notification-not-found.error';

describe('NotificationNotFoundError', () => {
  it('is a 404 with the notification not-found message key', () => {
    const error = new NotificationNotFoundError();
    expect(error.status).toBe(HttpStatus.NOT_FOUND);
    expect(error.messageKey).toBe(NOTIFICATION_NOT_FOUND_MESSAGE_KEY);
  });
});
