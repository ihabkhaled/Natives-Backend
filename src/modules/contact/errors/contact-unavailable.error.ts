import { ServiceUnavailableError } from '@core/errors/service-unavailable.error';

import {
  CONTACT_UNAVAILABLE_MESSAGE,
  CONTACT_UNAVAILABLE_MESSAGE_KEY,
} from '../model/contact.constants';

/**
 * Raised when a contact submission cannot be delivered because outbound email is
 * disabled or has no operator inbox configured. Maps to HTTP 503 — the request
 * was well-formed, the channel is simply not available.
 */
export class ContactUnavailableError extends ServiceUnavailableError {
  constructor() {
    super(CONTACT_UNAVAILABLE_MESSAGE, CONTACT_UNAVAILABLE_MESSAGE_KEY);
  }
}
