import { ConflictError } from '@core/errors/conflict.error';

import {
  SETTING_VERSION_NOT_CANCELLABLE_MESSAGE,
  SETTING_VERSION_NOT_CANCELLABLE_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when cancelling a setting version that is already (or ever was) in
 * effect (P2, D7). A never-in-effect future row is not history and may be
 * deleted; past and current rows stay immutable.
 */
export class SettingVersionNotCancellableError extends ConflictError {
  constructor() {
    super(
      SETTING_VERSION_NOT_CANCELLABLE_MESSAGE,
      SETTING_VERSION_NOT_CANCELLABLE_MESSAGE_KEY,
    );
  }
}
