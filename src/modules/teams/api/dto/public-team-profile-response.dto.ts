import { ApiProperty } from '@core/openapi';

export class PublicTeamProfileResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly slug: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly location: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date',
    description: 'Date-only, ISO YYYY-MM-DD',
  })
  declare readonly foundedOn: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly facebookUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly instagramUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly tiktokUrl: string | null;
}
