import { ConflictError } from '@core/errors/conflict.error';

import {
  REPORT_RETRY_NOT_ALLOWED_MESSAGE,
  REPORT_RETRY_NOT_ALLOWED_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportRetryNotAllowedError extends ConflictError {
  constructor() {
    super(
      REPORT_RETRY_NOT_ALLOWED_MESSAGE,
      REPORT_RETRY_NOT_ALLOWED_MESSAGE_KEY,
    );
  }
}
