/**
 * Small structural validation helpers shared by the persisted-shard validators.
 *
 * Saved data is untrusted input: every read is validated before the store uses
 * it (REQ-010). Helpers stay dependency-free so they are easy to reuse in
 * co-located tests.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

/** True for a canonical UTC ISO 8601 timestamp as produced by `Date#toISOString`. */
export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString() === value;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
