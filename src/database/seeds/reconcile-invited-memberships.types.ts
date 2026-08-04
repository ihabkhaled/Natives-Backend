/** Why one orphaned invitation can or cannot be repaired automatically. */
export type ReconcileVerdict = 'repairable' | 'ambiguous';

/**
 * One invitation whose roster membership was written without the email
 * acceptance matches on.
 *
 * `pending` invitations only need the address restored — the ordinary accept
 * path then links and grants correctly. `accepted` ones are already spent, so
 * the membership has to be linked and the promised role granted directly.
 */
export interface OrphanedInvitation {
  readonly invitationId: string;
  readonly email: string;
  readonly teamId: string;
  readonly teamRoleKey: string;
  readonly status: 'pending' | 'accepted';
  /** The single candidate membership, or null when the match is ambiguous. */
  readonly membershipId: string | null;
  /** How many invited, unlinked, email-less memberships the team holds. */
  readonly candidateCount: number;
  /** The account created by an accepted invitation; null while pending. */
  readonly userId: string | null;
  readonly verdict: ReconcileVerdict;
}

/** Raw candidate row (snake_case) as the reconciliation query returns it. */
export interface OrphanedInvitationRow {
  readonly invitation_id: string;
  readonly email: string;
  readonly team_id: string;
  readonly team_role_key: string;
  readonly status: string;
  readonly membership_id: string | null;
  readonly candidate_count: string | number;
  readonly user_id: string | null;
}

/** Outcome of one reconciliation invocation. */
export interface ReconcileResult {
  readonly orphans: readonly OrphanedInvitation[];
  readonly repaired: readonly OrphanedInvitation[];
  readonly applied: boolean;
}

/** A single id row returned by lookups. */
export interface ReconcileIdRow {
  readonly id: string;
}
