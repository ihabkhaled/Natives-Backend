import type { PlayerProfileDto } from '../api/dto/player-profile.dto';
import type { ProfileInput } from '../model/members.types';

/**
 * Maps the validated profile DTO to the vendor-free application command input,
 * normalizing every optional/absent field to an explicit `null` (null-not-zero)
 * and defaulting positions to an empty list. Keeps controllers a single
 * delegation with no inline mapping logic.
 */
export function toProfileInput(dto: PlayerProfileDto): ProfileInput {
  return {
    fullName: dto.fullName,
    preferredName: dto.preferredName ?? null,
    fullNameAr: dto.fullNameAr ?? null,
    nickname: dto.nickname ?? null,
    email: dto.email ?? null,
    phone: dto.phone ?? null,
    gender: dto.gender ?? null,
    division: dto.division ?? null,
    positions: dto.positions ?? [],
    jerseyNumber: dto.jerseyNumber ?? null,
    jerseySize: dto.jerseySize ?? null,
    heightCm: dto.heightCm ?? null,
    weightKg: dto.weightKg ?? null,
    dateOfBirth: dto.dateOfBirth ?? null,
  };
}
