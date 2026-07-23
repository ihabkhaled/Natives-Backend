import type {
  ReportFormat,
  ReportPrivacyClass,
  ReportStatus,
  ReportTemplate,
} from './reports.enums';

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

// --- Jobs --------------------------------------------------------------------

export interface ReportJob {
  readonly jobId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly template: ReportTemplate;
  readonly format: ReportFormat;
  readonly privacyClass: ReportPrivacyClass;
  readonly parameters: Readonly<Record<string, string>>;
  readonly requestHash: string;
  readonly status: ReportStatus;
  readonly progress: number;
  readonly retryCount: number;
  readonly calculationVersion: string;
  readonly snapshotAt: Date;
  readonly storageReference: string | null;
  readonly checksum: string | null;
  readonly rowCount: number | null;
  readonly failureReason: string | null;
  readonly expiresAt: Date;
  readonly recordVersion: number;
  readonly requestedBy: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewReportJob {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly template: ReportTemplate;
  readonly format: ReportFormat;
  readonly privacyClass: ReportPrivacyClass;
  readonly parameters: Readonly<Record<string, string>>;
  readonly requestHash: string;
  readonly calculationVersion: string;
  readonly snapshotAt: Date;
  readonly expiresAt: Date;
  readonly requestedBy: string;
  readonly now: Date;
}

export interface ReportRequest {
  readonly seasonId: string | null;
  readonly template: ReportTemplate;
  readonly format: ReportFormat;
  readonly parameters: Readonly<Record<string, string>>;
}

export interface ReportRequestInput {
  readonly seasonId?: string | null;
  readonly template: ReportTemplate;
  readonly format?: ReportFormat | null;
  readonly parameters?: Readonly<Record<string, string>> | null;
}

export interface GenerateReportCommand {
  readonly request: ReportRequest;
}

/** A version-guarded completion of a job with its artifact metadata. */
export interface ReportCompletion {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly storageReference: string;
  readonly checksum: string;
  readonly rowCount: number;
  readonly now: Date;
}

export type ReportJobPage = PagedResult<ReportJob>;

export interface ReportListFilter {
  readonly template: ReportTemplate | null;
  readonly status: ReportStatus | null;
  readonly seasonId: string | null;
  readonly requestedBy: string | null;
}

export interface ReportListFilterInput {
  readonly template?: ReportTemplate | null;
  readonly status?: ReportStatus | null;
  readonly seasonId?: string | null;
  readonly requestedBy?: string | null;
}

// --- Document generation (adapter contracts) ---------------------------------

/** One row of tabular report data, keyed by column. Values are strings. */
export type ReportRow = Readonly<Record<string, string>>;

/** The rendered artifact: format, bytes-as-base64, and its row count. */
export interface RenderedReport {
  readonly format: ReportFormat;
  readonly content: string;
  readonly rowCount: number;
}

/** What the document adapter is asked to render. */
export interface RenderRequest {
  readonly template: ReportTemplate;
  readonly format: ReportFormat;
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly ReportRow[];
}

export interface ReportDocumentPort {
  render(request: RenderRequest): RenderedReport;
}

/** A signed download handle for a completed report. */
export interface DownloadTicket {
  readonly url: string;
  readonly expiresAt: Date;
  readonly checksum: string;
}

export interface DownloadRequest {
  readonly storageReference: string;
  readonly checksum: string;
  readonly now: Date;
}

export interface ReportDownloadPort {
  createDownloadTicket(request: DownloadRequest): DownloadTicket;
}

/** The resolved team/season scope of a report operation. */
export interface ReportScope {
  readonly teamId: string;
  readonly seasonId: string | null;
}
