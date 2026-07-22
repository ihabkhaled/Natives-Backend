import {
  SCHEDULED_JOB_PORT,
  type ScheduledJob,
  type ScheduledJobRegistryPort,
} from '@modules/platform';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { ExpireInvitationsUseCase } from '../application/expire-invitations.use-case';
import {
  INVITATION_EXPIRY_INTERVAL_MS,
  INVITATION_EXPIRY_JOB_KEY,
} from '../model/identity.constants';

/**
 * Identity's scheduled maintenance: sweep overdue pending invitations to
 * EXPIRED. Registers itself with the platform job seam on module init —
 * platform never imports identity; the registry is how the dependency points
 * the right way — so the previously latent sweep actually runs and reports
 * health.
 */
@Injectable()
export class InvitationExpiryJob implements ScheduledJob, OnModuleInit {
  readonly jobKey = INVITATION_EXPIRY_JOB_KEY;
  readonly intervalMs = INVITATION_EXPIRY_INTERVAL_MS;

  constructor(
    @Inject(SCHEDULED_JOB_PORT)
    private readonly registry: ScheduledJobRegistryPort,
    private readonly expireInvitations: ExpireInvitationsUseCase,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async run(): Promise<void> {
    await this.expireInvitations.execute();
  }
}
