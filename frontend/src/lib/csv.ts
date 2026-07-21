/** RFC-4180 field escaping: quote when the value contains a comma, quote, or newline. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** Joins rows with CRLF per RFC-4180. Does not include a UTF-8 BOM — add that at Blob-creation time. */
export function buildCsv(rows: string[][]): string {
  return rows.map(toCsvRow).join("\r\n");
}

export const CSV_UTF8_BOM = "﻿";

/**
 * Wraps a value in an Excel text-formula so a leading zero (phone numbers)
 * survives Excel's automatic numeric conversion. Plain CSV has no cell-type
 * metadata, so quoting the field alone isn't enough — Excel still infers
 * "General" (numeric) on open and drops the leading zero.
 */
export function excelTextForce(value: string): string {
  return `="${value}"`;
}
