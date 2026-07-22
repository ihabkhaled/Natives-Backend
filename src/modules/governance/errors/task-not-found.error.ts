import { NotFoundError } from '@core/errors/not-found.error';

import {
  TASK_NOT_FOUND_MESSAGE,
  TASK_NOT_FOUND_MESSAGE_KEY,
} from '../model/governance.constants';

export class TaskNotFoundError extends NotFoundError {
  constructor() {
    super(TASK_NOT_FOUND_MESSAGE, TASK_NOT_FOUND_MESSAGE_KEY);
  }
}
