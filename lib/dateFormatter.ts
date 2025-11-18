/**
 * Format an ISO date string to a user-friendly date format.
 * Only call this client-side after hydration to avoid hydration mismatches.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO date string to a user-friendly date and time format.
 * Only call this client-side after hydration to avoid hydration mismatches.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Convert UTC date to local datetime-local format for datetime-local inputs.
 * Returns empty string if input is null/undefined.
 */
export function toLocalDatetimeString(utcDateString: string | null | undefined): string {
  if (!utcDateString) return '';
  const date = new Date(utcDateString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}
