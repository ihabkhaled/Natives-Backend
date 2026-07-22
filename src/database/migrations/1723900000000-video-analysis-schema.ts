import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Match video analysis, timestamped clips, tags, and the review workflow
 * (UN-505). Four additive tables; it changes no existing table and grants no new
 * permission (match.analysis.read.self / read.team / manage are already seeded
 * by the RBAC baseline):
 *
 *   - video_sources        a provider + opaque object reference for one match
 *                          recording, with the known duration (NULL means "not
 *                          known", never zero), the clock sync offset between
 *                          the recording and match time, the processing state,
 *                          and the access policy that decides who may be handed
 *                          a signed provider URL. Bytes never pass through the
 *                          application.
 *   - video_clips          a timestamped coaching observation on a source:
 *                          start/end second, offence/defence context, optional
 *                          links to a scored point and a possession event, the
 *                          DO / DONT / GOOD_EXAMPLE / BAD_EXAMPLE classification,
 *                          the comment visibility, the author, the review status
 *                          and the revision chain. A published clip is never
 *                          edited — a revision supersedes it.
 *   - video_clip_players   the visible players a clip is about, plus their own
 *                          acknowledgement instant (NULL = not acknowledged).
 *   - video_clip_tags      free, configurable tags on a clip (normalized, one
 *                          row per tag) so the taxonomy grows without a schema
 *                          change.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case,
 * check constraints mirroring the enums, optimistic record_version, and bounded
 * deterministic indexes. Fully reversible.
 */
export class VideoAnalysisSchema1723900000000 implements MigrationInterface {
  name = 'VideoAnalysisSchema1723900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSources(queryRunner);
    await this.createClips(queryRunner);
    await this.createClipPlayers(queryRunner);
    await this.createClipTags(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "video_clip_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "video_clip_players"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "video_clips"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "video_sources"`);
  }

  private async createSources(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "video_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "match_id" uuid REFERENCES "matches" ("id") ON DELETE SET NULL,
        "provider" text NOT NULL,
        "external_ref" text NOT NULL,
        "title" text NOT NULL,
        "duration_seconds" integer,
        "sync_offset_seconds" integer NOT NULL DEFAULT 0,
        "processing_status" text NOT NULL DEFAULT 'pending',
        "access_policy" text NOT NULL DEFAULT 'coaches',
        "record_version" integer NOT NULL DEFAULT 1,
        "registered_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_video_source_provider" CHECK ("provider" IN
          ('youtube', 'vimeo', 'drive', 'object_storage', 'external')),
        CONSTRAINT "ck_video_source_processing" CHECK ("processing_status" IN
          ('pending', 'ready', 'failed')),
        CONSTRAINT "ck_video_source_access" CHECK ("access_policy" IN
          ('coaches', 'team', 'restricted')),
        CONSTRAINT "ck_video_source_duration" CHECK
          ("duration_seconds" IS NULL OR "duration_seconds" > 0),
        CONSTRAINT "ck_video_source_offset" CHECK
          ("sync_offset_seconds" BETWEEN -86400 AND 86400)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_video_sources_team_ref"
         ON "video_sources" ("team_id", "provider", "external_ref")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_video_sources_scope"
         ON "video_sources" ("team_id", "created_at" DESC, "id")`,
    );
  }

  private async createClips(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "video_clips" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "source_id" uuid NOT NULL REFERENCES "video_sources" ("id")
          ON DELETE CASCADE,
        "match_id" uuid REFERENCES "matches" ("id") ON DELETE SET NULL,
        "point_id" uuid REFERENCES "match_events" ("id") ON DELETE SET NULL,
        "event_id" uuid REFERENCES "match_play_events" ("id")
          ON DELETE SET NULL,
        "start_second" integer NOT NULL,
        "end_second" integer,
        "play_context" text NOT NULL DEFAULT 'unspecified',
        "clip_type" text NOT NULL,
        "title" text NOT NULL,
        "comment" text,
        "visibility" text NOT NULL DEFAULT 'coach_only',
        "status" text NOT NULL DEFAULT 'draft',
        "revision" integer NOT NULL DEFAULT 1,
        "supersedes_clip_id" uuid REFERENCES "video_clips" ("id")
          ON DELETE SET NULL,
        "import_reference" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "author_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_video_clip_context" CHECK ("play_context" IN
          ('offense', 'defense', 'unspecified')),
        CONSTRAINT "ck_video_clip_type" CHECK ("clip_type" IN
          ('do', 'dont', 'good_example', 'bad_example', 'note')),
        CONSTRAINT "ck_video_clip_visibility" CHECK ("visibility" IN
          ('coach_only', 'tagged_players', 'team')),
        CONSTRAINT "ck_video_clip_status" CHECK ("status" IN
          ('draft', 'in_review', 'published', 'revised', 'archived')),
        CONSTRAINT "ck_video_clip_start" CHECK ("start_second" >= 0),
        CONSTRAINT "ck_video_clip_end" CHECK
          ("end_second" IS NULL OR "end_second" > "start_second"),
        CONSTRAINT "ck_video_clip_revision" CHECK ("revision" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_video_clips_queue"
         ON "video_clips" ("team_id", "status", "created_at" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_video_clips_source"
         ON "video_clips" ("source_id", "start_second", "id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_video_clips_import_reference"
         ON "video_clips" ("team_id", "import_reference")
         WHERE "import_reference" IS NOT NULL`,
    );
  }

  private async createClipPlayers(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "video_clip_players" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "clip_id" uuid NOT NULL REFERENCES "video_clips" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "acknowledged_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_video_clip_players" UNIQUE ("clip_id", "membership_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_video_clip_players_membership"
         ON "video_clip_players" ("membership_id", "clip_id")`,
    );
  }

  private async createClipTags(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "video_clip_tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "clip_id" uuid NOT NULL REFERENCES "video_clips" ("id")
          ON DELETE CASCADE,
        "tag" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_video_clip_tags" UNIQUE ("clip_id", "tag"),
        CONSTRAINT "ck_video_clip_tag_length" CHECK
          (char_length("tag") BETWEEN 2 AND 40)
      )
    `);
  }
}
