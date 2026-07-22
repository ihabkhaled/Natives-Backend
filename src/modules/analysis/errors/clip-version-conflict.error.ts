import { ConflictError } from '@core/errors/conflict.error';

import {
  CLIP_VERSION_CONFLICT_MESSAGE,
  CLIP_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/analysis.constants';

export class ClipVersionConflictError extends ConflictError {
  constructor() {
    super(CLIP_VERSION_CONFLICT_MESSAGE, CLIP_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
