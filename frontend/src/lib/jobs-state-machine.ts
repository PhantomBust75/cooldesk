import type { JobDetail } from "@/types/jobs";

const INSTALLATION_NEXT_STATUS: Record<string, string[]> = {
  pending_schedule: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["acknowledged", "cancelled"],
  acknowledged: ["in_transit", "cancelled"],
  in_transit: ["in_process", "cancelled"],
  in_process: ["completed", "cancelled"],
};

const COMPLAINT_NEXT_STATUS: Record<string, string[]> = {
  new: ["assigned", "cancelled"],
  assigned: ["acknowledged", "cancelled"],
  acknowledged: ["in_transit", "cancelled"],
  in_transit: ["in_process", "cancelled"],
  in_process: ["needs_revisit", "resolved", "cancelled"],
  needs_revisit: ["revisit_scheduled", "cancelled"],
  revisit_scheduled: ["in_transit", "cancelled"],
};

export function getAllowedNextStatuses(job: Pick<JobDetail, "type" | "status">): string[] {
  if (job.type === "installation") {
    return INSTALLATION_NEXT_STATUS[job.status] ?? [];
  }

  return COMPLAINT_NEXT_STATUS[job.status] ?? [];
}
