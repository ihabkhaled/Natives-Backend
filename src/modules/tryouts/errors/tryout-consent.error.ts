import { ValidationError } from '@core/errors/validation.error';

import {
  TRYOUT_CONSENT_MESSAGE,
  TRYOUT_CONSENT_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutConsentError extends ValidationError {
  constructor() {
    super(TRYOUT_CONSENT_MESSAGE, TRYOUT_CONSENT_MESSAGE_KEY);
  }
}
