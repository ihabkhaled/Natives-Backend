import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isReviewableSignup } from '../domain/signup.policy';
import { SignupNotFoundError } from '../errors/signup-not-found.error';
import { UserRepository } from '../infrastructure/user.repository';
import { toSignupRequestSummary } from '../lib/identity.mapper';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type {
  ReviewSignupCommand,
  SignupRequestSummary,
  User,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SendSignupEmailService } from './send-signup-email.service';

/**
 * Approves a pending self-signup: locks the row, verifies it is still pending
 * (a non-pending or unknown id is a not-found, never an enumeration), activates
 * the account, and audits who approved it and when — all atomically. Approval
 * only activates the account for later team assignment; it grants no membership
 * or role on its own. The applicant is emailed best-effort after commit.
 */
@Injectable()
export class ApproveSignupUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly users: UserRepository,
    private readonly audit: SecurityAuditService,
    private readonly signupEmail: SendSignupEmailService,
  ) {}

  async execute(command: ReviewSignupCommand): Promise<SignupRequestSummary> {
    const user = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, command),
    );
    const summary = toSignupRequestSummary(user);
    await this.signupEmail.sendApproved(summary);
    return summary;
  }

  private async run(
    scope: TransactionScope,
    command: ReviewSignupCommand,
  ): Promise<User> {
    const now = this.clock.now();
    const user = await this.users.findByIdForUpdate(scope, command.signupId);
    if (user === null || !isReviewableSignup(user)) {
      throw new SignupNotFoundError();
    }
    await this.users.markReviewed(
      scope,
      user.id,
      UserStatus.Active,
      command.reviewerId,
      now,
    );
    await this.audit.record(
      scope,
      SecurityEventType.SignupApproved,
      command.reviewerId,
      { signupId: user.id },
    );
    return { ...user, status: UserStatus.Active };
  }
}
