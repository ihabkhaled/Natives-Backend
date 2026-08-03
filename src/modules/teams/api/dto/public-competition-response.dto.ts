import { ApiProperty } from '@core/openapi';

/**
 * One competition on the public site. Publishable fields only: what it was
 * called, when it ran, and how far along it is — never the internal notes,
 * cancellation reason, or organiser contact.
 */
export class PublicCompetitionResponseDto {
  @ApiProperty()
  declare readonly competitionId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ description: 'Season label, e.g. "Season 2026".' })
  declare readonly seasonName: string;

  @ApiProperty({ description: 'friendly | league | tournament …' })
  declare readonly competitionType: string;

  @ApiProperty({ nullable: true, type: String })
  declare readonly startsOn: string | null;

  @ApiProperty({ nullable: true, type: String })
  declare readonly endsOn: string | null;
}
