import { ValidationError } from '@core/errors/validation.error';

import {
  SETTING_EFFECTIVE_INVALID_MESSAGE,
  SETTING_EFFECTIVE_INVALID_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when a setting version's `effectiveFrom` is not a strict UTC ISO-8601
 * instant with an explicit `Z` designator (P2, D5). Offset-less local strings
 * were silently interpreted server-locally before P2 — rejected at the edge now.
 */
export class SettingEffectiveInvalidError extends ValidationError {
  constructor() {
    super(
      SETTING_EFFECTIVE_INVALID_MESSAGE,
      SETTING_EFFECTIVE_INVALID_MESSAGE_KEY,
    );
  }
}
