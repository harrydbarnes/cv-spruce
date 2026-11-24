import { describe, it, expect } from "vitest";
import {
  isFollowUpDue,
  isApplicationStale,
  type ApplicationRecord,
} from "./application-utils";
import { parseJsonFromModel } from "./ai-client";

const baseApp = (overrides: Partial<ApplicationRecord> = {}): ApplicationRecord => ({
  id: "app-1",
  company: "Stripe",
  roleTitle: "Staff Engineer",
  location: "Remote",
  jobSpecText: "Build financial infrastructure.",
  status: "applied",
  matchingHighlights: [],
  missingSkills: [],
  tailoredCv: "",
  coverLetter: "",
  interviewQna: [],
  industryUpdates: [],
  cvVersions: [],
  chatHistory: [],
  notes: "",
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  ...overrides,
});

describe("application-utils", () => {
  it("flags due follow-ups only for active applications", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    const dueApp = baseApp({ nextFollowUpAt: "2026-11-20T00:00:00Z", status: "applied" });
    const futureApp = baseApp({ nextFollowUpAt: "2026-11-30T00:00:00Z", status: "applied" });
    const closedApp = baseApp({ nextFollowUpAt: "2026-11-20T00:00:00Z", status: "rejected" });

    expect(isFollowUpDue(dueApp, now)).toBe(true);
    expect(isFollowUpDue(futureApp, now)).toBe(false);
    expect(isFollowUpDue(closedApp, now)).toBe(false);
  });

  it("flags applied roles with no update for 7+ days as stale", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    const stale = baseApp({ status: "applied", appliedAt: "2026-11-10T12:00:00Z" });
    const fresh = baseApp({ status: "applied", appliedAt: "2026-11-22T12:00:00Z" });

    expect(isApplicationStale(stale, now)).toBe(true);
    expect(isApplicationStale(fresh, now)).toBe(false);
  });

  it("parses JSON wrapped in markdown fences cleanly", () => {
    const parsed = parseJsonFromModel<{ ok: boolean }>('```json\n{"ok": true}\n```');
    expect(parsed.ok).toBe(true);
  });
});
