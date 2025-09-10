// Robust search normalization: remove accents, punctuation, lowercase

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

export function makeSearchHaystack(...parts: string[]): string {
  return normalizeForSearch(parts.filter(Boolean).join(' '));
}

