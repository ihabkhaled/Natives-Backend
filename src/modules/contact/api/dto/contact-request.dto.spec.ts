import { plainToInstance, validateSync } from '@core/validation';
import { describe, expect, it } from 'vitest';

import { ContactRequestDto } from './contact-request.dto';

const VALID = {
  email: 'visitor@example.test',
  subject: 'Question about tryouts',
  message: 'When do winter tryouts open?',
};

function fieldsWithErrors(payload: Record<string, unknown>): string[] {
  const dto = plainToInstance(ContactRequestDto, payload);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map(error => error.property);
}

describe('ContactRequestDto', () => {
  it('accepts a well-formed submission', () => {
    expect(fieldsWithErrors(VALID)).toEqual([]);
  });

  it('rejects a malformed email', () => {
    expect(fieldsWithErrors({ ...VALID, email: 'not-an-email' })).toContain(
      'email',
    );
  });

  it('rejects a subject below the minimum length', () => {
    expect(fieldsWithErrors({ ...VALID, subject: 'ab' })).toContain('subject');
  });

  it('rejects a subject above the maximum length', () => {
    expect(fieldsWithErrors({ ...VALID, subject: 'a'.repeat(161) })).toContain(
      'subject',
    );
  });

  it('rejects a message below the minimum length', () => {
    expect(fieldsWithErrors({ ...VALID, message: 'too short' })).toContain(
      'message',
    );
  });

  it('rejects a message above the maximum length', () => {
    expect(fieldsWithErrors({ ...VALID, message: 'a'.repeat(4001) })).toContain(
      'message',
    );
  });

  it('trims before length validation so whitespace padding cannot pass', () => {
    expect(fieldsWithErrors({ ...VALID, subject: `  ab  ` })).toContain(
      'subject',
    );
  });

  it('rejects unknown properties (anti header-smuggling)', () => {
    expect(
      fieldsWithErrors({ ...VALID, bcc: 'attacker@example.test' }),
    ).toContain('bcc');
  });
});
