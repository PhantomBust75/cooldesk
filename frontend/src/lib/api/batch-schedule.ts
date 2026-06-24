import { apiClient } from "@/lib/api/client";

export type BatchScheduleInput = {
  jobIds: string[];
  scheduledAt: string;
  technicianId?: string;
};

export type BatchScheduleResult = {
  ok: true;
  scheduled: number;
  errors: Array<{ jobId: string; reason: string }>;
};

export function batchScheduleJobs(input: BatchScheduleInput): Promise<BatchScheduleResult> {
  return apiClient.post<BatchScheduleResult>("/jobs/batch-schedule", input);
}
