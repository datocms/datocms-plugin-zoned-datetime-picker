/**
 * Option shape consumed by the time zone autocomplete.
 *
 * - `group`: user-visible grouping header.
 * - `offsetMin`: numeric offset at `now` (used for sorting).
 * - `searchHay`: normalized text used by search filtering.
 */
export type ZoneOption = {
  tz: string;
  group: string;
  label: string;
  offsetMin: number;
  searchHay: string;
};
