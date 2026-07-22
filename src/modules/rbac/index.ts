export { EnsureRoleAssignmentService } from './application/ensure-role-assignment.service';
export { ReplaceTeamRolesUseCase } from './application/replace-team-roles.use-case';
export { RoleAssignmentQueryService } from './application/role-assignment-query.service';
export { TeamRoleQueryService } from './application/team-role-query.service';
export {
  assignmentAppliesToScope,
  assignmentIsLive,
} from './domain/assignment-window.policy';
export { EscalationDeniedError } from './errors/escalation-denied.error';
export { ProtectedRoleError } from './errors/protected-role.error';
export { RoleNotFoundError } from './errors/role-not-found.error';
export { toRoleKey, toRoleSlug } from './lib/role-slug.mapper';
export {
  ROLE_SLUG_MAX_LENGTH,
  ROLE_SLUG_PATTERN,
} from './model/rbac.constants';
export type {
  EnsureTeamRoleCommand,
  RbacRoleRecord,
  ReplaceTeamRolesCommand,
  RoleAssignment,
  TeamRolesView,
} from './model/rbac.types';
export { RbacModule } from './rbac.module';
