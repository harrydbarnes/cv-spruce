import { describe, it, expect } from "vitest";
import {
  stripHtml,
  deduplicateJobs,
  computeHeuristicMatchScore,
  type DiscoveredJob,
} from "./job-feeds";
import { EMPTY_CAREER_PROFILE, type CareerProfile } from "./profile-types";

const makeJob = (overrides: Partial<DiscoveredJob> = {}): DiscoveredJob => ({
  id: "remotive-1",
  externalId: "1",
  source: "remotive",
  title: "Senior Frontend Engineer",
  company: "Linear",
  location: "Remote",
  remote: true,
  url: "https://example.com/job/1",
  description: "We are looking for a Senior Frontend Engineer with TypeScript, React, and Tailwind.",
  tags: ["TypeScript", "React"],
  matchReasons: [],
  skillGaps: [],
  discoveredAt: "2026-11-24T12:00:00Z",
  ...overrides,
});

describe("job-feeds", () => {
  it("strips HTML tags and decodes common entities cleanly", () => {
    const clean = stripHtml("<p>Hello &amp; <strong>world</strong><br/>Line 2</p>");
    expect(clean).toContain("Hello & world");
    expect(clean).toContain("Line 2");
    expect(clean).not.toContain("<p>");
  });

  it("deduplicates jobs by source + externalId while preserving first occurrence", () => {
    const a = makeJob({ id: "1", source: "remotive", externalId: "42", title: "First" });
    const b = makeJob({ id: "2", source: "remotive", externalId: "42", title: "Duplicate" });
    const c = makeJob({ id: "3", source: "greenhouse", externalId: "42", title: "Other Source" });

    const deduped = deduplicateJobs([a, b, c]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe("First");
    expect(deduped[1].title).toBe("Other Source");
  });

  it("scores strong skill/role/remote matches higher and penalizes dealbreakers", () => {
    const profile: CareerProfile = {
      ...EMPTY_CAREER_PROFILE,
      skills: ["TypeScript", "React", "Tailwind", "Node.js"],
      preferences: {
        ...EMPTY_CAREER_PROFILE.preferences,
        targetRoles: ["Frontend Engineer"],
        workMode: "remote",
        dealbreakers: ["crypto"],
      },
    };

    const goodJob = makeJob();
    const badJob = makeJob({
      id: "remotive-2",
      externalId: "2",
      title: "Blockchain Architect",
      remote: false,
      description: "On-site only crypto web3 protocol role using Solidity.",
    });

    const goodScore = computeHeuristicMatchScore(goodJob, profile);
    const badScore = computeHeuristicMatchScore(badJob, profile);

    expect(goodScore.matchScore!).toBeGreaterThan(75);
    expect(goodScore.matchReasons.length).toBeGreaterThan(0);
    expect(badScore.matchScore!).toBeLessThan(goodScore.matchScore!);
    expect(badScore.skillGaps.some((g) => g.toLowerCase().includes("dealbreaker"))).toBe(true);
  });
});
