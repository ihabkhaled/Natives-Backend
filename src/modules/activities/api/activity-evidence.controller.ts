import { RequirePermissions } from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { EvidenceQueryService } from '../application/evidence-query.service';
import {
  ACTIVITIES_API_TAG,
  ACTIVITY_SUBMISSIONS_ROUTE,
  SUBMISSION_EVIDENCE_ROUTE,
  SUBMISSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/activities.constants';
import { ListEvidenceResponseDto } from './dto/list-evidence.response.dto';

/**
 * Reviewer-scoped evidence surface (evidence.read.review). The private storage
 * reference is exposed ONLY here — a plain member, lacking this permission, can
 * never read another member's (or their own) evidence references.
 */
@ApiTags(ACTIVITIES_API_TAG)
@Controller(ACTIVITY_SUBMISSIONS_ROUTE)
export class ActivityEvidenceController {
  constructor(private readonly evidence: EvidenceQueryService) {}

  @Get(SUBMISSION_EVIDENCE_ROUTE)
  @RequirePermissions(Permission.EvidenceReadReview)
  @ApiOperation({ summary: 'List a submission’s evidence (reviewer only)' })
  @ApiOkResponse({ type: ListEvidenceResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBMISSION_ID_PARAM, UuidValidationPipe) submissionId: string,
  ): Promise<ListEvidenceResponseDto> {
    return this.evidence.listForReview(teamId, submissionId);
  }
}
