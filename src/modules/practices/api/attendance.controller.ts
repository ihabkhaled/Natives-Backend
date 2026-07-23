import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
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
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AttendanceQueryService } from '../application/attendance-query.service';
import { CorrectAttendanceUseCase } from '../application/correct-attendance.use-case';
import { FinalizeAttendanceUseCase } from '../application/finalize-attendance.use-case';
import { RecordAttendanceUseCase } from '../application/record-attendance.use-case';
import { SelfCheckInUseCase } from '../application/self-check-in.use-case';
import {
  parseNullableInstant,
  resolveAttendancePage,
} from '../lib/attendance.helpers';
import {
  ATTENDANCE_BULK_ROUTE,
  ATTENDANCE_CHECK_IN_ROUTE,
  ATTENDANCE_CORRECTION_ROUTE,
  ATTENDANCE_FINALIZE_ROUTE,
  ATTENDANCE_HISTORY_ROUTE,
  ATTENDANCE_LIST_ROUTE,
  ATTENDANCE_RECORD_ROUTE,
  ATTENDANCE_SELF_ROUTE,
} from '../model/attendance.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { MEMBERSHIP_ID_PARAM } from '../model/rsvp.constants';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceResponseDto } from './dto/attendance-response.dto';
import { AttendanceSheetResponseDto } from './dto/attendance-sheet-response.dto';
import { AttendanceStatusResponseDto } from './dto/attendance-status-response.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { BulkRecordResponseDto } from './dto/bulk-record-response.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { FinalizeAttendanceDto } from './dto/finalize-attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { SelfCheckInDto } from './dto/self-check-in.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class AttendanceController {
  constructor(
    private readonly record: RecordAttendanceUseCase,
    private readonly selfCheckIn: SelfCheckInUseCase,
    private readonly finalize: FinalizeAttendanceUseCase,
    private readonly correct: CorrectAttendanceUseCase,
    private readonly query: AttendanceQueryService,
  ) {}

  @Get(ATTENDANCE_LIST_ROUTE)
  @RequirePermissions(Permission.AttendanceReadTeam)
  @ApiOperation({
    summary: 'List the attendance roster + sheet state (prefill)',
  })
  @ApiOkResponse({ description: 'Roster', type: AttendanceSheetResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listRoster(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Query() query: ListAttendanceQueryDto,
  ): Promise<AttendanceSheetResponseDto> {
    return this.query.getRoster(
      teamId,
      sessionId,
      resolveAttendancePage(query),
    );
  }

  @Get(ATTENDANCE_SELF_ROUTE)
  @RequirePermissions(Permission.AttendanceReadSelf)
  @ApiOperation({ summary: 'Get my own attendance for a session' })
  @ApiOkResponse({ description: 'My attendance', type: AttendanceResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyAttendance(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceResponseDto> {
    return this.query.getOwn(teamId, sessionId, actor);
  }

  @Post(ATTENDANCE_CHECK_IN_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.AttendanceReadSelf)
  @ApiOperation({
    summary:
      'Check myself in for a session (status derived; idempotent — a repeated ' +
      'check-in returns the existing record unchanged)',
    description:
      'The status is derived from the server clock, never trusted from the ' +
      'client. A new check-in must fall inside the explicit window: it opens ' +
      '60 minutes before startsAt and closes at the session end, and only ' +
      'published/rescheduled sessions accept check-ins — otherwise 409 with ' +
      'messageKey errors.practices.checkInWindowClosed. Venue/geo/check-in-code ' +
      'policy is explicitly none: the window is the whole rule. A finalized ' +
      'sheet responds 409 errors.practices.attendanceLocked.',
  })
  @ApiOkResponse({ description: 'Checked in', type: AttendanceResponseDto })
  @ApiConflictResponse({
    description:
      'Outside the check-in window or session not check-in-able ' +
      '(errors.practices.checkInWindowClosed), or the sheet is finalized ' +
      '(errors.practices.attendanceLocked)',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  checkIn(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: SelfCheckInDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceResponseDto> {
    return this.selfCheckIn.execute(actor, teamId, sessionId, {
      note: dto.note ?? null,
    });
  }

  @Post(ATTENDANCE_BULK_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.AttendanceRecord)
  @ApiOperation({ summary: 'Bulk-mark attendance for a session (atomic)' })
  @ApiOkResponse({ description: 'Recorded', type: BulkRecordResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  recordBulk(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: BulkMarkAttendanceDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<BulkRecordResponseDto> {
    return this.record.recordBulk(actor, teamId, sessionId, {
      marks: dto.marks.map(entry => ({
        membershipId: entry.membershipId,
        status: entry.status,
        checkInAt: parseNullableInstant(entry.checkInAt),
        checkOutAt: parseNullableInstant(entry.checkOutAt),
        latenessMinutes: entry.latenessMinutes ?? null,
        excuseCategory: entry.excuseCategory ?? null,
        note: entry.note ?? null,
        evidenceRef: entry.evidenceRef ?? null,
        expectedVersion: entry.expectedVersion ?? null,
      })),
    });
  }

  @Post(ATTENDANCE_FINALIZE_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.AttendanceFinalize)
  @ApiOperation({ summary: 'Finalize (lock) attendance for a session' })
  @ApiOkResponse({
    description: 'Finalized',
    type: AttendanceStatusResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  finalizeSheet(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: FinalizeAttendanceDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceStatusResponseDto> {
    return this.finalize.execute(actor, teamId, sessionId, {
      expectedVersion: dto.expectedVersion,
    });
  }

  @Put(ATTENDANCE_RECORD_ROUTE)
  @RequirePermissions(Permission.AttendanceRecord)
  @ApiOperation({
    summary: "Record one participant's attendance (coach/admin)",
  })
  @ApiOkResponse({ description: 'Recorded', type: AttendanceResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  recordOne(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceResponseDto> {
    return this.record.recordOne(actor, teamId, sessionId, membershipId, {
      status: dto.status,
      checkInAt: parseNullableInstant(dto.checkInAt),
      checkOutAt: parseNullableInstant(dto.checkOutAt),
      latenessMinutes: dto.latenessMinutes ?? null,
      excuseCategory: dto.excuseCategory ?? null,
      note: dto.note ?? null,
      evidenceRef: dto.evidenceRef ?? null,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Put(ATTENDANCE_CORRECTION_ROUTE)
  @RequirePermissions(Permission.AttendanceCorrect)
  @ApiOperation({ summary: 'Correct a finalized attendance record (audited)' })
  @ApiOkResponse({ description: 'Corrected', type: AttendanceResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  correctOne(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceResponseDto> {
    return this.correct.execute(actor, teamId, sessionId, membershipId, {
      status: dto.status,
      checkInAt: parseNullableInstant(dto.checkInAt),
      checkOutAt: parseNullableInstant(dto.checkOutAt),
      latenessMinutes: dto.latenessMinutes ?? null,
      excuseCategory: dto.excuseCategory ?? null,
      note: dto.note ?? null,
      evidenceRef: dto.evidenceRef ?? null,
      correctionReason: dto.reason,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Get(ATTENDANCE_HISTORY_ROUTE)
  @RequirePermissions(Permission.AttendanceReadTeam)
  @ApiOperation({ summary: "A member's attendance correction history" })
  @ApiOkResponse({ description: 'History', type: AttendanceHistoryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getHistory(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<AttendanceHistoryResponseDto> {
    return this.query.getHistory(teamId, sessionId, membershipId);
  }
}
