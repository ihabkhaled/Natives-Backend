import { ApiProperty } from '@core/openapi';

export class PublicRosterPlayerResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly nickname: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly jerseyNumber: number | null;

  @ApiProperty({ type: [String] })
  declare readonly positions: readonly string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Direct photo URL, null until an admin attaches one',
  })
  declare readonly photoUrl: string | null;
}
