import type { AuditInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  CALCULATION_VERSION,
  JOB_EXPIRY_HOURS,
  MILLISECONDS_PER_HOUR,
  REPORT_REQUESTED_ACTION,
  REPORT_RESOURCE_TYPE,
} from '../model/reports.constants';
import type { ReportPrivacyClass } from '../model/reports.enums';
import type {
  NewReportJob,
  ReportJob,
  ReportRequest,
} from '../model/reports.types';

/** The instant a newly requested job's download expires. */
export function expiryOf(now: Date): Date {
  return new Date(now.getTime() + JOB_EXPIRY_HOURS * MILLISECONDS_PER_HOUR);
}

export function buildNewJob(
  id: string,
  teamId: string,
  request: ReportRequest,
  privacyClass: ReportPrivacyClass,
  requestHash: string,
  actorUserId: string,
  now: Date,
): NewReportJob {
  return {
    id,
    teamId,
    seasonId: request.seasonId,
    template: request.template,
    format: request.format,
    privacyClass,
    parameters: request.parameters,
    requestHash,
    calculationVersion: CALCULATION_VERSION,
    snapshotAt: now,
    expiresAt: expiryOf(now),
    requestedBy: actorUserId,
    now,
  };
}

/**
 * Audit a report job. The diff carries the template, format, and privacy class —
 * never the produced rows or the parameter values, which may reference members.
 */
export function buildJobAudit(
  action: string,
  actorUserId: string,
  job: ReportJob,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: REPORT_RESOURCE_TYPE,
    resourceId: job.jobId,
    teamId: job.teamId,
    seasonId: job.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      template: job.template,
      format: job.format,
      privacyClass: job.privacyClass,
      status: job.status,
    },
  };
}

export function buildRequestedAudit(
  actorUserId: string,
  job: ReportJob,
): AuditInput {
  return buildJobAudit(REPORT_REQUESTED_ACTION, actorUserId, job);
}
