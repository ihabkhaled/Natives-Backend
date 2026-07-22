import { NotFoundError } from '@core/errors/not-found.error';

import {
  CASE_NOT_FOUND_MESSAGE,
  CASE_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class CaseNotFoundError extends NotFoundError {
  constructor() {
    super(CASE_NOT_FOUND_MESSAGE, CASE_NOT_FOUND_MESSAGE_KEY);
  }
}
