import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  approxTokens,
  buildBootstrap,
  buildBootstrapContent,
  extractRuleCategories,
  extractSection,
} from '../../../tools/knowledge/build-summaries.mjs';

const CLAUDE_MD_FIXTURE = `# Enterprise SDLC Operating Brain

## Purpose

This file is the permanent operating brain for AI-assisted delivery. It is
not a feature document.

The point of this file is to remove ambiguity.

## Authority And Precedence

If a ticket conflicts with this file, this file wins.
`;

const NON_NEGOTIABLE_RULES_FIXTURE = `# 00 — The Non-Negotiable Rules

> These rules are mandatory.

## Type safety (1–9)

1. Full strict TypeScript.

## Zero inline declarations (10–16)

10. No inline types.

## Pre-flight checklist (run mentally before writing code)

- [ ] No \`any\`.
`;

const PACKAGE_JSON_FIXTURE = JSON.stringify({
  description: 'A fixture project.',
  scripts: {
    lint: 'eslint .',
    typecheck: 'tsc --noEmit',
    'test:coverage': 'vitest run --coverage',
    build: 'tsc -p tsconfig.build.json',
  },
});

describe('build-summaries.mjs', () => {
  describe('extractSection', () => {
    it('extracts the body of a section up to the next heading', () => {
      const purpose = extractSection(CLAUDE_MD_FIXTURE, 'Purpose');
      expect(purpose).toContain('permanent operating brain');
      expect(purpose).not.toContain('Authority And Precedence');
    });

    it('extracts the last section up to end of document', () => {
      const authority = extractSection(
        CLAUDE_MD_FIXTURE,
        'Authority And Precedence',
      );
      expect(authority).toContain('this file wins');
    });

    it('returns null for a heading that does not exist', () => {
      expect(extractSection(CLAUDE_MD_FIXTURE, 'Does Not Exist')).toBeNull();
    });
  });

  describe('extractRuleCategories', () => {
    it('extracts every rule-category heading, excluding the checklist', () => {
      const categories = extractRuleCategories(NON_NEGOTIABLE_RULES_FIXTURE);
      expect(categories).toEqual([
        'Type safety (1–9)',
        'Zero inline declarations (10–16)',
      ]);
    });
  });

  describe('approxTokens', () => {
    it('approximates 4 characters per token', () => {
      expect(approxTokens('a'.repeat(400))).toBe(100);
    });
  });

  describe('buildBootstrapContent', () => {
    it('assembles BOOTSTRAP.md content from the three inputs', () => {
      const content = buildBootstrapContent({
        claudeMdText: CLAUDE_MD_FIXTURE,
        nonNegotiableRulesText: NON_NEGOTIABLE_RULES_FIXTURE,
        packageJsonText: PACKAGE_JSON_FIXTURE,
      });

      expect(content).toContain('permanent operating brain');
      expect(content).toContain('Type safety (1–9)');
      expect(content).toContain('npm run lint');
      expect(content).toContain('npm run typecheck');
      expect(content).toContain('npm run test:coverage');
      expect(content).toContain('npm run build');
      expect(content).not.toContain('Pre-flight checklist');
    });

    it('stays within the documented token budget for a realistic input size', () => {
      const content = buildBootstrapContent({
        claudeMdText: CLAUDE_MD_FIXTURE,
        nonNegotiableRulesText: NON_NEGOTIABLE_RULES_FIXTURE,
        packageJsonText: PACKAGE_JSON_FIXTURE,
      });
      expect(approxTokens(content)).toBeLessThan(1500);
    });
  });

  describe('buildBootstrap (filesystem-backed)', () => {
    let fixtureRoot;

    beforeEach(() => {
      fixtureRoot = mkdtempSync(path.join(tmpdir(), 'knowledge-bootstrap-'));
      writeFileSync(path.join(fixtureRoot, 'claude.md'), CLAUDE_MD_FIXTURE);
      const rulesDir = path.join(fixtureRoot, 'rules');
      writeFileSync(
        path.join(fixtureRoot, 'package.json'),
        PACKAGE_JSON_FIXTURE,
      );
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        path.join(rulesDir, '00-non-negotiable-rules.md'),
        NON_NEGOTIABLE_RULES_FIXTURE,
      );
    });

    afterEach(() => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    });

    it('writes .ai/BOOTSTRAP.md and returns its token estimate', () => {
      const { tokens } = buildBootstrap(fixtureRoot);
      expect(tokens).toBeGreaterThan(0);

      const written = readFileSync(
        path.join(fixtureRoot, '.ai', 'BOOTSTRAP.md'),
        'utf8',
      );
      expect(written).toContain('permanent operating brain');
    });

    it('throws a clear error when a required input file is missing', () => {
      rmSync(path.join(fixtureRoot, 'claude.md'));
      expect(() => buildBootstrap(fixtureRoot)).toThrow(/claude\.md/);
    });
  });
});
