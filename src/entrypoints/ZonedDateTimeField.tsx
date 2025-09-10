import { useEffect, useMemo, useState } from "react";
import type { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { Canvas, FieldGroup } from "datocms-react-ui";

// MUI Date Time Picker + material components
// Requires deps: @mui/material, @emotion/react, @emotion/styled, @mui/x-date-pickers, luxon
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterLuxon } from "@mui/x-date-pickers/AdapterLuxon";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { renderTimeViewClock } from "@mui/x-date-pickers/timeViewRenderers";
import { TextField, Autocomplete, Stack } from "@mui/material";

import { DateTime } from "luxon";

/**
 * ZonedDateTime (IXDTF) field editor
 *
 * This editor targets TEXT fields and reads/writes values in Internet Extended
 * Date/Time Format (IXDTF, RFC 9557), for example:
 *   2025-09-08T15:30:00+02:00[Europe/Rome]
 *
 * Design notes:
 * - We keep the chosen IANA time zone (e.g. Europe/Rome) and compute the
 *   numeric offset at the chosen local date-time (e.g. +02:00 or +01:00) so
 *   the saved string captures DST correctly.
 * - Internally we store two pieces of state: the local wall-clock date-time
 *   without offset ("dateTime") and the IANA zone ("timeZone"). The offset is
 *   derived on save using Luxon with the zone applied.
 * - We only support IXDTF strings. No legacy JSON format.
 */

export type ZonedValue = {
  dateTime?: string | null; // ISO local string without offset, e.g. 2025-09-08T15:30:00
  timeZone?: string | null; // IANA TZ, e.g. Europe/Rome
};

function getSupportedTimeZones(): readonly string[] {
  // Assume Intl.supportedValuesOf exists in the environment per project setup
  const intlWithSupport = Intl as typeof Intl & {
    supportedValuesOf: (key: "timeZone") => readonly string[];
  };
  return intlWithSupport.supportedValuesOf("timeZone");
}

export const ZonedDateTimeField = ({
  ctx,
}: {
  ctx: RenderFieldExtensionCtx;
}) => {
  const {
    fieldPath,
    disabled,
    setFieldValue,
    ui: { locale: userPreferredLocale },
    site: {
      attributes: { timezone: userPreferredTimeZone },
    },
  } = ctx;

  // Parse field value (IXDTF string) into internal state on mount.
  const [zonedDateTime, setZonedDateTime] = useState<ZonedValue>(() => {
    const initial = ctx.formValues[fieldPath] as string | null | undefined;
    return parseIxdtf(initial ?? "");
  });

  // Compute IXDTF string whenever local state changes
  const ixdtfString = useMemo(
    () => formatToIxdtf(zonedDateTime),
    [zonedDateTime]
  );

  // Persist to Dato whenever local state changes
  useEffect(() => {
    setFieldValue(fieldPath, ixdtfString);
  }, [ixdtfString, setFieldValue, fieldPath]);

  // Time zone dropdown. Show current offset next to each zone for clarity.
  const timeZones = useMemo(() => getSupportedTimeZones(), []);
  const now = useMemo(() => new Date(), []);

  // Favorites/suggested group pinned at the top:
  // - UTC
  // - Browser time zone
  // - Site default time zone (from DatoCMS project)
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const suggestedLabel = "Suggested";
  const suggestedTimeZones = useMemo(() => {
    const arr = ["UTC", browserTimeZone, userPreferredTimeZone].filter(
      (v): v is string => !!v
    );
    return Array.from(new Set(arr));
  }, [browserTimeZone, userPreferredTimeZone]);

  // Group IANA zones by top-level region (e.g., Europe, America, Asia) and sort
  const groupForTimeZone = (tz: string): string => {
    if (suggestedTimeZones.includes(tz)) return suggestedLabel;
    if (tz === "UTC" || tz === "GMT" || tz.startsWith("Etc/")) return "UTC";
    const first = tz.split("/")[0];
    return first || "Other";
  };

  const sortedTimeZones = useMemo(() => {
    // Build list starting with suggestions, then append the remaining time zones
    const set = new Set(suggestedTimeZones);
    const list = [
      ...suggestedTimeZones,
      ...timeZones.filter((tz) => !set.has(tz)),
    ];
    const offsetCache = new Map<string, number>();
    const getOffset = (tz: string) => {
      if (!offsetCache.has(tz)) {
        offsetCache.set(tz, getTimeZoneOffsetMinutes(tz, now));
      }
      return offsetCache.get(tz)!;
    };
    list.sort((a, b) => {
      const ga = groupForTimeZone(a);
      const gb = groupForTimeZone(b);
      if (ga !== gb) {
        if (ga === suggestedLabel) return -1;
        if (gb === suggestedLabel) return 1;
        return ga.localeCompare(gb);
      }
      const oa = getOffset(a);
      const ob = getOffset(b);
      if (oa !== ob) return oa - ob; // earliest (lowest offset) first
      return a.localeCompare(b);
    });
    return list;
  }, [timeZones, now, suggestedTimeZones]);
  const getOptionLabel = (tz: string): string => {
    const offsetMin = getTimeZoneOffsetMinutes(tz, now);
    const offset = formatUtcOffset(offsetMin);
    if (tz === "UTC") return "UTC";
    if (tz === browserTimeZone) return `Browser time zone: ${tz} (${offset})`;
    if (tz === userPreferredTimeZone)
      return `Site time zone: ${tz} (${offset})`;
    return `${tz} (${offset})`;
  };

  // DateTimePicker value: Luxon DateTime in the selected zone
  const dt: DateTime | null = useMemo(() => {
    if (!zonedDateTime?.dateTime) return null;
    const zone = zonedDateTime.timeZone ?? "system";
    const parsed = DateTime.fromISO(zonedDateTime.dateTime, { zone });
    return parsed.isValid ? parsed : null;
  }, [zonedDateTime?.dateTime, zonedDateTime?.timeZone]);

  // When the user edits the date/time, keep the local wall time (no offset)
  const handleDateChange = (newVal: DateTime | null) => {
    setZonedDateTime((prev) => ({
      ...prev,
      dateTime: newVal ? newVal.toFormat("yyyy-LL-dd'T'HH:mm:ss") : null,
    }));
  };

  // When the user picks an IANA zone, we store it and re-derive the offset on save
  const handleTzChange = (_: unknown, newValue: string | null) => {
    setZonedDateTime((prev) => ({ ...prev, timeZone: newValue }));
  };

  return (
    <Canvas ctx={ctx}>
      <LocalizationProvider
        dateAdapter={AdapterLuxon}
        adapterLocale={userPreferredLocale}
      >
        <FieldGroup>
          <Stack direction="row" spacing={1}>
            <DateTimePicker
              value={dt}
              onChange={handleDateChange}
              disabled={disabled}
              timezone={zonedDateTime.timeZone ?? "system"}
              slotProps={{ textField: { id: "zdt-picker", size: "small" } }}
              viewRenderers={{
                hours: renderTimeViewClock,
                minutes: renderTimeViewClock,
                seconds: renderTimeViewClock,
              }}
            />
            <Autocomplete<string, false, false, false>
              id="zdt-tz"
              options={sortedTimeZones as string[]}
              groupBy={groupForTimeZone}
              value={zonedDateTime.timeZone ?? null}
              onChange={handleTzChange}
              getOptionLabel={getOptionLabel}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="UTC" />
              )}
              disabled={disabled}
              fullWidth
            />
          </Stack>
        </FieldGroup>
      </LocalizationProvider>

      <h4>Debug</h4>
      <ul>
        <li>Internal state: {JSON.stringify(zonedDateTime)}</li>
        <li>DatoCMS field value: {ixdtfString}</li>
      </ul>
    </Canvas>
  );
};

/**
 * Parse an IXDTF string into our internal state.
 * We only support strings with an IANA zone in brackets, e.g.:
 *   2025-09-08T15:30:00+02:00[Europe/Rome]
 * The numeric offset is ignored on parse (it is derived again on save).
 */
function parseIxdtf(input: string): ZonedValue {
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

// Ensure seconds are present (we always store HH:mm:ss for clarity)
function ensureSeconds(dt: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)) return dt + ":00";
  return dt;
}

/**
 * Format our state to an IXDTF string for storage.
 * We apply the IANA zone to the local date-time and ask Luxon to include the
 * numeric offset for that instant. Then we append the zone in brackets.
 */
function formatToIxdtf(value: ZonedValue): string | null {
  const { dateTime, timeZone } = value;
  if (!dateTime || !timeZone) return null;
  const dt = DateTime.fromISO(dateTime, { zone: timeZone });
  if (!dt.isValid) return null;
  const base = dt.toISO({ suppressMilliseconds: true, includeOffset: true });
  return `${base}[${timeZone}]`;
}

function getTimeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const inTz = Date.UTC(year, month - 1, day, hour, minute, second);
  const utc = at.getTime();
  const offsetMs = inTz - utc; // positive if TZ is ahead of UTC
  return Math.round(offsetMs / 60000);
}

function formatUtcOffset(totalMinutes: number): string {
  if (totalMinutes === 0) return "UTC+0";
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const mm = minutes ? `:${minutes.toString().padStart(2, "0")}` : "";
  return `UTC${sign}${hours}${mm}`;
}
