import { NotFoundError } from '@core/errors/not-found.error';

import {
  REPORT_SCOPE_NOT_FOUND_MESSAGE,
  REPORT_SCOPE_NOT_FOUND_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportScopeNotFoundError extends NotFoundError {
  constructor() {
    super(REPORT_SCOPE_NOT_FOUND_MESSAGE, REPORT_SCOPE_NOT_FOUND_MESSAGE_KEY);
  }
}
