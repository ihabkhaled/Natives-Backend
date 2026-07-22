import { ConflictError } from '@core/errors/conflict.error';

import {
  ALIAS_COLLISION_MESSAGE,
  ALIAS_COLLISION_MESSAGE_KEY,
} from '../model/migration.constants';

export class AliasCollisionError extends ConflictError {
  constructor() {
    super(ALIAS_COLLISION_MESSAGE, ALIAS_COLLISION_MESSAGE_KEY);
  }
}
