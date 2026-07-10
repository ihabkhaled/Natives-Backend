import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors/validation.error';
import { UuidValidationPipe } from './uuid-validation.pipe';
import { UUID_INVALID_MESSAGE_KEY } from './validation.constants';

const metadata: ArgumentMetadata = { type: 'param' };

describe('UuidValidationPipe', () => {
  const pipe = new UuidValidationPipe();

  it('accepts a UUID v4 value', async () => {
    await expect(
      pipe.transform('00000000-0000-4000-a000-000000000000', metadata),
    ).resolves.toBe('00000000-0000-4000-a000-000000000000');
  });

  it('throws a typed validation error for malformed input', async () => {
    await expect(pipe.transform('not-a-uuid', metadata)).rejects.toEqual(
      expect.objectContaining<Partial<ValidationError>>({
        messageKey: UUID_INVALID_MESSAGE_KEY,
      }),
    );
  });
});
