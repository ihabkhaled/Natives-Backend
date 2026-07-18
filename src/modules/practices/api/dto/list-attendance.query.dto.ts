import { ListQueryDto } from './list-query.dto';

/**
 * Query for the attendance roster list. Pagination is inherited and clamped; the
 * roster returns every active member (unmarked ⇒ null status), so there is no
 * status filter to leak partial rosters.
 */
export class ListAttendanceQueryDto extends ListQueryDto {}
