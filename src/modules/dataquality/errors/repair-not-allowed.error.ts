import { ConflictError } from '@core/errors/conflict.error';

import {
  REPAIR_NOT_ALLOWED_MESSAGE,
  REPAIR_NOT_ALLOWED_MESSAGE_KEY,
} from '../model/dataquality.constants';

export class RepairNotAllowedError extends ConflictError {
  constructor() {
    super(REPAIR_NOT_ALLOWED_MESSAGE, REPAIR_NOT_ALLOWED_MESSAGE_KEY);
  }
}
