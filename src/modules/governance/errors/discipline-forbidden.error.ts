import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  DISCIPLINE_FORBIDDEN_MESSAGE,
  DISCIPLINE_FORBIDDEN_MESSAGE_KEY,
} from '../model/governance.constants';

export class DisciplineForbiddenError extends ForbiddenError {
  constructor() {
    super(DISCIPLINE_FORBIDDEN_MESSAGE, DISCIPLINE_FORBIDDEN_MESSAGE_KEY);
  }
}
