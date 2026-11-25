import { callStructuredAi } from "./ai-client";
import type { ModelType } from "./types";

export interface ProfileBasics {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  highlights: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  graduationYear: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  url: string;
  technologies: string[];
}

export type WorkModePreference = "any" | "remote" | "hybrid" | "onsite";

export interface CareerPreferences {
  targetRoles: string[];
  preferredLocations: string[];
  workMode: WorkModePreference;
  minSalary: string;
  dealbreakers: string[];
  searchStatus: "actively_looking" | "preparing" | "open_passively";
}

export interface FeedbackSignal {
  id: string;
  jobTitle: string;
  company: string;
  signal: "liked" | "disliked";
  reason?: string;
  createdAt: string;
}

export interface CareerProfile {
  basics: ProfileBasics;
  summary: string;
  experience: ExperienceItem[];
  skills: string[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: string[];
  careerStory: string;
  preferences: CareerPreferences;
  feedbackMemory: FeedbackSignal[];
  rawCvText: string;
}

export const EMPTY_CAREER_PROFILE: CareerProfile = {
  basics: {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
  },
  summary: "",
  experience: [],
  skills: [],
  projects: [],
  education: [],
  certifications: [],
  careerStory: "",
  preferences: {
    targetRoles: [],
    preferredLocations: [],
    workMode: "any",
    minSalary: "",
    dealbreakers: [],
    searchStatus: "actively_looking",
  },
  feedbackMemory: [],
  rawCvText: "",
};

export interface ProfileStrength {
  score: number;
  missing: string[];
}

/**
 * Calculates a 0-100 profile completeness score (Dossier-style strength meter)
 * focusing only on fields that meaningfully improve tailoring and job matching.
 */
export function calculateProfileStrength(profile: CareerProfile): ProfileStrength {
  const checks: Array<{ ok: boolean; weight: number; label: string }> = [
    { ok: Boolean(profile.basics.fullName.trim()), weight: 10, label: "Full name" },
    { ok: Boolean(profile.basics.headline.trim()), weight: 10, label: "Headline / current title" },
    { ok: Boolean(profile.summary.trim().length >= 30), weight: 15, label: "Professional summary" },
    { ok: profile.experience.length > 0, weight: 25, label: "At least one work experience entry" },
    { ok: profile.skills.length >= 3, weight: 15, label: "At least 3 core skills" },
    { ok: profile.preferences.targetRoles.length > 0, weight: 15, label: "Target roles for Bruce" },
    { ok: Boolean(profile.careerStory.trim().length >= 20), weight: 10, label: "Career story / goals" },
  ];

  let score = 0;
  const missing: string[] = [];

  for (const c of checks) {
    if (c.ok) {
      score += c.weight;
    } else {
      missing.push(c.label);
    }
  }

  return { score, missing };
}

/**
 * Serializes the structured Master Career Profile into clean Markdown
 * that can be passed directly into Bruce's CV tailoring pipeline.
 */
export function profileToCvMarkdown(profile: CareerProfile): string {
  const lines: string[] = [];

  if (profile.basics.fullName) {
    lines.push(`# ${profile.basics.fullName}`);
  }
  if (profile.basics.headline) {
    lines.push(`**${profile.basics.headline}**`);
  }

  const contactBits = [
    profile.basics.email,
    profile.basics.phone,
    profile.basics.location,
    profile.basics.linkedinUrl,
    profile.basics.githubUrl,
    profile.basics.portfolioUrl,
  ].filter(Boolean);
  if (contactBits.length > 0) {
    lines.push(contactBits.join(" | "));
  }

  if (profile.summary.trim()) {
    lines.push("", "## Professional Summary", profile.summary.trim());
  }

  if (profile.skills.length > 0) {
    lines.push("", "## Skills", profile.skills.join(", "));
  }

  if (profile.experience.length > 0) {
    lines.push("", "## Experience");
    for (const exp of profile.experience) {
      const dates = `${exp.startDate || "?"} – ${exp.current ? "Present" : exp.endDate || "?"}`;
      lines.push(`### ${exp.role} — ${exp.company}${exp.location ? ` (${exp.location})` : ""}`);
      lines.push(`*${dates}*`);
      for (const bullet of exp.highlights.filter(Boolean)) {
        lines.push(`- ${bullet}`);
      }
      lines.push("");
    }
  }

  if (profile.projects.length > 0) {
    lines.push("## Projects");
    for (const proj of profile.projects) {
      lines.push(`- **${proj.name}**${proj.url ? ` (${proj.url})` : ""}: ${proj.description}`);
      if (proj.technologies.length > 0) {
        lines.push(`  - Tech: ${proj.technologies.join(", ")}`);
      }
    }
    lines.push("");
  }

  if (profile.education.length > 0) {
    lines.push("## Education");
    for (const edu of profile.education) {
      lines.push(
        `- **${edu.degree}${edu.field ? ` in ${edu.field}` : ""}**, ${edu.institution}${edu.graduationYear ? ` (${edu.graduationYear})` : ""}`
      );
    }
    lines.push("");
  }

  if (profile.certifications.length > 0) {
    lines.push("## Certifications", ...profile.certifications.map((c) => `- ${c}`));
  }

  const formatted = lines.join("\n").trim();
  return formatted || profile.rawCvText;
}

/**
 * Uses the user's selected AI provider to extract a structured CareerProfile
 * from raw CV text (uploaded PDF/DOCX/TXT).
 */
export async function parseCvToProfileWithAi(
  provider: ModelType,
  apiKey: string,
  rawCvText: string
): Promise<Partial<CareerProfile>> {
  const systemPrompt = `You are a precise CV parser. Extract ONLY facts explicitly present in the candidate's CV into this JSON structure:
{
  "basics": { "fullName": "", "headline": "", "email": "", "phone": "", "location": "", "linkedinUrl": "", "githubUrl": "", "portfolioUrl": "" },
  "summary": "",
  "experience": [{ "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "current": false, "highlights": [""] }],
  "skills": [""],
  "projects": [{ "name": "", "description": "", "url": "", "technologies": [""] }],
  "education": [{ "institution": "", "degree": "", "field": "", "graduationYear": "" }],
  "certifications": [""]
}
Never invent missing fields — use empty strings or empty arrays when not present.`;

  const parsed = await callStructuredAi<Partial<CareerProfile>>({
    provider,
    apiKey,
    systemPrompt,
    userPrompt: `Extract the structured profile from this CV:\n\n${rawCvText}`,
    temperature: 0.1,
  });

  return {
    ...parsed,
    experience: (parsed.experience ?? []).map((item, idx) => ({
      ...item,
      id: item.id || `exp-${Date.now()}-${idx}`,
      highlights: Array.isArray(item.highlights) ? item.highlights : [],
      current: Boolean(item.current),
    })),
    projects: (parsed.projects ?? []).map((item, idx) => ({
      ...item,
      id: item.id || `proj-${Date.now()}-${idx}`,
      technologies: Array.isArray(item.technologies) ? item.technologies : [],
    })),
    education: (parsed.education ?? []).map((item, idx) => ({
      ...item,
      id: item.id || `edu-${Date.now()}-${idx}`,
    })),
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    rawCvText,
  };
}
