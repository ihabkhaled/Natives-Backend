import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { VideoClipNotFoundError } from '../errors/video-clip-not-found.error';
import { VideoSourceNotFoundError } from '../errors/video-source-not-found.error';
import { VideoClipRepository } from '../infrastructure/video-clip.repository';
import { VideoSourceRepository } from '../infrastructure/video-source.repository';
import type { VideoClip, VideoSource } from '../model/analysis.types';

/**
 * Resolves a team-owned source or clip for a write or a scoped read, translating
 * a miss into a 404 that hides existence. Only the caller's own team is
 * reachable — a cross-team id resolves to not-found, never a leak.
 */
@Injectable()
export class AnalysisLookupService {
  constructor(
    private readonly sources: VideoSourceRepository,
    private readonly clips: VideoClipRepository,
  ) {}

  async requireSource(
    scope: TransactionScope,
    teamId: string,
    sourceId: string,
  ): Promise<VideoSource> {
    const source = await this.sources.findForWrite(scope, teamId, sourceId);
    if (source === null) {
      throw new VideoSourceNotFoundError();
    }
    return source;
  }

  async requireClip(
    scope: TransactionScope,
    teamId: string,
    clipId: string,
  ): Promise<VideoClip> {
    const clip = await this.clips.findForWrite(scope, teamId, clipId);
    if (clip === null) {
      throw new VideoClipNotFoundError();
    }
    return clip;
  }
}
