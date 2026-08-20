const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function resolveBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function toDateKeyInTimeZone(value: Date | string | number, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date value.");
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function toDateTimeLocalValueInTimeZone(value: Date | string | number, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function dateTimeLocalValueToIso(value: string, timeZone: string): string {
  const match = value.match(DATE_TIME_LOCAL);
  if (!match) throw new Error("Invalid local date-time value.");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const desired = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  };
  const calendarProbe = new Date(Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second));
  if (
    calendarProbe.getUTCFullYear() !== desired.year
    || calendarProbe.getUTCMonth() + 1 !== desired.month
    || calendarProbe.getUTCDate() !== desired.day
    || calendarProbe.getUTCHours() !== desired.hour
    || calendarProbe.getUTCMinutes() !== desired.minute
    || calendarProbe.getUTCSeconds() !== desired.second
  ) {
    throw new Error("Invalid local date-time value.");
  }

  const desiredEpoch = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let candidateEpoch = desiredEpoch;
  for (let index = 0; index < 5; index += 1) {
    const actual = zonedParts(new Date(candidateEpoch), timeZone);
    const actualEpoch = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = desiredEpoch - actualEpoch;
    candidateEpoch += delta;
    if (delta === 0) break;
  }

  const candidate = new Date(candidateEpoch);
  const roundTrip = zonedParts(candidate, timeZone);
  if (
    roundTrip.year !== desired.year
    || roundTrip.month !== desired.month
    || roundTrip.day !== desired.day
    || roundTrip.hour !== desired.hour
    || roundTrip.minute !== desired.minute
  ) {
    throw new Error("The selected local date-time does not exist in the workspace timezone.");
  }
  return candidate.toISOString();
}

export function normalizeDateTimeInputValue(value: string | undefined, timeZone: string): string {
  if (!value) return "";
  if (DATE_TIME_LOCAL.test(value)) return value.slice(0, 16);
  return toDateTimeLocalValueInTimeZone(value, timeZone);
}

export function addDurationAsDateTimeLocal(
  value: Date | string | number,
  durationMs: number,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date value.");
  return toDateTimeLocalValueInTimeZone(new Date(date.getTime() + durationMs), timeZone);
}

export function isSameCalendarDateInTimeZone(
  left: Date | string | number,
  right: Date | string | number,
  timeZone: string,
): boolean {
  return toDateKeyInTimeZone(left, timeZone) === toDateKeyInTimeZone(right, timeZone);
}

export function isValidDateKey(value: string): boolean {
  const match = value.match(DATE_KEY);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  return date.getUTCFullYear() === Number(yearText)
    && date.getUTCMonth() + 1 === Number(monthText)
    && date.getUTCDate() === Number(dayText);
}
