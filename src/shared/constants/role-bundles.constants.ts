import { PERMISSION_CATALOG_KEYS } from '@shared/constants/permission-catalog.constants';
import { Permission, RbacRole } from '@shared/enums';

/**
 * Default role bundles for Ultimate Natives, expressed as data (never scattered
 * conditionals). Bundles compose by extension: COACH extends MEMBER, TEAM_ADMIN
 * extends COACH. SCOREKEEPER and ANALYST are standalone bundles. This is the
 * single source of truth the RBAC migration seeds into `roles` + `role_permissions`.
 * Adding a permission to a role is a one-line data edit here.
 */
function uniquePermissions(
  permissions: readonly Permission[],
): readonly Permission[] {
  return [...new Set(permissions)];
}

const MEMBER_BUNDLE: readonly Permission[] = [
  Permission.TeamRead,
  Permission.MemberProfileReadPublic,
  Permission.MemberProfileUpdateSelf,
  Permission.PracticeRead,
  Permission.PracticeRsvpSelf,
  Permission.AttendanceReadSelf,
  Permission.AssessmentReadSelfPublished,
  Permission.FeedbackReadSelf,
  Permission.ActivitySubmitSelf,
  Permission.ActivityReadSelf,
  Permission.AnalyticsReadSelf,
  Permission.PointsReadSelf,
  Permission.LeaderboardRead,
  Permission.CompetitionRead,
  Permission.SquadRead,
  Permission.RosterRead,
  Permission.MatchRead,
  Permission.MatchStatsRead,
  Permission.MatchAnalysisReadSelf,
  Permission.NotificationReadSelf,
  Permission.NotificationPreferencesSelf,
];

const COACH_BUNDLE: readonly Permission[] = uniquePermissions([
  ...MEMBER_BUNDLE,
  Permission.MemberList,
  Permission.MemberProfileReadCoach,
  Permission.PracticeManage,
  Permission.PracticeRsvpOverride,
  Permission.AttendanceReadTeam,
  Permission.AttendanceRecord,
  Permission.AttendanceFinalize,
  Permission.DrillManage,
  Permission.AssessmentReadTeam,
  Permission.AssessmentCreate,
  Permission.AssessmentReview,
  Permission.AssessmentPublish,
  Permission.FeedbackManage,
  Permission.MeasurementRecord,
  Permission.AnalyticsReadTeam,
  Permission.ActivityReview,
  Permission.EvidenceReadReview,
  Permission.PointsReadTeam,
  Permission.CompetitionManage,
  Permission.SquadManage,
  Permission.RosterManage,
  Permission.MatchManage,
  Permission.MatchAnalysisReadTeam,
  Permission.MatchAnalysisManage,
  Permission.TryoutManage,
  Permission.TryoutEvaluate,
]);

// TEAM_ADMIN carries every SCOREKEEPER permission (notably match.score) so the
// privilege ceiling lets a team administrator assign the SCOREKEEPER bundle:
// the ceiling only offers roles fully contained in the actor's own permissions.
const TEAM_ADMIN_BUNDLE: readonly Permission[] = uniquePermissions([
  ...COACH_BUNDLE,
  Permission.MatchScore,
  Permission.TeamSettingsRead,
  Permission.TeamSettingsManage,
  Permission.SeasonManage,
  Permission.VenueManage,
  Permission.MemberInvite,
  Permission.MemberLifecycleManage,
  Permission.MemberRolesManage,
  Permission.MemberAliasesManage,
  Permission.AttendanceCorrect,
  Permission.AssessmentCorrect,
  Permission.ActivityCorrect,
  Permission.PointsAdjust,
  Permission.PointsRulesManage,
  Permission.SquadOverrideEligibility,
  Permission.RosterLock,
  Permission.MatchFinalize,
  Permission.MatchCorrect,
  Permission.TryoutContactsRead,
  Permission.TryoutReadinessRead,
  Permission.TryoutDecide,
  Permission.TryoutConvert,
  Permission.GovernanceManage,
  Permission.RulesManage,
  Permission.DisciplineRead,
  Permission.DisciplineManage,
  Permission.JerseyManage,
  Permission.ReportGenerate,
  Permission.ReportRead,
  Permission.ImportManage,
  Permission.ImportSignoff,
  Permission.AuditRead,
  Permission.JobsManage,
  Permission.DataQualityManage,
]);

const SCOREKEEPER_BUNDLE: readonly Permission[] = uniquePermissions([
  Permission.TeamRead,
  Permission.CompetitionRead,
  Permission.RosterRead,
  Permission.MatchRead,
  Permission.MatchScore,
  Permission.MatchStatsRead,
]);

const ANALYST_BUNDLE: readonly Permission[] = uniquePermissions([
  Permission.TeamRead,
  Permission.MemberList,
  Permission.PracticeRead,
  Permission.AttendanceReadTeam,
  Permission.AnalyticsReadTeam,
  Permission.PointsReadTeam,
  Permission.LeaderboardRead,
  Permission.CompetitionRead,
  Permission.RosterRead,
  Permission.MatchRead,
  Permission.MatchStatsRead,
  Permission.ReportGenerate,
  Permission.ReportRead,
]);

/**
 * The platform bundle. SUPER_ADMIN is the ONLY bundle that carries the platform
 * permissions (create a team, browse every team, administer the platform), and
 * it is meant to be assigned globally (teamId IS NULL). A team-scoped assignment
 * of any other bundle can therefore never satisfy a platform-scoped route, which
 * is what separates the web-app super admin from a team administrator.
 */
const SUPER_ADMIN_BUNDLE: readonly Permission[] = uniquePermissions([
  ...PERMISSION_CATALOG_KEYS,
]);

export const ROLE_BUNDLES: ReadonlyMap<RbacRole, readonly Permission[]> =
  new Map([
    [RbacRole.SuperAdmin, SUPER_ADMIN_BUNDLE],
    [RbacRole.Member, MEMBER_BUNDLE],
    [RbacRole.Coach, COACH_BUNDLE],
    [RbacRole.TeamAdmin, TEAM_ADMIN_BUNDLE],
    [RbacRole.Scorekeeper, SCOREKEEPER_BUNDLE],
    [RbacRole.Analyst, ANALYST_BUNDLE],
  ]);

/** Human-readable display names + descriptions for the default bundles. */
export const ROLE_BUNDLE_METADATA: ReadonlyMap<
  RbacRole,
  { readonly displayName: string; readonly description: string }
> = new Map([
  [
    RbacRole.SuperAdmin,
    {
      displayName: 'Super administrator',
      description: 'Platform-wide administrator across every team',
    },
  ],
  [
    RbacRole.Member,
    { displayName: 'Member', description: 'Baseline participating member' },
  ],
  [
    RbacRole.Coach,
    { displayName: 'Coach', description: 'Coaching staff for a team' },
  ],
  [
    RbacRole.TeamAdmin,
    {
      displayName: 'Team administrator',
      description: 'Full administration of a team',
    },
  ],
  [
    RbacRole.Scorekeeper,
    { displayName: 'Scorekeeper', description: 'Records live match scores' },
  ],
  [
    RbacRole.Analyst,
    {
      displayName: 'Analyst',
      description: 'Read-only analytics and reporting',
    },
  ],
]);
