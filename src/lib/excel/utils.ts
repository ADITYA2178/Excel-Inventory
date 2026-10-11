export const getColumnLabel = (index: number) => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

export const sanitizeString = (value: unknown) => String(value ?? '').trim();

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const canonicalizeRefLabel = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const formatDisplayWord = (word: string) => {
  if (!word) return '';
  if (word.length <= 3 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

export const formatGridHeaderName = (header: string, fallback: string) => {
  const trimmed = sanitizeString(header);
  if (!trimmed) return fallback;
  if (!trimmed.includes('_')) return trimmed;
  return trimmed.split('_').map(formatDisplayWord).join(' ');
};

export const normalizeHeaderKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
