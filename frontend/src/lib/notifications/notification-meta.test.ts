import { describe, it, expect } from "vitest";
import { getNotificationMeta } from "./notification-meta";

describe("getNotificationMeta", () => {
  it("maps a known assignment event to its title/category/priority", () => {
    const meta = getNotificationMeta("job_assigned");
    expect(meta.title).toBe("Job Assigned");
    expect(meta.category).toBe("assignment");
    expect(meta.priority).toBe("normal");
    expect(meta.description.length).toBeGreaterThan(0);
  });

  it("classifies cancellation events into the cancellation category", () => {
    const meta = getNotificationMeta("cancellation_request_submitted");
    expect(meta.title).toBe("Cancellation Requested");
    expect(meta.category).toBe("cancellation");
    expect(meta.priority).toBe("medium");
  });

  it("marks chronic/high-severity events as high priority", () => {
    const meta = getNotificationMeta("third_revisit_reached");
    expect(meta.title).toBe("Chronic Job Flagged");
    expect(meta.category).toBe("other");
    expect(meta.priority).toBe("high");
  });

  it("falls back to a humanized title with normal priority for unknown events", () => {
    const meta = getNotificationMeta("mystery_event_happened");
    expect(meta).toEqual({
      title: "Mystery Event Happened",
      description: "",
      category: "other",
      priority: "normal",
    });
  });

  it("strips a dotted namespace prefix when humanizing the fallback title", () => {
    expect(getNotificationMeta("jobs.some_thing_occurred").title).toBe("Some Thing Occurred");
  });
});
