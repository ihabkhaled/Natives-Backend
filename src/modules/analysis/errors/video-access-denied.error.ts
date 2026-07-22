import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  VIDEO_ACCESS_DENIED_MESSAGE,
  VIDEO_ACCESS_DENIED_MESSAGE_KEY,
} from '../model/analysis.constants';

export class VideoAccessDeniedError extends ForbiddenError {
  constructor() {
    super(VIDEO_ACCESS_DENIED_MESSAGE, VIDEO_ACCESS_DENIED_MESSAGE_KEY);
  }
}
