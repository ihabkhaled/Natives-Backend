import { UNKNOWN_DATABASE_CLI_ERROR } from './database.constants';

export function writeDatabaseCliMessage(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function describeDatabaseCliError(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_DATABASE_CLI_ERROR;
}
