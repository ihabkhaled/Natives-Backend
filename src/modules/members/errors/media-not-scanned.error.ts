import { ConflictError } from '@core/errors/conflict.error';

import {
  MEDIA_NOT_SCANNED_MESSAGE,
  MEDIA_NOT_SCANNED_MESSAGE_KEY,
} from '../model/members.constants';

/** Raised when attaching media that has not been cleared by the malware scan. */
export class MediaNotScannedError extends ConflictError {
  constructor() {
    super(MEDIA_NOT_SCANNED_MESSAGE, MEDIA_NOT_SCANNED_MESSAGE_KEY);
  }
}
