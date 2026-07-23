import { ConflictError } from '@core/errors/conflict.error';

import {
  SETTING_VERSION_STALE_MESSAGE,
  SETTING_VERSION_STALE_MESSAGE_KEY,
} from '../model/teams.constants';

/**
 * Raised when the caller's `expectedHeadVersionId` no longer matches the newest
 * stored version for the key (P2, D8) — two admins were scheduling divergent
 * changes concurrently; the loser reloads and reapplies.
 */
export class SettingVersionStaleError extends ConflictError {
  constructor() {
    super(SETTING_VERSION_STALE_MESSAGE, SETTING_VERSION_STALE_MESSAGE_KEY);
  }
}
