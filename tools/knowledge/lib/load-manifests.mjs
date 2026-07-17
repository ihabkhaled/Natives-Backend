import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MANIFEST_FILES = {
  repository: 'repository.json',
  modules: 'modules.json',
  documents: 'documents.json',
  dependencyGraph: 'dependency-graph.json',
};

// Loads the 4 committed manifests from .ai/manifests/. Returns null (never
// throws) when any is absent, so callers can print a "run knowledge:build
// first" hint. Shared by the resolver, the benchmark, and their tests.
export function loadManifests(repoRoot) {
  const manifestDir = path.join(repoRoot, '.ai', 'manifests');
  const manifests = {};
  for (const [name, file] of Object.entries(MANIFEST_FILES)) {
    const filePath = path.join(manifestDir, file);
    if (!existsSync(filePath)) {
      return null;
    }
    manifests[name] = JSON.parse(readFileSync(filePath, 'utf8'));
  }
  return manifests;
}
