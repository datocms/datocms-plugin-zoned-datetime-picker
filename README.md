# Zoned DateTimes for DatoCMS (IXDTF)

A zero‑config field editor that stores date and time values using Internet Extended Date/Time Format (IXDTF, RFC 9557). It preserves the original IANA time zone and the correct UTC offset for the chosen date, so daylight‑saving transitions are always represented accurately.

![Cover](docs/cover-1200x800.svg)

## Overview

- Field editor for `string`/`text` fields.
- Stores a single IXDTF string, for example: `2025-09-08T15:30:00+02:00[Europe/Rome]`.
- Uses Luxon + MUI Date/Time Picker for a smooth UX.
- Time zone picker with flags, localized names, and smart suggestions (UTC, Project default, Browser zone).
- Fully localized UI labels (English, Italian, French, German, Portuguese, Czech, Dutch).

## Why IXDTF?

IXDTF augments ISO 8601 with explicit IANA time zone information (e.g. `Europe/Rome`) in addition to a numeric UTC offset. This ensures the stored value is unambiguous across DST boundaries and future‑proof if offset rules change.

## Installation

You can use it locally or publish to the Marketplace.

1) Local development install

- Clone this repository and install dependencies:

  npm install

- Start the dev server:

  npm run dev

- In DatoCMS → Settings → Plugins → Add new plugin → “Create a new local/remote plugin”, set the entrypoint URL to your local server (Vite dev server URL).

2) Marketplace install

- Once published, install from the DatoCMS Marketplace and enable permissions if requested (this plugin currently needs none).

## Usage

1. Add a `Text` field to your model.
2. In Presentation → Field editor, select “Zoned DateTime”.
3. Editors can pick a local date/time and a time zone; the value is stored as IXDTF.

## Data format

- Example: `2025-09-08T15:30:00+02:00[Europe/Rome]`
- Structure: `<local-date>T<local-time><offset>[<IANA-time-zone>]`
- The local wall‑clock time is preserved; the numeric offset is computed for that zone at that date/time, so DST is correct.

## Features

- Smart suggestions: UTC, the project time zone, and the browser zone appear first.
- Powerful search: type city, offset (e.g. `utc+2`), or zone name.
- Localized long names via `Intl.DateTimeFormat` when available.
- Grouped options by region (e.g. Europe, America, Asia, UTC).
- Keyboard and screen‑reader friendly MUI components.

## Configuration

No configuration is required. The plugin adapts to the project’s primary colors and the user’s preferred locale.

## Compatibility

- Time zones list is read from `Intl.supportedValuesOf('timeZone')` when supported by the runtime (modern browsers).
- Relies on `@mui/x-date-pickers` and `luxon`.

## Permissions

This plugin does not require any special permissions.

## Development

- Build for production:

  npm run build

- Preview the built plugin locally:

  npm run preview

The production entry point is `dist/index.html`.

## FAQ

- Can I migrate existing fields? Store strings in IXDTF format. The parser tolerates missing seconds and infers them.
- What if the runtime lacks `Intl.supportedValuesOf`? The zone list will be empty; the control will still render but without the zone options.

## License

MIT
