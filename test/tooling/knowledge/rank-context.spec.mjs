import { describe, expect, it } from 'vitest';

import {
  rankContext,
  WARMUP_PATHS,
} from '../../../tools/knowledge/lib/rank-context.mjs';

function buildFixtureManifests() {
  return {
    repository: {
      files: [
        {
          path: 'src/modules/articles/api/articles.controller.ts',
          root: 'modules',
          module: 'articles',
          layer: 'controller',
          kind: 'source',
        },
        {
          path: 'src/modules/articles/application/articles.service.ts',
          root: 'modules',
          module: 'articles',
          layer: 'service',
          kind: 'source',
        },
        {
          path: 'src/modules/auth/jwt-auth.guard.ts',
          root: 'modules',
          module: 'auth',
          layer: 'guard',
          kind: 'source',
        },
      ],
    },
    documents: {
      documents: [
        {
          path: 'rules/07-security-authn-authz.md',
          title: 'Security, AuthN & AuthZ',
          ruleNumber: 7,
          keywords: ['security', 'authn', 'authz', 'guard', 'permission'],
        },
        {
          path: 'skills/add-guard-and-permission.md',
          title: 'Add a Guard and a Permission',
          ruleNumber: null,
          keywords: ['guard', 'permission', 'rbac'],
        },
        {
          path: 'rules/09-performance-and-scalability.md',
          title: 'Performance & Scalability',
          ruleNumber: 9,
          keywords: ['performance', 'n+1', 'pagination', 'caching'],
        },
      ],
    },
    modules: {
      modules: [
        { name: 'articles', fileCount: 2, specCount: 0 },
        { name: 'auth', fileCount: 1, specCount: 0 },
      ],
    },
    dependencyGraph: {
      edges: [
        {
          from: 'src/modules/articles/api/articles.controller.ts',
          to: 'src/modules/articles/application/articles.service.ts',
          type: 'internal',
        },
      ],
    },
  };
}

describe('rank-context.mjs', () => {
  it('always returns the fixed 5-file warm-up set', () => {
    const result = rankContext({
      task: '',
      files: [],
      manifests: buildFixtureManifests(),
    });
    expect(result.warmup).toEqual(WARMUP_PATHS);
  });

  it('returns an empty ranked array when no task and no files are given', () => {
    const result = rankContext({
      task: '',
      files: [],
      manifests: buildFixtureManifests(),
    });
    expect(result.ranked).toEqual([]);
  });

  it('ranks a security/guard task toward rules/07 and the guard skill', () => {
    const result = rankContext({
      task: 'add a guard to a controller',
      files: [],
      manifests: buildFixtureManifests(),
    });

    const paths = result.ranked.map(entry => entry.path);
    expect(paths).toContain('rules/07-security-authn-authz.md');
    expect(paths).toContain('skills/add-guard-and-permission.md');
    expect(paths).not.toContain('rules/09-performance-and-scalability.md');
  });

  it('scores an exact rule-number mention highly', () => {
    const result = rankContext({
      task: 'what does rule 7 require',
      files: [],
      manifests: buildFixtureManifests(),
    });
    const rule7 = result.ranked.find(
      entry => entry.path === 'rules/07-security-authn-authz.md',
    );
    expect(rule7).toBeDefined();
    expect(rule7.reasons.some(reason => reason.includes('is rule 7'))).toBe(
      true,
    );
  });

  it('never includes a warm-up path in the ranked list', () => {
    const result = rankContext({
      task: 'non-negotiable rules architecture',
      files: [],
      manifests: buildFixtureManifests(),
    });
    for (const item of result.ranked) {
      expect(WARMUP_PATHS).not.toContain(item.path);
    }
  });

  it('gives explicitly touched files an infinite (always-top) score', () => {
    const result = rankContext({
      task: '',
      files: ['src/modules/auth/jwt-auth.guard.ts'],
      manifests: buildFixtureManifests(),
    });
    const seed = result.ranked.find(
      entry => entry.path === 'src/modules/auth/jwt-auth.guard.ts',
    );
    expect(seed).toBeDefined();
    expect(seed.score).toBe(Number.POSITIVE_INFINITY);
    expect(seed.reasons).toContain('explicitly touched file');
  });

  it('boosts depth-1 dependency-graph neighbors of a seed file', () => {
    const result = rankContext({
      task: '',
      files: ['src/modules/articles/api/articles.controller.ts'],
      manifests: buildFixtureManifests(),
    });
    const neighbor = result.ranked.find(
      entry =>
        entry.path === 'src/modules/articles/application/articles.service.ts',
    );
    expect(neighbor).toBeDefined();
    expect(neighbor.reasons[0]).toContain('depth-1 dependency neighbor');
  });

  it('includes module cards for touched modules', () => {
    const result = rankContext({
      task: 'articles',
      files: [],
      manifests: buildFixtureManifests(),
    });
    expect(result.modules.map(module => module.name)).toEqual(['articles']);
  });

  it('is deterministic: identical input produces identical output', () => {
    const manifests = buildFixtureManifests();
    const first = rankContext({ task: 'add a guard', files: [], manifests });
    const second = rankContext({ task: 'add a guard', files: [], manifests });
    expect(first).toEqual(second);
  });
});
