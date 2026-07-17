export type ErrorMessageKey = `errors.${string}`;

export interface ErrorBody {
  readonly statusCode: number;
  readonly messageKey: ErrorMessageKey;
  readonly message: string;
}
