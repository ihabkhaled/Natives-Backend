import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { SignedVideoAccessAdapter } from './adapters/signed-video-access.adapter';
import { VideoClipsController } from './api/video-clips.controller';
import { VideoSourcesController } from './api/video-sources.controller';
import { AcknowledgeVideoClipUseCase } from './application/acknowledge-video-clip.use-case';
import { AnalysisAuthorityService } from './application/analysis-authority.service';
import { AnalysisLookupService } from './application/analysis-lookup.service';
import { AnalysisScopeService } from './application/analysis-scope.service';
import { ClipViewService } from './application/clip-view.service';
import { CreateVideoClipUseCase } from './application/create-video-clip.use-case';
import { ImportVideoClipsUseCase } from './application/import-video-clips.use-case';
import { RegisterVideoSourceUseCase } from './application/register-video-source.use-case';
import { ReviseVideoClipUseCase } from './application/revise-video-clip.use-case';
import { TransitionVideoClipUseCase } from './application/transition-video-clip.use-case';
import { VideoAccessService } from './application/video-access.service';
import { VideoClipQueryService } from './application/video-clip-query.service';
import { VideoSourceQueryService } from './application/video-source-query.service';
import { AnalysisScopeRepository } from './infrastructure/analysis-scope.repository';
import { ClipDetailRepository } from './infrastructure/clip-detail.repository';
import { VideoClipRepository } from './infrastructure/video-clip.repository';
import { VideoSourceRepository } from './infrastructure/video-source.repository';
import { VIDEO_ACCESS_PORT } from './model/analysis.constants';

/**
 * Match video analysis (UN-505): secured video sources and timestamped coaching
 * observations linked to players, points, and possession events. Owns its
 * persistence (raw SQL via the global UnitOfWorkPort) and composes the platform
 * audit + outbox primitives so every write commits atomically with its
 * `analysis.*` events.
 *
 * Two invariants shape the module. Video rights follow the SOURCE: the API only
 * ever mints an expiring signed provider URL through the `VIDEO_ACCESS_PORT`
 * adapter and never proxies unauthorized video. Visibility is EXPLICIT: a player
 * receives only published clips addressed to them and a coach-only note is
 * redacted before it leaves the application.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule, RbacModule],
  controllers: [VideoSourcesController, VideoClipsController],
  providers: [
    { provide: VIDEO_ACCESS_PORT, useClass: SignedVideoAccessAdapter },
    AnalysisScopeRepository,
    VideoSourceRepository,
    VideoClipRepository,
    ClipDetailRepository,
    AnalysisScopeService,
    AnalysisLookupService,
    AnalysisAuthorityService,
    ClipViewService,
    VideoSourceQueryService,
    VideoClipQueryService,
    VideoAccessService,
    RegisterVideoSourceUseCase,
    CreateVideoClipUseCase,
    TransitionVideoClipUseCase,
    ReviseVideoClipUseCase,
    AcknowledgeVideoClipUseCase,
    ImportVideoClipsUseCase,
  ],
})
export class AnalysisModule {}
