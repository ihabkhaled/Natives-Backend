import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { AnomalyNotFoundError } from '../errors/anomaly-not-found.error';
import { DataQualityScopeNotFoundError } from '../errors/data-quality-scope-not-found.error';
import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import type { Anomaly } from '../model/dataquality.types';

/**
 * Resolves team-owned anomalies, translating a miss into a 404 that hides
 * existence, and validates the team scope of a write.
 */
@Injectable()
export class DataQualityLookupService {
  constructor(private readonly anomalies: AnomalyRepository) {}

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.anomalies.activeTeamExists(scope, teamId))) {
      throw new DataQualityScopeNotFoundError();
    }
  }

  async requireAnomaly(
    scope: TransactionScope,
    teamId: string,
    anomalyId: string,
  ): Promise<Anomaly> {
    const anomaly = await this.anomalies.findForWrite(scope, teamId, anomalyId);
    if (anomaly === null) {
      throw new AnomalyNotFoundError();
    }
    return anomaly;
  }
}
