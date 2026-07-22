/** Raw `team_rules` row. */
export interface RuleRow {
  readonly id: string;
  readonly team_id: string;
  readonly rule_key: string;
  readonly version: number | string;
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly audience: string;
  readonly requires_acknowledgement: boolean;
  readonly effective_from: string | Date;
  readonly status: string;
  readonly owner_user_id: string | null;
  readonly created_by: string | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
}

/** Raw `rule_acknowledgements` row. */
export interface AckRow {
  readonly id: string;
  readonly team_id: string;
  readonly rule_id: string;
  readonly membership_id: string;
  readonly rule_version: number | string;
  readonly acknowledged_at: string | Date;
}

/** Raw `discipline_cases` row. */
export interface DisciplineCaseRow {
  readonly id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly rule_id: string | null;
  readonly severity: string;
  readonly fact_summary: string;
  readonly evidence_reference: string | null;
  readonly private_notes: string | null;
  readonly status: string;
  readonly action: string;
  readonly due_date: string | Date | null;
  readonly member_response: string | null;
  readonly appeal_reason: string | null;
  readonly resolution: string | null;
  readonly opened_by: string | null;
  readonly reviewed_by: string | null;
  readonly resolved_by: string | null;
  readonly record_version: number | string;
  readonly responded_at: string | Date | null;
  readonly reviewed_at: string | Date | null;
  readonly appealed_at: string | Date | null;
  readonly resolved_at: string | Date | null;
  readonly expunged_at: string | Date | null;
  readonly retention_expires_at: string | Date;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `governance_positions` row. */
export interface PositionRow {
  readonly id: string;
  readonly team_id: string;
  readonly position_key: string;
  readonly title: string;
  readonly responsibilities: string | null;
  readonly status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `governance_appointments` row. */
export interface AppointmentRow {
  readonly id: string;
  readonly team_id: string;
  readonly position_id: string;
  readonly membership_id: string;
  readonly acting: boolean;
  readonly starts_on: string | Date;
  readonly ends_on: string | Date | null;
  readonly status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `governance_meetings` row. */
export interface MeetingRow {
  readonly id: string;
  readonly team_id: string;
  readonly title: string;
  readonly scheduled_at: string | Date;
  readonly agenda: string | null;
  readonly minutes: string | null;
  readonly decisions: unknown;
  readonly visibility: string;
  readonly status: string;
  readonly recurrence: string;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly minutes_approved_by: string | null;
  readonly minutes_approved_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `governance_tasks` row. */
export interface TaskRow {
  readonly id: string;
  readonly team_id: string;
  readonly meeting_id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly owner_membership_id: string | null;
  readonly due_date: string | Date | null;
  readonly priority: string;
  readonly status: string;
  readonly depends_on_task_id: string | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly completed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A generic count row. */
export interface GovernanceCountRow {
  readonly count: number | string;
}

/** A single-column id probe row for existence checks. */
export interface GovernanceIdRow {
  readonly id: string;
}
