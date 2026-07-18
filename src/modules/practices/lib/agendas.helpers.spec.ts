import { describe, expect, it } from 'vitest';

import {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../model/agendas.enums';
import {
  coalesceStrings,
  parseAgendaStatus,
  parseBlockType,
  parseCompletionStatus,
  parseDrillCategory,
  parseDrillIntensity,
  parseDrillStatus,
  parseNullableIntensity,
  resolveDrillsQuery,
} from './agendas.helpers';

describe('agendas.helpers', () => {
  it('parses each valid enum value and rejects unknown ones', () => {
    expect(parseDrillCategory('throwing')).toBe(DrillCategory.Throwing);
    expect(parseDrillIntensity('high')).toBe(DrillIntensity.High);
    expect(parseDrillStatus('archived')).toBe(DrillStatus.Archived);
    expect(parseAgendaStatus('published')).toBe(AgendaStatus.Published);
    expect(parseBlockType('water_break')).toBe(AgendaBlockType.WaterBreak);
    expect(parseCompletionStatus('skipped')).toBe(CompletionStatus.Skipped);
    expect(() => parseDrillCategory('nope')).toThrow(/drill category/u);
    expect(() => parseBlockType('nope')).toThrow(/block type/u);
  });

  it('preserves null intensity but parses a present value', () => {
    expect(parseNullableIntensity(null)).toBeNull();
    expect(parseNullableIntensity('moderate')).toBe(DrillIntensity.Moderate);
  });

  it('coalesces a null text[] to an empty array', () => {
    expect(coalesceStrings(null)).toEqual([]);
    expect(coalesceStrings(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('resolves an empty query to unfiltered, clamped defaults', () => {
    expect(resolveDrillsQuery({})).toEqual({
      category: null,
      status: null,
      skillTag: null,
      limit: 20,
      offset: 0,
    });
  });

  it('carries allowlisted filters and clamps an oversized limit', () => {
    expect(
      resolveDrillsQuery({
        category: DrillCategory.Defense,
        status: DrillStatus.Active,
        skillTag: 'handling',
        limit: 5000,
        offset: 10,
      }),
    ).toEqual({
      category: DrillCategory.Defense,
      status: DrillStatus.Active,
      skillTag: 'handling',
      limit: 100,
      offset: 10,
    });
  });
});
