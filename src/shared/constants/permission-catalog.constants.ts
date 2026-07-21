import { Permission, PermissionArea } from '@shared/enums';

/**
 * A single entry in the canonical permission catalog: the permission key, the
 * area it belongs to, and a short human description. This catalog is the single
 * source of truth seeded verbatim into the `permissions` table by the RBAC
 * migration. Adding a permission means adding ONE entry here (and a member to
 * the `Permission` enum) plus, if it belongs in a default bundle, one line in
 * `role-bundles.constants` — never a scattered conditional.
 */
export interface PermissionCatalogEntry {
  readonly key: Permission;
  readonly area: PermissionArea;
  readonly description: string;
}

export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  // platform — never bundled into a team-scoped role, so a team-scoped grant can
  // never satisfy them; only a global (teamId IS NULL) assignment does.
  {
    key: Permission.PlatformAdmin,
    area: PermissionArea.Platform,
    description: 'Administer the platform across every team',
  },
  {
    key: Permission.TeamCreate,
    area: PermissionArea.Platform,
    description: 'Create a new team',
  },
  {
    key: Permission.TeamBrowseAll,
    area: PermissionArea.Platform,
    description: 'Browse every team on the platform',
  },
  // team
  {
    key: Permission.TeamRead,
    area: PermissionArea.Team,
    description: 'View a team',
  },
  {
    key: Permission.TeamSettingsRead,
    area: PermissionArea.Team,
    description: 'View team settings',
  },
  {
    key: Permission.TeamSettingsManage,
    area: PermissionArea.Team,
    description: 'Change team settings',
  },
  {
    key: Permission.SeasonManage,
    area: PermissionArea.Team,
    description: 'Manage seasons',
  },
  {
    key: Permission.VenueManage,
    area: PermissionArea.Team,
    description: 'Manage venues',
  },
  // members
  {
    key: Permission.MemberList,
    area: PermissionArea.Members,
    description: 'List team members',
  },
  {
    key: Permission.MemberProfileReadPublic,
    area: PermissionArea.Members,
    description: 'Read public member profile fields',
  },
  {
    key: Permission.MemberProfileReadCoach,
    area: PermissionArea.Members,
    description: 'Read coach-restricted member profile fields',
  },
  {
    key: Permission.MemberProfileReadAdmin,
    area: PermissionArea.Members,
    description: 'Read admin-restricted member profile fields',
  },
  {
    key: Permission.MemberProfileUpdateSelf,
    area: PermissionArea.Members,
    description: 'Update own member profile',
  },
  {
    key: Permission.MemberInvite,
    area: PermissionArea.Members,
    description: 'Invite new members',
  },
  {
    key: Permission.MemberLifecycleManage,
    area: PermissionArea.Members,
    description: 'Manage member lifecycle (activate/suspend/leave)',
  },
  {
    key: Permission.MemberRolesManage,
    area: PermissionArea.Members,
    description: 'Assign and revoke member roles',
  },
  {
    key: Permission.MemberAliasesManage,
    area: PermissionArea.Members,
    description: 'Manage member aliases',
  },
  // practices
  {
    key: Permission.PracticeRead,
    area: PermissionArea.Practices,
    description: 'View practices',
  },
  {
    key: Permission.PracticeManage,
    area: PermissionArea.Practices,
    description: 'Create and manage practices',
  },
  {
    key: Permission.PracticeRsvpSelf,
    area: PermissionArea.Practices,
    description: 'RSVP to own practices',
  },
  {
    key: Permission.PracticeRsvpOverride,
    area: PermissionArea.Practices,
    description: 'Override another member RSVP',
  },
  {
    key: Permission.AttendanceReadSelf,
    area: PermissionArea.Practices,
    description: 'View own attendance',
  },
  {
    key: Permission.AttendanceReadTeam,
    area: PermissionArea.Practices,
    description: 'View team attendance',
  },
  {
    key: Permission.AttendanceRecord,
    area: PermissionArea.Practices,
    description: 'Record attendance',
  },
  {
    key: Permission.AttendanceFinalize,
    area: PermissionArea.Practices,
    description: 'Finalize attendance',
  },
  {
    key: Permission.AttendanceCorrect,
    area: PermissionArea.Practices,
    description: 'Correct finalized attendance',
  },
  {
    key: Permission.DrillManage,
    area: PermissionArea.Practices,
    description: 'Manage drills',
  },
  // performance
  {
    key: Permission.AssessmentReadSelfPublished,
    area: PermissionArea.Performance,
    description: 'Read own published assessments',
  },
  {
    key: Permission.AssessmentReadTeam,
    area: PermissionArea.Performance,
    description: 'Read team assessments',
  },
  {
    key: Permission.AssessmentCreate,
    area: PermissionArea.Performance,
    description: 'Create assessments',
  },
  {
    key: Permission.AssessmentReview,
    area: PermissionArea.Performance,
    description: 'Review assessments',
  },
  {
    key: Permission.AssessmentPublish,
    area: PermissionArea.Performance,
    description: 'Publish assessments',
  },
  {
    key: Permission.AssessmentCorrect,
    area: PermissionArea.Performance,
    description: 'Correct published assessments',
  },
  {
    key: Permission.FeedbackReadSelf,
    area: PermissionArea.Performance,
    description: 'Read own feedback',
  },
  {
    key: Permission.FeedbackManage,
    area: PermissionArea.Performance,
    description: 'Manage feedback',
  },
  {
    key: Permission.MeasurementRecord,
    area: PermissionArea.Performance,
    description: 'Record measurements',
  },
  {
    key: Permission.AnalyticsReadSelf,
    area: PermissionArea.Performance,
    description: 'View own analytics',
  },
  {
    key: Permission.AnalyticsReadTeam,
    area: PermissionArea.Performance,
    description: 'View team analytics',
  },
  // training
  {
    key: Permission.ActivitySubmitSelf,
    area: PermissionArea.Training,
    description: 'Submit own external activity',
  },
  {
    key: Permission.ActivityReadSelf,
    area: PermissionArea.Training,
    description: 'Read own external activity',
  },
  {
    key: Permission.ActivityReview,
    area: PermissionArea.Training,
    description: 'Review external activity',
  },
  {
    key: Permission.ActivityCorrect,
    area: PermissionArea.Training,
    description: 'Correct external activity',
  },
  {
    key: Permission.EvidenceReadReview,
    area: PermissionArea.Training,
    description: 'Read evidence during review',
  },
  {
    key: Permission.PointsReadSelf,
    area: PermissionArea.Training,
    description: 'View own points',
  },
  {
    key: Permission.PointsReadTeam,
    area: PermissionArea.Training,
    description: 'View team points',
  },
  {
    key: Permission.PointsAdjust,
    area: PermissionArea.Training,
    description: 'Adjust points ledger',
  },
  {
    key: Permission.LeaderboardRead,
    area: PermissionArea.Training,
    description: 'View leaderboards',
  },
  {
    key: Permission.PointsRulesManage,
    area: PermissionArea.Training,
    description: 'Manage points rules',
  },
  // competition
  {
    key: Permission.CompetitionRead,
    area: PermissionArea.Competition,
    description: 'View competitions',
  },
  {
    key: Permission.CompetitionManage,
    area: PermissionArea.Competition,
    description: 'Manage competitions',
  },
  {
    key: Permission.SquadRead,
    area: PermissionArea.Competition,
    description: 'View squads',
  },
  {
    key: Permission.SquadManage,
    area: PermissionArea.Competition,
    description: 'Manage squads',
  },
  {
    key: Permission.SquadOverrideEligibility,
    area: PermissionArea.Competition,
    description: 'Override squad eligibility',
  },
  {
    key: Permission.RosterRead,
    area: PermissionArea.Competition,
    description: 'View rosters',
  },
  {
    key: Permission.RosterManage,
    area: PermissionArea.Competition,
    description: 'Manage rosters',
  },
  {
    key: Permission.RosterLock,
    area: PermissionArea.Competition,
    description: 'Lock rosters',
  },
  // match
  {
    key: Permission.MatchRead,
    area: PermissionArea.Match,
    description: 'View matches',
  },
  {
    key: Permission.MatchManage,
    area: PermissionArea.Match,
    description: 'Manage matches',
  },
  {
    key: Permission.MatchScore,
    area: PermissionArea.Match,
    description: 'Score a match',
  },
  {
    key: Permission.MatchFinalize,
    area: PermissionArea.Match,
    description: 'Finalize a match',
  },
  {
    key: Permission.MatchCorrect,
    area: PermissionArea.Match,
    description: 'Correct a finalized match',
  },
  {
    key: Permission.MatchStatsRead,
    area: PermissionArea.Match,
    description: 'View match statistics',
  },
  {
    key: Permission.MatchAnalysisReadSelf,
    area: PermissionArea.Match,
    description: 'Read own match analysis',
  },
  {
    key: Permission.MatchAnalysisReadTeam,
    area: PermissionArea.Match,
    description: 'Read team match analysis',
  },
  {
    key: Permission.MatchAnalysisManage,
    area: PermissionArea.Match,
    description: 'Manage match analysis',
  },
  // tryouts
  {
    key: Permission.TryoutPublicRegister,
    area: PermissionArea.Tryouts,
    description: 'Register for a tryout publicly',
  },
  {
    key: Permission.TryoutCandidateReadSelf,
    area: PermissionArea.Tryouts,
    description: 'Read own tryout candidate record',
  },
  {
    key: Permission.TryoutManage,
    area: PermissionArea.Tryouts,
    description: 'Manage tryouts',
  },
  {
    key: Permission.TryoutContactsRead,
    area: PermissionArea.Tryouts,
    description: 'Read tryout contact details',
  },
  {
    key: Permission.TryoutReadinessRead,
    area: PermissionArea.Tryouts,
    description: 'Read tryout readiness data',
  },
  {
    key: Permission.TryoutEvaluate,
    area: PermissionArea.Tryouts,
    description: 'Evaluate tryout candidates',
  },
  {
    key: Permission.TryoutDecide,
    area: PermissionArea.Tryouts,
    description: 'Decide tryout outcomes',
  },
  {
    key: Permission.TryoutConvert,
    area: PermissionArea.Tryouts,
    description: 'Convert a candidate to a member',
  },
  // governance
  {
    key: Permission.GovernanceRead,
    area: PermissionArea.Governance,
    description: 'View governance records',
  },
  {
    key: Permission.GovernanceManage,
    area: PermissionArea.Governance,
    description: 'Manage governance records',
  },
  {
    key: Permission.RulesRead,
    area: PermissionArea.Governance,
    description: 'View rules',
  },
  {
    key: Permission.RulesManage,
    area: PermissionArea.Governance,
    description: 'Manage rules',
  },
  {
    key: Permission.DisciplineRead,
    area: PermissionArea.Governance,
    description: 'View discipline records',
  },
  {
    key: Permission.DisciplineManage,
    area: PermissionArea.Governance,
    description: 'Manage discipline records',
  },
  {
    key: Permission.JerseyRead,
    area: PermissionArea.Governance,
    description: 'View jersey reservations',
  },
  {
    key: Permission.JerseyManage,
    area: PermissionArea.Governance,
    description: 'Manage jersey reservations',
  },
  // operations
  {
    key: Permission.NotificationReadSelf,
    area: PermissionArea.Operations,
    description: 'Read own notifications',
  },
  {
    key: Permission.NotificationPreferencesSelf,
    area: PermissionArea.Operations,
    description: 'Manage own notification preferences',
  },
  {
    key: Permission.ReportGenerate,
    area: PermissionArea.Operations,
    description: 'Generate reports',
  },
  {
    key: Permission.ReportRead,
    area: PermissionArea.Operations,
    description: 'Read reports',
  },
  {
    key: Permission.ImportManage,
    area: PermissionArea.Operations,
    description: 'Manage data imports',
  },
  {
    key: Permission.ImportSignoff,
    area: PermissionArea.Operations,
    description: 'Sign off on data imports',
  },
  {
    key: Permission.AuditRead,
    area: PermissionArea.Operations,
    description: 'Read the audit log',
  },
  {
    key: Permission.JobsManage,
    area: PermissionArea.Operations,
    description: 'Manage background jobs',
  },
  {
    key: Permission.DataQualityManage,
    area: PermissionArea.Operations,
    description: 'Manage data quality',
  },
  {
    key: Permission.SecurityAdmin,
    area: PermissionArea.Operations,
    description: 'System-wide security administration',
  },
];

/** All canonical catalog permission keys, in catalog order. */
export const PERMISSION_CATALOG_KEYS: readonly Permission[] =
  PERMISSION_CATALOG.map(entry => entry.key);
