import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { ClipDetailRepository } from '../infrastructure/clip-detail.repository';
import type { ClipPlayerRow, ClipTagRow } from '../model/analysis.rows';
import type { VideoClip, VideoClipView } from '../model/analysis.types';

/**
 * Assembles clips into their read model: each clip plus its tags, the
 * memberships it is about, and which of those already acknowledged it. The
 * satellite rows are fetched once for the whole page (two bounded queries, never
 * one per clip) so a large queue stays a constant number of round trips.
 */
@Injectable()
export class ClipViewService {
  constructor(private readonly details: ClipDetailRepository) {}

  async assemble(
    scope: TransactionScope,
    clips: readonly VideoClip[],
  ): Promise<readonly VideoClipView[]> {
    const clipIds = clips.map(clip => clip.clipId);
    const players = await this.details.listPlayers(scope, clipIds);
    const tags = await this.details.listTags(scope, clipIds);
    return clips.map(clip => this.toView(clip, players, tags));
  }

  async assembleOne(
    scope: TransactionScope,
    clip: VideoClip,
  ): Promise<VideoClipView> {
    const views = await this.assemble(scope, [clip]);
    return views[0] ?? this.toView(clip, [], []);
  }

  private toView(
    clip: VideoClip,
    players: readonly ClipPlayerRow[],
    tags: readonly ClipTagRow[],
  ): VideoClipView {
    const own = players.filter(player => player.clip_id === clip.clipId);
    return {
      clip,
      tags: tags.filter(tag => tag.clip_id === clip.clipId).map(tag => tag.tag),
      membershipIds: own.map(player => player.membership_id),
      acknowledgedMembershipIds: own
        .filter(player => player.acknowledged_at !== null)
        .map(player => player.membership_id),
    };
  }
}
