import { AttendanceMarkDto } from './attendance-mark.dto';

/**
 * Body for recording one participant's attendance (coach/admin). The membership is
 * taken from the path; the mark fields are inherited. `expectedVersion` guards a
 * concurrent edit of an existing record.
 */
export class MarkAttendanceDto extends AttendanceMarkDto {}
