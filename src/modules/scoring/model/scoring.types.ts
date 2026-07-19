import type {
  CalculationRuleStatus,
  CalculationRuleTransition,
  ScoreCategory,
  ScoreConfidence,
  ScoreProjectionStatus,
} from './scoring.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Rule definition ---------------------------------------------------------

/**
 * One weighted category component of a calculation rule. `weight` is a positive
 * relative weight; the engine normalizes over the components that actually have
 * data, so weights need not sum to any fixed total. `minSample` is the minimum
 * assessed metric count for the component to count as present.
 */
export interface RuleComponent {
  readonly categoryKey: ScoreCategory;
  readonly weight: number;
  readonly minSample: number;
}

/**
 * The pure, engine-facing definition of a calculation rule: the numeric scale,
 * the weighted category components, and the minimum number of present components
 * required before an overall score is emitted (below it the overall stays null).
 */
export interface ScoreRuleDefinition {
  readonly ruleId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly name: string;
  readonly scaleMin: number;
  readonly scaleMax: number;
  readonly minComponents: number;
  readonly components: readonly RuleComponent[];
}

/** The full persisted calculation-rule aggregate. */
export interface CalculationRule extends ScoreRuleDefinition {
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly description: string | null;
  readonly status: CalculationRuleStatus;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a calculation rule (create/update command). */
export interface RuleContent {
  readonly ruleKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly seasonId: string | null;
  readonly scaleMin: number;
  readonly scaleMax: number;
  readonly minComponents: number;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly components: readonly RuleComponent[];
}

/** A fully-resolved new rule row ready for insertion. */
export interface NewCalculationRule {
  readonly id: string;
  readonly teamId: string;
  readonly version: number;
  readonly content: RuleContent;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded content update of a draft rule. */
export interface RuleContentUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly content: RuleContent;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a rule. */
export interface RuleStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: CalculationRuleStatus;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly now: Date;
}

// --- Pure engine -------------------------------------------------------------

/** A single component fed to the weighted aggregator: value or a missing null. */
export interface WeightedComponent {
  readonly key: string;
  readonly value: number | null;
  readonly weight: number;
}

/**
 * The outcome of a weighted aggregation. `value` is null (not zero) when no
 * component contributed. Numerator/denominator/counts are carried through so the
 * explanation can show exactly how the number was reached.
 */
export interface WeightedAggregation {
  readonly value: number | null;
  readonly numerator: number;
  readonly denominator: number;
  readonly includedKeys: readonly string[];
  readonly excludedKeys: readonly string[];
}

/**
 * A per-category score input for the overall calculation: the aggregated
 * category value (null when the category has no assessed metric), plus coverage
 * so completeness can be reported.
 */
export interface CategoryInput {
  readonly categoryKey: ScoreCategory;
  readonly value: number | null;
  readonly assessedMetrics: number;
  readonly totalMetrics: number;
}

/** The computed score for one weighted category component. */
export interface ComponentScore {
  readonly categoryKey: ScoreCategory;
  readonly weight: number;
  readonly value: number | null;
  readonly contribution: number | null;
  readonly included: boolean;
  readonly assessedMetrics: number;
  readonly totalMetrics: number;
}

/** The full deterministic result of running a rule against category inputs. */
export interface PerformanceScoreResult {
  readonly value: number | null;
  readonly numerator: number;
  readonly denominator: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly sufficient: boolean;
  readonly completeness: number;
  readonly confidence: ScoreConfidence;
  readonly components: readonly ComponentScore[];
}

// --- Attendance calculators --------------------------------------------------

/**
 * Eligible-session counts for the legacy attendance percentage. `excusedSessions`
 * (excused/injured) are removed from the denominator, never counted as absences.
 */
export interface AttendancePercentageInput {
  readonly attendedEligible: number;
  readonly eligibleSessions: number;
  readonly excusedSessions: number;
}

/**
 * The explained attendance percentage. `value` is the attended fraction (0–1), or
 * null when no session is eligible after excusals — never a divide-by-zero or a
 * misleading 0%. Numerator/denominator/excluded are carried for the explanation.
 */
export interface AttendancePercentageResult {
  readonly value: number | null;
  readonly numerator: number;
  readonly denominator: number;
  readonly excludedCount: number;
}

/** Per-session-type present counts plus late/absent tallies (legacy weighted). */
export interface WeightedAttendanceInput {
  readonly practicePresent: number;
  readonly fitnessPresent: number;
  readonly gamePresent: number;
  readonly throwingPresent: number;
  readonly lateCount: number;
  readonly absentCount: number;
}

/**
 * The versioned session-type weights and penalties for the legacy weighted
 * attendance score. Seeded candidate weights are Practice 3, Fitness 2, Game 3,
 * Throwing 4 with a unit late and absent penalty — a named CANDIDATE, never
 * hard-coded final policy.
 */
export interface WeightedAttendanceWeights {
  readonly practice: number;
  readonly fitness: number;
  readonly game: number;
  readonly throwing: number;
  readonly latePenalty: number;
  readonly absentPenalty: number;
}

/** One weighted session-type contribution line carried in the explanation. */
export interface WeightedAttendanceLine {
  readonly key: string;
  readonly present: number;
  readonly weight: number;
  readonly contribution: number;
}

/**
 * The explained legacy weighted attendance score: the positive per-type
 * contributions minus the late and absent penalties, with every line preserved so
 * the arithmetic can be reproduced and shown.
 */
export interface WeightedAttendanceResult {
  readonly value: number;
  readonly lines: readonly WeightedAttendanceLine[];
  readonly latePenalty: number;
  readonly absentPenalty: number;
}

/**
 * Per-membership attendance tallies read from module 202 (finalized sheets only)
 * that feed the attendance category of a projection. Excused/injured are held
 * separately so they can be excluded from the denominator, never inferred as zero.
 */
export interface AttendanceCounts {
  readonly membershipId: string;
  readonly attendedEligible: number;
  readonly absentCount: number;
  readonly excusedSessions: number;
}

// --- Explanation -------------------------------------------------------------

/** The rule version a result is projected from. */
export interface ScoreRuleReference {
  readonly ruleId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly name: string;
}

/** The explained overall figure: exact arithmetic plus rounded display value. */
export interface OverallExplanation {
  readonly unrounded: number | null;
  readonly display: number | null;
  readonly numerator: number;
  readonly denominator: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly sufficient: boolean;
}

/** The explained figure for one category component. */
export interface ComponentExplanation {
  readonly categoryKey: ScoreCategory;
  readonly weight: number;
  readonly unrounded: number | null;
  readonly display: number | null;
  readonly included: boolean;
  readonly assessedMetrics: number;
  readonly totalMetrics: number;
  readonly excludedReason: string | null;
}

/**
 * The complete, self-contained explanation stored with (and returned alongside)
 * every projected score: the rule version it came from, the arithmetic of the
 * overall figure, each component, and the completeness/confidence indicators.
 */
export interface ScoreExplanation {
  readonly rule: ScoreRuleReference;
  readonly overall: OverallExplanation;
  readonly components: readonly ComponentExplanation[];
  readonly completeness: number;
  readonly confidence: ScoreConfidence;
  readonly formulaVersion: number;
}

// --- Projection --------------------------------------------------------------

/**
 * The assessed metric values of a single category for one membership, read from
 * published assessments. `values` are the non-null (present) observations — a 0
 * is a measured value; `totalMetrics` includes the missing ones so the engine can
 * exclude them without inferring zero.
 */
export interface CategorySource {
  readonly categoryKey: ScoreCategory;
  readonly values: readonly number[];
  readonly totalMetrics: number;
}

/** Per-membership category inputs assembled from source facts for a rebuild. */
export interface MembershipScoreInputs {
  readonly membershipId: string;
  readonly inputs: readonly CategoryInput[];
}

/** The membership + scope a projection is computed for. */
export interface ProjectionTarget {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly periodId: string | null;
}

/** A fully-computed projection ready to be upserted. */
export interface ComputedProjection {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly periodId: string | null;
  readonly rule: ScoreRuleDefinition;
  readonly result: PerformanceScoreResult;
  readonly explanation: ScoreExplanation;
  readonly sourceHash: string;
  readonly now: Date;
}

/** The persisted performance-score projection. */
export interface ScoreProjection {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly periodId: string | null;
  readonly ruleId: string;
  readonly ruleKey: string;
  readonly ruleVersion: number;
  readonly status: ScoreProjectionStatus;
  readonly value: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly completeness: number;
  readonly confidence: ScoreConfidence;
  readonly explanation: ScoreExplanation | null;
  readonly sourceHash: string | null;
  readonly error: string | null;
  readonly computedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The outcome of a projection rebuild batch for a scope. */
export interface RebuildOutcome {
  readonly scanned: number;
  readonly rebuilt: number;
  readonly failed: number;
  readonly ruleId: string;
  readonly ruleVersion: number;
}

/** A dry-run comparison of a draft rule against the effective published rule. */
export interface SimulationComparison {
  readonly membershipId: string;
  readonly draft: ScoreExplanation;
  readonly published: ScoreExplanation | null;
  readonly delta: number | null;
}

// --- Transport inputs --------------------------------------------------------

/** Loosely-typed component input the DTO structurally satisfies. */
export interface RuleComponentInput {
  readonly categoryKey: ScoreCategory;
  readonly weight: number;
  readonly minSample?: number | null;
}

/** Loosely-typed rule-content input; the mapper fills scale/floor defaults. */
export interface RuleContentInput {
  readonly ruleKey: string;
  readonly name: string;
  readonly description?: string | null;
  readonly seasonId?: string | null;
  readonly scaleMin?: number | null;
  readonly scaleMax?: number | null;
  readonly minComponents?: number | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly components: readonly RuleComponentInput[];
}

// --- Commands ----------------------------------------------------------------

export interface CreateRuleCommand {
  readonly content: RuleContent;
}

export interface UpdateRuleCommand {
  readonly expectedRecordVersion: number;
  readonly content: RuleContent;
}

export interface TransitionRuleCommand {
  readonly transition: CalculationRuleTransition;
  readonly expectedRecordVersion: number;
}

export interface SimulateRuleCommand {
  readonly membershipId: string;
}

// --- Read envelopes ----------------------------------------------------------

export type CalculationRulePage = PagedResult<CalculationRule>;
export type ScoreProjectionPage = PagedResult<ScoreProjection>;

export interface ScoreProjectionList {
  readonly items: readonly ScoreProjection[];
}
