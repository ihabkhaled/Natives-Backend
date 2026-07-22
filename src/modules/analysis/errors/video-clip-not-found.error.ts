import { NotFoundError } from '@core/errors/not-found.error';

import {
  VIDEO_CLIP_NOT_FOUND_MESSAGE,
  VIDEO_CLIP_NOT_FOUND_MESSAGE_KEY,
} from '../model/analysis.constants';

export class VideoClipNotFoundError extends NotFoundError {
  constructor() {
    super(VIDEO_CLIP_NOT_FOUND_MESSAGE, VIDEO_CLIP_NOT_FOUND_MESSAGE_KEY);
  }
}
