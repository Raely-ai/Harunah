import { format, differenceInYears, parse, isValid, parseISO } from 'date-fns';

/**
 * Converts various date-like formats (strings, numbers, timestamps) to a JS Date.
 */
export function toSafeDate(date: any): Date {
  if (date instanceof Date) return date;
  if (!date) return new Date();
  
  // Handle Firestore Timestamp
  if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  
  // Handle string/number
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a date safely.
 */
export function formatSafeDate(date: any, formatStr: string = 'dd.MM.yyyy'): string {
  try {
    return format(toSafeDate(date), formatStr);
  } catch (error) {
    return String(date || '');
  }
}

/**
 * Validates if the birth date is in GG.AA.YYYY format and meets age requirements (18-80).
 */
export function validateBirthDate(dateStr: string): { isValid: boolean; error?: string } {
  // Check format GG.AA.YYYY
  const regex = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!regex.test(dateStr)) {
    return { isValid: false, error: "Geçerli bir doğum tarihi girin." };
  }

  const parts = dateStr.split(".");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  // Logical checks
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { isValid: false, error: "Geçerli bir tarih girin." };
  }

  const birthDate = parse(dateStr, "dd.MM.yyyy", new Date());
  if (!isValid(birthDate)) {
    return { isValid: false, error: "Geçerli bir doğum tarihi girin." };
  }

  // Double check year is logical (e.g. not 0001)
  if (year < 1900 || year > new Date().getFullYear()) {
    return { isValid: false, error: "Geçerli bir yıl girin." };
  }

  // Age checks
  const age = calculateAge(birthDate);
  if (age < 18) {
    return { isValid: false, error: "18 yaşından küçük kullanıcılar kabul edilmemektedir." };
  }
  if (age > 80) {
    return { isValid: false, error: "80 yaş üstü kullanıcılar kabul edilmemektedir." };
  }

  return { isValid: true };
}

/**
 * Calculates average age from a Date object.
 */
export function calculateAge(birthDate: Date): number {
  return differenceInYears(new Date(), birthDate);
}

/**
 * Automatically adds dots while typing GG.AA.YYYY
 */
export function formatBirthDateInput(value: string): string {
  // Remove non-digit chars
  const clean = value.replace(/\D/g, "");
  
  if (clean.length <= 2) {
    return clean;
  } else if (clean.length <= 4) {
    return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  } else {
    return `${clean.slice(0, 2)}.${clean.slice(2, 4)}.${clean.slice(4, 8)}`;
  }
}

/**
 * Conversion helpers between ISO (YYYY-MM-DD) and Display (DD.MM.YYYY)
 */
export function isoToDisplayDate(isoStr: string): string {
  if (!isoStr) return "";
  try {
    const date = parseISO(isoStr);
    if (!isValid(date)) return "";
    return format(date, "dd.MM.yyyy");
  } catch {
    return "";
  }
}

export function displayToIsoDate(displayStr: string): string {
  if (!displayStr) return "";
  try {
    const date = parse(displayStr, "dd.MM.yyyy", new Date());
    if (!isValid(date)) return "";
    return format(date, "yyyy-MM-dd");
  } catch {
    return "";
  }
}
