import { NotFoundError } from '@core/errors/not-found.error';

import {
  REPORT_JOB_NOT_FOUND_MESSAGE,
  REPORT_JOB_NOT_FOUND_MESSAGE_KEY,
} from '../model/reports.constants';

export class ReportJobNotFoundError extends NotFoundError {
  constructor() {
    super(REPORT_JOB_NOT_FOUND_MESSAGE, REPORT_JOB_NOT_FOUND_MESSAGE_KEY);
  }
}
