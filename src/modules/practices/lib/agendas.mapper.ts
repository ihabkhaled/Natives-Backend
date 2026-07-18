import type {
  Agenda,
  AgendaBlock,
  AgendaGroup,
  AgendaGroupMember,
  AgendaStation,
  AgendaSummaryView,
  AgendaTreeParts,
  AgendaView,
  BlockView,
  Drill,
  DrillView,
  GroupView,
  ListDrillsResult,
  ListDrillsView,
  StationView,
} from '../model/agendas.types';

/**
 * Pure mappers from agenda/drill domain rows to API response projections. The
 * agenda tree is assembled here (stations nested under their block, members under
 * their group). Private `coachNotes` are shaped out unless `includePrivate` is set
 * — the broad read always omits them (null), so coach notes never leak into the
 * team-wide agenda or a broad export.
 */

/** Map a stored drill to its catalog view. */
export function toDrillView(drill: Drill): DrillView {
  return {
    id: drill.id,
    seasonId: drill.seasonId,
    name: drill.name,
    category: drill.category,
    objective: drill.objective,
    instructions: drill.instructions,
    equipment: drill.equipment,
    intensity: drill.intensity,
    defaultDurationMinutes: drill.defaultDurationMinutes,
    skillTags: drill.skillTags,
    safetyNotes: drill.safetyNotes,
    mediaUrl: drill.mediaUrl,
    status: drill.status,
    version: drill.version,
  };
}

/** Map a paginated drill result to its list envelope. */
export function toListDrillsView(result: ListDrillsResult): ListDrillsView {
  return {
    items: result.items.map(drill => toDrillView(drill)),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

/** Map an agenda aggregate to its lightweight summary (no tree). */
export function toAgendaSummaryView(agenda: Agenda): AgendaSummaryView {
  return {
    sessionId: agenda.sessionId,
    agendaId: agenda.id,
    status: agenda.status,
    theme: agenda.theme,
    notes: agenda.notes,
    publishedAt: agenda.publishedAt,
    completedAt: agenda.completedAt,
    version: agenda.version,
  };
}

/** Map one station row to its view. */
export function toStationView(station: AgendaStation): StationView {
  return {
    id: station.id,
    blockId: station.blockId,
    drillId: station.drillId,
    groupId: station.groupId,
    coachMembershipId: station.coachMembershipId,
    position: station.position,
    name: station.name,
    repetitions: station.repetitions,
    target: station.target,
    notes: station.notes,
    completionStatus: station.completionStatus,
  };
}

/** Map one block row + its stations to a view, shaping private coach notes. */
export function toBlockView(
  block: AgendaBlock,
  stations: readonly AgendaStation[],
  includePrivate: boolean,
): BlockView {
  return {
    id: block.id,
    drillId: block.drillId,
    position: block.position,
    title: block.title,
    blockType: block.blockType,
    offsetMinutes: block.offsetMinutes,
    durationMinutes: block.durationMinutes,
    intensity: block.intensity,
    repetitions: block.repetitions,
    target: block.target,
    completionStatus: block.completionStatus,
    completedAt: block.completedAt,
    notes: block.notes,
    coachNotes: includePrivate ? block.coachNotes : null,
    stations: stations
      .filter(station => station.blockId === block.id)
      .map(station => toStationView(station)),
  };
}

/** Map one group row + its members to a view. */
export function toGroupView(
  group: AgendaGroup,
  members: readonly AgendaGroupMember[],
): GroupView {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    coachMembershipId: group.coachMembershipId,
    position: group.position,
    notes: group.notes,
    members: members
      .filter(member => member.groupId === group.id)
      .map(member => ({ membershipId: member.membershipId })),
  };
}

/** The explicit "no agenda yet" view for a session with no agenda row. */
export function emptyAgendaView(sessionId: string): AgendaView {
  return {
    sessionId,
    agendaId: null,
    status: null,
    theme: null,
    notes: null,
    publishedAt: null,
    completedAt: null,
    version: null,
    blocks: [],
    groups: [],
  };
}

/** Assemble the full agenda tree view; shape private coach notes by permission. */
export function toAgendaView(
  sessionId: string,
  agenda: Agenda | null,
  parts: AgendaTreeParts,
  includePrivate: boolean,
): AgendaView {
  if (agenda === null) {
    return emptyAgendaView(sessionId);
  }
  return {
    sessionId,
    agendaId: agenda.id,
    status: agenda.status,
    theme: agenda.theme,
    notes: agenda.notes,
    publishedAt: agenda.publishedAt,
    completedAt: agenda.completedAt,
    version: agenda.version,
    blocks: parts.blocks.map(block =>
      toBlockView(block, parts.stations, includePrivate),
    ),
    groups: parts.groups.map(group => toGroupView(group, parts.members)),
  };
}
