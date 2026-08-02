import { plainToInstance, validateSync } from '@core/validation';
import { describe, expect, it } from 'vitest';

import { AddRosterEntryDto } from './add-roster-entry.dto';

const VALID = {
  membershipId: '11111111-1111-4111-8111-111111111111',
};

function fieldsWithErrors(payload: Record<string, unknown>): string[] {
  const dto = plainToInstance(AddRosterEntryDto, payload);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map(error => error.property);
}

describe('AddRosterEntryDto jerseyNumber', () => {
  it('accepts a number with a leading zero, unchanged', () => {
    const dto = plainToInstance(AddRosterEntryDto, {
      ...VALID,
      jerseyNumber: '011',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.jerseyNumber).toBe('011');
  });

  it('is optional', () => {
    expect(fieldsWithErrors(VALID)).toEqual([]);
  });

  it('accepts an explicit null', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: null })).toEqual([]);
  });

  it('rejects a number sent as a JSON integer, not a string', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: 11 })).toContain(
      'jerseyNumber',
    );
  });

  it('rejects more than four digits', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '99999' })).toContain(
      'jerseyNumber',
    );
  });

  it('rejects non-digit characters', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '7B' })).toContain(
      'jerseyNumber',
    );
  });
});
