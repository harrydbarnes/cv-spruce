# CV Spruce 🌲

Welcome to **CV Spruce** — your AI-powered career co-pilot, featuring **Bruce**, the CV Spruce agent.

Use it **instantly with zero login** in Guest/Local Mode (preserving the original 1-screen Quick Tailor experience), or connect **Supabase** for multi-device accounts, cloud sync, and automated daily job scanning.

## Features ✨

* **Quick Tailor (`/`)**: The classic instant CV Spruce experience — upload a CV (or load from your Master Profile), paste/fetch a job spec, pick **Gemini 2.5 Flash**, **Claude Sonnet 4**, or **GPT-4o**, and get a match score, skill gaps, tailored CV, cover letter, interview Q&As, and industry updates.
* **Master Career Profile (`/profile`)**:
  * One verified source of truth with a **Profile Strength Meter**.
  * **1-Click CV Import**: Upload PDF/DOCX/TXT and let Bruce extract structured roles, skills, and education.
  * **Bruce's Career Brief & Preferences**: Share your career story, target roles, work mode, salary floor, and dealbreakers — plus inspect what Bruce learns from your 👍/👎 job ratings.
  * **Strict Factual Grounding**: Bruce never invents experience, roles, or metrics and honestly surfaces missing requirements as gaps.
* **Automated Job Discovery (`/discover`)**:
  * Watch open job feeds (**Remotive**, **Arbeitnow**, **Hacker News / YC Who is Hiring**) and any target company's **Greenhouse** or **Lever** career board slug (e.g. `stripe`, `linear`, `monzo`).
  * Instant local match scoring + optional deep **Bruce AI Re-Ranking**.
  * Rate roles with **More like this / Pass** to sharpen Bruce's ranking loop, or click **Spruce & Apply** for 1-click application prep.
* **Application Monitoring Board & Bespoke Studio (`/board`, `/applications/:id`)**:
  * Kanban pipeline (`Saved` → `Drafting` → `Applied` → `Interviewing` → `Offer` / `Archived`) with KPI strip, follow-up date reminders, and 7-day stale-application nudges.
  * **1-Click Bespoke Kit**: Generate a fact-grounded CV, cover letter, and interview Q&A per role.
  * **Refine with Bruce Chat**: Iterate conversationally with automatic version history & 1-click restore.
  * **Clean ATS-Friendly PDF & Markdown Export**: Print-styled monochrome PDF export and `.md` download.
* **Optional Cloud Accounts & Scheduled Scanning**:
  * Powered by **Supabase** (Auth + PostgreSQL with Row-Level Security + Edge Functions + `pg_cron`).
  * Gracefully runs in **Local-First Guest Mode** whenever Supabase environment variables are omitted.

## Getting Started 🚀

```sh
# 1. Clone the repository
git clone https://github.com/harrydbarnes/cv-spruce.git
cd cv-spruce

# 2. Install dependencies (Bun)
bun install

# 3. Start the dev server
bun run dev
```

### Verification Commands

```sh
bun run typecheck   # TypeScript strict check
bun run lint        # ESLint
bun run test        # Vitest unit & component tests
bun run build       # Production bundle
```

## Enabling Cloud Accounts & Daily Job Scanning (Optional) ☁️

1. Create a free [Supabase](https://supabase.com/) project.
2. Run [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) in the Supabase SQL Editor (creates `career_profiles`, `job_watchers`, `discovered_jobs`, and `applications` with strict RLS).
3. Copy `.env.example` to `.env` and set:
   ```env
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
   For GitHub Pages deployments, add those two keys as **Repository Secrets** (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
4. (Optional) Deploy the Edge Functions for daily `pg_cron` scanning and server-side URL extraction:
   ```sh
   supabase functions deploy job-scanner
   supabase functions deploy fetch-job-url
   ```

## Tech Stack 🛠️

* **Vite 6** + **React 18** + **TypeScript** + **VitePWA** (installable desktop/mobile PWA with route code-splitting)
* **Tailwind CSS** + **shadcn/ui** + **Framer Motion**
* **Supabase** (Optional Auth, Postgres RLS, Edge Functions with adaptive inactivity scan decay & 30-day job pruning)
* **PDF.js** & **Mammoth.js** for client-side document parsing
* **GitHub Actions**: Automated CI (typecheck, lint, test, build), GitHub Pages deploy, and Dependabot

## Parked / Future Roadmap 🗺️

* **High-Match Email / Webhook Digests** *(Parked for now)*: Optional Resend email or Discord/Slack notification triggered by `job-scanner` only when a newly discovered role scores ≥ 80%, paired with adaptive scan decay.
* **Lightweight Browser Extension**: 1-click "Send current job tab to CV Spruce" + quick copy of drafted Form Q&A answers.
* **Reed.co.uk API Integration**: Additional UK-native job board alongside Adzuna UK (`gb`), Ashby, Greenhouse, and Lever.

Happy sprucing! 🌲✨
