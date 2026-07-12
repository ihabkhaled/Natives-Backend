import { describe, expect, it } from 'vitest';

import {
  deriveKeywords,
  extractDocMetadata,
  extractImplementsRule,
  extractIntentBlockquote,
  extractLeadParagraph,
  extractLinksFromCell,
  extractRelatedPaths,
  extractTitle,
  parseMarkdownTable,
} from '../../../tools/knowledge/lib/extract-doc-metadata.mjs';

const RULE_FIXTURE = `# 07 — Security, AuthN & AuthZ

> Every protected route chains an **auth guard**, a **permissions guard**, and an
> **ownership/tenant check**. Implements rules **33**, **34**, **35** of
> [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

## Section

Body text.

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [/skills/add-guard-and-permission.md](../skills/add-guard-and-permission.md)
`;

const RULE_WITH_LEAD_PARAGRAPH_FIXTURE = `# 07 — Security, AuthN & AuthZ

> The house standard for backend security. Implements rules **33**–**37** of
> [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

Every control lives in a dedicated place in the right layer (identity and
guards in \`core/auth/\`). Never inline a one-off auth check in a controller
or service.

## Section

Body text.
`;

const MEMORY_FIXTURE = `# Database Decisions

> Durable ORM and persistence conventions. Implements the canon in
> [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md).

## Decision: bounded lists

Body text.

**Related:** [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)
`;

describe('extract-doc-metadata.mjs', () => {
  describe('extractTitle', () => {
    it('strips the numeric rule prefix', () => {
      expect(extractTitle(RULE_FIXTURE)).toBe('Security, AuthN & AuthZ');
    });

    it('returns the title as-is when there is no numeric prefix', () => {
      expect(extractTitle(MEMORY_FIXTURE)).toBe('Database Decisions');
    });

    it('returns null when there is no H1', () => {
      expect(extractTitle('no heading here')).toBeNull();
    });
  });

  describe('extractIntentBlockquote', () => {
    it('joins every leading blockquote line into one string', () => {
      const intent = extractIntentBlockquote(RULE_FIXTURE);
      expect(intent).toContain('Every protected route chains');
      expect(intent).toContain('rules **33**, **34**, **35**');
    });

    it('returns null when the doc has no blockquote', () => {
      expect(extractIntentBlockquote('# Title\n\nNo quote.')).toBeNull();
    });
  });

  describe('extractImplementsRule', () => {
    it('extracts every bolded rule number', () => {
      expect(
        extractImplementsRule('Implements rules **33**, **34**, **35**.'),
      ).toEqual([33, 34, 35]);
    });

    it('extracts both endpoints of an en-dash range without expanding it', () => {
      // Real house style favors individually-bolded numbers ("rules **43**
      // and **46**"); a bare range like this is rare enough that expanding
      // it is not worth the added complexity (rules/21) — both endpoints
      // still route correctly, which is all the resolver needs.
      expect(extractImplementsRule('Implements rules **43**–**46**.')).toEqual([
        43, 46,
      ]);
    });

    it('returns an empty array (never throws) when no rule reference exists', () => {
      expect(extractImplementsRule('Implements the canon.')).toEqual([]);
      expect(extractImplementsRule(null)).toEqual([]);
    });
  });

  describe('extractLeadParagraph', () => {
    it('extracts the paragraph immediately after the blockquote', () => {
      const paragraph = extractLeadParagraph(RULE_WITH_LEAD_PARAGRAPH_FIXTURE);
      expect(paragraph).toContain('guards');
      expect(paragraph).toContain('controller');
    });

    it('returns null when there is no paragraph after the blockquote', () => {
      expect(extractLeadParagraph(RULE_FIXTURE)).toBeNull();
    });

    it('returns null when there is no blockquote at all', () => {
      expect(extractLeadParagraph('# Title\n\nJust prose.')).toBeNull();
    });
  });

  describe('extractRelatedPaths', () => {
    it('extracts every .md link from the Related line', () => {
      expect(extractRelatedPaths(RULE_FIXTURE)).toEqual([
        './00-non-negotiable-rules.md',
        '../skills/add-guard-and-permission.md',
      ]);
    });

    it('returns an empty array when there is no Related section', () => {
      expect(extractRelatedPaths('# Title\n\nNo related section.')).toEqual([]);
    });
  });

  describe('deriveKeywords', () => {
    it('derives keywords from filename, title, and intent', () => {
      const keywords = deriveKeywords({
        relativePath: 'rules/07-security-authn-authz.md',
        title: 'Security, AuthN & AuthZ',
        intent: 'Every protected route chains an auth guard',
      });
      expect(keywords).toContain('security');
      expect(keywords).toContain('authn');
      expect(keywords).toContain('authz');
      expect(keywords).toContain('guard');
      // stopwords never appear
      expect(keywords).not.toContain('every');
      expect(keywords).not.toContain('the');
    });
  });

  describe('extractDocMetadata', () => {
    it('assembles the full record for a numbered rule file', () => {
      const record = extractDocMetadata(
        'rules/07-security-authn-authz.md',
        RULE_FIXTURE,
      );
      expect(record.path).toBe('rules/07-security-authn-authz.md');
      expect(record.root).toBe('rules');
      expect(record.title).toBe('Security, AuthN & AuthZ');
      expect(record.ruleNumber).toBe(7);
      expect(record.implementsRule).toEqual([33, 34, 35]);
      expect(record.relatedPaths).toEqual([
        './00-non-negotiable-rules.md',
        '../skills/add-guard-and-permission.md',
      ]);
      expect(record.keywords).toContain('security');
    });

    it('assembles a record for a memory file with no rule number', () => {
      const record = extractDocMetadata(
        'memory/database-decisions.md',
        MEMORY_FIXTURE,
      );
      expect(record.root).toBe('memory');
      expect(record.ruleNumber).toBeNull();
      expect(record.title).toBe('Database Decisions');
    });

    it('never throws for a doc matching neither house style', () => {
      const record = extractDocMetadata(
        'docs/features/some-slug/00-intake.md',
        '# 00 — Intake\n\nNo blockquote at all.',
      );
      expect(record.title).toBe('Intake');
      expect(record.implementsRule).toEqual([]);
      expect(record.relatedPaths).toEqual([]);
    });
  });

  describe('parseMarkdownTable', () => {
    const TABLE_FIXTURE = `
Intro text.

| You are about to… | Rule | Skill |
| --- | --- | --- |
| Add a guard / permission | [07-security-authn-authz.md](../rules/07-security-authn-authz.md) | [add-guard-and-permission.md](../skills/add-guard-and-permission.md) |
| Add a config value | [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) | [add-config-value.md](../skills/add-config-value.md) |

Trailing text.
`;

    it('parses every row including the header, skipping the separator row', () => {
      const rows = parseMarkdownTable(TABLE_FIXTURE);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['You are about to…', 'Rule', 'Skill']);
      expect(rows[1][0]).toBe('Add a guard / permission');
    });

    it('returns an empty array when there is no table', () => {
      expect(parseMarkdownTable('# Title\n\nJust prose.')).toEqual([]);
    });
  });

  describe('extractLinksFromCell', () => {
    it('extracts the link target from a table cell', () => {
      expect(
        extractLinksFromCell(
          '[07-security-authn-authz.md](../rules/07-security-authn-authz.md)',
        ),
      ).toEqual(['../rules/07-security-authn-authz.md']);
    });

    it('returns an empty array for a cell with no link', () => {
      expect(extractLinksFromCell('plain text')).toEqual([]);
    });
  });
});
