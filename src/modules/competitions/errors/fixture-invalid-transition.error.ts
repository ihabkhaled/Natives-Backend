import { ConflictError } from '@core/errors/conflict.error';

import {
  FIXTURE_INVALID_TRANSITION_MESSAGE,
  FIXTURE_INVALID_TRANSITION_MESSAGE_KEY,
} from '../model/competitions.constants';

export class FixtureInvalidTransitionError extends ConflictError {
  constructor() {
    super(
      FIXTURE_INVALID_TRANSITION_MESSAGE,
      FIXTURE_INVALID_TRANSITION_MESSAGE_KEY,
    );
  }
}
