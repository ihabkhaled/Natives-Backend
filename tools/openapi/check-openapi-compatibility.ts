import { readFile } from 'node:fs/promises';

import { OPENAPI_ALLOW_BREAKING_FLAG } from '../../src/bootstrap/openapi-artifact.constants';
import { classifyOpenApiChange } from '../../src/bootstrap/openapi-compatibility';
import type { OpenApiDocument } from '../../src/bootstrap/openapi-document.types';

function parseDocument(source: string): OpenApiDocument {
  return JSON.parse(source) as OpenApiDocument;
}

async function run(): Promise<void> {
  const [baselineSource, currentSource] = await Promise.all([
    readFile('.tmp/openapi-base.json', 'utf8'),
    readFile('contracts/openapi.json', 'utf8'),
  ]);
  const report = classifyOpenApiChange(
    parseDocument(baselineSource),
    parseDocument(currentSource),
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.breaking && !process.argv.includes(OPENAPI_ALLOW_BREAKING_FLAG)) {
    throw new Error(
      'Breaking OpenAPI drift requires the api-breaking-approved label and a coordinated rollout.',
    );
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
