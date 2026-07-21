/**
 * Canonical permission catalog for Ultimate Natives. Every value is a stable,
 * dot-delimited `<area>.<resource>.<action>[.<qualifier>]` string. Permissions
 * are the atoms of authorization; roles are configurable bundles of these atoms
 * (see `@shared/constants/role-bundles.constants`). Never type a raw permission
 * literal at a call site — always reference a member of this enum.
 *
 * The `Article*` members are retained from the template's reference module and
 * are intentionally NOT part of the Natives permission catalog
 * (`PERMISSION_CATALOG`); they exist only so the template article routes keep
 * compiling and are granted via the account-role baseline, never a seeded bundle.
 */
export enum Permission {
  // --- platform (only ever satisfied by a global, teamId IS NULL grant) -------
  PlatformAdmin = 'platform.admin',
  TeamCreate = 'team.create',
  TeamBrowseAll = 'team.browse.all',
  // --- team ------------------------------------------------------------------
  TeamRead = 'team.read',
  TeamSettingsRead = 'team.settings.read',
  TeamSettingsManage = 'team.settings.manage',
  SeasonManage = 'season.manage',
  VenueManage = 'venue.manage',
  // --- members ---------------------------------------------------------------
  MemberList = 'member.list',
  MemberProfileReadPublic = 'member.profile.read.public',
  MemberProfileReadCoach = 'member.profile.read.coach',
  MemberProfileReadAdmin = 'member.profile.read.admin',
  MemberProfileUpdateSelf = 'member.profile.update.self',
  MemberInvite = 'member.invite',
  MemberLifecycleManage = 'member.lifecycle.manage',
  MemberRolesManage = 'member.roles.manage',
  MemberAliasesManage = 'member.aliases.manage',
  // --- practices -------------------------------------------------------------
  PracticeRead = 'practice.read',
  PracticeManage = 'practice.manage',
  PracticeRsvpSelf = 'practice.rsvp.self',
  PracticeRsvpOverride = 'practice.rsvp.override',
  AttendanceReadSelf = 'attendance.read.self',
  AttendanceReadTeam = 'attendance.read.team',
  AttendanceRecord = 'attendance.record',
  AttendanceFinalize = 'attendance.finalize',
  AttendanceCorrect = 'attendance.correct',
  DrillManage = 'drill.manage',
  // --- performance -----------------------------------------------------------
  AssessmentReadSelfPublished = 'assessment.read.self.published',
  AssessmentReadTeam = 'assessment.read.team',
  AssessmentCreate = 'assessment.create',
  AssessmentReview = 'assessment.review',
  AssessmentPublish = 'assessment.publish',
  AssessmentCorrect = 'assessment.correct',
  FeedbackReadSelf = 'feedback.read.self',
  FeedbackManage = 'feedback.manage',
  MeasurementRecord = 'measurement.record',
  AnalyticsReadSelf = 'analytics.read.self',
  AnalyticsReadTeam = 'analytics.read.team',
  // --- training --------------------------------------------------------------
  ActivitySubmitSelf = 'activity.submit.self',
  ActivityReadSelf = 'activity.read.self',
  ActivityReview = 'activity.review',
  ActivityCorrect = 'activity.correct',
  EvidenceReadReview = 'evidence.read.review',
  PointsReadSelf = 'points.read.self',
  PointsReadTeam = 'points.read.team',
  PointsAdjust = 'points.adjust',
  LeaderboardRead = 'leaderboard.read',
  PointsRulesManage = 'points.rules.manage',
  // --- competition -----------------------------------------------------------
  CompetitionRead = 'competition.read',
  CompetitionManage = 'competition.manage',
  SquadRead = 'squad.read',
  SquadManage = 'squad.manage',
  SquadOverrideEligibility = 'squad.override_eligibility',
  RosterRead = 'roster.read',
  RosterManage = 'roster.manage',
  RosterLock = 'roster.lock',
  // --- match -----------------------------------------------------------------
  MatchRead = 'match.read',
  MatchManage = 'match.manage',
  MatchScore = 'match.score',
  MatchFinalize = 'match.finalize',
  MatchCorrect = 'match.correct',
  MatchStatsRead = 'match.stats.read',
  MatchAnalysisReadSelf = 'match.analysis.read.self',
  MatchAnalysisReadTeam = 'match.analysis.read.team',
  MatchAnalysisManage = 'match.analysis.manage',
  // --- tryouts ---------------------------------------------------------------
  TryoutPublicRegister = 'tryout.public.register',
  TryoutCandidateReadSelf = 'tryout.candidate.read.self',
  TryoutManage = 'tryout.manage',
  TryoutContactsRead = 'tryout.contacts.read',
  TryoutReadinessRead = 'tryout.readiness.read',
  TryoutEvaluate = 'tryout.evaluate',
  TryoutDecide = 'tryout.decide',
  TryoutConvert = 'tryout.convert',
  // --- governance ------------------------------------------------------------
  GovernanceRead = 'governance.read',
  GovernanceManage = 'governance.manage',
  RulesRead = 'rules.read',
  RulesManage = 'rules.manage',
  DisciplineRead = 'discipline.read',
  DisciplineManage = 'discipline.manage',
  JerseyRead = 'jersey.read',
  JerseyManage = 'jersey.manage',
  // --- operations ------------------------------------------------------------
  NotificationReadSelf = 'notification.read.self',
  NotificationPreferencesSelf = 'notification.preferences.self',
  ReportGenerate = 'report.generate',
  ReportRead = 'report.read',
  ImportManage = 'import.manage',
  ImportSignoff = 'import.signoff',
  AuditRead = 'audit.read',
  JobsManage = 'jobs.manage',
  DataQualityManage = 'data_quality.manage',
  SecurityAdmin = 'security.admin',
  // --- template reference module (not part of the Natives catalog) -----------
  ArticleCreate = 'article:create',
  ArticleRead = 'article:read',
}

export const PERMISSION_VALUES: readonly Permission[] =
  Object.values(Permission);
