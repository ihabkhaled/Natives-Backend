import { ConflictError } from '@core/errors/conflict.error';

import {
  TRYOUT_ALREADY_CONVERTED_MESSAGE,
  TRYOUT_ALREADY_CONVERTED_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutAlreadyConvertedError extends ConflictError {
  constructor() {
    super(
      TRYOUT_ALREADY_CONVERTED_MESSAGE,
      TRYOUT_ALREADY_CONVERTED_MESSAGE_KEY,
    );
  }
}
