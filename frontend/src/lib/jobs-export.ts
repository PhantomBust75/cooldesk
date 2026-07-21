import type { JobExportRow } from "@/types/jobs";
import type { ServiceItem } from "@/types/operations";
import { formatDateNumeric, formatDateTime } from "@/lib/format-date";
import { buildCsv, CSV_UTF8_BOM, excelTextForce } from "@/lib/csv";

const DASH = "-";

const FIXED_COLUMNS_BEFORE_ITEMS = [
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
] as const;

const FIXED_COLUMNS_AFTER_ITEMS = [
  "Additional Charges (PKR)",
  "Total Revenue (PKR)",
  "Payment Method",
  "Created At (exact)",
  "Notes",
  "Tags",
] as const;

/**
 * Item column set = every current Settings service item, unioned with every
 * item name actually charged on the exported jobs (so a since-deleted item
 * still gets a column on old jobs that used it). Alphabetical.
 */
export function unionServiceItemNames(currentItems: ServiceItem[], jobs: JobExportRow[]): string[] {
  const names = new Set<string>();
  for (const item of currentItems) names.add(item.name);
  for (const job of jobs) {
    for (const item of job.payment?.items ?? []) names.add(item.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function buildJobExportHeader(itemColumnNames: string[]): string[] {
  return [
    ...FIXED_COLUMNS_BEFORE_ITEMS,
    ...itemColumnNames.map((name) => `${name} (PKR)`),
    ...FIXED_COLUMNS_AFTER_ITEMS,
  ];
}

function shortJobId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function formatTonnage(tonnage: number | null): string {
  return tonnage == null ? DASH : `${tonnage} ton`;
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTags(job: JobExportRow): string {
  return [job.isChronic && "Chronic", job.isFrequent && "Frequent", job.isRepeat && "Repeat"]
    .filter((v): v is string => Boolean(v))
    .join(", ");
}

function notesFor(job: JobExportRow): string {
  return (job.type === "complaint" ? job.issueDescription : job.installationNotes) ?? "";
}

/**
 * One row per unit. Jobs are expected pre-sorted (Date ascending, then Job ID)
 * by the backend. `sNo` counts rows (units), not jobs, and restarts at 1 per export.
 */
export function buildJobExportRows(jobs: JobExportRow[], itemColumnNames: string[]): string[][] {
  const rows: string[][] = [];
  let sNo = 1;

  for (const job of jobs) {
    // A job with no unit rows still needs to appear — one synthetic row with
    // equipment fields dashed, rather than silently vanishing from the export.
    const units = job.units.length > 0 ? job.units : [null];
    const totalUnits = units.length;
    const dateStr = formatDateNumeric(job.createdAt, "");
    const createdAtExact = formatDateTime(job.createdAt, "");
    const reference = job.dealerName ?? "Direct";
    const statusLabel = humanizeStatus(job.status);
    const technician = job.assignedTechnicianName ?? DASH;
    const brand = job.brandName ?? DASH;
    const tags = buildTags(job);
    const notes = notesFor(job);

    units.forEach((unit, index) => {
      const isFirstRow = index === 0;
      const unitNo = unit ? `${index + 1} of ${totalUnits}` : DASH;

      const financial: string[] =
        !isFirstRow
          ? // Continuation row of a multi-unit job: money already appeared on row 1.
            Array(1 + itemColumnNames.length + 2 + 1).fill("")
          : !job.payment
            ? Array(1 + itemColumnNames.length + 2 + 1).fill(DASH)
            : [
                job.payment.installationCharge == null ? DASH : formatMoney(job.payment.installationCharge),
                ...itemColumnNames.map((name) => {
                  const matched = (job.payment?.items ?? []).filter((it) => it.name === name);
                  if (matched.length === 0) return DASH;
                  return formatMoney(matched.reduce((sum, it) => sum + it.total, 0));
                }),
                formatMoney((job.payment.items ?? []).reduce((sum, it) => sum + it.total, 0)),
                formatMoney(
                  (job.payment.installationCharge ?? 0) +
                    (job.payment.items ?? []).reduce((sum, it) => sum + it.total, 0),
                ),
                job.payment.paymentMethodName ?? DASH,
              ];

      rows.push([
        String(sNo),
        dateStr,
        shortJobId(job.id),
        job.customerName,
        excelTextForce(job.phone),
        reference,
        unitNo,
        brand,
        formatTonnage(unit?.tonnage ?? null),
        unit?.model ?? DASH,
        unit?.serialInner ?? DASH,
        unit?.serialOuter ?? DASH,
        statusLabel,
        technician,
        job.address,
        ...financial,
        createdAtExact,
        notes,
        tags,
      ]);
      sNo += 1;
    });
  }

  return rows;
}

export function buildJobsExportCsvText(
  jobs: JobExportRow[],
  currentServiceItems: ServiceItem[],
): string {
  const itemColumnNames = unionServiceItemNames(currentServiceItems, jobs);
  const header = buildJobExportHeader(itemColumnNames);
  const rows = buildJobExportRows(jobs, itemColumnNames);
  return buildCsv([header, ...rows]);
}

function ddmmyyyyFromInputDate(value: string): string {
  // value is "YYYY-MM-DD" from <input type="date">.
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

export function buildJobsExportFilename(dateFrom?: string, dateTo?: string): string {
  if (dateFrom && dateTo) {
    return `Jobs_${ddmmyyyyFromInputDate(dateFrom)}_to_${ddmmyyyyFromInputDate(dateTo)}.csv`;
  }
  if (dateFrom) return `Jobs_from_${ddmmyyyyFromInputDate(dateFrom)}.csv`;
  if (dateTo) return `Jobs_until_${ddmmyyyyFromInputDate(dateTo)}.csv`;
  return "Jobs_All.csv";
}

export function downloadJobsExportCsv(csvText: string, filename: string): void {
  const blob = new Blob([CSV_UTF8_BOM + csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
