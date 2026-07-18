export interface IdRow {
  readonly id: string;
}

export interface SeedAdminInput {
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
}

export interface SeedAdminResult {
  readonly userId: string;
  readonly created: boolean;
}
