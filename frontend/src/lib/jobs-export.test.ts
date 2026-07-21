import { describe, expect, it } from "vitest";
import type { JobExportRow } from "@/types/jobs";
import type { ServiceItem } from "@/types/operations";
import {
  buildJobExportHeader,
  buildJobExportRows,
  buildJobsExportFilename,
  unionServiceItemNames,
} from "@/lib/jobs-export";

function serviceItem(name: string): ServiceItem {
  return { id: name, name, pricingType: "fixed", unitPrice: 0, unitLabel: null, createdAt: "" };
}

function job(overrides: Partial<JobExportRow>): JobExportRow {
  return {
    id: "e2bc37e1-ac0b-4f0f-ab0c-3d945648cd82",
    type: "installation",
    status: "completed",
    brandName: "Dawlance",
    dealerName: null,
    assignedTechnicianName: "Muhammad Rehman",
    customerName: "Faraz Ahmed",
    phone: "03202205001",
    address: "254/2 Beach Street, DHA Phase 8",
    issueDescription: null,
    installationNotes: null,
    isRepeat: false,
    isFrequent: false,
    isChronic: false,
    createdAt: "2026-07-17T09:36:44.295Z",
    payment: null,
    units: [],
    ...overrides,
  };
}

describe("unionServiceItemNames", () => {
  it("unions current settings items with items charged on exported jobs, alphabetically", () => {
    const current = [serviceItem("Gas Refill"), serviceItem("Duct Cleaning")];
    const jobs = [
      job({
        payment: {
          installationCharge: 3000,
          paymentMethodName: "Cash",
          items: [{ name: "Master Service", unitPrice: 500, quantity: 1, total: 500 }],
        },
      }),
    ];
    expect(unionServiceItemNames(current, jobs)).toEqual(["Duct Cleaning", "Gas Refill", "Master Service"]);
  });

  it("keeps a since-deleted item's column if an old job was charged for it", () => {
    // Settings no longer has "Old Item" — only a historical job references it.
    const jobs = [
      job({
        payment: {
          installationCharge: null,
          paymentMethodName: "Cash",
          items: [{ name: "Old Item", unitPrice: 100, quantity: 1, total: 100 }],
        },
      }),
    ];
    expect(unionServiceItemNames([], jobs)).toEqual(["Old Item"]);
  });

  it("returns an empty list when there are no items anywhere", () => {
    expect(unionServiceItemNames([], [])).toEqual([]);
  });
});

describe("buildJobExportHeader", () => {
  it("places item columns between Installation and Additional Charges, each carrying (PKR)", () => {
    const header = buildJobExportHeader(["Duct Cleaning", "Gas Refill"]);
    expect(header).toEqual([
      "S No.",
      "Date",
      "Job ID",
      "Customer Name",
      "Contact No",
      "Reference",
      "Unit No",
      "Brand",
      "AC Type (Tonnage)",
      "Model No",
      "Indoor Serial No.",
      "Outer Serial No.",
      "Status",
      "Technician Assigned",
      "Address",
      "Installation (PKR)",
      "Duct Cleaning (PKR)",
      "Gas Refill (PKR)",
      "Additional Charges (PKR)",
      "Total Revenue (PKR)",
      "Payment Method",
      "Created At (exact)",
      "Notes",
      "Tags",
    ]);
  });

  it("still emits a full header with zero item columns", () => {
    expect(buildJobExportHeader([])).toContain("Installation (PKR)");
    expect(buildJobExportHeader([])).toContain("Additional Charges (PKR)");
  });
});

describe("buildJobExportRows — S No. and row expansion", () => {
  it("restarts S No. at 1 and counts units, not jobs", () => {
    const jobs = [
      job({ id: "aaaaaaaa-0000", units: [{ model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" }, { model: "M2", unitType: "Split", tonnage: 2, serialOuter: null, serialInner: null, label: "" }] }),
      job({ id: "bbbbbbbb-0000", units: [{ model: "M3", unitType: "Floor", tonnage: 1, serialOuter: null, serialInner: null, label: "" }] }),
    ];
    const rows = buildJobExportRows(jobs, []);
    expect(rows.map((r) => r[0])).toEqual(["1", "2", "3"]);
  });

  it("emits one synthetic row (equipment dashed) for a job with zero units, instead of dropping it", () => {
    const rows = buildJobExportRows([job({ units: [] })], []);
    expect(rows).toHaveLength(1);
    const [, , , , , , unitNo, , acType, model, indoorSn, outerSn] = rows[0];
    expect(unitNo).toBe("-");
    expect(acType).toBe("-");
    expect(model).toBe("-");
    expect(indoorSn).toBe("-");
    expect(outerSn).toBe("-");
  });

  it("labels unit rows '1 of 2', '2 of 2'", () => {
    const rows = buildJobExportRows(
      [
        job({
          units: [
            { model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: "OUT-1", serialInner: "IN-1", label: "" },
            { model: "M2", unitType: "Floor", tonnage: 2, serialOuter: "OUT-2", serialInner: "IN-2", label: "" },
          ],
        }),
      ],
      [],
    );
    expect(rows[0][6]).toBe("1 of 2");
    expect(rows[1][6]).toBe("2 of 2");
  });
});

describe("buildJobExportRows — financial dash/blank rules", () => {
  const twoUnitJob = job({
    units: [
      { model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" },
      { model: "M2", unitType: "Split", tonnage: 2, serialOuter: null, serialInner: null, label: "" },
    ],
    payment: {
      installationCharge: 3000,
      paymentMethodName: "Cash",
      items: [
        { name: "Gas Refill", unitPrice: 500, quantity: 1, total: 500 },
        { name: "Duct Cleaning", unitPrice: 300, quantity: 1, total: 300 },
      ],
    },
  });
  const itemColumns = ["Duct Cleaning", "Gas Refill"];
  const rows = buildJobExportRows([twoUnitJob], itemColumns);
  // columns: ...Address(14), Installation(15), Duct Cleaning(16), Gas Refill(17), Additional Charges(18), Total Revenue(19), Payment Method(20)...
  const FIN_START = 15;

  it("writes financial values on the first unit row", () => {
    expect(rows[0][FIN_START]).toBe("3000.00"); // Installation
    expect(rows[0][FIN_START + 1]).toBe("300.00"); // Duct Cleaning
    expect(rows[0][FIN_START + 2]).toBe("500.00"); // Gas Refill
    expect(rows[0][FIN_START + 3]).toBe("800.00"); // Additional Charges = 500+300
    expect(rows[0][FIN_START + 4]).toBe("3800.00"); // Total Revenue = 3000+800
    expect(rows[0][FIN_START + 5]).toBe("Cash");
  });

  it("leaves financial cells truly blank (not dashed) on continuation rows", () => {
    const financial = rows[1].slice(FIN_START, FIN_START + 6);
    expect(financial).toEqual(["", "", "", "", "", ""]);
  });

  it("dashes an item column the job did not use", () => {
    const noItemsJob = job({
      units: [{ model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" }],
      payment: { installationCharge: 3000, paymentMethodName: "Cash", items: [] },
    });
    const r = buildJobExportRows([noItemsJob], itemColumns);
    expect(r[0][FIN_START + 1]).toBe("-"); // Duct Cleaning unused
    expect(r[0][FIN_START + 2]).toBe("-"); // Gas Refill unused
    expect(r[0][FIN_START + 3]).toBe("0.00"); // Additional Charges is a real computed zero, not "unused"
  });

  it("dashes every financial column when the job has no payment log at all", () => {
    const noPaymentJob = job({
      units: [{ model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" }],
      payment: null,
    });
    const r = buildJobExportRows([noPaymentJob], itemColumns);
    expect(r[0].slice(FIN_START, FIN_START + 6)).toEqual(["-", "-", "-", "-", "-", "-"]);
  });

  it("dashes Installation specifically for a repair/complaint job with no installation charge", () => {
    const complaintJob = job({
      type: "complaint",
      issueDescription: "Not cooling",
      units: [{ model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" }],
      payment: {
        installationCharge: null,
        paymentMethodName: "Cash",
        items: [{ name: "Gas Refill", unitPrice: 500, quantity: 1, total: 500 }],
      },
    });
    const r = buildJobExportRows([complaintJob], itemColumns);
    expect(r[0][FIN_START]).toBe("-"); // Installation
    expect(r[0][FIN_START + 2]).toBe("500.00"); // Gas Refill still charged
    expect(r[0][FIN_START + 4]).toBe("500.00"); // Total Revenue = 0 (no install) + 500
  });

  it("sums multiple payment-item rows sharing the same name into one column value", () => {
    const dupJob = job({
      units: [{ model: "M1", unitType: "Split", tonnage: 1.5, serialOuter: null, serialInner: null, label: "" }],
      payment: {
        installationCharge: null,
        paymentMethodName: "Cash",
        items: [
          { name: "Gas Refill", unitPrice: 500, quantity: 1, total: 500 },
          { name: "Gas Refill", unitPrice: 200, quantity: 1, total: 200 },
        ],
      },
    });
    const r = buildJobExportRows([dupJob], itemColumns);
    expect(r[0][FIN_START + 2]).toBe("700.00");
  });
});

describe("buildJobExportRows — non-financial fields", () => {
  it("wraps Contact No in an Excel text formula", () => {
    const r = buildJobExportRows([job({ phone: "03001234567" })], []);
    expect(r[0][4]).toBe('="03001234567"');
  });

  it("uses the dealer name for Reference, or the literal 'Direct' otherwise", () => {
    const viaDealer = buildJobExportRows([job({ dealerName: "Naeem Electronics" })], []);
    const direct = buildJobExportRows([job({ dealerName: null })], []);
    expect(viaDealer[0][5]).toBe("Naeem Electronics");
    expect(direct[0][5]).toBe("Direct");
  });

  it("shows issueDescription as Notes for complaints and installationNotes for installations", () => {
    const complaint = buildJobExportRows(
      [job({ type: "complaint", issueDescription: "AC not cooling", installationNotes: null })],
      [],
    );
    const installation = buildJobExportRows(
      [job({ type: "installation", issueDescription: null, installationNotes: "Extra piping charged" })],
      [],
    );
    // Installation(15), Additional Charges(16), Total Revenue(17), Payment Method(18), Created At(19), Notes(20)
    const NOTES_INDEX = 20;
    expect(complaint[0][NOTES_INDEX]).toBe("AC not cooling");
    expect(installation[0][NOTES_INDEX]).toBe("Extra piping charged");
  });

  it("joins active tags with a comma", () => {
    const r = buildJobExportRows([job({ isChronic: true, isRepeat: true })], []);
    const TAGS_INDEX = r[0].length - 1;
    expect(r[0][TAGS_INDEX]).toBe("Chronic, Repeat");
  });

  it("leaves Tags blank (not dashed) when no tags apply", () => {
    const r = buildJobExportRows([job({})], []);
    const TAGS_INDEX = r[0].length - 1;
    expect(r[0][TAGS_INDEX]).toBe("");
  });
});

describe("buildJobsExportFilename", () => {
  it("names the file after the full date range", () => {
    expect(buildJobsExportFilename("2026-07-01", "2026-07-31")).toBe("Jobs_01-07-2026_to_31-07-2026.csv");
  });

  it("falls back to Jobs_All.csv when unfiltered", () => {
    expect(buildJobsExportFilename(undefined, undefined)).toBe("Jobs_All.csv");
  });

  it("handles an open-ended from-only range", () => {
    expect(buildJobsExportFilename("2026-07-01", undefined)).toBe("Jobs_from_01-07-2026.csv");
  });

  it("handles an open-ended to-only range", () => {
    expect(buildJobsExportFilename(undefined, "2026-07-31")).toBe("Jobs_until_31-07-2026.csv");
  });
});
