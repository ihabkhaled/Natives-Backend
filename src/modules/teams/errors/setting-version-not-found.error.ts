import { NotFoundError } from '@core/errors/not-found.error';

import {
  SETTING_VERSION_NOT_FOUND_MESSAGE,
  SETTING_VERSION_NOT_FOUND_MESSAGE_KEY,
} from '../model/teams.constants';

/** Raised when a setting version does not exist within the team scope. */
export class SettingVersionNotFoundError extends NotFoundError {
  constructor() {
    super(
      SETTING_VERSION_NOT_FOUND_MESSAGE,
      SETTING_VERSION_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
