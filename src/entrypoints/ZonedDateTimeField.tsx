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
import { ThemeProvider, createTheme } from "@mui/material/styles";
import zoneTabRaw from "../data/zone.tab?raw";

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

type ZoneOption = {
  tz: string;
  group: string;
  label: string;
  offsetMin: number;
  searchHay: string;
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
    theme: { primaryColor, accentColor, lightColor, darkColor },
    setHeight,
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

  // Map DatoCMS theme colors into MUI theme
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: primaryColor },
          secondary: { main: accentColor, light: lightColor, dark: darkColor },
        },
        components: {
          MuiAutocomplete: {
            styleOverrides: {
              option: ({ theme }) => ({
                '&[aria-selected="true"]': {
                  backgroundColor: `${theme.palette.primary.main} !important`,
                  color: `${theme.palette.primary.contrastText} !important`,
                },
                "&:hover": {
                  backgroundColor: `${theme.palette.secondary.light} !important`,
                  color: `${theme.palette.secondary.dark} !important`,
                },
              }),
            },
          },
        },
      }),
    [primaryColor, accentColor]
  );

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
  // Localized strings for UI labels
  const i18n = {
    en: {
      suggested: "Suggested",
      browser: "Your browser",
      site: "This project",
      dateTime: "Date & time",
      timeZone: "Time zone",
    },
    it: {
      suggested: "Suggeriti",
      browser: "Il tuo browser",
      site: "Questo progetto",
      dateTime: "Data e ora",
      timeZone: "Fuso orario",
    },
    fr: {
      suggested: "Suggérés",
      browser: "Votre navigateur",
      site: "Ce projet",
      dateTime: "Date et heure",
      timeZone: "Fuseau horaire",
    },
    de: {
      suggested: "Vorgeschlagen",
      browser: "Ihr Browser",
      site: "Dieses Projekt",
      dateTime: "Datum & Uhrzeit",
      timeZone: "Zeitzone",
    },
    pt: {
      suggested: "Sugeridos",
      browser: "Seu navegador",
      site: "Este projeto",
      dateTime: "Data e hora",
      timeZone: "Fuso horário",
    },
    cs: {
      suggested: "Doporučené",
      browser: "Váš prohlížeč",
      site: "Tento projekt",
      dateTime: "Datum a čas",
      timeZone: "Časové pásmo",
    },
    nl: {
      suggested: "Aanbevolen",
      browser: "Uw browser",
      site: "Dit project",
      dateTime: "Datum en tijd",
      timeZone: "Tijdzone",
    },
  } as const;
  const localeKey = (userPreferredLocale || "en")
    .split("-")[0]
    .toLowerCase() as keyof typeof i18n;
  const labels = i18n[localeKey] || i18n.en;
  const suggestedLabel = labels.suggested;
  const suggestedTimeZones = useMemo(() => {
    // Fixed order: UTC, This project (site), Your browser
    const arr = ["UTC", userPreferredTimeZone, browserTimeZone].filter(
      (v): v is string => !!v
    );
    return Array.from(new Set(arr));
  }, [browserTimeZone, userPreferredTimeZone]);

  // Group IANA zones by top-level region (e.g., Europe, America, Asia) and sort
  const groupForTimeZone = (tz: string): string => {
    if (tz === "UTC" || tz === "GMT" || tz.startsWith("Etc/")) return "UTC";
    const first = tz.split("/")[0];
    return first || "Other";
  };
  // Localized time zone display name via Intl.DateTimeFormat + timeZoneName
  const getZoneLongName = (tz: string): string | null => {
    try {
      const parts = new Intl.DateTimeFormat(userPreferredLocale, {
        timeZone: tz,
        timeZoneName: "longGeneric",
      }).formatToParts(now);
      const namePart = parts.find((p) => p.type === "timeZoneName");
      return namePart?.value ?? null;
    } catch {
      return null;
    }
  };
  const makeLabel = (
    tz: string,
    kind: "suggested" | "regular",
    offsetMin: number
  ) => {
    const offset = formatUtcOffset(offsetMin);
    const localized = getZoneLongName(tz) ?? tz;
    const cc = ZONE_TO_COUNTRY.get(tz) ?? null;
    const flag = cc ? `${toFlagEmoji(cc)} ` : "";
    const base = `${tz} (${offset}${localized && localized !== tz ? `, ${localized}` : ""})`;
    if (tz === "UTC") return `🌍 ${base}`;
    if (kind === "suggested") {
      if (tz === browserTimeZone) return `${flag}${labels.browser}: ${base}`;
      if (tz === userPreferredTimeZone) return `${flag}${labels.site}: ${base}`;
      return `${flag}${base}`;
    }
    return `${flag}${base}`;
  };

  const normalizeForSearch = (s: string): string => {
    try {
      return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    } catch {
      return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }
  };
  const makeSearchHay = (tz: string, label: string): string =>
    normalizeForSearch(`${tz} ${label}`);

  // Build a TZ -> country code map from official IANA zone.tab
  const ZONE_TO_COUNTRY = useMemo(() => {
    const map = new Map<string, string>();
    const raw = zoneTabRaw || "";
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const cols = line.split("\t");
      if (cols.length < 3) continue;
      const cc = cols[0]?.trim();
      const tz = cols[2]?.trim();
      if (cc && tz && !map.has(tz)) map.set(tz, cc.toUpperCase());
    }
    return map;
  }, []);

  const options: ZoneOption[] = useMemo(() => {
    const offsetCache = new Map<string, number>();
    const getOffset = (tz: string) => {
      if (!offsetCache.has(tz)) {
        offsetCache.set(tz, getTimeZoneOffsetMinutes(tz, now));
      }
      return offsetCache.get(tz)!;
    };
    // Suggested copies first
    const suggested: ZoneOption[] = suggestedTimeZones.map((tz) => {
      const offsetMin = getOffset(tz);
      const label = makeLabel(tz, "suggested", offsetMin);
      return {
        tz,
        group: suggestedLabel,
        label,
        offsetMin,
        searchHay: makeSearchHay(tz, label),
      };
    });
    // Keep fixed order: UTC, This project (site), Your browser
    const priorityOf = (tz: string) =>
      tz === "UTC"
        ? 0
        : tz === userPreferredTimeZone
          ? 1
          : tz === browserTimeZone
            ? 2
            : 3;
    suggested.sort((a, b) => priorityOf(a.tz) - priorityOf(b.tz));

    // Full list including zones that are also in suggested
    const regular: ZoneOption[] = timeZones.map((tz) => {
      const offsetMin = getOffset(tz);
      const label = makeLabel(tz, "regular", offsetMin);
      return {
        tz,
        group: groupForTimeZone(tz),
        label,
        offsetMin,
        searchHay: makeSearchHay(tz, label),
      };
    });
    regular.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.offsetMin - b.offsetMin || a.label.localeCompare(b.label);
    });

    return [...suggested, ...regular];
  }, [
    timeZones,
    now,
    suggestedTimeZones,
    browserTimeZone,
    userPreferredTimeZone,
    userPreferredLocale,
  ]);

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

  setHeight(500);

  return (
    <Canvas ctx={ctx} noAutoResizer={true}>
      <ThemeProvider theme={muiTheme}>
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
                slotProps={{
                  textField: {
                    id: "zdt-picker",
                    size: "small",
                    placeholder: labels.dateTime,
                  },
                }}
                viewRenderers={{
                  hours: renderTimeViewClock,
                  minutes: renderTimeViewClock,
                  seconds: renderTimeViewClock,
                }}
                sx={{ width: 310 }}
              />
              <Autocomplete<ZoneOption, false, false, false>
                id="zdt-tz"
                options={options}
                groupBy={(opt) => opt.group}
                value={
                  options.find(
                    (o) => o.tz === (zonedDateTime.timeZone ?? "")
                  ) ?? null
                }
                isOptionEqualToValue={(opt, val) => opt.tz === val.tz}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue ?? "").trim();
                  if (!q) return opts;
                  const norm = (q.normalize ? q.normalize("NFD") : q)
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim();
                  if (!norm) return opts;
                  const tokens = norm.split(/\s+/).filter(Boolean);
                  return opts.filter((o) =>
                    tokens.every((t) => o.searchHay.includes(t))
                  );
                }}
                onChange={(_, newOption) =>
                  handleTzChange(_, newOption?.tz ?? null)
                }
                getOptionLabel={(opt) => opt.label}
                slotProps={{
                  listbox: { sx: { maxHeight: 200, overflowY: "auto" } },
                }}
                // Styling handled via theme to avoid flicker between states
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder={labels.timeZone}
                  />
                )}
                disabled={disabled}
                fullWidth
              />
            </Stack>
          </FieldGroup>
        </LocalizationProvider>
      </ThemeProvider>

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

// --- Country flag support (best-effort without large datasets) ---
// Converts ISO 3166-1 alpha-2 country code to a unicode flag
function toFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const cc = countryCode.toUpperCase();
  const A = 0x1f1e6;
  const codePoint = (ch: string) => A + (ch.charCodeAt(0) - 65);
  return String.fromCodePoint(codePoint(cc[0]), codePoint(cc[1]));
}

// Country code lookup now comes from official IANA zone.tab, parsed above.
