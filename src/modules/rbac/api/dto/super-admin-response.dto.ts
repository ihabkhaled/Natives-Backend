import { ApiProperty } from '@core/openapi';

/** One platform super administrator: live global assignment plus identity. */
export class SuperAdminEntryDto {
  @ApiProperty()
  declare readonly assignmentId: string;

  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty()
  declare readonly email: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly displayName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({ type: String, nullable: true })
  declare readonly grantedBy: string | null;
}

/** Bounded listing of the current platform super administrators. */
export class SuperAdminListResponseDto {
  @ApiProperty({ type: [SuperAdminEntryDto] })
  declare readonly items: readonly SuperAdminEntryDto[];

  @ApiProperty()
  declare readonly total: number;
}
