import { TooManyRequestsError } from '@core/errors/too-many-requests.error';

import {
  EMAIL_THROTTLED_MESSAGE,
  EMAIL_THROTTLED_MESSAGE_KEY,
} from './email.constants';

/**
 * Raised by `SmtpEmailSenderService` when the in-process send throttle is
 * saturated. A caller whose contract promises delivery (the contact form)
 * lets this propagate as 429; fire-and-forget callers catch it like any
 * other transport failure.
 */
export class EmailThrottledError extends TooManyRequestsError {
  constructor() {
    super(EMAIL_THROTTLED_MESSAGE, EMAIL_THROTTLED_MESSAGE_KEY);
  }
}
