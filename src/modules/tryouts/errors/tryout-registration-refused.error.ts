import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_REGISTRATION_REFUSED_MESSAGE,
  TRYOUT_REGISTRATION_REFUSED_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutRegistrationRefusedError extends ConflictError {
  constructor() {
    super(
      TRYOUT_REGISTRATION_REFUSED_MESSAGE,
      TRYOUT_REGISTRATION_REFUSED_MESSAGE_KEY,
    );
  }
}
