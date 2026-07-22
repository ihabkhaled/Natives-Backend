/**
 * Raw persistence row shapes (snake_case) returned by the SQL layer. Repositories
 * map these into vendor-free domain aggregates. Kept in the model layer so
 * implementation files stay free of inline type declarations.
 */

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly display_name: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly deleted_at: string | Date | null;
  readonly version: number;
}

export interface UserWithCredentialRow extends UserRow {
  readonly password_hash: string | null;
}

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly invited_by: string | null;
  readonly role: string;
  readonly team_id: string | null;
  readonly status: string;
  readonly expires_at: string | Date;
  readonly accepted_at: string | Date | null;
  readonly revoked_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

export interface PublicInvitationRow extends InvitationRow {
  readonly inviter_display_name: string | null;
}

export interface RefreshSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly family_id: string;
  readonly device_label: string | null;
  readonly issued_at: string | Date;
  readonly expires_at: string | Date;
  readonly rotated_at: string | Date | null;
  readonly revoked_at: string | Date | null;
  readonly reuse_detected_at: string | Date | null;
}

export interface PasswordResetTokenRow {
  readonly id: string;
  readonly user_id: string;
  readonly expires_at: string | Date;
  readonly consumed_at: string | Date | null;
}

export interface FailedLoginStateRow {
  readonly id: string;
  readonly email: string;
  readonly attempt_count: number;
  readonly first_attempt_at: string | Date;
  readonly locked_until: string | Date | null;
}

export interface CountRow {
  readonly count: number;
}

export interface IdentifierRow {
  readonly id: string;
}
