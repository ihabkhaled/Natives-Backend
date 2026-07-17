import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class NotFoundError extends AppError {
  readonly status = HttpStatus.NOT_FOUND;
}
