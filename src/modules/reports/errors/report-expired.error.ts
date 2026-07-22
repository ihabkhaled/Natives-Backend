import { ConflictError } from '@core/errors/conflict.error';

import {
  REPORT_EXPIRED_MESSAGE,
  REPORT_EXPIRED_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportExpiredError extends ConflictError {
  constructor() {
    super(REPORT_EXPIRED_MESSAGE, REPORT_EXPIRED_MESSAGE_KEY);
  }
}
