import { NotFoundError } from '@core/errors/not-found.error';

import {
  MEDIA_NOT_FOUND_MESSAGE,
  MEDIA_NOT_FOUND_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when a media asset does not exist for the requested membership. */
export class MediaNotFoundError extends NotFoundError {
  constructor() {
    super(MEDIA_NOT_FOUND_MESSAGE, MEDIA_NOT_FOUND_MESSAGE_KEY);
  }
}
