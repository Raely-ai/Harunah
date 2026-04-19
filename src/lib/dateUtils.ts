import { format } from "date-fns";
import { tr } from "date-fns/locale";

/**
 * Safely converts various timestamp formats (Firestore Timestamp, ISO String, Number, Date) to a JS Date object.
 * Prevents "toDate is not a function" errors when dealing with cached or serialized data.
 * Always returns a valid Date object to prevent crashes during sort/map operations.
 */
export function toSafeDate(value: any): Date {
  // If null, undefined, or empty, return current date
  if (value === null || value === undefined) return new Date();

  // Handle Firestore Timestamp
  if (typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) {
      return new Date();
    }
  }

  // Handle JS Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? new Date() : value;
  }

  // Handle JSON serialized Firestore Timestamp { _seconds, _nanoseconds } or { seconds, nanoseconds }
  if (typeof value === 'object' && value !== null) {
    const seconds = value._seconds ?? value.seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000);
    }
  }

  // Handle string (ISO) or number (milliseconds)
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // Ignore and fallback
  }

  // Fallback to current date (ensures getTime() works)
  return new Date();
}

/**
 * Formats a timestamp safely using toSafeDate.
 */
export function formatSafeDate(value: any, formatStr: string, options?: any): string {
  try {
    const date = toSafeDate(value);
    return format(date, formatStr, { locale: tr, ...options });
  } catch (e) {
    console.error("formatSafeDate error:", e);
    return "...";
  }
}
