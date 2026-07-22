import { ValidationError } from '@core/errors/validation.error';

import {
  STANDINGS_PROVENANCE_MESSAGE,
  STANDINGS_PROVENANCE_MESSAGE_KEY,
} from '../model/standings.constants';

export class StandingsProvenanceError extends ValidationError {
  constructor() {
    super(STANDINGS_PROVENANCE_MESSAGE, STANDINGS_PROVENANCE_MESSAGE_KEY);
  }
}
