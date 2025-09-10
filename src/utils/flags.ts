/**
 * Country flag utilities.
 */

/**
 * Converts an ISO 3166-1 alpha-2 country code (eg. 'IT') into a Unicode flag.
 * Returns an empty string if input is invalid.
 *
 * Example
 *   toFlagEmoji('US') // => '🇺🇸'
 */
export function toFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const cc = countryCode.toUpperCase();
  const A = 0x1f1e6;
  const codePoint = (ch: string) => A + (ch.charCodeAt(0) - 65);
  return String.fromCodePoint(codePoint(cc[0]), codePoint(cc[1]));
}
