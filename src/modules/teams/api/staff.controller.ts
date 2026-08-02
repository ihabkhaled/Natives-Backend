import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AssignStaffTitleUseCase } from '../application/assign-staff-title.use-case';
import { RemoveStaffAssignmentUseCase } from '../application/remove-staff-assignment.use-case';
import { StaffAssignmentQueryService } from '../application/staff-assignment-query.service';
import { resolvePage } from '../lib/teams.helpers';
import {
  STAFF_ASSIGNMENT_BY_ID_ROUTE,
  STAFF_ASSIGNMENT_ID_PARAM,
  STAFF_ASSIGNMENTS_ROUTE,
  TEAM_ID_PARAM,
  TEAMS_API_TAG,
  TEAMS_ROUTE,
} from '../model/teams.constants';
import { AssignStaffTitleDto } from './dto/assign-staff-title.dto';
import { TeamListQueryDto } from './dto/list-query.dto';
import { ListStaffAssignmentsResponseDto } from './dto/list-staff-assignments-response.dto';
import { StaffAssignmentResponseDto } from './dto/staff-assignment-response.dto';

/**
 * Admin CRUD for per-team staff-title assignments (the public "who's who"
 * roster), gated on the existing team-admin permission (create/remove) and
 * team-read (list) — no new permission introduced for this surface.
 */
@ApiTags(TEAMS_API_TAG)
@Controller(TEAMS_ROUTE)
export class StaffController {
  constructor(
    private readonly assign: AssignStaffTitleUseCase,
    private readonly remove: RemoveStaffAssignmentUseCase,
    private readonly query: StaffAssignmentQueryService,
  ) {}

  @Post(STAFF_ASSIGNMENTS_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a staff title to a membership' })
  @ApiCreatedResponse({
    description: 'Staff assignment created',
    type: StaffAssignmentResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: AssignStaffTitleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StaffAssignmentResponseDto> {
    return this.assign.execute(actor, teamId, {
      membershipId: dto.membershipId,
      titleEntryId: dto.titleEntryId,
      photoUrl: dto.photoUrl ?? null,
    });
  }

  @Get(STAFF_ASSIGNMENTS_ROUTE)
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'List a team’s staff-title assignments' })
  @ApiOkResponse({
    description: 'Staff assignments',
    type: ListStaffAssignmentsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: TeamListQueryDto,
  ): Promise<ListStaffAssignmentsResponseDto> {
    return this.query.list(teamId, resolvePage(query.limit, query.offset));
  }

  @Delete(STAFF_ASSIGNMENT_BY_ID_ROUTE)
  @RequirePermissions(Permission.TeamSettingsManage)
  @ApiOperation({ summary: 'Remove a staff-title assignment' })
  @ApiOkResponse({
    description: 'Staff assignment removed',
    type: StaffAssignmentResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(STAFF_ASSIGNMENT_ID_PARAM, UuidValidationPipe) assignmentId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<StaffAssignmentResponseDto> {
    return this.remove.execute(actor, teamId, assignmentId);
  }
}
