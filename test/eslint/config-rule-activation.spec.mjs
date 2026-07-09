import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Guards against the silent-disable failure mode where a flat-config `files`
// entry written as a regex string (instead of a minimatch glob) never matches
// any file, turning a whole override off without any error. Every assertion
// here resolves the REAL eslint.config.mjs for a representative path and
// checks that the expected rule is active with the expected options.
// See rules/13-eslint-and-typescript.md and rules/23.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const SERVICE_FILE = path.join(
  repoRoot,
  'src/modules/example/application/example.service.ts',
);
const CONTROLLER_FILE = path.join(
  repoRoot,
  'src/modules/example/api/example.controller.ts',
);
const REPOSITORY_FILE = path.join(
  repoRoot,
  'src/modules/example/infrastructure/example.repository.ts',
);
const ADAPTER_FILE = path.join(
  repoRoot,
  'src/modules/example/adapters/vendor.adapter.ts',
);
// A vendor folder nested under adapters/ must not escape the adapter overrides.
const NESTED_ADAPTER_FILE = path.join(
  repoRoot,
  'src/modules/example/adapters/vendor/vendor-client.ts',
);
const NESTED_GUARD_FILE = path.join(
  repoRoot,
  'src/modules/example/guards/nested/tenant.ts',
);
const DOMAIN_FILE = path.join(
  repoRoot,
  'src/modules/example/domain/example.policy.ts',
);
const GUARD_FILE = path.join(repoRoot, 'src/modules/example/example.guard.ts');
const SPEC_FILE = path.join(
  repoRoot,
  'src/modules/example/application/example.service.spec.ts',
);
const LIB_FILE = path.join(
  repoRoot,
  'src/modules/example/lib/example.helpers.ts',
);

const ERROR_SEVERITY = 2;

describe('eslint.config.mjs rule activation', () => {
  let eslint;
  const configFor = async file => {
    const config = await eslint.calculateConfigForFile(file);
    return config.rules;
  };

  beforeAll(() => {
    eslint = new ESLint({ cwd: repoRoot });
  });

  describe('simplicity caps apply to every source file (rules/20, rules/23)', () => {
    it.each([
      ['complexity', [{ max: 15 }]],
      ['max-depth', [{ max: 3 }]],
      ['no-nested-ternary', []],
      ['no-else-return', [{ allowElseIf: false }]],
      ['no-param-reassign', []],
      ['no-return-assign', ['always']],
    ])('%s is an error on library files', async (ruleId, expectedOptions) => {
      const rules = await configFor(LIB_FILE);
      expect(rules[ruleId], ruleId).toBeDefined();
      expect(rules[ruleId][0], ruleId).toBe(ERROR_SEVERITY);
      expect(rules[ruleId].slice(1), ruleId).toEqual(expectedOptions);
    });

    it('sonarjs/cognitive-complexity caps at 15', async () => {
      const rules = await configFor(SERVICE_FILE);
      expect(rules['sonarjs/cognitive-complexity']).toEqual([
        ERROR_SEVERITY,
        15,
      ]);
    });
  });

  describe('service overrides stay active', () => {
    it('caps service methods at 20 lines', async () => {
      const rules = await configFor(SERVICE_FILE);
      expect(rules['max-lines-per-function'][0]).toBe(ERROR_SEVERITY);
      expect(rules['max-lines-per-function'][1]).toMatchObject({ max: 20 });
    });

    it('blocks use-case imports in services', async () => {
      const rules = await configFor(SERVICE_FILE);
      expect(rules['architecture/no-use-case-import-in-service'][0]).toBe(
        ERROR_SEVERITY,
      );
    });
  });

  describe('implementation-layer overrides resolve via globs (regression: regex strings in `files` never match)', () => {
    it.each([
      ['service', SERVICE_FILE],
      ['controller', CONTROLLER_FILE],
      ['repository', REPOSITORY_FILE],
      ['adapter', ADAPTER_FILE],
      ['nested adapter', NESTED_ADAPTER_FILE],
      ['guard', GUARD_FILE],
      ['nested guard', NESTED_GUARD_FILE],
    ])(
      'no-inline-layer-declarations is active on %s files',
      async (_, file) => {
        const rules = await configFor(file);
        expect(rules['architecture/no-inline-layer-declarations'][0]).toBe(
          ERROR_SEVERITY,
        );
      },
    );

    it.each([
      ['service', SERVICE_FILE],
      ['controller', CONTROLLER_FILE],
      ['repository', REPOSITORY_FILE],
      ['adapter', ADAPTER_FILE],
      ['nested adapter', NESTED_ADAPTER_FILE],
      ['guard', GUARD_FILE],
      ['nested guard', NESTED_GUARD_FILE],
    ])('max-classes-per-file caps %s files at one class', async (_, file) => {
      const rules = await configFor(file);
      expect(rules['max-classes-per-file']).toEqual([ERROR_SEVERITY, 1]);
    });

    it('controller-no-logic is active on controllers', async () => {
      const rules = await configFor(CONTROLLER_FILE);
      expect(rules['architecture/controller-no-logic'][0]).toBe(ERROR_SEVERITY);
    });

    it.each([
      ['adapter', ADAPTER_FILE],
      ['nested adapter', NESTED_ADAPTER_FILE],
    ])('%s files ban inline Promise concurrency', async (_, file) => {
      const rules = await configFor(file);
      const restricted = rules['no-restricted-syntax'];
      expect(restricted[0]).toBe(ERROR_SEVERITY);
      const selectors = restricted.slice(1).map(option => option.selector);
      expect(selectors.join(' ')).toContain("callee.object.name='Promise'");
    });

    it('domain files reject API DTO imports', async () => {
      const rules = await configFor(DOMAIN_FILE);
      expect(rules['architecture/no-dto-import-in-domain-or-use-case'][0]).toBe(
        ERROR_SEVERITY,
      );
    });

    it('lib files are NOT implementation layers (the function is the layer)', async () => {
      const rules = await configFor(LIB_FILE);
      expect(rules['architecture/no-inline-layer-declarations']).toBe(
        undefined,
      );
    });
  });

  describe('test relaxations stay intact', () => {
    it('spec files keep max-lines-per-function off and no-explicit-any on', async () => {
      const rules = await configFor(SPEC_FILE);
      expect(rules['max-lines-per-function'][0]).toBe(0);
      expect(rules['@typescript-eslint/no-explicit-any'][0]).toBe(
        ERROR_SEVERITY,
      );
    });
  });
});
