import { ApiProperty } from '@core/openapi';

export class PublicRosterPlayerResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly nickname: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Shirt number exactly as printed, including any leading zero',
  })
  declare readonly jerseyNumber: string | null;

  @ApiProperty({ type: [String] })
  declare readonly positions: readonly string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Direct photo URL, null until an admin attaches one',
  })
  declare readonly photoUrl: string | null;
}
