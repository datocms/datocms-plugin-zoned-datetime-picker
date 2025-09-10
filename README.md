# Zoned DateTimes (IXDTF)

A text field editor that saves and reads Internet Extended Date/Time Format (IXDTF, RFC 9557). Preserves the original time zone information instead of converting to UTC.

## What it does

- Adds a manual field extension for `text` fields in DatoCMS.
- Renders a MUI Date Time Picker and a time zone dropdown (IANA TZ).
- Saves the value as a single IXDTF string, e.g. `2025-09-08T15:30:00+02:00[Europe/Rome]`.

Example stored value: `2025-09-08T15:30:00+02:00[Europe/Rome]`

## Development

1. Install dependencies:

   npm install

2. Start the dev server:

   npm run dev

3. Add the plugin to your DatoCMS project and point the entrypoint URL to the local dev server (or build and host as needed).

## Usage in DatoCMS

1. Create a `Text` field in your model.
2. In the field’s Presentation settings, choose the manual field editor “Zoned DateTime”.
3. Editors will see a date-time picker and a time zone select. The field stores the value as IXDTF.

## Notes

- Time zone list is obtained from `Intl.supportedValuesOf('timeZone')`.
- The date-time is saved as IXDTF including the numeric UTC offset and the IANA zone in brackets.
- Requires the following deps: `@mui/material`, `@mui/x-date-pickers`, `@emotion/react`, `@emotion/styled`, and `luxon`.

<!-- This example intentionally does not support legacy formats -->
