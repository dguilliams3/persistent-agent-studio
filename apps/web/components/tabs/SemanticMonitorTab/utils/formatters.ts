const DEFAULT_LOCALE = 'en-US';
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function isFiniteNumber(value: any) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatDistance(value: any, precision = 2) {
  if (!isFiniteNumber(value)) return '--';
  return value.toFixed(precision);
}

export function formatPercent(value: any, precision = 1) {
  if (!isFiniteNumber(value)) return '--';
  return `${(value * 100).toFixed(precision)}%`;
}

export function formatZScore(value: any, precision = 2, withSign = true) {
  if (!isFiniteNumber(value)) return '--';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(precision)}σ`;
}

export function formatTimestamp(value: any, { includeTime = true } = {}) {
  if (!value) return '--';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    const options: any = {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return date.toLocaleString(DEFAULT_LOCALE, options);
  } catch {
    return '--';
  }
}

export function formatRelativeTime(value: any) {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  return `${Math.round(diff / DAY)}d ago`;
}

export function formatEntryLabel(entry: any) {
  if (!entry) return 'Unknown entry';
  const parts = [];
  if (entry.type) parts.push(capitalize(entry.type));
  if (entry.table && !entry.type) parts.push(capitalize(entry.table));
  if (entry.id !== undefined) parts.push(`#${entry.id}`);
  return parts.join(' ');
}

export function capitalize(value: any) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default {
  isFiniteNumber,
  formatDistance,
  formatPercent,
  formatZScore,
  formatTimestamp,
  formatRelativeTime,
  formatEntryLabel,
  capitalize
};
