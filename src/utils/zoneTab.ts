// Parse official IANA tzdb zone.tab (ASCII, one country code per row)
// to map time zone -> ISO 3166-1 alpha-2 country code.

import zoneTabRaw from "../data/zone.tab?raw";

export function loadZoneToCountryMap(): Map<string, string> {
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
}

