const LEADING_UNICODE_WHITESPACE = "[\\u0000-\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]*";
const FORMULA_PREFIX = new RegExp(`^${LEADING_UNICODE_WHITESPACE}[=+\\-@]`, "u");
const CONTROL_PREFIX = /^[\t\r]/u;

/** Neutralizes values that spreadsheet applications may interpret as formulas. */
export function neutralizeSpreadsheetFormula(value: unknown): string {
  const text = String(value ?? "");
  return FORMULA_PREFIX.test(text) || CONTROL_PREFIX.test(text) ? `'${text}` : text;
}

/** Produces a quoted, spreadsheet-safe RFC 4180-style CSV cell. */
export function escapeSpreadsheetSafeCsvCell(value: unknown): string {
  const safeText = neutralizeSpreadsheetFormula(value);
  return `"${safeText.replace(/"/g, '""')}"`;
}
