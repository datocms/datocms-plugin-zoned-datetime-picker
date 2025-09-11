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
export function getZoneLongName(
  locale: string | undefined,
  timeZone: string,
  at: Date
): string | null {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(at);
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

export type DatoZonedOutput = {
  zonedDateTime: string; // IXDTF e.g. 2025-09-08T15:30:00+02:00[Europe/Rome]
  dateTime: string; // ISO8601 with numeric offset
  zone: string; // IANA time zone
  offset: string; // e.g. +02:00
  date: string; // yyyy-LL-dd
  time_24hr: string; // HH:mm:ss
  time_12hr: string; // hh:mm:ss (no AM/PM)
  ampm: "am" | "pm";
  timestamp: string; // epoch seconds as string
};

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
  const withoutZone = zoneMatch
    ? trimmed.slice(0, zoneMatch.index).trim()
    : trimmed;
  // Extract local date-time portion (strip any offset)
  const localMatch = withoutZone.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/
  );
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
// Deprecated: legacy single-string storage has been removed.

/**
 * Parses any stored Dato value (old IXDTF string or new JSON object)
 * back into our internal { dateTime, timeZone } structure.
 */
export function parseDatoValue(input: unknown): ZonedValue {
  if (input && typeof input === "object") {
    const anyVal = input as Record<string, unknown>;
    // Prefer explicit fields over parsing IXDTF from JSON payload
    const zone = typeof anyVal.zone === "string" ? anyVal.zone : null;
    const dateTime =
      typeof anyVal.dateTime === "string" ? anyVal.dateTime : null;
    if (zone && dateTime) {
      // Extract local wall time part from ISO8601 with offset
      const m = dateTime.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
      return { dateTime: m ? ensureSeconds(m[1]) : null, timeZone: zone };
    }
    // Fallback to separate date/time fields
    const date = typeof anyVal.date === "string" ? anyVal.date : null;
    const time24 =
      typeof (anyVal as any).time_24hr === "string"
        ? (anyVal as any).time_24hr
        : null;
    const time =
      typeof (anyVal as any).time === "string" ? (anyVal as any).time : null; // legacy
    if (zone && date && (time24 || time)) {
      const t = time24 ?? time!;
      return { dateTime: ensureSeconds(`${date}T${t}`), timeZone: zone };
    }
    // As a last resort, try parsing the embedded IXDTF
    const fromZdt =
      typeof anyVal.zonedDateTime === "string"
        ? parseIxdtf(anyVal.zonedDateTime)
        : null;
    if (fromZdt) return fromZdt;
  }
  return { dateTime: null, timeZone: null };
}

/**
 * Builds the new JSON payload expected by Dato consumers from
 * a { dateTime, timeZone } structure. Returns null if invalid/incomplete.
 */
export function buildDatoOutput(value: ZonedValue): DatoZonedOutput | {} {
  const { dateTime, timeZone } = value;
  if (!dateTime || !timeZone) return {};
  const dt = DateTime.fromISO(dateTime, { zone: timeZone });
  if (!dt.isValid) return {};

  // ISO with numeric offset, without zone id
  const isoWithOffset = dt.toISO({
    suppressMilliseconds: true,
    includeOffset: true,
  });
  // IXDTF with zone id appended
  const ixdtf = `${isoWithOffset}[${timeZone}]`;
  const offset = dt.toFormat("ZZ");
  const date = dt.toFormat("yyyy-LL-dd");
  const time_24hr = dt.toFormat("HH:mm:ss");
  const time_12hr = dt.toFormat("hh:mm:ss");
  const ampm = dt.hour >= 12 ? "pm" : "am";
  const timestamp = String(dt.toUnixInteger());

  return {
    zonedDateTime: ixdtf,
    dateTime: isoWithOffset,
    zone: timeZone,
    offset,
    date,
    time_24hr,
    time_12hr,
    ampm,
    timestamp,
  };
}
