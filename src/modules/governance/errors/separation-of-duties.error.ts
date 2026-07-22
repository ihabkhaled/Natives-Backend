import { ConflictError } from '@core/errors/conflict.error';

import {
  SEPARATION_OF_DUTIES_MESSAGE,
  SEPARATION_OF_DUTIES_MESSAGE_KEY,
} from '../model/governance.constants';

export class SeparationOfDutiesError extends ConflictError {
  constructor() {
    super(SEPARATION_OF_DUTIES_MESSAGE, SEPARATION_OF_DUTIES_MESSAGE_KEY);
  }
}
