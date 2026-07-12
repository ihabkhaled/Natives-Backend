import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildContextOutput,
  loadManifests,
  parseArgs,
  resolveDiffFiles,
} from '../../../tools/knowledge/resolve-context.mjs';

describe('resolve-context.mjs', () => {
  describe('parseArgs', () => {
    it('parses --task, --files, and --diff', () => {
      expect(
        parseArgs([
          '--task=add a guard',
          '--files=a.ts,b.ts',
          '--diff=main...HEAD',
        ]),
      ).toEqual({
        task: 'add a guard',
        files: ['a.ts', 'b.ts'],
        diff: 'main...HEAD',
      });
    });

    it('defaults to empty task/files and null diff', () => {
      expect(parseArgs([])).toEqual({ task: '', files: [], diff: null });
    });

    it('trims and drops empty entries in --files', () => {
      expect(parseArgs(['--files=a.ts, , b.ts,'])).toEqual({
        task: '',
        files: ['a.ts', 'b.ts'],
        diff: null,
      });
    });
  });

  describe('loadManifests + buildContextOutput (filesystem-backed)', () => {
    let fixtureRoot;

    beforeEach(() => {
      fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-resolve-'));
      const manifestDir = path.join(fixtureRoot, '.ai', 'manifests');
      mkdirSync(manifestDir, { recursive: true });
      mkdirSync(path.join(fixtureRoot, 'rules'), { recursive: true });

      writeFileSync(
        path.join(fixtureRoot, 'rules', '00-non-negotiable-rules.md'),
        '# 00 — The Non-Negotiable Rules\n',
      );
      writeFileSync(
        path.join(manifestDir, 'repository.json'),
        JSON.stringify({ files: [] }),
      );
      writeFileSync(
        path.join(manifestDir, 'modules.json'),
        JSON.stringify({ modules: [] }),
      );
      writeFileSync(
        path.join(manifestDir, 'documents.json'),
        JSON.stringify({
          documents: [
            {
              path: 'rules/00-non-negotiable-rules.md',
              title: 'The Non-Negotiable Rules',
              ruleNumber: 0,
              keywords: ['non-negotiable'],
            },
          ],
        }),
      );
      writeFileSync(
        path.join(manifestDir, 'dependency-graph.json'),
        JSON.stringify({ edges: [] }),
      );
    });

    afterEach(() => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    });

    it('loadManifests returns null when manifests do not exist yet', () => {
      const emptyRoot = mkdtempSync(
        path.join(tmpdir(), 'knowledge-resolve-empty-'),
      );
      expect(loadManifests(emptyRoot)).toBeNull();
      rmSync(emptyRoot, { recursive: true, force: true });
    });

    it('loadManifests loads all 4 manifests when present', () => {
      const manifests = loadManifests(fixtureRoot);
      expect(manifests).not.toBeNull();
      expect(manifests.documents.documents).toHaveLength(1);
    });

    it('buildContextOutput produces token estimates for files that exist on disk', () => {
      const manifests = loadManifests(fixtureRoot);
      const output = buildContextOutput({
        task: '',
        files: [],
        manifests,
        repoRoot: fixtureRoot,
      });

      const rulesWarmup = output.warmup.find(
        item => item.path === 'rules/00-non-negotiable-rules.md',
      );
      expect(rulesWarmup.tokens).toBeGreaterThan(0);

      const claudeWarmup = output.warmup.find(
        item => item.path === 'claude.md',
      );
      // claude.md does not exist in this minimal fixture — must not throw.
      expect(claudeWarmup.tokens).toBeNull();
    });

    it('buildContextOutput includes seedFiles and the original task string', () => {
      const manifests = loadManifests(fixtureRoot);
      const output = buildContextOutput({
        task: 'add a guard',
        files: ['src/example.ts'],
        manifests,
        repoRoot: fixtureRoot,
      });
      expect(output.task).toBe('add a guard');
      expect(output.seedFiles).toEqual(['src/example.ts']);
    });
  });

  describe('resolveDiffFiles', () => {
    let fixtureRoot;

    beforeEach(() => {
      fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-resolve-git-'));
      // -b main pins the initial branch name explicitly — this repo's git
      // defaults to `master` locally but CI/other machines may default to
      // `main`; the test must not depend on either ambient default.
      execSync('git init -q -b main', { cwd: fixtureRoot });
      execSync('git config user.email "test@example.com"', {
        cwd: fixtureRoot,
      });
      execSync('git config user.name "Test"', { cwd: fixtureRoot });
      execSync('git config core.autocrlf false', { cwd: fixtureRoot });
      writeFileSync(path.join(fixtureRoot, 'a.txt'), 'one\n');
      execSync('git add a.txt', { cwd: fixtureRoot });
      execSync('git commit -q -m "first"', { cwd: fixtureRoot });
      execSync('git checkout -q -b feature', { cwd: fixtureRoot });
      writeFileSync(path.join(fixtureRoot, 'b.txt'), 'two\n');
      execSync('git add b.txt', { cwd: fixtureRoot });
      execSync('git commit -q -m "second"', { cwd: fixtureRoot });
    });

    afterEach(() => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    });

    it('returns an empty array when no range is given', () => {
      expect(resolveDiffFiles(fixtureRoot, null)).toEqual([]);
    });

    it('returns the changed files for a valid range', () => {
      expect(resolveDiffFiles(fixtureRoot, 'main...feature')).toEqual([
        'b.txt',
      ]);
    });

    it('returns an empty array (never throws) for an invalid range', () => {
      expect(
        resolveDiffFiles(fixtureRoot, 'not-a-real-ref...also-fake'),
      ).toEqual([]);
    });
  });
});
