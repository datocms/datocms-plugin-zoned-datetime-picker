import { useEffect, useMemo, useState } from "react";
import type { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { Canvas, FieldGroup } from "datocms-react-ui";

// MUI Date Time Picker + material components
// Requires deps: @mui/material, @emotion/react, @emotion/styled, @mui/x-date-pickers, luxon
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterLuxon } from "@mui/x-date-pickers/AdapterLuxon";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { renderTimeViewClock } from "@mui/x-date-pickers/timeViewRenderers";
import { TextField, Autocomplete, Stack, Box } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { getTimezoneLabels } from "../i18n/timezoneLabels";
import { loadZoneToCountryMap } from "../utils/zoneTab";
import { toFlagEmoji } from "../utils/flags";
import {
  getZoneLongName,
  utcOffsetStringForZone,
  parseIxdtf,
  formatToIxdtf,
  type ZonedValue,
} from "../utils/datetime";
import { normalizeForSearch, makeSearchHaystack } from "../utils/search";
import { getSupportedTimeZones, groupForTimeZone } from "../utils/timezones";

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

type ZoneOption = {
  tz: string;
  group: string;
  label: string;
  offsetMin: number;
  searchHay: string;
};

// (moved: getSupportedTimeZones in utils/timezones)

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
  const labels = getTimezoneLabels(userPreferredLocale);
  const suggestedLabel = labels.suggested;
  const suggestedTimeZones = useMemo(() => {
    // Fixed order: UTC, This project (site), Your browser
    const arr = ["UTC", userPreferredTimeZone, browserTimeZone].filter(
      (v): v is string => !!v
    );
    return Array.from(new Set(arr));
  }, [browserTimeZone, userPreferredTimeZone]);

  // (moved: groupForTimeZone in utils/timezones)
  // Pre-load TZ -> country code map from official zone.tab
  const zoneToCountry = useMemo(() => loadZoneToCountryMap(), []);
  const makeLabel = (
    tz: string,
    kind: "suggested" | "regular",
    offsetMin: number
  ) => {
    const offset = utcOffsetStringForZone(tz, now);
    const localized = getZoneLongName(userPreferredLocale, tz, now) ?? tz;
    const cc = zoneToCountry.get(tz) ?? null;
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

  const makeSearchHay = (tz: string, label: string): string =>
    makeSearchHaystack(tz, label);

  // Build a TZ -> country code map from official IANA zone.tab
  // (zoneToCountry map is built above)

  const options: ZoneOption[] = useMemo(() => {
    const offsetCache = new Map<string, number>();
    const getOffset = (tz: string) => {
      if (!offsetCache.has(tz)) {
        // Use Luxon to read the current offset for the given zone
        const offset = DateTime.fromJSDate(now, { zone: tz }).offset;
        offsetCache.set(tz, offset);
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
  const selectedDateTime: DateTime | null = useMemo(() => {
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
                value={selectedDateTime}
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
                renderOption={(props, opt) => {
                  const isSuggested = opt.group === suggestedLabel;
                  const isBrowser = opt.tz === browserTimeZone;
                  const isSite = opt.tz === userPreferredTimeZone;
                  const isUTC = opt.tz === "UTC";
                  const countryCode = zoneToCountry.get(opt.tz) ?? null;
                  const flag = countryCode
                    ? `${toFlagEmoji(countryCode)} `
                    : "";
                  const globe = isUTC ? "🌍 " : "";
                  const offsetText = utcOffsetStringForZone(opt.tz, now);
                  const localizedName =
                    getZoneLongName(userPreferredLocale, opt.tz, now) ?? opt.tz;
                  const suffix = `${offsetText}${
                    localizedName !== opt.tz ? `, ${localizedName}` : ""
                  }`;
                  const prefix =
                    isSuggested && (isBrowser || isSite)
                      ? `${isBrowser ? labels.browser : labels.site}: `
                      : "";
                  return (
                    <li {...props}>
                      {globe}
                      {flag}
                      {prefix}
                      <Box marginX={1}>
                        <strong>{opt.tz}</strong>
                      </Box>
                      <Box component="span" sx={{ color: "text.secondary" }}>
                        ({suffix})
                      </Box>
                    </li>
                  );
                }}
                filterOptions={(opts, state) => {
                  const q = (state.inputValue ?? "").trim();
                  if (!q) return opts;
                  const norm = normalizeForSearch(q);
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
