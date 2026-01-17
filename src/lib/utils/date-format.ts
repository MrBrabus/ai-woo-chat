/**
 * Date formatting utilities with user preference support
 */

type TimeFormat = '12h' | '24h';

// Default to 24h format
let userTimeFormat: TimeFormat = '24h';

/**
 * Get user's time format preference from localStorage
 */
export function getTimeFormat(): TimeFormat {
  if (typeof window === 'undefined') {
    return '24h'; // Server-side default
  }

  try {
    const stored = localStorage.getItem('ai_woo_chat_time_format');
    if (stored === '12h' || stored === '24h') {
      userTimeFormat = stored;
      return stored;
    }
  } catch (error) {
    console.error('Error reading time format preference:', error);
  }

  return '24h';
}

/**
 * Set user's time format preference
 */
export function setTimeFormat(format: TimeFormat): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('ai_woo_chat_time_format', format);
    userTimeFormat = format;
  } catch (error) {
    console.error('Error saving time format preference:', error);
  }
}

/**
 * Format date with user's time format preference
 */
export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const format = getTimeFormat();

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: format === '12h',
  };

  return dateObj.toLocaleString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format date only (no time)
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time only with user's format preference
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const format = getTimeFormat();

  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: format === '12h',
  });
}
