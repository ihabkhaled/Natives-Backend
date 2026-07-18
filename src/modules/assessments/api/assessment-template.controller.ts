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
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AssessmentQueryService } from '../application/assessment-query.service';
import { CreateTemplateUseCase } from '../application/create-template.use-case';
import { CreateTemplateVersionUseCase } from '../application/create-template-version.use-case';
import { PublishTemplateUseCase } from '../application/publish-template.use-case';
import { resolveAssessmentPage } from '../lib/assessments.helpers';
import {
  ASSESSMENT_CATALOG_ROUTE,
  ASSESSMENT_TEMPLATE_PUBLISH_ROUTE,
  ASSESSMENT_TEMPLATE_VERSIONS_ROUTE,
  ASSESSMENT_TEMPLATES_ROUTE,
  ASSESSMENTS_API_TAG,
  TEAM_ID_PARAM,
  TEMPLATE_ID_PARAM,
} from '../model/assessments.constants';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListCatalogQueryDto } from './dto/list-catalog.query.dto';
import { ListTemplatesResponseDto } from './dto/list-templates.response.dto';
import { PublishTemplateDto } from './dto/publish-template.dto';
import { TemplateResponseDto } from './dto/template-response.dto';

@ApiTags(ASSESSMENTS_API_TAG)
@Controller(ASSESSMENT_CATALOG_ROUTE)
export class AssessmentTemplateController {
  constructor(
    private readonly query: AssessmentQueryService,
    private readonly createTemplate: CreateTemplateUseCase,
    private readonly createTemplateVersion: CreateTemplateVersionUseCase,
    private readonly publishTemplate: PublishTemplateUseCase,
  ) {}

  @Get(ASSESSMENT_TEMPLATES_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List assessment templates for a team' })
  @ApiOkResponse({ description: 'Templates', type: ListTemplatesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListTemplatesResponseDto> {
    return this.query.listTemplates(
      teamId,
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Post(ASSESSMENT_TEMPLATES_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft assessment template (version 1)' })
  @ApiCreatedResponse({
    description: 'Template created',
    type: TemplateResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateTemplateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TemplateResponseDto> {
    return this.createTemplate.execute(actor, teamId, {
      key: dto.key,
      seasonId: dto.seasonId ?? null,
      name: dto.name,
      cohort: dto.cohort ?? null,
      evaluatorRoles: dto.evaluatorRoles,
      scoreVersion: dto.scoreVersion,
      categoryWeights: dto.categoryWeights,
      metrics: dto.metrics,
    });
  }

  @Post(ASSESSMENT_TEMPLATE_VERSIONS_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a new draft version of a template' })
  @ApiCreatedResponse({
    description: 'Version created',
    type: TemplateResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createVersion(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(TEMPLATE_ID_PARAM, UuidValidationPipe) templateId: string,
    @Body() dto: CreateTemplateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TemplateResponseDto> {
    return this.createTemplateVersion.execute(actor, teamId, templateId, {
      key: dto.key,
      seasonId: dto.seasonId ?? null,
      name: dto.name,
      cohort: dto.cohort ?? null,
      evaluatorRoles: dto.evaluatorRoles,
      scoreVersion: dto.scoreVersion,
      categoryWeights: dto.categoryWeights,
      metrics: dto.metrics,
    });
  }

  @Post(ASSESSMENT_TEMPLATE_PUBLISH_ROUTE)
  @RequirePermissions(Permission.AssessmentPublish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish and lock a draft template version' })
  @ApiOkResponse({
    description: 'Template published',
    type: TemplateResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(TEMPLATE_ID_PARAM, UuidValidationPipe) templateId: string,
    @Body() dto: PublishTemplateDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TemplateResponseDto> {
    return this.publishTemplate.execute(actor, teamId, templateId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
