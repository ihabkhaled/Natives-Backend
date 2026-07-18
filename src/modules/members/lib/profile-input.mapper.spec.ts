import { describe, expect, it } from 'vitest';

import type { PlayerProfileDto } from '../api/dto/player-profile.dto';
import { PlayerGender } from '../model/members.enums';
import { toProfileInput } from './profile-input.mapper';

describe('toProfileInput', () => {
  it('defaults every absent optional field to null and positions to []', () => {
    const dto = { fullName: 'Ahmed Hassan' } as PlayerProfileDto;
    expect(toProfileInput(dto)).toEqual({
      fullName: 'Ahmed Hassan',
      preferredName: null,
      fullNameAr: null,
      nickname: null,
      email: null,
      phone: null,
      gender: null,
      division: null,
      positions: [],
      jerseyNumber: null,
      jerseySize: null,
      heightCm: null,
      weightKg: null,
      dateOfBirth: null,
    });
  });

  it('passes through provided values', () => {
    const dto = {
      fullName: 'Ahmed Hassan',
      preferredName: 'Ammar',
      gender: PlayerGender.Man,
      positions: ['handler'],
      jerseyNumber: 7,
      heightCm: 180,
      dateOfBirth: '2000-01-01',
    } as PlayerProfileDto;
    const input = toProfileInput(dto);
    expect(input.preferredName).toBe('Ammar');
    expect(input.gender).toBe(PlayerGender.Man);
    expect(input.positions).toEqual(['handler']);
    expect(input.jerseyNumber).toBe(7);
    expect(input.dateOfBirth).toBe('2000-01-01');
  });
});
