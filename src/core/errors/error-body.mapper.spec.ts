import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { toErrorBody } from './error-body.mapper';
import { NotFoundError } from './not-found.error';

describe('toErrorBody', () => {
  it('maps an AppError to its status and messageKey', () => {
    const body = toErrorBody(
      new NotFoundError('missing', 'errors.article.notFound'),
    );

    expect(body.statusCode).toBe(404);
    expect(body.messageKey).toBe('errors.article.notFound');
    expect(body.message).toBe('missing');
  });

  it('maps a framework HttpException to a safe status-specific key', () => {
    const body = toErrorBody(new BadRequestException('bad'));

    expect(body.statusCode).toBe(400);
    expect(body.messageKey).toBe('errors.http.badRequest');
    expect(body.message).toBe('Request failed');
    expect(body.message).not.toBe('bad');
  });

  it('maps an unknown error to an opaque 500', () => {
    const body = toErrorBody(new Error('boom'));

    expect(body.statusCode).toBe(500);
    expect(body.messageKey).toBe('errors.common.internalError');
    expect(body.message).toBe('Internal server error');
  });

  it('maps an unmapped framework 4xx to the generic safe request key', () => {
    const body = toErrorBody(new HttpException('sensitive', 418));

    expect(body.statusCode).toBe(418);
    expect(body.messageKey).toBe('errors.http.requestFailed');
    expect(body.message).toBe('Request failed');
    expect(body.message).not.toBe('sensitive');
  });

  it('maps a framework server error to the same opaque 500 contract', () => {
    const body = toErrorBody(new InternalServerErrorException('sensitive'));

    expect(body.statusCode).toBe(500);
    expect(body.messageKey).toBe('errors.common.internalError');
    expect(body.message).toBe('Internal server error');
    expect(body.message).not.toBe('sensitive');
  });
});
