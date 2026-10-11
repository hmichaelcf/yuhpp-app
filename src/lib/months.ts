// Work dates for the bullet bank. Members type MM/YYYY; the database keeps
// YYYY-MM so dates sort as plain text. Shared by the browser and the server.

/** Keeps a date field shaped like MM/YYYY while the member types. */
export function maskMonth(raw: string): string {
  let v = raw.replace(/[^\d/]/g, "");
  // "3/" becomes "03/" so a one-digit month still works.
  const single = v.match(/^(\d)\/(.*)$/);
  if (single) v = `0${single[1]}/${single[2]}`;
  const digits = v.replace(/\//g, "").slice(0, 6);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 2 && raw.endsWith("/")) return `${digits}/`;
  return digits;
}

/** "2021-03" becomes "03/2021". Empty stays empty. */
export function showMonth(stored: string | null | undefined): string {
  const m = stored?.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : "";
}

/** The current month as YYYY-MM. */
export function thisMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type MonthCheck = { ok: true; value: string | null } | { ok: false; message: string };

/** "03/2021" becomes "2021-03". Empty is allowed and becomes null. */
export function readMonth(typed: string, label: string, now = new Date()): MonthCheck {
  const v = typed.trim();
  if (!v) return { ok: true, value: null };
  const m = v.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return { ok: false, message: `${label} should look like MM/YYYY, for example 03/2021.` };
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, message: `${label} has a month that is not 01 to 12.` };
  if (year < 1950) return { ok: false, message: `${label} has a year before 1950.` };
  const value = `${year}-${String(month).padStart(2, "0")}`;
  // One month of slack so a member west of UTC is never told today is the future.
  const latest = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (value > thisMonth(latest)) return { ok: false, message: `${label} is in the future.` };
  return { ok: true, value };
}

export type WorkDates = { start: string | null; end: string | null; current: boolean };

/**
 * Checks a start date, an end date, and the Present box together.
 * Present clears the end date. An end date needs a start date and cannot come
 * before it.
 */
export function readWorkDates(start: string, end: string, current: boolean, now = new Date()):
  | { ok: true; dates: WorkDates }
  | { ok: false; message: string } {
  const s = readMonth(start, "The start date", now);
  if (!s.ok) return s;
  if (current) return { ok: true, dates: { start: s.value, end: null, current: true } };
  const e = readMonth(end, "The end date", now);
  if (!e.ok) return e;
  if (e.value && !s.value) return { ok: false, message: "Add a start date to go with the end date." };
  if (e.value && s.value && e.value < s.value) {
    return { ok: false, message: "The end date comes before the start date." };
  }
  return { ok: true, dates: { start: s.value, end: e.value, current: false } };
}

/** "03/2021 to Present", "03/2021 to 08/2024", or "" when there are no dates. */
export function dateRange(start: string | null, end: string | null, current: boolean): string {
  const s = showMonth(start);
  const e = current ? "Present" : showMonth(end);
  if (s && e) return `${s} to ${e}`;
  if (s) return `From ${s}`;
  if (e) return current ? "Present" : `Until ${e}`;
  return "";
}
