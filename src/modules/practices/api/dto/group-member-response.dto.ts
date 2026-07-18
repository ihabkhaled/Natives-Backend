import { ApiProperty } from '@core/openapi';

/** A participant assigned to a group (membership id only — no PII). */
export class GroupMemberResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;
}
