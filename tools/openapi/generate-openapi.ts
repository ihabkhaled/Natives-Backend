import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { createApp } from '../../src/bootstrap/create-app';
import {
  hashOpenApiArtifact,
  serializeOpenApiDocument,
} from '../../src/bootstrap/openapi-artifact';
import { OPENAPI_CHECK_FLAG } from '../../src/bootstrap/openapi-artifact.constants';
import { createOpenApiDocument } from '../../src/bootstrap/openapi-document';

async function assertArtifactMatches(
  artifact: string,
  checksum: string,
): Promise<void> {
  const [committedArtifact, committedChecksum] = await Promise.all([
    readFile('contracts/openapi.json', 'utf8'),
    readFile('contracts/openapi.sha256', 'utf8'),
  ]);

  if (committedArtifact !== artifact || committedChecksum.trim() !== checksum) {
    throw new Error(
      'OpenAPI contract drift detected. Run npm run contract:generate.',
    );
  }
}

async function writeArtifact(
  artifact: string,
  checksum: string,
): Promise<void> {
  await mkdir('contracts', { recursive: true });
  await Promise.all([
    writeFile('contracts/openapi.json', artifact, 'utf8'),
    writeFile('contracts/openapi.sha256', `${checksum}\n`, 'utf8'),
  ]);
}

async function run(): Promise<void> {
  const app = await createApp();
  try {
    const artifact = serializeOpenApiDocument(createOpenApiDocument(app));
    const checksum = hashOpenApiArtifact(artifact);
    if (process.argv.includes(OPENAPI_CHECK_FLAG)) {
      await assertArtifactMatches(artifact, checksum);
    } else {
      await writeArtifact(artifact, checksum);
    }
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
