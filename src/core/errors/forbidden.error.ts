import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class ForbiddenError extends AppError {
  readonly status = HttpStatus.FORBIDDEN;
}
