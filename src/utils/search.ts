/**
 * Robust search normalization: remove accents, punctuation, lowercase.
 */

/**
 * Normalizes a string for forgiving search.
 * Removes accents, collapses non-alphanumerics to spaces, lowercases.
 *
 * Example
 *   normalizeForSearch('São-Paulo / GMT+03') // => 'sao paulo gmt 03'
 */
export function normalizeForSearch(s: string): string {
  try {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  } catch {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
}

/**
 * Builds a normalized haystack from multiple parts.
 *
 * Example
 *   makeSearchHaystack('Europe/Rome', 'UTC+2, Central European Summer Time')
 */
export function makeSearchHaystack(...parts: string[]): string {
  return normalizeForSearch(parts.filter(Boolean).join(' '));
}
