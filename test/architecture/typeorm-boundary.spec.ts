import { describe, expect, it } from 'vitest';

// Eagerly load every source file as raw text via the test runner (no filesystem
// access), then assert the application/domain layers never import TypeORM. This
// is the mechanical counterpart to the package-boundary ESLint rule.
const sources = import.meta.glob('../../src/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const TYPEORM_IMPORT =
  /(?:from\s+['"]typeorm['"]|require\(\s*['"]typeorm['"]\s*\))/u;

function isApplicationOrDomainFile(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  if (normalized.includes('/database/') || normalized.endsWith('.spec.ts')) {
    return false;
  }
  return (
    normalized.includes('/application/') ||
    normalized.includes('/domain/') ||
    normalized.endsWith('.service.ts') ||
    normalized.endsWith('.use-case.ts')
  );
}

describe('TypeORM boundary', () => {
  const guardedFiles = Object.keys(sources).filter(path =>
    isApplicationOrDomainFile(path),
  );

  it('covers the application and domain layers', () => {
    expect(guardedFiles.length).toBeGreaterThan(0);
  });

  it('never imports typeorm in application or domain code', () => {
    for (const filePath of guardedFiles) {
      expect(
        TYPEORM_IMPORT.test(sources[filePath] ?? ''),
        `${filePath} must not import typeorm — depend on an app-owned port`,
      ).toBe(false);
    }
  });
});
