export type NotificationCategory = "cancellation" | "assignment" | "other";
export type NotificationPriority = "high" | "medium" | "normal";

export type NotificationMeta = {
  title: string;
  description: string;
  category: NotificationCategory;
  priority: NotificationPriority;
};

const META: Record<string, NotificationMeta> = {
  job_assigned: {
    title: "Job Assigned",
    description: "A job has been assigned to a technician.",
    category: "assignment",
    priority: "normal",
  },
  dealer_job_submitted: {
    title: "New Dealer Job",
    description: "A dealer submitted a new job.",
    category: "other",
    priority: "normal",
  },
  no_show_flagged: {
    title: "No-Show Flagged",
    description: "A job was flagged as a customer no-show.",
    category: "other",
    priority: "high",
  },
  job_unacknowledged: {
    title: "Job Unacknowledged",
    description: "An assigned job hasn't been acknowledged yet.",
    category: "other",
    priority: "medium",
  },
  revisit_pending_scheduling: {
    title: "Revisit Pending Scheduling",
    description: "A revisit is pending scheduling.",
    category: "other",
    priority: "medium",
  },
  third_revisit_reached: {
    title: "Chronic Job Flagged",
    description: "This job has reached its 3rd revisit and has been flagged as chronic.",
    category: "other",
    priority: "high",
  },
  cancellation_request_submitted: {
    title: "Cancellation Requested",
    description: "A cancellation has been requested for a job.",
    category: "cancellation",
    priority: "medium",
  },
  cancellation_request_outcome: {
    title: "Cancellation Request Update",
    description: "There's an update on a cancellation request.",
    category: "cancellation",
    priority: "normal",
  },
  vcid_review_required: {
    title: "VCID Review Required",
    description: "A job requires VCID review.",
    category: "other",
    priority: "medium",
  },
  repeat_complaint_detected: {
    title: "Repeat Complaint Detected",
    description: "A repeat complaint has been detected for a customer.",
    category: "other",
    priority: "high",
  },
  frequent_complaint_detected: {
    title: "Frequent Complaints Detected",
    description: "Frequent complaints have been detected for a customer.",
    category: "other",
    priority: "high",
  },
  low_rating_received: {
    title: "Low Rating Received",
    description: "A customer left a low rating.",
    category: "other",
    priority: "medium",
  },
};

export function humanizeEventType(eventType: string): string {
  const withoutPrefix = eventType.includes(".")
    ? eventType.slice(eventType.indexOf(".") + 1)
    : eventType;
  return withoutPrefix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getNotificationMeta(eventType: string): NotificationMeta {
  return (
    META[eventType] ?? {
      title: humanizeEventType(eventType),
      description: "",
      category: "other",
      priority: "normal",
    }
  );
}
