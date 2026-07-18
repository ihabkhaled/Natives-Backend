import { ValidationError } from '@core/errors/validation.error';

import {
  MEDIA_VALIDATION_MESSAGE,
  MEDIA_VALIDATION_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when avatar metadata fails the type, size, or dimension rules. */
export class MediaValidationError extends ValidationError {
  constructor() {
    super(MEDIA_VALIDATION_MESSAGE, MEDIA_VALIDATION_MESSAGE_KEY);
  }
}
