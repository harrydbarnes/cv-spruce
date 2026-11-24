// Supabase Edge Function: Automated Adaptive Job Scanner (invoked via pg_cron or user request)
// - Respects per-user adaptive scan decay (gradually reduces cadence to 0 when user is idle)
// - Respects gentler decay curve for `open_passively` users
// - Auto-prunes un-saved, un-liked discovered jobs older than 30 days
// Deploy with: supabase functions deploy job-scanner

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WatcherRow {
  id: string;
  user_id: string;
  source: string;
  query: string;
  company_slug: string | null;
  remote_only: boolean;
  last_run_at: string | null;
}

interface ProfileActivityRow {
  user_id: string;
  last_active_at: string | null;
  preferences: { searchStatus?: string } | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeIntervalHours(
  lastActiveAt: string | null | undefined,
  searchStatus: string | undefined,
  nowMs: number
): number | null {
  const lastMs = lastActiveAt ? new Date(lastActiveAt).getTime() : nowMs;
  const inactiveDays = Number.isNaN(lastMs)
    ? 0
    : Math.max(0, Math.floor((nowMs - lastMs) / MS_PER_DAY));

  if (searchStatus === "open_passively") {
    if (inactiveDays <= 30) return 72;
    if (inactiveDays <= 90) return 168;
    if (inactiveDays <= 120) return 336;
    return null; // Paused
  }

  if (inactiveDays <= 7) return 24;
  if (inactiveDays <= 21) return 72;
  if (inactiveDays <= 45) return 168;
  if (inactiveDays <= 60) return 336;
  return null; // Paused
}

function isDue(lastRunAt: string | null, intervalHours: number | null, nowMs: number): boolean {
  if (intervalHours === null) return false;
  if (!lastRunAt) return true;
  const elapsedHours = (nowMs - new Date(lastRunAt).getTime()) / (60 * 60 * 1000);
  return elapsedHours >= intervalHours - 1;
}

async function fetchSourceJobs(w: WatcherRow) {
  if (w.source === "remotive") {
    const res = await fetch(
      `https://remotive.com/api/remote-jobs?limit=20&search=${encodeURIComponent(w.query || "")}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).map((j: Record<string, unknown>) => ({
      external_id: String(j.id),
      source: "remotive",
      title: String(j.title ?? ""),
      company: String(j.company_name ?? ""),
      location: String(j.candidate_required_location ?? "Remote"),
      remote: true,
      salary: j.salary ? String(j.salary) : null,
      url: String(j.url ?? ""),
      description: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 12000),
      tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
      posted_at: j.publication_date ? String(j.publication_date) : null,
    }));
  }

  if (w.source === "greenhouse" && w.company_slug) {
    const slug = w.company_slug.trim().toLowerCase();
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).slice(0, 25).map((j: Record<string, unknown>) => ({
      external_id: `${slug}-${String(j.id)}`,
      source: "greenhouse",
      title: String(j.title ?? ""),
      company: slug.charAt(0).toUpperCase() + slug.slice(1),
      location: (j.location as { name?: string } | undefined)?.name ?? "See posting",
      remote: /remote/i.test((j.location as { name?: string } | undefined)?.name ?? ""),
      salary: null,
      url: String(j.absolute_url ?? ""),
      description: String(j.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 12000),
      tags: ["Greenhouse"],
      posted_at: j.updated_at ? String(j.updated_at) : null,
    }));
  }

  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRoleKey);
    const nowMs = Date.now();

    const [{ data: watchers, error: wErr }, { data: profiles }] = await Promise.all([
      client
        .from("job_watchers")
        .select("id, user_id, source, query, company_slug, remote_only, last_run_at")
        .eq("enabled", true),
      client.from("career_profiles").select("user_id, last_active_at, preferences"),
    ]);

    if (wErr) throw wErr;

    const profileByUser = new Map<string, ProfileActivityRow>();
    for (const p of (profiles ?? []) as ProfileActivityRow[]) {
      profileByUser.set(p.user_id, p);
    }

    let scanned = 0;
    let skippedIdle = 0;
    let inserted = 0;

    for (const watcher of (watchers ?? []) as WatcherRow[]) {
      const prof = profileByUser.get(watcher.user_id);
      const intervalHours = computeIntervalHours(
        prof?.last_active_at,
        prof?.preferences?.searchStatus,
        nowMs
      );

      if (!isDue(watcher.last_run_at, intervalHours, nowMs)) {
        skippedIdle += 1;
        continue;
      }

      scanned += 1;
      const jobs = await fetchSourceJobs(watcher);
      if (jobs.length > 0) {
        const rows = jobs
          .filter((j) => (!watcher.remote_only ? true : j.remote))
          .map((j) => ({
            ...j,
            user_id: watcher.user_id,
            watcher_id: watcher.id,
          }));

        if (rows.length > 0) {
          const { error: upsertErr } = await client
            .from("discovered_jobs")
            .upsert(rows, { onConflict: "user_id,source,external_id" });
          if (!upsertErr) inserted += rows.length;
        }
      }

      await client
        .from("job_watchers")
        .update({ last_run_at: new Date(nowMs).toISOString() })
        .eq("id", watcher.id);
    }

    // Auto-prune un-saved, un-liked jobs older than 30 days to keep DB storage lean
    const cutoffIso = new Date(nowMs - 30 * MS_PER_DAY).toISOString();
    await client
      .from("discovered_jobs")
      .delete()
      .is("feedback", null)
      .lt("discovered_at", cutoffIso);

    return new Response(
      JSON.stringify({ ok: true, scanned, skippedIdle, inserted, prunedBefore: cutoffIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Scan failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
