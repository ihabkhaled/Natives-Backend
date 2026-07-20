export interface IdRow {
  readonly id: string;
}

/** Identifiers of the rows the team seeder resolved or created. */
export interface SeedTeamResult {
  readonly teamId: string;
  readonly seasonId: string;
  readonly membershipId: string;
}
