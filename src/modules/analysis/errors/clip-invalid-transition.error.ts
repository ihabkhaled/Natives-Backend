import { ConflictError } from '@core/errors/conflict.error';

import {
  CLIP_INVALID_TRANSITION_MESSAGE,
  CLIP_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/analysis.constants';

export class ClipInvalidTransitionError extends ConflictError {
  constructor() {
    super(CLIP_INVALID_TRANSITION_MESSAGE, CLIP_INVALID_TRANSITION_MESSAGE_KEY);
  }
}
