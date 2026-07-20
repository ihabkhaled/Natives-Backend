import { describe, expect, it } from 'vitest';

import { CompetitionType, MatchSide } from '../model/competitions.enums';
import {
  toCompetitionContent,
  toFixtureContent,
  toOpponentContent,
} from './competitions-command.mapper';

describe('competitions command mapper', () => {
  it('fills competition null defaults for absent optionals', () => {
    const content = toCompetitionContent({
      name: 'Cairo League',
      competitionType: CompetitionType.League,
      seasonId: 'season-1',
    });
    expect(content.genderDivision).toBeNull();
    expect(content.organizerName).toBeNull();
    expect(content.startsOn).toBeNull();
    expect(content.description).toBeNull();
  });

  it('preserves supplied competition fields', () => {
    const content = toCompetitionContent({
      name: 'Cairo League',
      competitionType: CompetitionType.Custom,
      seasonId: 'season-1',
      genderDivision: 'open',
      startsOn: '2026-01-01',
      endsOn: '2026-03-01',
    });
    expect(content.competitionType).toBe(CompetitionType.Custom);
    expect(content.startsOn).toBe('2026-01-01');
    expect(content.endsOn).toBe('2026-03-01');
  });

  it('fills opponent null defaults', () => {
    const content = toOpponentContent({ name: 'Sharks' });
    expect(content.shortName).toBeNull();
    expect(content.logoRef).toBeNull();
    expect(content.contactInfo).toBeNull();
  });

  it('fills fixture null defaults and preserves the required fields', () => {
    const content = toFixtureContent({
      opponentId: 'opp-1',
      homeAway: MatchSide.Away,
      scheduledAt: '2026-01-15T18:30:00.000Z',
    });
    expect(content.stageId).toBeNull();
    expect(content.roundId).toBeNull();
    expect(content.venueId).toBeNull();
    expect(content.homeAway).toBe(MatchSide.Away);
    expect(content.scheduledAt).toBe('2026-01-15T18:30:00.000Z');
  });
});
