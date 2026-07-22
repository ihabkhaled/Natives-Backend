import { ALERTABLE_SEVERITIES } from '../model/dataquality.constants';
import type { AnomalySeverity } from '../model/dataquality.enums';
import type { DetectedAnomaly } from '../model/dataquality.types';

/**
 * Pure alerting rules (UN-705).
 *
 * Only an ACTIONABLE severity produces an alert: an `info` finding sits in the
 * queue for review but never pages anyone, so the signal-to-noise ratio stays
 * high. Alerts carry the rule and resource REFERENCE only — never a private
 * payload — so an alert channel can never leak member data.
 */
export function isAlertable(severity: AnomalySeverity): boolean {
  return ALERTABLE_SEVERITIES.includes(severity);
}

/** The count of alertable detections in a scan batch, given their severities. */
export function countAlertable(
  detected: readonly DetectedAnomaly[],
  severityOf: (rule: DetectedAnomaly['ruleKey']) => AnomalySeverity,
): number {
  return detected.filter(anomaly => isAlertable(severityOf(anomaly.ruleKey)))
    .length;
}

/** The fingerprint that de-duplicates a detection: rule + resource ref. */
export function fingerprintOf(detected: DetectedAnomaly): string {
  return `${detected.ruleKey}:${detected.resourceType}:${detected.resourceRef}`;
}
