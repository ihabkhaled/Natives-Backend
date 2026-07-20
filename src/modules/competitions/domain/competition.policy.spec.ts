import { describe, expect, it } from 'vitest';

import { CompetitionValidationError } from '../errors/competition-validation.error';
import { CompetitionType } from '../model/competitions.enums';
import type { CompetitionContent } from '../model/competitions.types';
import { assertCompetitionContent } from './competition.policy';

function content(
  overrides: Partial<CompetitionContent> = {},
): CompetitionContent {
  return {
    name: 'Cairo Winter League',
    competitionType: CompetitionType.League,
    seasonId: 'season-1',
    genderDivision: null,
    organizerName: null,
    externalRef: null,
    startsOn: null,
    endsOn: null,
    description: null,
    ...overrides,
  };
}

describe('competition content policy', () => {
  it('accepts an open or ordered window', () => {
    expect(() => assertCompetitionContent(content())).not.toThrow();
    expect(() =>
      assertCompetitionContent(
        content({ startsOn: '2026-01-01', endsOn: null }),
      ),
    ).not.toThrow();
    expect(() =>
      assertCompetitionContent(
        content({ startsOn: '2026-01-01', endsOn: '2026-03-01' }),
      ),
    ).not.toThrow();
    expect(() =>
      assertCompetitionContent(
        content({ startsOn: '2026-01-01', endsOn: '2026-01-01' }),
      ),
    ).not.toThrow();
  });

  it('rejects an inverted window', () => {
    expect(() =>
      assertCompetitionContent(
        content({ startsOn: '2026-03-01', endsOn: '2026-01-01' }),
      ),
    ).toThrow(CompetitionValidationError);
  });
});
