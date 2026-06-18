export const TERMINAL_STATUSES = ["completed", "resolved", "resolved_on_revisit", "cancelled"] as const;

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
