/** One rostered player from the owner-supplied shirt-number sheet. */
export interface RosterPlayer {
  /** Stable slug used to link staff assignments to this player. */
  readonly key: string;
  readonly fullName: string;
  readonly nickname: string;
  /**
   * The numeric column, which carries the per-team uniqueness index. Null
   * where the printed form has no unambiguous integer, or where the integer
   * is already taken by another player.
   */
  readonly jerseyNumber: number | null;
  /** The shirt number exactly as printed, including any leading zero. */
  readonly jerseyLabel: string | null;
}

/** One entry in the extensible `staff_title` reference catalog. */
export interface StaffTitleDefinition {
  readonly key: string;
  readonly label: string;
  readonly position: number;
}
