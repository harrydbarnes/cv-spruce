import { callStructuredAi } from "./ai-client";
import type { IndustryUpdate, ModelType } from "./types";

export type ApplicationStatus =
  | "saved"
  | "drafting"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "archived";

export interface CvVersionSnapshot {
  id: string;
  label: string;
  tailoredCv: string;
  coverLetter: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  jobId?: string;
  company: string;
  roleTitle: string;
  location: string;
  salary?: string;
  jobUrl?: string;
  jobSpecText: string;
  status: ApplicationStatus;
  matchPercentage?: number;
  matchingHighlights: string[];
  missingSkills: string[];
  tailoredCv: string;
  coverLetter: string;
  interviewQna: Array<{ question: string; answer: string }>;
  industryUpdates: IndustryUpdate[];
  cvVersions: CvVersionSnapshot[];
  chatHistory: ChatMessage[];
  notes: string;
  appliedAt?: string;
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const APPLICATION_STATUS_META: Array<{
  id: ApplicationStatus;
  label: string;
  description: string;
}> = [
  { id: "saved", label: "Saved", description: "Bookmarked roles to review" },
  { id: "drafting", label: "Drafting", description: "Tailoring CV & cover letter" },
  { id: "applied", label: "Applied", description: "Submitted & waiting" },
  { id: "interviewing", label: "Interviewing", description: "Active stages" },
  { id: "offer", label: "Offer", description: "Offer received" },
  { id: "rejected", label: "Rejected", description: "Closed / unsuccessful" },
  { id: "archived", label: "Archived", description: "Paused or withdrawn" },
];

/**
 * Returns true if the application has a follow-up date that is due now or overdue.
 */
export function isFollowUpDue(app: ApplicationRecord, now = new Date()): boolean {
  if (!app.nextFollowUpAt) return false;
  if (app.status === "archived" || app.status === "rejected" || app.status === "offer") {
    return false;
  }
  const dueTime = new Date(app.nextFollowUpAt).getTime();
  return !Number.isNaN(dueTime) && dueTime <= now.getTime();
}

/**
 * Returns true if an 'applied' role has had no status update for >= 7 days.
 */
export function isApplicationStale(
  app: ApplicationRecord,
  now = new Date(),
  staleDays = 7
): boolean {
  if (app.status !== "applied") return false;
  const ref = app.appliedAt || app.updatedAt;
  const diffMs = now.getTime() - new Date(ref).getTime();
  return diffMs >= staleDays * 24 * 60 * 60 * 1000;
}

/**
 * Refines either the tailored CV or cover letter via Bruce chat while strictly
 * remaining grounded in the candidate's verified profile facts.
 */
export async function refineDocumentWithBruce(params: {
  provider: ModelType;
  apiKey: string;
  target: "cv" | "cover_letter";
  currentDocument: string;
  masterProfileText: string;
  jobSpecText: string;
  userInstruction: string;
}): Promise<{ updatedDocument: string; reply: string }> {
  const docLabel = params.target === "cv" ? "Tailored CV" : "Cover Letter";
  const systemPrompt = `You are Bruce, the CV Spruce career agent. The user wants to refine their ${docLabel} for a specific job application.
STRICT FACTUAL GROUNDING: Never invent roles, companies, dates, degrees, metrics, or skills not present in <verified_profile>.
Use UK English spelling.
Return JSON:
{
  "updatedDocument": "Full updated ${docLabel} in clean Markdown",
  "reply": "Brief 1-2 sentence confirmation explaining what you changed"
}`;

  const userPrompt = `<verified_profile>
${params.masterProfileText}
</verified_profile>

<job_specification>
${params.jobSpecText.slice(0, 6000)}
</job_specification>

<current_${params.target}>
${params.currentDocument}
</current_${params.target}>

<user_instruction>
${params.userInstruction}
</user_instruction>`;

  return callStructuredAi<{ updatedDocument: string; reply: string }>({
    provider: params.provider,
    apiKey: params.apiKey,
    systemPrompt,
    userPrompt,
    temperature: 0.4,
  });
}

/**
 * Triggers a clean browser download of a Markdown file.
 */
export function downloadMarkdownFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts basic Markdown into clean semantic HTML for ATS-friendly PDF printing.
 */
function markdownToPrintHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const formatInline = (text: string) =>
    escape(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h3>${formatInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h2>${formatInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h1>${formatInline(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInline(line.slice(2))}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<p>${formatInline(line)}</p>`);
    }
  }

  if (inList) out.push("</ul>");
  return out.join("\n");
}

export type PdfTheme = "classic" | "modern" | "compact" | "executive";

export const PDF_THEME_OPTIONS: Array<{ id: PdfTheme; label: string; description: string }> = [
  { id: "classic", label: "Classic ATS", description: "Clean sans-serif, crisp section dividers" },
  { id: "modern", label: "Modern Minimal", description: "Generous spacing, subtle accent bar" },
  { id: "compact", label: "Technical Compact", description: "Dense 1-page layout for engineers" },
  { id: "executive", label: "Executive Serif", description: "Editorial Georgia/serif typography" },
];

const PDF_THEME_CSS: Record<PdfTheme, string> = {
  classic: `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.45; }
    h1 { font-size: 18pt; margin: 0 0 4px; letter-spacing: -0.01em; }
    h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #d4d4d4; padding-bottom: 3px; margin: 16px 0 8px; }
    h3 { font-size: 10.5pt; margin: 10px 0 2px; }
  `,
  modern: `
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18181b; font-size: 10pt; line-height: 1.55; }
    h1 { font-size: 20pt; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; border-left: 4px solid #111827; padding-left: 10px; }
    h2 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #3f3f46; margin: 18px 0 8px; }
    h3 { font-size: 10.5pt; font-weight: 600; margin: 10px 0 2px; }
  `,
  compact: `
    @page { margin: 11mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 9.5pt; line-height: 1.35; }
    h1 { font-size: 15.5pt; margin: 0 0 2px; }
    h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin: 11px 0 5px; }
    h3 { font-size: 9.8pt; margin: 7px 0 1px; }
    ul { margin: 2px 0 6px; padding-left: 15px; }
    li { margin-bottom: 2px; }
  `,
  executive: `
    body { font-family: Georgia, "Times New Roman", Times, serif; color: #1c1917; font-size: 10.5pt; line-height: 1.5; }
    h1 { font-size: 20pt; font-weight: normal; text-align: center; margin: 0 0 6px; letter-spacing: 0.02em; }
    h2 { font-size: 11pt; font-variant: small-caps; letter-spacing: 0.08em; border-bottom: 1px solid #a8a29e; padding-bottom: 3px; margin: 16px 0 8px; }
    h3 { font-size: 10.5pt; font-weight: bold; margin: 10px 0 2px; }
  `,
};

/**
 * Drafts a fact-grounded answer to a custom ATS application question
 * (e.g. "Why do you want to work here?" or "Tell us about a complex problem you solved").
 */
export async function draftApplicationAnswerWithBruce(params: {
  provider: ModelType;
  apiKey: string;
  question: string;
  company: string;
  roleTitle: string;
  masterProfileText: string;
  careerStory: string;
  jobSpecText: string;
  tone?: "concise" | "detailed";
}): Promise<{ answer: string; keyPointsUsed: string[] }> {
  const lengthHint =
    params.tone === "detailed"
      ? "2-3 well-structured paragraphs (approx. 180-250 words)"
      : "1 concise, high-impact paragraph (approx. 80-130 words)";

  const systemPrompt = `You are Bruce, the CV Spruce career agent. Draft an authentic, human-sounding answer to a job application screening question for ${params.roleTitle} at ${params.company}.
STRICT FACTUAL GROUNDING: Only cite projects, roles, achievements, and skills explicitly present in <verified_profile> or <career_story>. Never invent experience.
Length: ${lengthHint}. Use UK English spelling. Avoid cliché AI phrasing.
Return JSON:
{
  "answer": "The ready-to-paste answer text",
  "keyPointsUsed": ["2-3 short bullets of which verified facts were highlighted"]
}`;

  const userPrompt = `<question>
${params.question}
</question>

<verified_profile>
${params.masterProfileText}
</verified_profile>

<career_story>
${params.careerStory}
</career_story>

<job_specification>
${params.jobSpecText.slice(0, 5000)}
</job_specification>`;

  return callStructuredAi<{ answer: string; keyPointsUsed: string[] }>({
    provider: params.provider,
    apiKey: params.apiKey,
    systemPrompt,
    userPrompt,
    temperature: 0.5,
  });
}

/**
 * Opens an ATS-friendly monochrome print sheet so the user can Save as PDF
 * cleanly without any site chrome or neon background colors.
 */
export function printCleanDocument(
  title: string,
  markdownContent: string,
  theme: PdfTheme = "classic"
) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=850,height=1000");
  if (!win) return;

  const bodyHtml = markdownToPrintHtml(markdownContent);
  const safeTitle = title.replace(/[<>&"]/g, "");

  win.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { margin: 16mm; }
    body {
      background: #fff;
      max-width: 780px;
      margin: 0 auto;
      padding: 24px;
    }
    p { margin: 4px 0 8px; }
    ul { margin: 4px 0 10px; padding-left: 18px; }
    li { margin-bottom: 3px; }
    ${PDF_THEME_CSS[theme]}
  </style>
</head>
<body>
  ${bodyHtml}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
