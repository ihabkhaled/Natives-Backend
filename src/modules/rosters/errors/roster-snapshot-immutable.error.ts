import { ConflictError } from '@core/errors/conflict.error';

import {
  ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE,
  ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE_KEY,
} from '../model/rosters.constants';

export class RosterSnapshotImmutableError extends ConflictError {
  constructor() {
    super(
      ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE,
      ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE_KEY,
    );
  }
}
