import { NotFoundError } from '@core/errors/not-found.error';

import {
  VIDEO_SOURCE_NOT_FOUND_MESSAGE,
  VIDEO_SOURCE_NOT_FOUND_MESSAGE_KEY,
} from '../model/analysis.constants';

export class VideoSourceNotFoundError extends NotFoundError {
  constructor() {
    super(VIDEO_SOURCE_NOT_FOUND_MESSAGE, VIDEO_SOURCE_NOT_FOUND_MESSAGE_KEY);
  }
}
