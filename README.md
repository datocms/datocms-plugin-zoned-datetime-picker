# Zoned DateTime Picker

This plugin is a field editor for JSON fields. It provides a user-friendly GUI for picking a date, time, and IANA timezone, and saves a JSON object that includes a RFC 9557 IXDTF datetime string along with helpful derived fields.

[RFC 9557](https://datatracker.ietf.org/doc/rfc9557/) is a proposed internet standard that expands current ISO 8601 datetime timestamps (which have a format like `1996-12-19T16:39:57-08:00`, without the explicit `[America/Los_Angeles]` time zone). This new format is called the Internet Extended Date/Time Format (IXDTF). The full specification allows additional metadata, but this plugin only adds the time zone string.

## Stored JSON Shape

The JSON field value is an object like:

```
{
  "zoned_datetime_ixdtf": "1996-12-19T16:39:57-08:00[America/Los_Angeles]",
  "datetime_iso8601": "1996-12-19T16:39:57-08:00",
  "zone": "America/Los_Angeles",
  "offset": "-08:00",
  "date": "1996-12-19",
  "time_24hr": "16:39:57",
  "time_12hr": "04:39:57",
  "am_pm": "pm",
  "timestamp_epoch_seconds": "851042397"
}
```

Notes:
- `zoned_datetime_ixdtf` follows RFC 9557 IXDTF and preserves the chosen zone and offset.
- `datetime_iso8601` is ISO 8601 with numeric offset (no zone ID).
- `time_24hr` is `HH:mm:ss`. `time_12hr` is `hh:mm:ss` (pair with `ampm`).
- `am_pm` is `am` or `pm` (pair with `time_12hr`).
- `timestamp_epoch_seconds` is epoch seconds (string).

## Compatibility

IMPORTANT NOTE: As of September 2025, the IXDTF or RFC9557 datestring format is not yet widely supported. You CANNOT yet parse it in most JS runtimes and datetime libraries.

Therefore, this plugin should ONLY be used if you know you have a need for it, and have a corresponding frontend library able to correctly utilize this extended format. If you try to parse IXDTF with an older ISO8601-only function, you may end up with incorrect information or crash your program altogether.

### Frontend Support

Browsers and most JS datetime libraries do not yet support RFC 9557/IXDTF. In the near future, this format should be compatible with the [Temporal API's ZoneDateTime format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime#rfc_9557_format), which is itself experimental at the moment, with almost no browser support.

For now, your options are:

- Manual regex parsing
- Using a datetime lib that does have support, like [@11ty/parse-date-strings](https://www.npmjs.com/package/@11ty/parse-date-strings)
- Using a Temporal API polyfill, like [fullcalendar/temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) or [js-temporal/temporal-polyfill](https://github.com/js-temporal/temporal-polyfill)

## Why would I use this? Why not use the built-in date & time field?

DatoCMS's default datetime picker converts the entered time to UTC as soon as you save. When you pick a time like `1996-12-19T16:39:57-08:00`, the system actually converts it to `1996-12-20T00:39:57.000Z` when you save. For some use cases, this is a problem because:

1. It makes cross-time-zone marketing difficult. It unrecoverably loses the original offset (`-08:00`). If your event was in `America/Los_Angeles`, your website was in `Europe/Rome`, and your visitor was in `Europe/London` , your frontend would have no way to know which time zone to use.

2. It doesn't respect daylight savings time. With an ISO 8601 offset like `-06:00`, there is no way to know if that is being used for a region that observes daylight savings time (like CDT, Central Daylight Time, in the USA) or one that doesn't (like Mexico City, which uses CST, Central Standard Time, instead). Depending on the time of the year, the timestamp may be ahead or behind by 1 hour in that case, and your frontend cannot tell which is correct without further information.

The plugin does two things to address this situation:

1. It always encodes the original offset you chose. If you entered the time in `-08:00`, it stays that way and does not get coerced to UTC.
2. It adds an explicit IANA time zone string like `[America/Los_Angeles]` and stores a helpful JSON payload. Your frontend can then use that time zone to ensure proper display via [`Intl.DateTimeFormat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) or a helper library like [Luxon](https://moment.github.io/luxon/#/).

## Notes on migration

This plugin now supports JSON fields only. Legacy single-string fields storing plain IXDTF are no longer supported by the editor. If you previously stored IXDTF in a string field, migrate to a JSON field and, if needed, wrap the string into the JSON shape above.
