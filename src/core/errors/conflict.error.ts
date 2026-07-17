import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class ConflictError extends AppError {
  readonly status = HttpStatus.CONFLICT;
}
