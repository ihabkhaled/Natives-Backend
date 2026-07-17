import { describe, expect, it } from 'vitest';

import { ROUTING_MAP } from '../../../tools/knowledge/data/routing-map.mjs';
import {
  mergePack,
  resolvePacks,
} from '../../../tools/knowledge/lib/resolve-pack.mjs';

describe('resolvePacks', () => {
  it('returns nothing for an empty task', () => {
    expect(resolvePacks('')).toEqual([]);
  });

  it('matches a single-token keyword only as a whole word', () => {
    const matched = resolvePacks('add a guard');
    expect(matched.map(entry => entry.id)).toContain('guard-permission');
  });

  it('does not fire a single-token keyword on a substring', () => {
    // "safeguarding" must not trigger the "guard" keyword.
    const matched = resolvePacks('safeguarding the release notes');
    expect(matched.map(entry => entry.id)).not.toContain('guard-permission');
  });

  it('matches a multi-word keyword as a phrase', () => {
    const matched = resolvePacks('scaffold a new module for billing');
    expect(matched.map(entry => entry.id)).toContain('scaffold-module');
  });

  it('orders entries by hit count, ties broken by id', () => {
    const matched = resolvePacks('add a guard to a controller');
    // guard-permission and add-controller both match; both have 1 hit here,
    // so the tie breaks alphabetically by id.
    expect(matched.map(entry => entry.id).slice(0, 2)).toEqual([
      'add-controller',
      'guard-permission',
    ]);
  });
});

describe('mergePack', () => {
  it('returns null when nothing matches', () => {
    expect(mergePack('xyzzy unrelated gibberish')).toBeNull();
  });

  it('escalates to the strictest lane across merged entries', () => {
    // add-controller (standard) + guard-permission (critical) -> critical.
    const pack = mergePack('add a guard to a controller');
    expect(pack.lane).toBe('critical');
    expect(pack.matchedTaskTypes).toEqual(
      expect.arrayContaining(['add-controller', 'guard-permission']),
    );
  });

  it('unions rules, skills, and reviewers, deduped and sorted', () => {
    const pack = mergePack('add a guard to a controller');
    expect(pack.rules).toEqual([...pack.rules].sort());
    expect(pack.rules).toContain('rules/07-security-authn-authz.md');
    expect(pack.skills).toContain('skills/add-guard-and-permission.md');
    expect(pack.reviewers).toContain('agents/backend-security-reviewer.md');
  });

  it('includes security:scan in the validation of a critical pack', () => {
    const pack = mergePack('add a guard');
    expect(pack.validation).toContain('npm run security:scan');
  });

  it('a fast-lane split task does not over-escalate on the word service', () => {
    const pack = mergePack('split an oversized service that is too large');
    expect(pack.lane).toBe('fast');
  });
});

describe('routing-map integrity', () => {
  it('every entry has a unique id', () => {
    const ids = ROUTING_MAP.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry declares a valid lane and non-empty pack lists', () => {
    for (const entry of ROUTING_MAP) {
      expect(['fast', 'standard', 'critical']).toContain(entry.lane);
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.rules.length).toBeGreaterThan(0);
      expect(entry.skills.length).toBeGreaterThan(0);
      expect(entry.reviewers.length).toBeGreaterThan(0);
      expect(entry.validation.length).toBeGreaterThan(0);
    }
  });
});
