import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvField, excelTextForce, toCsvRow } from "@/lib/csv";

describe("escapeCsvField", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsvField("Faraz Ahmed")).toBe("Faraz Ahmed");
    expect(escapeCsvField("")).toBe("");
    expect(escapeCsvField("500.00")).toBe("500.00");
  });

  it("quotes a field containing a comma", () => {
    expect(escapeCsvField("254/2 Beach Street, DHA Phase 8")).toBe('"254/2 Beach Street, DHA Phase 8"');
  });

  it("quotes and doubles internal quotes", () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a field containing a carriage return", () => {
    expect(escapeCsvField("line one\rline two")).toBe('"line one\rline two"');
  });

  it("handles a field with both commas and quotes together", () => {
    expect(escapeCsvField('Gas Refill, "1.5 ton"')).toBe('"Gas Refill, ""1.5 ton"""');
  });
});

describe("toCsvRow", () => {
  it("joins fields with commas, escaping as needed", () => {
    expect(toCsvRow(["1", "Faraz Ahmed", "254/2 Beach Street, DHA"])).toBe(
      '1,Faraz Ahmed,"254/2 Beach Street, DHA"',
    );
  });
});

describe("buildCsv", () => {
  it("joins rows with CRLF", () => {
    expect(buildCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("still emits the header row alone when there are zero data rows", () => {
    expect(buildCsv([["S No.", "Date"]])).toBe("S No.,Date");
  });
});

describe("excelTextForce", () => {
  it("wraps a value in an Excel text formula", () => {
    expect(excelTextForce("03001234567")).toBe('="03001234567"');
  });

  it("round-trips through the RFC-4180 escaper correctly", () => {
    // Excel needs the literal field content to be: ="03001234567"
    // which, because it contains quote characters, must itself be
    // CSV-quoted with the inner quotes doubled.
    expect(escapeCsvField(excelTextForce("03001234567"))).toBe('"=""03001234567"""');
  });
});
