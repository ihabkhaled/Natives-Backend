import { ConflictError } from '@core/errors/conflict.error';

import {
  REPORT_NOT_READY_MESSAGE,
  REPORT_NOT_READY_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportNotReadyError extends ConflictError {
  constructor() {
    super(REPORT_NOT_READY_MESSAGE, REPORT_NOT_READY_MESSAGE_KEY);
  }
}
