import { describe, expect, it } from 'vitest';

import {
  AvailabilitySource,
  AvailabilityStatus,
  CandidateStatus,
  SelectionRole,
  SelectionStatus,
  SquadStatus,
} from '../model/squads.enums';
import type {
  AvailabilityRow,
  CandidateRow,
  SelectionRow,
  SquadRow,
} from '../model/squads.rows';
import {
  toAvailability,
  toEligibilityInputs,
  toSelection,
  toSquad,
} from './squads.mapper';

const NOW = new Date('2026-02-01T12:00:00.000Z');

function squadRow(overrides: Partial<SquadRow> = {}): SquadRow {
  return {
    id: 'squad-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: null,
    name: 'Nationals Squad',
    status: 'draft',
    attendance_threshold_pct: '70.00',
    policy_version: 'eligibility-signals-v1',
    selection_deadline: null,
    notes: null,
    revision: 1,
    record_version: 1,
    created_by: 'user-1',
    published_by: null,
    published_at: null,
    locked_at: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('squads.mapper', () => {
  it('maps a squad row and coerces the numeric threshold', () => {
    const squad = toSquad(
      squadRow({ competition_id: 'comp-1', status: 'published' }),
    );
    expect(squad.squadId).toBe('squad-1');
    expect(squad.competitionId).toBe('comp-1');
    expect(squad.status).toBe(SquadStatus.Published);
    expect(squad.attendanceThresholdPct).toBe(70);
    expect(squad.selectionDeadline).toBeNull();
  });

  it('maps a selection row with its override evidence', () => {
    const row: SelectionRow = {
      id: 'sel-1',
      squad_id: 'squad-1',
      team_id: 'team-1',
      membership_id: 'm-1',
      selection_role: 'captain',
      status: 'selected',
      reason: 'starting handler',
      eligibility_overridden: true,
      override_reason: 'coach cleared low attendance',
      overridden_by: 'user-2',
      eligibility_snapshot: 'overridden:attendance',
      selected_by: 'user-2',
      removed_by: null,
      removed_at: null,
      record_version: 1,
      created_at: NOW,
      updated_at: NOW,
    };
    const selection = toSelection(row);
    expect(selection.selectionRole).toBe(SelectionRole.Captain);
    expect(selection.status).toBe(SelectionStatus.Selected);
    expect(selection.eligibilityOverridden).toBe(true);
    expect(selection.overrideReason).toBe('coach cleared low attendance');
  });

  it('maps an availability row', () => {
    const row: AvailabilityRow = {
      id: 'av-1',
      squad_id: 'squad-1',
      team_id: 'team-1',
      membership_id: 'm-1',
      availability: 'unavailable',
      reason: 'travelling',
      source: 'self',
      declared_by: 'user-1',
      record_version: 1,
      created_at: NOW,
      updated_at: NOW,
    };
    const availability = toAvailability(row);
    expect(availability.availability).toBe(AvailabilityStatus.Unavailable);
    expect(availability.source).toBe(AvailabilitySource.Self);
  });

  it('maps a candidate row into pure eligibility inputs', () => {
    const row: CandidateRow = {
      membership_id: 'm-1',
      full_name: 'Player One',
      status: 'active',
      registered_in_season: true,
      gender: 'woman',
      jersey_number: 7,
      attended_sessions: 8,
      eligible_sessions: 10,
      injured_sessions: 0,
      availability: 'available',
      selected: true,
      selection_overridden: false,
    };
    const inputs = toEligibilityInputs(row);
    expect(inputs.status).toBe(CandidateStatus.Active);
    expect(inputs.registeredInSeason).toBe(true);
    expect(inputs.availability).toBe(AvailabilityStatus.Available);
    expect(inputs.selected).toBe(true);
  });

  it('treats a null season as unregistered, a null name as a placeholder, undeclared availability as null', () => {
    const row: CandidateRow = {
      membership_id: 'm-2',
      full_name: null,
      status: 'invited',
      registered_in_season: false,
      gender: null,
      jersey_number: null,
      attended_sessions: 0,
      eligible_sessions: 0,
      injured_sessions: 0,
      availability: null,
      selected: false,
      selection_overridden: false,
    };
    const inputs = toEligibilityInputs(row);
    expect(inputs.registeredInSeason).toBe(false);
    expect(inputs.fullName).toBe('Unnamed member');
    expect(inputs.availability).toBeNull();
  });
});
