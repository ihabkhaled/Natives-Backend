import { RbacRole } from '@shared/enums';

export const ADMIN_ROLE_KEY = RbacRole.TeamAdmin;
export const ADMIN_ROLE_MISSING_MESSAGE =
  'Role "TEAM_ADMIN" is missing. Run "npm run migration:run" before seeding.';
export const ADMIN_USER_INSERT_FAILED_MESSAGE =
  'Administrator insert did not return an id';
export const DATABASE_CONNECTION_UNAVAILABLE_MESSAGE =
  'Database connection is not available. Is PostgreSQL running on the configured host/port?';
