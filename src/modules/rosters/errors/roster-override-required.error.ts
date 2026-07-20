import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_OVERRIDE_REQUIRED_MESSAGE,
  ROSTER_OVERRIDE_REQUIRED_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterOverrideRequiredError extends ConflictError {
  constructor() {
    super(
      ROSTER_OVERRIDE_REQUIRED_MESSAGE,
      ROSTER_OVERRIDE_REQUIRED_MESSAGE_KEY,
    );
  }
}
