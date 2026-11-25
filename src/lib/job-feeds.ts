import { callStructuredAi } from "./ai-client";
import type { CareerProfile } from "./profile-types";
import type { ModelType } from "./types";

export type JobSource =
  | "remotive"
  | "arbeitnow"
  | "hn_yc"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "adzuna"
  | "reed"
  | "jsearch";

export type JobFeedback = "liked" | "disliked" | "saved" | "hidden";

export interface JobWatcher {
  id: string;
  name: string;
  source: JobSource;
  query: string;
  companySlug?: string;
  location?: string;
  remoteOnly: boolean;
  enabled: boolean;
  lastRunAt?: string;
}

export interface DiscoveredJob {
  id: string;
  watcherId?: string;
  externalId: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary?: string;
  url: string;
  description: string;
  tags: string[];
  matchScore?: number;
  matchReasons: string[];
  skillGaps: string[];
  feedback?: JobFeedback;
  feedbackNote?: string;
  postedAt?: string;
  discoveredAt: string;
}

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  remotive: "Remotive (Remote)",
  arbeitnow: "Arbeitnow (EU / UK Remote)",
  hn_yc: "HN / YC Who is Hiring",
  greenhouse: "Greenhouse Company Board",
  lever: "Lever Company Board",
  ashby: "Ashby Company Board (UK/Global Startups)",
  adzuna: "Adzuna UK (GBP / Free API Key)",
  reed: "Reed.co.uk (UK / Free API Key)",
  jsearch: "JSearch / LinkedIn & Indeed (BYOK)",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const terms = q.split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return terms.some((t) => hay.includes(t));
}

export async function fetchRemotiveJobs(query: string, limit = 20): Promise<DiscoveredJob[]> {
  const url = `https://remotive.com/api/remote-jobs?limit=${limit}${
    query.trim() ? `&search=${encodeURIComponent(query.trim())}` : ""
  }`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Remotive API error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.jobs) ? data.jobs : [];
  const now = new Date().toISOString();

  return list.slice(0, limit).map((item: Record<string, unknown>) => ({
    id: `remotive-${String(item.id)}`,
    externalId: String(item.id),
    source: "remotive" as const,
    title: String(item.title ?? "Untitled Role"),
    company: String(item.company_name ?? "Unknown Company"),
    location: String(item.candidate_required_location ?? "Remote"),
    remote: true,
    salary: item.salary ? String(item.salary) : undefined,
    url: String(item.url ?? ""),
    description: stripHtml(String(item.description ?? "")),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    matchReasons: [],
    skillGaps: [],
    postedAt: item.publication_date ? String(item.publication_date) : undefined,
    discoveredAt: now,
  }));
}

export async function fetchArbeitnowJobs(query: string, limit = 20): Promise<DiscoveredJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!res.ok) throw new Error(`Arbeitnow API error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.data) ? data.data : [];
  const now = new Date().toISOString();

  return list
    .filter((item: Record<string, unknown>) =>
      matchesQuery(
        `${item.title ?? ""} ${item.company_name ?? ""} ${item.description ?? ""} ${
          Array.isArray(item.tags) ? item.tags.join(" ") : ""
        }`,
        query
      )
    )
    .slice(0, limit)
    .map((item: Record<string, unknown>) => ({
      id: `arbeitnow-${String(item.slug)}`,
      externalId: String(item.slug),
      source: "arbeitnow" as const,
      title: String(item.title ?? "Untitled Role"),
      company: String(item.company_name ?? "Unknown Company"),
      location: String(item.location ?? "Europe"),
      remote: Boolean(item.remote),
      url: String(item.url ?? ""),
      description: stripHtml(String(item.description ?? "")),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      matchReasons: [],
      skillGaps: [],
      postedAt: item.created_at
        ? new Date(Number(item.created_at) * 1000).toISOString()
        : undefined,
      discoveredAt: now,
    }));
}

export async function fetchHackerNewsHiringJobs(
  query: string,
  limit = 20
): Promise<DiscoveredJob[]> {
  // Find latest "Ask HN: Who is hiring?" story via Algolia
  const storyRes = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
      "Ask HN: Who is hiring?"
    )}&tags=story,author_whoishiring&hitsPerPage=1`
  );
  if (!storyRes.ok) throw new Error(`HN Algolia API error (${storyRes.status})`);
  const storyData = await storyRes.json();
  const storyId = storyData?.hits?.[0]?.objectID;
  if (!storyId) return [];

  const commentsUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=${limit}${
    query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ""
  }`;
  const commentsRes = await fetch(commentsUrl);
  if (!commentsRes.ok) throw new Error(`HN comments API error (${commentsRes.status})`);
  const commentsData = await commentsRes.json();
  const hits = Array.isArray(commentsData.hits) ? commentsData.hits : [];
  const now = new Date().toISOString();

  return hits
    .filter((hit: Record<string, unknown>) => Boolean(hit.comment_text))
    .slice(0, limit)
    .map((hit: Record<string, unknown>) => {
      const text = stripHtml(String(hit.comment_text ?? ""));
      const firstLine = text.split("\n")[0] ?? "";
      const segments = firstLine.split("|").map((s) => s.trim()).filter(Boolean);
      const company = segments[0]?.slice(0, 60) || "YC / HN Startup";
      const title = segments[1]?.slice(0, 90) || "Engineering / Product Role";
      const location = segments[2]?.slice(0, 60) || (text.toLowerCase().includes("remote") ? "Remote" : "See post");
      return {
        id: `hn_yc-${String(hit.objectID)}`,
        externalId: String(hit.objectID),
        source: "hn_yc" as const,
        title,
        company,
        location,
        remote: /remote/i.test(firstLine) || /\bremote\b/i.test(text.slice(0, 300)),
        url: `https://news.ycombinator.com/item?id=${String(hit.objectID)}`,
        description: text,
        tags: ["YC / HN"],
        matchReasons: [],
        skillGaps: [],
        postedAt: hit.created_at ? String(hit.created_at) : undefined,
        discoveredAt: now,
      };
    });
}

export async function fetchGreenhouseJobs(
  companySlug: string,
  query: string,
  limit = 25
): Promise<DiscoveredJob[]> {
  const slug = companySlug.trim().toLowerCase();
  if (!slug) throw new Error("Greenhouse watcher requires a company slug (e.g. 'stripe').");

  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`
  );
  if (!res.ok) throw new Error(`Greenhouse board "${slug}" error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.jobs) ? data.jobs : [];
  const now = new Date().toISOString();

  return list
    .filter((item: Record<string, unknown>) => {
      const loc = (item.location as { name?: string } | undefined)?.name ?? "";
      return matchesQuery(`${item.title ?? ""} ${loc} ${item.content ?? ""}`, query);
    })
    .slice(0, limit)
    .map((item: Record<string, unknown>) => {
      const loc = (item.location as { name?: string } | undefined)?.name ?? "See posting";
      return {
        id: `greenhouse-${slug}-${String(item.id)}`,
        externalId: `${slug}-${String(item.id)}`,
        source: "greenhouse" as const,
        title: String(item.title ?? "Untitled Role"),
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        remote: /remote/i.test(loc),
        url: String(item.absolute_url ?? ""),
        description: stripHtml(String(item.content ?? "")),
        tags: ["Greenhouse"],
        matchReasons: [],
        skillGaps: [],
        postedAt: item.updated_at ? String(item.updated_at) : undefined,
        discoveredAt: now,
      };
    });
}

export async function fetchLeverJobs(
  companySlug: string,
  query: string,
  limit = 25
): Promise<DiscoveredJob[]> {
  const slug = companySlug.trim().toLowerCase();
  if (!slug) throw new Error("Lever watcher requires a company slug (e.g. 'netflix').");

  const res = await fetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`
  );
  if (!res.ok) throw new Error(`Lever board "${slug}" error (${res.status})`);
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  const now = new Date().toISOString();

  return list
    .filter((item: Record<string, unknown>) => {
      const categories = (item.categories as Record<string, string> | undefined) ?? {};
      return matchesQuery(
        `${item.text ?? ""} ${categories.location ?? ""} ${categories.team ?? ""} ${
          item.descriptionPlain ?? ""
        }`,
        query
      );
    })
    .slice(0, limit)
    .map((item: Record<string, unknown>) => {
      const categories = (item.categories as Record<string, string> | undefined) ?? {};
      const loc = categories.location ?? "See posting";
      return {
        id: `lever-${slug}-${String(item.id)}`,
        externalId: `${slug}-${String(item.id)}`,
        source: "lever" as const,
        title: String(item.text ?? "Untitled Role"),
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        remote: /remote/i.test(loc) || /remote/i.test(String(item.workplaceType ?? "")),
        url: String(item.hostedUrl ?? ""),
        description: String(item.descriptionPlain ?? stripHtml(String(item.description ?? ""))),
        tags: [categories.team, categories.commitment].filter(Boolean) as string[],
        matchReasons: [],
        skillGaps: [],
        postedAt: item.createdAt ? new Date(Number(item.createdAt)).toISOString() : undefined,
        discoveredAt: now,
      };
    });
}

export async function fetchAshbyJobs(
  companySlug: string,
  query: string,
  limit = 25
): Promise<DiscoveredJob[]> {
  const slug = companySlug.trim();
  if (!slug) throw new Error("Ashby watcher requires a company board slug (e.g. 'incident.io', 'synthesia').");

  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`
  );
  if (!res.ok) throw new Error(`Ashby board "${slug}" error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.jobs) ? data.jobs : [];
  const now = new Date().toISOString();

  return list
    .filter((item: Record<string, unknown>) =>
      matchesQuery(
        `${item.title ?? ""} ${item.location ?? ""} ${item.department ?? ""} ${
          item.descriptionPlain ?? item.descriptionHtml ?? ""
        }`,
        query
      )
    )
    .slice(0, limit)
    .map((item: Record<string, unknown>) => {
      const loc = String(item.location ?? "See posting");
      const workplace = String(item.workplaceType ?? "");
      return {
        id: `ashby-${slug}-${String(item.id)}`,
        externalId: `${slug}-${String(item.id)}`,
        source: "ashby" as const,
        title: String(item.title ?? "Untitled Role"),
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: loc,
        remote: Boolean(item.isRemote) || /remote/i.test(loc) || /remote/i.test(workplace),
        url: String(item.jobUrl ?? item.applyUrl ?? ""),
        description: String(item.descriptionPlain ?? stripHtml(String(item.descriptionHtml ?? ""))),
        tags: [item.department, item.employmentType].filter(Boolean).map(String),
        matchReasons: [],
        skillGaps: [],
        postedAt: item.publishedAt ? String(item.publishedAt) : undefined,
        discoveredAt: now,
      };
    });
}

export const ADZUNA_APP_ID_KEY = "cv-spruce-adzuna-app-id";
export const ADZUNA_APP_KEY_KEY = "cv-spruce-adzuna-app-key";

export async function fetchAdzunaUkJobs(
  query: string,
  location = "",
  limit = 20
): Promise<DiscoveredJob[]> {
  const appId = typeof window !== "undefined" ? localStorage.getItem(ADZUNA_APP_ID_KEY) || "" : "";
  const appKey = typeof window !== "undefined" ? localStorage.getItem(ADZUNA_APP_KEY_KEY) || "" : "";

  if (!appId.trim() || !appKey.trim()) {
    throw new Error(
      "Adzuna UK requires a free App ID & App Key — add them under Discover → UK Job Board Keys."
    );
  }

  const params = new URLSearchParams({
    app_id: appId.trim(),
    app_key: appKey.trim(),
    results_per_page: String(limit),
    what: query.trim() || "software engineer",
  });
  if (location.trim()) {
    params.set("where", location.trim());
  }

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/gb/search/1?${params.toString()}`);
  if (!res.ok) throw new Error(`Adzuna UK API error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.results) ? data.results : [];
  const now = new Date().toISOString();

  return list.slice(0, limit).map((item: Record<string, unknown>) => {
    const companyObj = (item.company as { display_name?: string } | undefined) ?? {};
    const locObj = (item.location as { display_name?: string } | undefined) ?? {};
    const minSal = typeof item.salary_min === "number" ? Math.round(item.salary_min) : null;
    const maxSal = typeof item.salary_max === "number" ? Math.round(item.salary_max) : null;
    const salary =
      minSal && maxSal
        ? `£${minSal.toLocaleString()} – £${maxSal.toLocaleString()}`
        : minSal
          ? `From £${minSal.toLocaleString()}`
          : undefined;

    const title = String(item.title ?? "Untitled Role");
    const desc = stripHtml(String(item.description ?? ""));
    const loc = locObj.display_name ?? "United Kingdom";

    return {
      id: `adzuna-${String(item.id)}`,
      externalId: String(item.id),
      source: "adzuna" as const,
      title,
      company: companyObj.display_name ?? "UK Employer",
      location: loc,
      remote: /\bremote\b/i.test(`${title} ${loc} ${desc}`),
      salary,
      url: String(item.redirect_url ?? ""),
      description: desc,
      tags: ["Adzuna UK"],
      matchReasons: [],
      skillGaps: [],
      postedAt: item.created ? String(item.created) : undefined,
      discoveredAt: now,
    };
  });
}

export const REED_API_KEY_KEY = "cv-spruce-reed-api-key";

export async function fetchReedUkJobs(
  query: string,
  location = "",
  limit = 20
): Promise<DiscoveredJob[]> {
  const apiKey = typeof window !== "undefined" ? localStorage.getItem(REED_API_KEY_KEY) || "" : "";
  if (!apiKey.trim()) {
    throw new Error(
      "Reed.co.uk requires a free Reed API key — add it under Discover → UK Job Board Keys."
    );
  }

  const params = new URLSearchParams({
    resultsToTake: String(limit),
    keywords: query.trim() || "software engineer",
  });
  if (location.trim()) {
    params.set("locationName", location.trim());
  }

  const authHeader = `Basic ${btoa(`${apiKey.trim()}:`)}`;
  const res = await fetch(`https://www.reed.co.uk/api/1.0/search?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
    },
  });
  if (!res.ok) throw new Error(`Reed.co.uk API error (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.results) ? data.results : [];
  const now = new Date().toISOString();

  return list.slice(0, limit).map((item: Record<string, unknown>) => {
    const minSal = typeof item.minimumSalary === "number" ? Math.round(item.minimumSalary) : null;
    const maxSal = typeof item.maximumSalary === "number" ? Math.round(item.maximumSalary) : null;
    const salary =
      minSal && maxSal
        ? `£${minSal.toLocaleString()} – £${maxSal.toLocaleString()}`
        : minSal
          ? `From £${minSal.toLocaleString()}`
          : undefined;
    const title = String(item.jobTitle ?? "Untitled Role");
    const desc = stripHtml(String(item.jobDescription ?? ""));
    const loc = String(item.locationName ?? "United Kingdom");

    return {
      id: `reed-${String(item.jobId)}`,
      externalId: String(item.jobId),
      source: "reed" as const,
      title,
      company: String(item.employerName ?? "UK Employer"),
      location: loc,
      remote: /\bremote\b/i.test(`${title} ${loc} ${desc}`),
      salary,
      url: String(item.jobUrl ?? ""),
      description: desc,
      tags: ["Reed UK"],
      matchReasons: [],
      skillGaps: [],
      postedAt: item.date ? String(item.date) : undefined,
      discoveredAt: now,
    };
  });
}

export async function fetchJobsForWatcher(watcher: JobWatcher): Promise<DiscoveredJob[]> {
  let jobs: DiscoveredJob[] = [];
  switch (watcher.source) {
    case "remotive":
      jobs = await fetchRemotiveJobs(watcher.query);
      break;
    case "arbeitnow":
      jobs = await fetchArbeitnowJobs(watcher.query);
      break;
    case "hn_yc":
      jobs = await fetchHackerNewsHiringJobs(watcher.query);
      break;
    case "greenhouse":
      jobs = await fetchGreenhouseJobs(watcher.companySlug || "", watcher.query);
      break;
    case "lever":
      jobs = await fetchLeverJobs(watcher.companySlug || "", watcher.query);
      break;
    case "ashby":
      jobs = await fetchAshbyJobs(watcher.companySlug || "", watcher.query);
      break;
    case "adzuna":
      jobs = await fetchAdzunaUkJobs(watcher.query, watcher.location || "");
      break;
    case "reed":
      jobs = await fetchReedUkJobs(watcher.query, watcher.location || "");
      break;
    default:
      jobs = [];
  }

  return jobs
    .filter((j) => (!watcher.remoteOnly ? true : j.remote))
    .map((j) => ({ ...j, watcherId: watcher.id }));
}

export function deduplicateJobs(jobs: DiscoveredJob[]): DiscoveredJob[] {
  const seen = new Map<string, DiscoveredJob>();
  for (const job of jobs) {
    const key = `${job.source}:${job.externalId}`;
    if (!seen.has(key)) {
      seen.set(key, job);
    }
  }
  return Array.from(seen.values());
}

/**
 * Fast local heuristic match scorer combining Master Career Profile skills,
 * target roles, work-mode preferences, dealbreakers, and Bruce feedback memory.
 */
export function computeHeuristicMatchScore(
  job: DiscoveredJob,
  profile: CareerProfile
): Pick<DiscoveredJob, "matchScore" | "matchReasons" | "skillGaps"> {
  const haystack = `${job.title} ${job.company} ${job.location} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  let score = 45;
  const reasons: string[] = [];
  const gaps: string[] = [];

  // Target roles check
  const matchedRoles = profile.preferences.targetRoles.filter((role) =>
    titleLower.includes(role.toLowerCase()) || haystack.includes(role.toLowerCase())
  );
  if (matchedRoles.length > 0) {
    score += 20;
    reasons.push(`Matches target role: ${matchedRoles[0]}`);
  }

  // Skills overlap
  if (profile.skills.length > 0) {
    const matchedSkills = profile.skills.filter((s) =>
      haystack.includes(s.toLowerCase())
    );
    const ratio = matchedSkills.length / Math.min(profile.skills.length, 8);
    score += Math.round(Math.min(25, ratio * 25));
    if (matchedSkills.length > 0) {
      reasons.push(`Skills matched: ${matchedSkills.slice(0, 4).join(", ")}`);
    } else {
      gaps.push("Low direct skill keyword overlap with profile");
    }
  }

  // Work mode preference
  if (profile.preferences.workMode === "remote") {
    if (job.remote) {
      score += 8;
      reasons.push("Matches Remote preference");
    } else {
      score -= 15;
      gaps.push("May not be fully remote");
    }
  }

  // Dealbreakers penalty
  const triggeredDealbreakers = profile.preferences.dealbreakers.filter((db) =>
    haystack.includes(db.toLowerCase())
  );
  if (triggeredDealbreakers.length > 0) {
    score -= 30;
    gaps.push(`Dealbreaker mentioned: ${triggeredDealbreakers.join(", ")}`);
  }

  // Feedback memory bias (Jack & Jill preference loop)
  for (const fb of profile.feedbackMemory.slice(0, 20)) {
    const fbCompanyMatch = fb.company.toLowerCase() === job.company.toLowerCase();
    const fbTitleToken = fb.jobTitle.toLowerCase().split(/\s+/).find((w) => w.length > 4);
    const fbTitleMatch = fbTitleToken ? titleLower.includes(fbTitleToken) : false;

    if (fb.signal === "liked" && (fbCompanyMatch || fbTitleMatch)) {
      score += 5;
      if (reasons.length < 4) reasons.push(`Similar to roles you liked (${fb.jobTitle})`);
      break;
    }
    if (fb.signal === "disliked" && (fbCompanyMatch || fbTitleMatch)) {
      score -= 10;
      if (gaps.length < 4) gaps.push(`Similar to role you passed on (${fb.jobTitle})`);
      break;
    }
  }

  const clamped = Math.max(5, Math.min(99, score));
  return {
    matchScore: clamped,
    matchReasons: reasons.slice(0, 4),
    skillGaps: gaps.slice(0, 4),
  };
}

/**
 * Optional deep AI batch scoring via Bruce using the user's API key.
 */
export async function scoreJobsWithAi(
  provider: ModelType,
  apiKey: string,
  jobs: DiscoveredJob[],
  profile: CareerProfile,
  modelId?: string,
  thinkingLevel?: "auto" | "low" | "medium" | "high"
): Promise<Map<string, { matchScore: number; matchReasons: string[]; skillGaps: string[] }>> {
  const sample = jobs.slice(0, 12).map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    remote: j.remote,
    excerpt: j.description.slice(0, 600),
  }));

  const systemPrompt = `You are Bruce, the CV Spruce career agent. Score each job 0-100 against the candidate's verified profile, career story, preferences, and past thumbs-up/down feedback.
Return JSON:
{
  "scores": [
    { "id": "job_id", "matchScore": 84, "matchReasons": ["..."], "skillGaps": ["..."] }
  ]
}`;

  const userPrompt = JSON.stringify({
    candidate: {
      headline: profile.basics.headline,
      summary: profile.summary,
      skills: profile.skills,
      careerStory: profile.careerStory,
      preferences: profile.preferences,
      recentFeedback: profile.feedbackMemory.slice(0, 10),
    },
    jobs: sample,
  });

  const res = await callStructuredAi<{
    scores: Array<{
      id: string;
      matchScore: number;
      matchReasons: string[];
      skillGaps: string[];
    }>;
  }>({
    provider,
    modelId,
    thinkingLevel,
    apiKey,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });

  const map = new Map<string, { matchScore: number; matchReasons: string[]; skillGaps: string[] }>();
  for (const item of res.scores ?? []) {
    map.set(item.id, {
      matchScore: Math.max(0, Math.min(100, Math.round(Number(item.matchScore) || 50))),
      matchReasons: Array.isArray(item.matchReasons) ? item.matchReasons : [],
      skillGaps: Array.isArray(item.skillGaps) ? item.skillGaps : [],
    });
  }
  return map;
}
