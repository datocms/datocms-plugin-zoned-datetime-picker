/**
 * Date/time helpers built on Luxon to minimize custom logic and surface area.
 */
import { DateTime } from "luxon";

/**
 * Returns a localized long time zone name (e.g., 'Pacific Time') for a zone.
 *
 * Example
 *   getZoneLongName('en-US', 'America/Los_Angeles', new Date()) // => 'Pacific Time'
 */
export function getZoneLongName(locale: string | undefined, timeZone: string, at: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longGeneric" }).formatToParts(at);
    const namePart = parts.find((p) => p.type === "timeZoneName");
    return namePart?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Formats the UTC offset for a zone at a given instant as 'UTC+H[:MM]'.
 *
 * Example
 *   utcOffsetStringForZone('Europe/Rome', new Date()) // => 'UTC+2'
 */
export function utcOffsetStringForZone(timeZone: string, at: Date): string {
  const dt = DateTime.fromJSDate(at, { zone: timeZone });
  const offsetMin = dt.offset; // minutes
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const mm = minutes ? `:${minutes.toString().padStart(2, "0")}` : "";
  return `UTC${sign}${hours}${mm}`;
}

/** Parse and format IXDTF (RFC 9557) values. */
export type ZonedValue = { dateTime?: string | null; timeZone?: string | null };

/** Ensure seconds are present (we always store HH:mm:ss for clarity). */
export function ensureSeconds(dt: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)) return dt + ":00";
  return dt;
}

/**
 * Parses an IXDTF string to a { dateTime, timeZone } structure.
 * Accepts values like '2025-09-08T15:30:00+02:00[Europe/Rome]'.
 *
 * Example
 *   parseIxdtf('2025-01-01T10:00:00+01:00[Europe/Rome]')
 *   // => { dateTime: '2025-01-01T10:00:00', timeZone: 'Europe/Rome' }
 */
export function parseIxdtf(input: string): ZonedValue {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { dateTime: null, timeZone: null };
  // Extract [Zone]
  const zoneMatch = trimmed.match(/\[([^\]]+)\]\s*$/);
  const timeZone = zoneMatch ? zoneMatch[1] : null;
  const withoutZone = zoneMatch ? trimmed.slice(0, zoneMatch.index).trim() : trimmed;
  // Extract local date-time portion (strip any offset)
  const localMatch = withoutZone.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
  const dateTime = localMatch ? ensureSeconds(localMatch[1]) : null;
  return { dateTime, timeZone };
}

/**
 * Formats a { dateTime, timeZone } structure to an IXDTF string for storage.
 *
 * Example
 *   formatToIxdtf({ dateTime: '2025-01-01T10:00:00', timeZone: 'Europe/Rome' })
 *   // => '2025-01-01T10:00:00+01:00[Europe/Rome]'
 */
export function formatToIxdtf(value: ZonedValue): string | null {
  const { dateTime, timeZone } = value;
  if (!dateTime || !timeZone) return null;
  const dt = DateTime.fromISO(dateTime, { zone: timeZone });
  if (!dt.isValid) return null;
  const base = dt.toISO({ suppressMilliseconds: true, includeOffset: true });
  return `${base}[${timeZone}]`;
}
