import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
} from '@core/validation';

import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  CONSENT_VERSION_MAX_LENGTH,
  CONSENT_VERSION_MIN_LENGTH,
  CONTACT_MAX_LENGTH,
  CRITERIA_VERSION_MAX_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
  RETENTION_DAYS_MAX,
  RETENTION_DAYS_MIN,
  TEXT_MAX_LENGTH,
} from '../../model/tryouts.constants';
import {
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  EvaluationStatus,
  OfferStatus,
  OfferTransition,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutEventTransition,
  TryoutVisibility,
} from '../../model/tryouts.enums';

/**
 * The API boundary of tryouts (UN-600, UN-601). Every DTO class name is
 * module-qualified (`Tryout*` / `Candidate*` / `Evaluation*` / `Offer*`) so the
 * generated OpenAPI document can never collapse two shapes into one schema name.
 *
 * There is deliberately NO national-id field anywhere in this surface: the
 * column does not exist, so the value cannot be collected.
 */

/** Bounded pagination shared by every tryout list. */
export class TryoutPageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}

/** Allow-listed facets of the candidate list. */
export class CandidateListQueryDto extends TryoutPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly eventId?: string;

  @ApiPropertyOptional({ enum: CandidateStatus })
  @IsOptional()
  @IsEnum(CandidateStatus)
  readonly status?: CandidateStatus;

  @ApiPropertyOptional({ enum: CandidateReadiness })
  @IsOptional()
  @IsEnum(CandidateReadiness)
  readonly readiness?: CandidateReadiness;
}

/** Request body creating a draft tryout event. */
export class CreateTryoutEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly seasonId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly venueId?: string | null;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({
    minimum: CAPACITY_MIN,
    maximum: CAPACITY_MAX,
    nullable: true,
    description: 'Null means no seat limit — never zero seats.',
  })
  @IsOptional()
  @IsInt()
  @Min(CAPACITY_MIN)
  @Max(CAPACITY_MAX)
  readonly capacity?: number | null;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly registrationOpensAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly registrationClosesAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly startsAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly endsAt: string;

  @ApiPropertyOptional({ enum: TryoutVisibility })
  @IsOptional()
  @IsEnum(TryoutVisibility)
  readonly visibility?: TryoutVisibility;

  @ApiProperty({
    minLength: CONSENT_VERSION_MIN_LENGTH,
    maxLength: CONSENT_VERSION_MAX_LENGTH,
  })
  @IsString()
  @MinLength(CONSENT_VERSION_MIN_LENGTH)
  @MaxLength(CONSENT_VERSION_MAX_LENGTH)
  declare readonly consentVersion: string;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly eligibilityNote?: string | null;

  @ApiPropertyOptional({
    minimum: RETENTION_DAYS_MIN,
    maximum: RETENTION_DAYS_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(RETENTION_DAYS_MIN)
  @Max(RETENTION_DAYS_MAX)
  readonly retentionDays?: number;
}

/** Request body moving a tryout event through its lifecycle. */
export class TransitionTryoutEventDto {
  @ApiProperty({ enum: TryoutEventTransition })
  @IsEnum(TryoutEventTransition)
  declare readonly transition: TryoutEventTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

/** A tryout event. */
export class TryoutEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly eventId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly venueId: string | null;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly capacity: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly registrationOpensAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly registrationClosesAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly startsAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly endsAt: Date;

  @ApiProperty({ enum: TryoutVisibility })
  declare readonly visibility: TryoutVisibility;

  @ApiProperty()
  declare readonly consentVersion: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly eligibilityNote: string | null;

  @ApiProperty()
  declare readonly retentionDays: number;

  @ApiProperty({ enum: TryoutEventStatus })
  declare readonly status: TryoutEventStatus;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly openedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly closedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly cancelledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A bounded page of tryout events. */
export class ListTryoutEventsResponseDto {
  @ApiProperty({ type: [TryoutEventResponseDto] })
  declare readonly items: readonly TryoutEventResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** Request body registering a candidate. Minimal by design. */
export class RegisterCandidateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly eventId: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly displayName: string;

  @ApiPropertyOptional({ enum: ContactChannel })
  @IsOptional()
  @IsEnum(ContactChannel)
  readonly contactChannel?: ContactChannel;

  @ApiPropertyOptional({ maxLength: CONTACT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_MAX_LENGTH)
  readonly contactReference?: string | null;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  readonly priorSport?: string | null;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  readonly referralSource?: string | null;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly motivation?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly communicationOptIn?: boolean;

  @ApiProperty({
    minLength: CONSENT_VERSION_MIN_LENGTH,
    maxLength: CONSENT_VERSION_MAX_LENGTH,
  })
  @IsString()
  @MinLength(CONSENT_VERSION_MIN_LENGTH)
  @MaxLength(CONSENT_VERSION_MAX_LENGTH)
  declare readonly consentVersion: string;

  @ApiPropertyOptional({ enum: CandidateReadiness })
  @IsOptional()
  @IsEnum(CandidateReadiness)
  readonly readiness?: CandidateReadiness;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly restrictedNotes?: string | null;
}

/** Request body for an optimistic-version-guarded candidate move. */
export class CandidateVersionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

/** Request body withdrawing a candidate. */
export class WithdrawCandidateDto extends CandidateVersionDto {
  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;
}

/**
 * A candidate as returned by the API. Contact, readiness notes, and the free
 * answers are already redacted by the application when the caller lacks the
 * matching permission tier.
 */
export class TryoutCandidateResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly eventId: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ enum: ContactChannel })
  declare readonly contactChannel: ContactChannel;

  @ApiProperty({ type: String, nullable: true })
  declare readonly contactReference: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly priorSport: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly referralSource: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly motivation: string | null;

  @ApiProperty()
  declare readonly communicationOptIn: boolean;

  @ApiProperty()
  declare readonly consentVersion: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly consentedAt: Date;

  @ApiProperty({ enum: CandidateReadiness })
  declare readonly readiness: CandidateReadiness;

  @ApiProperty({ type: String, nullable: true })
  declare readonly restrictedNotes: string | null;

  @ApiProperty({ enum: CandidateStatus })
  declare readonly status: CandidateStatus;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly waitlistPosition: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly checkedInAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly withdrawnAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly convertedMembershipId: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly convertedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly retentionExpiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly anonymizedAt: Date | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A bounded page of candidates. */
export class ListTryoutCandidatesResponseDto {
  @ApiProperty({ type: [TryoutCandidateResponseDto] })
  declare readonly items: readonly TryoutCandidateResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** Request body recording one evaluator's original observation. */
export class SubmitEvaluationDto {
  @ApiProperty({ maxLength: CRITERIA_VERSION_MAX_LENGTH })
  @IsString()
  @MaxLength(CRITERIA_VERSION_MAX_LENGTH)
  declare readonly criteriaVersion: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly attended?: boolean;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Criterion key to 1-5 rating. Out-of-range values are dropped.',
  })
  @IsOptional()
  @IsObject()
  readonly ratings?: Readonly<Record<string, number>>;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly observations?: string | null;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly privateNotes?: string | null;

  @ApiPropertyOptional({ enum: EvaluationRecommendation })
  @IsOptional()
  @IsEnum(EvaluationRecommendation)
  readonly recommendation?: EvaluationRecommendation;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly submit?: boolean;
}

/** One evaluator's original observation. */
export class TryoutEvaluationResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly evaluationId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly evaluatorUserId: string;

  @ApiProperty()
  declare readonly criteriaVersion: string;

  @ApiProperty()
  declare readonly attended: boolean;

  @ApiProperty({ type: Object })
  declare readonly ratings: Readonly<Record<string, number>>;

  @ApiProperty({ type: String, nullable: true })
  declare readonly observations: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly privateNotes: string | null;

  @ApiProperty({ enum: EvaluationRecommendation })
  declare readonly recommendation: EvaluationRecommendation;

  @ApiProperty({ enum: EvaluationStatus })
  declare readonly status: EvaluationStatus;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly submittedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/**
 * The read-only aggregate of several evaluators. It carries no recommendation:
 * a summary never becomes the decision.
 */
export class EvaluationAggregateResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty()
  declare readonly evaluatorCount: number;

  @ApiProperty()
  declare readonly submittedCount: number;

  @ApiProperty()
  declare readonly attendedCount: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly averageRating: number | null;

  @ApiProperty({ type: Object })
  declare readonly recommendationCounts: Readonly<Record<string, number>>;

  @ApiProperty({ type: [String] })
  declare readonly criteriaVersions: readonly string[];
}

/** Request body recording the committee's human decision. */
export class RecordTryoutDecisionDto extends CandidateVersionDto {
  @ApiProperty({ enum: TryoutDecisionValue })
  @IsEnum(TryoutDecisionValue)
  declare readonly decision: TryoutDecisionValue;

  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reasons: string;

  @ApiProperty({ maxLength: CRITERIA_VERSION_MAX_LENGTH })
  @IsString()
  @MaxLength(CRITERIA_VERSION_MAX_LENGTH)
  declare readonly criteriaVersion: string;
}

/** The committee's recorded decision. */
export class TryoutDecisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly decisionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty({ enum: TryoutDecisionValue })
  declare readonly decision: TryoutDecisionValue;

  @ApiProperty()
  declare readonly reasons: string;

  @ApiProperty()
  declare readonly criteriaVersion: string;

  @ApiProperty()
  declare readonly evaluatorCount: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly decidedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly decidedAt: Date;
}

/** Request body creating or moving a candidate-facing offer. */
export class ManageTryoutOfferDto extends CandidateVersionDto {
  @ApiProperty({ enum: OfferTransition })
  @IsEnum(OfferTransition)
  declare readonly transition: OfferTransition;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly candidateMessage?: string | null;
}

/** A candidate-facing offer. */
export class TryoutOfferResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly offerId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty({ enum: OfferStatus })
  declare readonly status: OfferStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly candidateMessage: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly sentAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly respondedAt: Date | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** Request body converting an accepted candidate into a membership. */
export class ConvertCandidateDto extends CandidateVersionDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly userId?: string | null;
}

/** The idempotent result of a conversion. `created` is false on a replay. */
export class CandidateConversionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly candidateId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly created: boolean;
}

/** One evaluator's completion progress. Identity by user id only. */
export class EvaluatorCompletionDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly evaluatorUserId: string;

  @ApiProperty()
  declare readonly assigned: number;

  @ApiProperty()
  declare readonly submitted: number;
}

/** The privacy-safe tryout funnel: counts only, never identities. */
export class TryoutFunnelResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly eventId: string;

  @ApiProperty()
  declare readonly registered: number;

  @ApiProperty()
  declare readonly waitlisted: number;

  @ApiProperty()
  declare readonly checkedIn: number;

  @ApiProperty()
  declare readonly noShow: number;

  @ApiProperty()
  declare readonly withdrawn: number;

  @ApiProperty()
  declare readonly accepted: number;

  @ApiProperty()
  declare readonly rejected: number;

  @ApiProperty()
  declare readonly converted: number;

  @ApiProperty({ type: [EvaluatorCompletionDto] })
  declare readonly evaluators: readonly EvaluatorCompletionDto[];
}

/** The reconciliation of one retention/anonymization sweep. */
export class TryoutRetentionResponseDto {
  @ApiProperty()
  declare readonly examined: number;

  @ApiProperty()
  declare readonly anonymized: number;

  @ApiProperty({ type: [String] })
  declare readonly candidateIds: readonly string[];
}
