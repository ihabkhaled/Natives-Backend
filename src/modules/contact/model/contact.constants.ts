import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Route & OpenAPI tag -----------------------------------------------------
export const CONTACT_ROUTE = 'contact';
export const CONTACT_API_TAG = 'contact';

// --- Field bounds ------------------------------------------------------------
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_SUBJECT_MIN_LENGTH = 3;
export const CONTACT_SUBJECT_MAX_LENGTH = 160;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 4000;

// --- Message composition -----------------------------------------------------
// A single, fixed subject prefix so operator inbox rules can filter contact
// submissions. The visitor's subject is length-capped by validation before it
// reaches here, so the composed line cannot be used to smuggle headers.
export const CONTACT_SUBJECT_PREFIX = '[Ultimate Natives contact] ';

// --- Availability ------------------------------------------------------------
export const CONTACT_UNAVAILABLE_MESSAGE =
  'The contact channel is not available right now';
export const CONTACT_UNAVAILABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.contact.unavailable';
