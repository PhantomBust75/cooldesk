export const TERMINAL_STATUSES = ["completed", "resolved", "resolved_on_revisit", "cancelled"] as const;

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function canProgressInstallation(job: {
  type: string;
  technicianId: string | null;
  scheduledAt: string | null;
}): boolean {
  if (job.type !== "installation") return true;
  return job.technicianId !== null && job.scheduledAt !== null;
}
