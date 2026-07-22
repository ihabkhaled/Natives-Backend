import { ConflictError } from '@core/errors/conflict.error';

import {
  NUMBER_COLLISION_MESSAGE,
  NUMBER_COLLISION_MESSAGE_KEY,
} from '../model/jerseys.constants';

export class NumberCollisionError extends ConflictError {
  constructor() {
    super(NUMBER_COLLISION_MESSAGE, NUMBER_COLLISION_MESSAGE_KEY);
  }
}
