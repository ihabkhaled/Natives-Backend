import { describe, expect, it } from 'vitest';

import {
  RosterDivision,
  RosterEntryRole,
  RosterKind,
  RosterLine,
  RosterPosition,
} from '../model/rosters.enums';
import {
  toCompetitionRosterContent,
  toMatchRosterContent,
  toRosterConstraints,
  toRosterEntryContent,
  toRosterListFilter,
  toStoredConstraints,
} from './rosters-command.mapper';

describe('rosters-command.mapper', () => {
  it('applies the documented defaults for an otherwise bare competition roster', () => {
    expect(
      toCompetitionRosterContent({
        competitionId: 'comp-1',
        name: 'Nationals',
      }),
    ).toEqual({
      competitionId: 'comp-1',
      squadId: null,
      name: 'Nationals',
      division: RosterDivision.Unspecified,
      minSize: 7,
      maxSize: 30,
      minWomen: null,
      requireCaptain: true,
      selectionDeadline: null,
      notes: null,
    });
  });

  it('keeps every supplied competition roster field verbatim', () => {
    expect(
      toCompetitionRosterContent({
        competitionId: 'comp-1',
        squadId: 'squad-1',
        name: 'Nationals',
        division: RosterDivision.Mixed,
        minSize: 10,
        maxSize: 20,
        minWomen: 4,
        requireCaptain: false,
        selectionDeadline: '2026-04-01T00:00:00.000Z',
        notes: 'travel squad',
      }),
    ).toMatchObject({
      squadId: 'squad-1',
      division: RosterDivision.Mixed,
      minSize: 10,
      maxSize: 20,
      minWomen: 4,
      requireCaptain: false,
      selectionDeadline: '2026-04-01T00:00:00.000Z',
      notes: 'travel squad',
    });
  });

  it('never reads an absent minimum-women rule as zero', () => {
    expect(
      toCompetitionRosterContent({ competitionId: 'c', name: 'n' }).minWomen,
    ).toBeNull();
    expect(
      toCompetitionRosterContent({ competitionId: 'c', name: 'n', minWomen: 0 })
        .minWomen,
    ).toBe(0);
  });

  it('applies the documented defaults for a match roster', () => {
    expect(
      toMatchRosterContent({ fixtureId: 'fixture-1', name: 'Game 1' }),
    ).toEqual({
      fixtureId: 'fixture-1',
      sourceRosterId: null,
      name: 'Game 1',
      division: RosterDivision.Unspecified,
      minSize: 7,
      maxSize: 30,
      minWomen: null,
      requireCaptain: true,
      notes: null,
    });
  });

  it('keeps every supplied match roster field verbatim', () => {
    expect(
      toMatchRosterContent({
        fixtureId: 'fixture-1',
        sourceRosterId: 'roster-1',
        name: 'Game 1',
        division: RosterDivision.Open,
        minSize: 8,
        maxSize: 16,
        minWomen: 3,
        requireCaptain: false,
        notes: 'travel',
      }),
    ).toMatchObject({
      sourceRosterId: 'roster-1',
      division: RosterDivision.Open,
      minSize: 8,
      maxSize: 16,
      minWomen: 3,
      requireCaptain: false,
      notes: 'travel',
    });
  });

  it('defaults an entry to an unassigned player and keeps supplied detail', () => {
    expect(toRosterEntryContent({ membershipId: 'member-1' })).toEqual({
      membershipId: 'member-1',
      jerseyNumber: null,
      entryRole: RosterEntryRole.Player,
      lineAssignment: RosterLine.Any,
      fieldPosition: RosterPosition.Unspecified,
      selectionReason: null,
    });
    expect(
      toRosterEntryContent({
        membershipId: 'member-1',
        jerseyNumber: 0,
        entryRole: RosterEntryRole.Captain,
        lineAssignment: RosterLine.Defense,
        fieldPosition: RosterPosition.Cutter,
        selectionReason: 'defensive anchor',
      }),
    ).toMatchObject({
      jerseyNumber: 0,
      entryRole: RosterEntryRole.Captain,
      lineAssignment: RosterLine.Defense,
      fieldPosition: RosterPosition.Cutter,
      selectionReason: 'defensive anchor',
    });
  });

  it('nulls every absent facet of the allow-listed list filter', () => {
    expect(toRosterListFilter({})).toEqual({
      competitionId: null,
      fixtureId: null,
      rosterKind: null,
    });
    expect(
      toRosterListFilter({
        competitionId: 'comp-1',
        fixtureId: 'fixture-1',
        rosterKind: RosterKind.Match,
      }),
    ).toEqual({
      competitionId: 'comp-1',
      fixtureId: 'fixture-1',
      rosterKind: RosterKind.Match,
    });
  });

  it('extracts the same constraints from a command and from a stored roster', () => {
    const content = toCompetitionRosterContent({
      competitionId: 'comp-1',
      name: 'Nationals',
      division: RosterDivision.Mixed,
      minWomen: 4,
    });
    expect(toRosterConstraints(content)).toEqual({
      division: RosterDivision.Mixed,
      minSize: 7,
      maxSize: 30,
      minWomen: 4,
      requireCaptain: true,
    });
    expect(
      toStoredConstraints({
        division: RosterDivision.Open,
        minSize: 5,
        maxSize: 12,
        minWomen: null,
        requireCaptain: false,
      }),
    ).toEqual({
      division: RosterDivision.Open,
      minSize: 5,
      maxSize: 12,
      minWomen: null,
      requireCaptain: false,
    });
  });
});
