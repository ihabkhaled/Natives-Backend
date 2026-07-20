import { ValidationError } from '@core/errors/validation.error';

import {
  FIXTURE_SCHEDULE_MESSAGE,
  FIXTURE_SCHEDULE_MESSAGE_KEY,
} from '../model/competitions.constants';

export class FixtureScheduleError extends ValidationError {
  constructor() {
    super(FIXTURE_SCHEDULE_MESSAGE, FIXTURE_SCHEDULE_MESSAGE_KEY);
  }
}
