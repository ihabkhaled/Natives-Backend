import { ApiProperty } from '@core/openapi';

import { AliasSource } from '../../model/members.enums';

/** Alias projection — no normalized key or soft-delete state. */
export class AliasResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly alias: string;

  @ApiProperty({ enum: AliasSource })
  declare readonly source: AliasSource;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}

/** List of a member's active aliases. */
export class ListAliasesResponseDto {
  @ApiProperty({ type: [AliasResponseDto] })
  declare readonly items: readonly AliasResponseDto[];
}
