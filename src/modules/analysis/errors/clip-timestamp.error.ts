import { ValidationError } from '@core/errors/validation.error';

import {
  CLIP_TIMESTAMP_MESSAGE,
  CLIP_TIMESTAMP_MESSAGE_KEY,
} from '../model/analysis.constants';

export class ClipTimestampError extends ValidationError {
  constructor() {
    super(CLIP_TIMESTAMP_MESSAGE, CLIP_TIMESTAMP_MESSAGE_KEY);
  }
}
