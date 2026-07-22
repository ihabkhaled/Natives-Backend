import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { VideoAnalysisSchema1723900000000 } from './1723900000000-video-analysis-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new VideoAnalysisSchema1723900000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('VideoAnalysisSchema1723900000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"video_sources"');
    expect(statements).toContain('"video_clips"');
    expect(statements).toContain('"video_clip_players"');
    expect(statements).toContain('"video_clip_tags"');
  });

  it('keeps an unknown recording duration nullable rather than zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      '"duration_seconds" IS NULL OR "duration_seconds" > 0',
    );
  });

  it('constrains the clip review lifecycle and visibility', async () => {
    const statements = await upStatements();
    for (const status of [
      'draft',
      'in_review',
      'published',
      'revised',
      'archived',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    for (const visibility of ['coach_only', 'tagged_players', 'team']) {
      expect(statements).toContain(`'${visibility}'`);
    }
  });

  it('makes the import reference unique per team', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_video_clips_import_reference"');
  });

  it('drops every table on down in dependency order', async () => {
    const queryRunner = runner();
    await new VideoAnalysisSchema1723900000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "video_clip_tags"');
    expect(statements).toContain('DROP TABLE IF EXISTS "video_sources"');
  });
});
