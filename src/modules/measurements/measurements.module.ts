import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { MeasurementHistoryController } from './api/measurement-history.controller';
import { MeasurementProtocolController } from './api/measurement-protocol.controller';
import { MeasurementSelfController } from './api/measurement-self.controller';
import { MeasurementSessionController } from './api/measurement-session.controller';
import { CreateMeasurementProtocolUseCase } from './application/create-measurement-protocol.use-case';
import { CreateMeasurementSessionUseCase } from './application/create-measurement-session.use-case';
import { MeasurementHistoryService } from './application/measurement-history.service';
import { MeasurementScopeService } from './application/measurement-scope.service';
import { ProtocolQueryService } from './application/protocol-query.service';
import { RecordMeasurementUseCase } from './application/record-measurement.use-case';
import { SessionQueryService } from './application/session-query.service';
import { TransitionMeasurementSessionUseCase } from './application/transition-measurement-session.use-case';
import { MeasurementAttemptRepository } from './infrastructure/measurement-attempt.repository';
import { MeasurementProtocolRepository } from './infrastructure/measurement-protocol.repository';
import { MeasurementScopeRepository } from './infrastructure/measurement-scope.repository';
import { MeasurementSessionRepository } from './infrastructure/measurement-session.repository';

/**
 * Physical & skill measurement (UN-304). An objective-test catalog (protocols with
 * units, direction, instructions, and safety notes), scheduled/conducted sessions
 * per team+season, and immutable per-player attempts. A pure engine converts units
 * and derives the best/average/latest result per protocol policy — missing attempts
 * stay null, never zero. Recording requires measurement.record and emits a
 * MeasurementRecorded outbox event; reads are gated by analytics.read.self/team.
 * Owns its persistence (raw SQL via the global UnitOfWorkPort) and composes the
 * platform audit + outbox primitives so every write is recorded atomically.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    MeasurementProtocolController,
    MeasurementSessionController,
    MeasurementHistoryController,
    MeasurementSelfController,
  ],
  providers: [
    MeasurementScopeRepository,
    MeasurementProtocolRepository,
    MeasurementSessionRepository,
    MeasurementAttemptRepository,
    MeasurementScopeService,
    ProtocolQueryService,
    SessionQueryService,
    MeasurementHistoryService,
    CreateMeasurementProtocolUseCase,
    CreateMeasurementSessionUseCase,
    TransitionMeasurementSessionUseCase,
    RecordMeasurementUseCase,
  ],
})
export class MeasurementsModule {}
