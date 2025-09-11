import { Box } from "@mui/material";
import React from "react";
import type { UILabels } from "../i18n/timezoneLabels";
import { toFlagEmoji } from "../utils/flags";
import { getZoneLongName, utcOffsetStringForZone } from "../utils/datetime";
import { normalizeForSearch } from "../utils/search";
import type { ZoneOption } from "../types/timezone";

export function renderZoneOptionFactory(cfg: {
  labels: UILabels;
  browserTimeZone: string;
  siteTimeZone?: string | null;
  zoneToCountry: Map<string, string>;
  now: Date;
  locale?: string;
}) {
  const { labels, browserTimeZone, siteTimeZone, zoneToCountry, now, locale } =
    cfg;
  return (props: React.HTMLAttributes<HTMLLIElement>, opt: ZoneOption) => {
    const isSuggested = opt.group === labels.suggested;
    const isBrowser = opt.tz === browserTimeZone;
    const isSite = !!siteTimeZone && opt.tz === siteTimeZone;
    const isUTC = opt.tz === "UTC";
    const countryCode = zoneToCountry.get(opt.tz) ?? null;
    const flag = countryCode ? `${toFlagEmoji(countryCode)} ` : "";
    const globe = isUTC ? "🌍 " : "";
    const offsetText = utcOffsetStringForZone(opt.tz, now);
    const localizedName = getZoneLongName(locale, opt.tz, now) ?? opt.tz;
    const suffix = `${offsetText}${localizedName !== opt.tz ? `, ${localizedName}` : ""}`;
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
        <Box
          component="span"
          sx={{
            color: "text.secondary",
          }}
        >
          ({suffix})
        </Box>
      </li>
    );
  };
}

export function filterZoneOptions(
  opts: ZoneOption[],
  inputValue: string
): ZoneOption[] {
  const q = (inputValue ?? "").trim();
  if (!q) return opts;
  const norm = normalizeForSearch(q);
  if (!norm) return opts;
  const tokens = norm.split(/\s+/).filter(Boolean);
  return opts.filter((o) => tokens.every((t) => o.searchHay.includes(t)));
}

export function filterZoneOptionsMUI(
  opts: ZoneOption[],
  state: { inputValue: string }
) {
  return filterZoneOptions(opts, state.inputValue);
}
