import { describe, it, expect } from "vitest";
import {
  EMPTY_CAREER_PROFILE,
  calculateProfileStrength,
  profileToCvMarkdown,
  type CareerProfile,
} from "./profile-types";
import { generateSystemInstruction } from "./prompt-utils";

describe("profile-types", () => {
  it("computes 0% strength for an empty profile and lists missing fields", () => {
    const result = calculateProfileStrength(EMPTY_CAREER_PROFILE);
    expect(result.score).toBe(0);
    expect(result.missing.length).toBeGreaterThanOrEqual(5);
  });

  it("computes 100% strength when all key sections are populated", () => {
    const full: CareerProfile = {
      ...EMPTY_CAREER_PROFILE,
      basics: { ...EMPTY_CAREER_PROFILE.basics, fullName: "Alex Mercer", headline: "Staff Engineer" },
      summary: "Experienced distributed systems and frontend engineer with 10+ years shipping web apps.",
      experience: [
        {
          id: "1",
          role: "Senior Engineer",
          company: "Acme",
          location: "London",
          startDate: "2021",
          endDate: "",
          current: true,
          highlights: ["Led platform migration reducing latency by 40%"],
        },
      ],
      skills: ["TypeScript", "React", "PostgreSQL"],
      careerStory: "Looking to lead high-trust product engineering teams focused on developer tools.",
      preferences: {
        ...EMPTY_CAREER_PROFILE.preferences,
        targetRoles: ["Staff Engineer"],
      },
    };
    const result = calculateProfileStrength(full);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it("serializes structured profile into clean Markdown", () => {
    const profile: CareerProfile = {
      ...EMPTY_CAREER_PROFILE,
      basics: { ...EMPTY_CAREER_PROFILE.basics, fullName: "Sam Taylor", headline: "Product Engineer" },
      skills: ["React", "Node.js"],
      experience: [
        {
          id: "e1",
          role: "Engineer",
          company: "Spruce Ltd",
          location: "Remote",
          startDate: "2023",
          endDate: "",
          current: true,
          highlights: ["Built job discovery engine"],
        },
      ],
    };

    const md = profileToCvMarkdown(profile);
    expect(md).toContain("# Sam Taylor");
    expect(md).toContain("## Skills");
    expect(md).toContain("React, Node.js");
    expect(md).toContain("### Engineer — Spruce Ltd (Remote)");
    expect(md).toContain("- Built job discovery engine");
  });

  it("enforces strict factual grounding in system prompt", () => {
    const instruction = generateSystemInstruction("Normal", "Middle");
    expect(instruction).toContain("STRICT FACTUAL GROUNDING");
    expect(instruction).toContain("NEVER invent");
  });
});
