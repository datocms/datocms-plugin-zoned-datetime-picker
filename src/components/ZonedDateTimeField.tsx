import { useEffect, useMemo, useState } from "react";
import type { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { Canvas } from "datocms-react-ui";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterLuxon } from "@mui/x-date-pickers/AdapterLuxon";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { TextField, Autocomplete, Stack } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { getTimezoneLabels } from "../i18n/uiLabels";
import { loadZoneToCountryMap } from "../utils/zoneTab";
import { toFlagEmoji } from "../utils/flags";
import {
  parseDatoValue,
  buildDatoOutput,
  type ZonedValue,
} from "../utils/datetime";
import { getSupportedTimeZones } from "../utils/timezones";
import { buildZoneOptions } from "../utils/zoneOptions";

import { DateTime } from "luxon";
import { createMuiThemeFromDato } from "../ui/theme";
import { CLOCK_VIEW_RENDERERS } from "../ui/timePicker";
import {
  filterZoneOptionsMUI,
  renderZoneOptionFactory,
} from "../ui/timeZoneAutocomplete";
import type { ZoneOption } from "../types/timezone";

/**
 * ZonedDateTime field editor
 *
 * Stores/loads Internet Extended Date/Time Format (IXDTF, RFC 9557), e.g.:
 *   2025-09-08T15:30:00+02:00[Europe/Rome]
 *
 * How it works
 * - State keeps the local wall-clock date-time (no offset) and the IANA zone.
 * - On save, Luxon derives the correct numeric offset for that date-time/zone
 *   so DST is preserved in the stored string.
 *
 * MUI integration
 * - DateTimePicker uses Luxon adapter and `viewRenderers` for the clock views.
 * - Autocomplete options are grouped and rendered with custom content
 *   (flag, UTC offset, localized long name) and a theme override for selected
 *   and hover states.
 */

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
    startAutoResizer,
    stopAutoResizer,
  } = ctx;

  // Parse current field value into internal state on mount.
  const [zonedDateTime, setZonedDateTime] = useState<ZonedValue>(() => {
    const rawField = ctx.formValues[fieldPath] as unknown as string;
    const parsedField = JSON.parse(rawField);
    return parseDatoValue(parsedField);
  });

  // Build JSON payload when local state changes
  const datoPayload = useMemo(
    () => JSON.stringify(buildDatoOutput(zonedDateTime), null, 2),
    [zonedDateTime]
  );

  // Persist JSON payload to DatoCMS when it changes (JSON-only field)
  useEffect(() => {
    setFieldValue(fieldPath, datoPayload);
  }, [datoPayload, setFieldValue, fieldPath]);

  // Map DatoCMS theme colors into an MUI theme
  const muiTheme = useMemo(
    () =>
      createMuiThemeFromDato(primaryColor, accentColor, lightColor, darkColor),
    [primaryColor, accentColor, lightColor, darkColor]
  );

  // Time zone dropdown data
  const timeZones = useMemo(() => getSupportedTimeZones(), []);
  const now = useMemo(() => new Date(), []);

  // Suggested time zones shown first: UTC, Site default, Browser zone
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  // Localized UI labels
  const labels = getTimezoneLabels(userPreferredLocale);
  const suggestedLabel = labels.suggested;
  const suggestedTimeZones = useMemo(() => {
    // Fixed order: UTC, This project (site), Your browser
    const arr = ["UTC", userPreferredTimeZone, browserTimeZone].filter(
      (v): v is string => !!v
    );
    return Array.from(new Set(arr));
  }, [browserTimeZone, userPreferredTimeZone]);

  // Pre-load TZ -> country code map from IANA zone.tab
  const zoneToCountry = useMemo(() => loadZoneToCountryMap(), []);
  // Option labels and filtering are handled by the helper modules

  const options: ZoneOption[] = useMemo(
    () =>
      buildZoneOptions({
        timeZones,
        now,
        suggestedTimeZones,
        suggestedLabel,
        browserTimeZone,
        siteTimeZone: userPreferredTimeZone,
        locale: userPreferredLocale,
        zoneToCountry,
        toFlagEmoji,
        labels: { browser: labels.browser, site: labels.site },
      }),
    [
      timeZones,
      now,
      suggestedTimeZones,
      suggestedLabel,
      browserTimeZone,
      userPreferredTimeZone,
      userPreferredLocale,
      zoneToCountry,
      labels.browser,
      labels.site,
    ]
  );

  // Custom renderer to bold the TZ name and show suffix/flags
  const renderZoneOption = useMemo(
    () =>
      renderZoneOptionFactory({
        labels,
        browserTimeZone,
        siteTimeZone: userPreferredTimeZone,
        zoneToCountry,
        now,
        locale: userPreferredLocale,
      }),
    [
      labels,
      browserTimeZone,
      userPreferredTimeZone,
      zoneToCountry,
      now,
      userPreferredLocale,
    ]
  );

  // DateTimePicker value: Luxon DateTime in the selected zone
  const selectedDateTime: DateTime | null = useMemo(() => {
    if (!zonedDateTime?.dateTime) return null;
    const zone = zonedDateTime.timeZone ?? "system";
    const parsed = DateTime.fromISO(zonedDateTime.dateTime, { zone });
    return parsed.isValid ? parsed : null;
  }, [zonedDateTime?.dateTime, zonedDateTime?.timeZone]);

  // When the user edits the date/time, keep local wall time (no offset)
  const handleDateChange = (newVal: DateTime | null) => {
    setZonedDateTime((prev) => ({
      ...prev,
      dateTime: newVal ? newVal.toFormat("yyyy-LL-dd'T'HH:mm:ss") : null,
    }));
  };

  // When the user picks a zone, update it and re-derive offset on save
  const handleTzChange = (_: unknown, newValue: string | null) => {
    setZonedDateTime((prev) => ({ ...prev, timeZone: newValue }));
  };

  const isTimeZonePickerDisabled = disabled || !zonedDateTime?.dateTime;

  return (
    <Canvas ctx={ctx}>
      <ThemeProvider theme={muiTheme}>
        <LocalizationProvider
          dateAdapter={AdapterLuxon}
          adapterLocale={userPreferredLocale}
        >
          <Stack direction="row" spacing={1}>
            <DateTimePicker
              value={selectedDateTime}
              onChange={handleDateChange}
              disabled={disabled}
              timezone={zonedDateTime.timeZone ?? "system"}
              reduceAnimations
              slotProps={{
                textField: {
                  id: "zdt-picker",
                  size: "small",
                  label: labels.dateTime,
                },
                desktopPaper: {
                  sx: { marginBottom: 2 },
                },
              }}
              viewRenderers={CLOCK_VIEW_RENDERERS}
              sx={{ width: 310 }}
            />
            <Autocomplete
              id="zdt-tz"
              options={options}
              groupBy={(opt) => opt.group}
              getOptionLabel={(opt) => opt.label}
              value={
                isTimeZonePickerDisabled
                  ? undefined
                  : (options.find(
                      (o) => o.tz === (zonedDateTime.timeZone ?? "")
                    ) ?? options[0])
              }
              disableClearable={true}
              isOptionEqualToValue={(opt, val) => opt.tz === val.tz}
              filterOptions={filterZoneOptionsMUI}
              renderOption={renderZoneOption}
              onChange={(_, newOption) => {
                handleTzChange(_, newOption?.tz ?? null);
                startAutoResizer();
              }}
              onClose={() => startAutoResizer()}
              slotProps={{
                listbox: {
                  sx: { maxHeight: 200, overflowY: "auto" },
                },
                popper: {
                  disablePortal: true,
                  keepMounted: true,
                  modifiers: [
                    {
                      // Workaround for the popper node overflowing the iframe and causing a huge expansion
                      name: "Manually resize on popup",
                      enabled: true,
                      phase: "main",
                      fn() {
                        stopAutoResizer();
                        setHeight(300);
                      },
                    },
                  ],
                },
              }}
              // Styling for options handled via theme override
              renderInput={(params) => (
                <TextField {...params} size="small" label={labels.timeZone} />
              )}
              disabled={isTimeZonePickerDisabled}
              fullWidth
            />
          </Stack>
        </LocalizationProvider>
      </ThemeProvider>
    </Canvas>
  );
};
