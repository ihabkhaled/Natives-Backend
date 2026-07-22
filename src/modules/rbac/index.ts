export { EnsureRoleAssignmentService } from './application/ensure-role-assignment.service';
export { ReplaceTeamRolesUseCase } from './application/replace-team-roles.use-case';
export { RoleAssignmentQueryService } from './application/role-assignment-query.service';
export { TeamRoleQueryService } from './application/team-role-query.service';
export {
  assignmentAppliesToScope,
  assignmentIsLive,
} from './domain/assignment-window.policy';
export { toRoleKey, toRoleSlug } from './lib/role-slug.mapper';
export type {
  EnsureTeamRoleCommand,
  ReplaceTeamRolesCommand,
  RoleAssignment,
  TeamRolesView,
} from './model/rbac.types';
export { RbacModule } from './rbac.module';
