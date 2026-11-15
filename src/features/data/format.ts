const monthFormat = (month: "short" | "long") =>
  new Intl.DateTimeFormat("en", { month, year: "numeric", timeZone: "UTC" });
const short = monthFormat("short");
const long = monthFormat("long");

const toDate = (yearMonth: string) => new Date(`${yearMonth}-01T00:00:00Z`);

/** "2024-07" → "Jul 2024". */
export function formatMonth(yearMonth: string) {
  return short.format(toDate(yearMonth));
}

/** "2024-07" → "July 2024". */
export function formatLongMonth(yearMonth: string) {
  return long.format(toDate(yearMonth));
}

/** "2026-11-15T12:00:00Z" → "15 November 2026". */
export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
