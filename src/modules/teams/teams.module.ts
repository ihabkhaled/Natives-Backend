import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { Module } from '@nestjs/common';

import { CatalogsController } from './api/catalogs.controller';
import { SeasonsController } from './api/seasons.controller';
import { SettingsController } from './api/settings.controller';
import { TeamsController } from './api/teams.controller';
import { VenuesController } from './api/venues.controller';
import { ArchiveCatalogEntryUseCase } from './application/archive-catalog-entry.use-case';
import { ArchiveVenueUseCase } from './application/archive-venue.use-case';
import { CancelSettingVersionUseCase } from './application/cancel-setting-version.use-case';
import { CatalogQueryService } from './application/catalog-query.service';
import { CreateCatalogEntryUseCase } from './application/create-catalog-entry.use-case';
import { CreateSeasonUseCase } from './application/create-season.use-case';
import { CreateSettingVersionUseCase } from './application/create-setting-version.use-case';
import { CreateTeamUseCase } from './application/create-team.use-case';
import { CreateVenueUseCase } from './application/create-venue.use-case';
import { RemoveTeamUseCase } from './application/remove-team.use-case';
import { SeasonQueryService } from './application/season-query.service';
import { SettingsQueryService } from './application/settings-query.service';
import { TeamLookupService } from './application/team-lookup.service';
import { TeamQueryService } from './application/team-query.service';
import { TransitionSeasonUseCase } from './application/transition-season.use-case';
import { TransitionTeamUseCase } from './application/transition-team.use-case';
import { UpdateSeasonUseCase } from './application/update-season.use-case';
import { UpdateTeamUseCase } from './application/update-team.use-case';
import { UpdateVenueUseCase } from './application/update-venue.use-case';
import { VenueQueryService } from './application/venue-query.service';
import { CatalogRepository } from './infrastructure/catalog.repository';
import { SeasonRepository } from './infrastructure/season.repository';
import { SettingVersionRepository } from './infrastructure/setting-version.repository';
import { TeamRepository } from './infrastructure/team.repository';
import { TeamAuditRepository } from './infrastructure/team-audit.repository';
import { VenueRepository } from './infrastructure/venue.repository';

/**
 * Teams bounded context: the stable team/season/venue records, configurable
 * reference catalogs, and effective-dated versioned settings every sports module
 * builds on. Owns its persistence (raw SQL via the global UnitOfWorkPort) and
 * writes audit rows to the shared security_events log. No other module imports
 * its internals; downstream modules reference the stable IDs and setting versions
 * it persists.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule],
  controllers: [
    TeamsController,
    SeasonsController,
    VenuesController,
    CatalogsController,
    SettingsController,
  ],
  providers: [
    TeamRepository,
    SeasonRepository,
    VenueRepository,
    CatalogRepository,
    SettingVersionRepository,
    TeamAuditRepository,
    TeamLookupService,
    TeamQueryService,
    SeasonQueryService,
    VenueQueryService,
    CatalogQueryService,
    SettingsQueryService,
    CreateTeamUseCase,
    UpdateTeamUseCase,
    TransitionTeamUseCase,
    RemoveTeamUseCase,
    CreateSeasonUseCase,
    UpdateSeasonUseCase,
    TransitionSeasonUseCase,
    CreateVenueUseCase,
    UpdateVenueUseCase,
    ArchiveVenueUseCase,
    CreateCatalogEntryUseCase,
    ArchiveCatalogEntryUseCase,
    CreateSettingVersionUseCase,
    CancelSettingVersionUseCase,
  ],
})
export class TeamsModule {}
