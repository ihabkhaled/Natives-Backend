/** One rostered player from the owner-supplied shirt-number sheet. */
export interface RosterPlayer {
  /** Stable slug used to link staff assignments to this player. */
  readonly key: string;
  readonly fullName: string;
  readonly nickname: string;
  /** Null where the source sheet is ambiguous or the number collides. */
  readonly jerseyNumber: number | null;
}

/** One entry in the extensible `staff_title` reference catalog. */
export interface StaffTitleDefinition {
  readonly key: string;
  readonly label: string;
  readonly position: number;
}
