import { plainToInstance, validateSync } from '@core/validation';
import { describe, expect, it } from 'vitest';

import { PlayerProfileDto } from './player-profile.dto';

const VALID = {
  fullName: 'Mahmoud Nasr',
};

function fieldsWithErrors(payload: Record<string, unknown>): string[] {
  const dto = plainToInstance(PlayerProfileDto, payload);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map(error => error.property);
}

describe('PlayerProfileDto jerseyNumber', () => {
  it('accepts a plain number as a string', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '33' })).toEqual([]);
  });

  it('accepts a number with a leading zero, unchanged', () => {
    const dto = plainToInstance(PlayerProfileDto, { ...VALID, jerseyNumber: '011' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.jerseyNumber).toBe('011');
  });

  it('accepts the shirt number 0', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '0' })).toEqual([]);
  });

  it('is optional', () => {
    expect(fieldsWithErrors(VALID)).toEqual([]);
  });

  it('rejects a number sent as a JSON integer, not a string', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: 33 })).toContain('jerseyNumber');
  });

  it('rejects more than four digits', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '12345' })).toContain('jerseyNumber');
  });

  it('rejects a negative sign', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '-1' })).toContain('jerseyNumber');
  });

  it('rejects non-digit characters', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '1a' })).toContain('jerseyNumber');
  });

  it('rejects an empty string rather than treating it as absent', () => {
    expect(fieldsWithErrors({ ...VALID, jerseyNumber: '' })).toContain('jerseyNumber');
  });
});
