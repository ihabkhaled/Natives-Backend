import { ValidationError } from '@core/errors/validation.error';

import {
  SETTING_EFFECTIVE_IN_PAST_MESSAGE,
  SETTING_EFFECTIVE_IN_PAST_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a setting version would be backdated (P2, D5). Appending a
 * past-effective version rewrites how history is interpreted, which the
 * append-only settings model forbids; a small grace window absorbs clock skew.
 */
export class SettingEffectiveInPastError extends ValidationError {
  constructor() {
    super(
      SETTING_EFFECTIVE_IN_PAST_MESSAGE,
      SETTING_EFFECTIVE_IN_PAST_MESSAGE_KEY,
    );
  }
}
