import { ConflictError } from '@core/errors/conflict.error';

import {
  REPORT_VERSION_CONFLICT_MESSAGE,
  REPORT_VERSION_CONFLICT_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportVersionConflictError extends ConflictError {
  constructor() {
    super(REPORT_VERSION_CONFLICT_MESSAGE, REPORT_VERSION_CONFLICT_MESSAGE_KEY);
  }
}
