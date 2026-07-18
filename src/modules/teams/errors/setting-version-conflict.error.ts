import { ConflictError } from '@core/errors/conflict.error';

import {
  SETTING_VERSION_CONFLICT_MESSAGE,
  SETTING_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a setting version already exists at the requested effective instant
 * for the same team and key. Setting versions are immutable and effective-unique;
 * change one by writing a new version at a later effective instant.
 */
export class SettingVersionConflictError extends ConflictError {
  constructor() {
    super(
      SETTING_VERSION_CONFLICT_MESSAGE,
      SETTING_VERSION_CONFLICT_MESSAGE_KEY,
    );
  }
}
