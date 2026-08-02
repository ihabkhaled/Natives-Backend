/** One rostered player from the owner-supplied shirt-number sheet. */
export interface RosterPlayer {
  /** Stable slug used to link staff assignments to this player. */
  readonly key: string;
  readonly fullName: string;
  readonly nickname: string;
  /**
   * The shirt number exactly as printed, including any leading zero. Null when
   * the player has no number of their own yet.
   */
  readonly jersey: string | null;
}

/** One entry in the extensible `staff_title` reference catalog. */
export interface StaffTitleDefinition {
  readonly key: string;
  readonly label: string;
  readonly position: number;
}
