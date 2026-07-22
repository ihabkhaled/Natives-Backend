import { ConflictError } from '@core/errors/conflict.error';

import {
  CLIP_IMMUTABLE_MESSAGE,
  CLIP_IMMUTABLE_MESSAGE_KEY,
} from '../model/analysis.constants';

export class ClipImmutableError extends ConflictError {
  constructor() {
    super(CLIP_IMMUTABLE_MESSAGE, CLIP_IMMUTABLE_MESSAGE_KEY);
  }
}
