import type { PeriodKind } from "./domain";

const DAY_MS = 86_400_000;

/** ISO dates are already local banking dates. Instants use Singapore, never host time. */
export function singaporeDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (
      !Number.isFinite(Date.parse(value)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    )
      throw new RangeError("Invalid banking date");
    return value;
  }
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    throw new RangeError("Timestamp needs an explicit timezone");
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Invalid banking date");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localDate(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last)))
    .toISOString()
    .slice(0, 10);
}

export function getCalendarQuarter(date: string): { start: string; end: string } {
  const [year, month] = singaporeDate(date).split("-").map(Number);
  const firstMonth = Math.floor((month - 1) / 3) * 3;
  return { start: localDate(year, firstMonth, 1), end: localDate(year, firstMonth + 3, 1) };
}

/** Bank membership years start in the approval month; their end is exclusive. */
export function getAnnualPeriod(date: string, start?: string, end?: string): { start: string; end: string } | null {
  if (!start || !end) return null;
  try {
    const day = singaporeDate(date);
    const first = singaporeDate(start);
    const last = singaporeDate(end);
    const [year, month, dateNumber] = first.split("-").map(Number);
    if (dateNumber !== 1 || last !== localDate(year + 1, month - 1, 1) || day < first || day >= last) return null;
    return { start: first, end: last };
  } catch { return null; }
}

/** Statement cycles are [confirmed start day, next start day), including short months. */
export function getPeriod(
  date: string,
  kind: PeriodKind,
  statementDay?: number,
): { start: string; end: string } | null {
  const day = singaporeDate(date);
  const [year, month, dayNumber] = day.split("-").map(Number);
  if (kind === "calendar-month")
    return {
      start: localDate(year, month - 1, 1),
      end: localDate(year, month, 1),
    };
  if (
    !statementDay ||
    !Number.isInteger(statementDay) ||
    statementDay < 1 ||
    statementDay > 31
  )
    return null;
  const startThisMonth = localDate(year, month - 1, statementDay);
  const monthOffset =
    dayNumber >= Number(startThisMonth.slice(-2)) ? month - 1 : month - 2;
  return {
    start: localDate(year, monthOffset, statementDay),
    end: localDate(year, monthOffset + 1, statementDay),
  };
}

export function inPeriod(
  date: string,
  period: { start: string; end: string },
): boolean {
  const day = singaporeDate(date);
  return day >= period.start && day < period.end;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${singaporeDate(to)}T00:00:00Z`) -
      Date.parse(`${singaporeDate(from)}T00:00:00Z`)) /
      DAY_MS,
  );
}
