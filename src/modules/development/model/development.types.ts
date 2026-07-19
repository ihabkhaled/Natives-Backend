export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Outcome of a reminder scan: how many privacy-safe reminder events were queued. */
export interface ReminderResult {
  readonly feedbackReminders: number;
  readonly goalReminders: number;
}
