import { ReportTemplate } from './reports.enums';

/** Hard ceiling on how many rows one report dataset may produce. */
export const REPORT_DATA_MAX_ROWS = 5000;

/** The report title shown at the head of a rendered document, per template. */
export const TEMPLATE_TITLES: ReadonlyMap<ReportTemplate, string> = new Map([
  [ReportTemplate.PlayerPerformance, 'Player Performance'],
  [ReportTemplate.TeamOverview, 'Team Overview'],
  [ReportTemplate.Attendance, 'Attendance'],
  [ReportTemplate.TrainingLeaderboard, 'Training Leaderboard'],
  [ReportTemplate.Roster, 'Roster'],
  [ReportTemplate.MatchSheet, 'Match Sheet'],
  [ReportTemplate.MatchStats, 'Match Statistics'],
  [ReportTemplate.Analysis, 'Analysis'],
  [ReportTemplate.TryoutFunnel, 'Tryout Funnel'],
  [ReportTemplate.DataQuality, 'Data Quality'],
]);

/**
 * The full, abbreviation-expanded column schema of each template. Any dataset
 * field outside its template's schema is stripped by the safety policy, so a
 * report can never carry a column the template did not define.
 */
export const TEMPLATE_COLUMNS: ReadonlyMap<ReportTemplate, readonly string[]> =
  new Map([
    [ReportTemplate.Attendance, ['membershipId', 'attended', 'total']],
    [ReportTemplate.TrainingLeaderboard, ['membershipId', 'points']],
    [ReportTemplate.Roster, ['membershipId', 'status', 'jerseyNumber']],
  ]);
