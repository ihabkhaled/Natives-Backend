import { NotFoundError } from '@core/errors/not-found.error';

import {
  ANALYSIS_SCOPE_NOT_FOUND_MESSAGE,
  ANALYSIS_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/analysis.constants';

export class AnalysisScopeNotFoundError extends NotFoundError {
  constructor() {
    super(
      ANALYSIS_SCOPE_NOT_FOUND_MESSAGE,
      ANALYSIS_SCOPE_NOT_FOUND_MESSAGE_KEY,
    );
  }
}
