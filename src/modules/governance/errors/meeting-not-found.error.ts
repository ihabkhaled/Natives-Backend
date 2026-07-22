import { NotFoundError } from '@core/errors/not-found.error';

import {
  MEETING_NOT_FOUND_MESSAGE,
  MEETING_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class MeetingNotFoundError extends NotFoundError {
  constructor() {
    super(MEETING_NOT_FOUND_MESSAGE, MEETING_NOT_FOUND_MESSAGE_KEY);
  }
}
