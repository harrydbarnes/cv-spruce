import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchJobsForWatcher,
  deduplicateJobs,
  computeHeuristicMatchScore,
  scoreJobsWithAi,
  type DiscoveredJob,
  type JobFeedback,
  type JobWatcher,
} from "@/lib/job-feeds";
import type { CareerProfile } from "@/lib/profile-types";
import type { ModelType } from "@/lib/types";

const WATCHERS_KEY = "cv-spruce-watchers-v1";
const JOBS_KEY = "cv-spruce-discovered-jobs-v1";

const DEFAULT_WATCHERS: JobWatcher[] = [
  {
    id: "default-remotive",
    name: "Remote Software & Product",
    source: "remotive",
    query: "software engineer",
    remoteOnly: true,
    enabled: true,
  },
  {
    id: "default-hn",
    name: "YC / HN Monthly Hiring",
    source: "hn_yc",
    query: "TypeScript",
    remoteOnly: false,
    enabled: true,
  },
];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useJobDiscovery(
  profile: CareerProfile,
  onFeedbackRecorded?: (signal: {
    jobTitle: string;
    company: string;
    signal: "liked" | "disliked";
    reason?: string;
  }) => void
) {
  const { user } = useAuth();
  const [watchers, setWatchers] = useState<JobWatcher[]>(() =>
    loadJson(WATCHERS_KEY, DEFAULT_WATCHERS)
  );
  const [jobs, setJobs] = useState<DiscoveredJob[]>(() => loadJson(JOBS_KEY, []));
  const [scanning, setScanning] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const [scanErrors, setScanErrors] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem(WATCHERS_KEY, JSON.stringify(watchers));
  }, [watchers]);

  useEffect(() => {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }, [jobs]);

  // Sync from Supabase when signed in
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;

    Promise.all([
      supabase.from("job_watchers").select("*").eq("user_id", user.id),
      supabase
        .from("discovered_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("match_score", { ascending: false, nullsFirst: false })
        .limit(100),
    ]).then(([wRes, jRes]) => {
      if (!active) return;
      if (wRes.data && wRes.data.length > 0) {
        setWatchers(
          wRes.data.map((row) => ({
            id: row.id,
            name: row.name,
            source: row.source,
            query: row.query ?? "",
            companySlug: row.company_slug ?? undefined,
            location: row.location ?? undefined,
            remoteOnly: Boolean(row.remote_only),
            enabled: Boolean(row.enabled),
            lastRunAt: row.last_run_at ?? undefined,
          }))
        );
      }
      if (jRes.data && jRes.data.length > 0) {
        setJobs(
          jRes.data.map((row) => ({
            id: row.id,
            watcherId: row.watcher_id ?? undefined,
            externalId: row.external_id,
            source: row.source,
            title: row.title,
            company: row.company,
            location: row.location ?? "",
            remote: Boolean(row.remote),
            salary: row.salary ?? undefined,
            url: row.url,
            description: row.description ?? "",
            tags: row.tags ?? [],
            matchScore: row.match_score ?? undefined,
            matchReasons: row.match_reasons ?? [],
            skillGaps: row.skill_gaps ?? [],
            feedback: row.feedback ?? undefined,
            feedbackNote: row.feedback_note ?? undefined,
            postedAt: row.posted_at ?? undefined,
            discoveredAt: row.discovered_at,
          }))
        );
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  const addWatcher = useCallback(
    async (watcher: Omit<JobWatcher, "id">) => {
      const created: JobWatcher = {
        ...watcher,
        id: crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}`,
      };
      setWatchers((prev) => [...prev, created]);

      if (user && supabase) {
        await supabase.from("job_watchers").insert({
          id: created.id,
          user_id: user.id,
          name: created.name,
          source: created.source,
          query: created.query,
          company_slug: created.companySlug ?? null,
          location: created.location ?? null,
          remote_only: created.remoteOnly,
          enabled: created.enabled,
        });
      }
      return created;
    },
    [user]
  );

  const toggleWatcher = useCallback(
    async (id: string) => {
      let nextEnabled = true;
      setWatchers((prev) =>
        prev.map((w) => {
          if (w.id === id) {
            nextEnabled = !w.enabled;
            return { ...w, enabled: nextEnabled };
          }
          return w;
        })
      );
      if (user && supabase) {
        await supabase
          .from("job_watchers")
          .update({ enabled: nextEnabled })
          .eq("id", id)
          .eq("user_id", user.id);
      }
    },
    [user]
  );

  const deleteWatcher = useCallback(
    async (id: string) => {
      setWatchers((prev) => prev.filter((w) => w.id !== id));
      if (user && supabase) {
        await supabase.from("job_watchers").delete().eq("id", id).eq("user_id", user.id);
      }
    },
    [user]
  );

  const runScan = useCallback(
    async (targetWatchers?: JobWatcher[]) => {
      const activeWatchers = (targetWatchers ?? watchers).filter((w) => w.enabled);
      if (activeWatchers.length === 0) return [];

      setScanning(true);
      setScanErrors([]);
      const errors: string[] = [];
      const fetched: DiscoveredJob[] = [];

      await Promise.all(
        activeWatchers.map(async (w) => {
          try {
            const results = await fetchJobsForWatcher(w);
            fetched.push(...results);
          } catch (err) {
            errors.push(`${w.name}: ${err instanceof Error ? err.message : "Failed to fetch"}`);
          }
        })
      );

      const now = new Date().toISOString();
      setWatchers((prev) =>
        prev.map((w) =>
          activeWatchers.some((aw) => aw.id === w.id) ? { ...w, lastRunAt: now } : w
        )
      );

      const scoredNew = fetched.map((job) => ({
        ...job,
        ...computeHeuristicMatchScore(job, profile),
      }));

      let merged: DiscoveredJob[] = [];
      setJobs((prev) => {
        // Preserve existing feedback on already-known jobs
        const prevMap = new Map(prev.map((j) => [`${j.source}:${j.externalId}`, j]));
        const combined = scoredNew.map((j) => {
          const existing = prevMap.get(`${j.source}:${j.externalId}`);
          return existing
            ? { ...j, feedback: existing.feedback, feedbackNote: existing.feedbackNote }
            : j;
        });
        merged = deduplicateJobs([...combined, ...prev]).sort(
          (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)
        );
        return merged.slice(0, 150);
      });

      setScanErrors(errors);
      setScanning(false);

      if (user && supabase && scoredNew.length > 0) {
        await supabase.from("discovered_jobs").upsert(
          scoredNew.slice(0, 60).map((j) => ({
            user_id: user.id,
            external_id: j.externalId,
            source: j.source,
            title: j.title,
            company: j.company,
            location: j.location,
            remote: j.remote,
            salary: j.salary ?? null,
            url: j.url,
            description: j.description.slice(0, 12000),
            tags: j.tags,
            match_score: j.matchScore ?? null,
            match_reasons: j.matchReasons,
            skill_gaps: j.skillGaps,
            posted_at: j.postedAt ?? null,
          })),
          { onConflict: "user_id,source,external_id" }
        );
      }

      return merged;
    },
    [watchers, profile, user]
  );

  const runAiDeepScore = useCallback(
    async (provider: ModelType, apiKey: string) => {
      const visible = jobs.filter((j) => j.feedback !== "hidden" && j.feedback !== "disliked");
      if (visible.length === 0) return;
      setAiScoring(true);
      try {
        const scoresMap = await scoreJobsWithAi(provider, apiKey, visible, profile);
        setJobs((prev) =>
          prev
            .map((j) => {
              const aiScore = scoresMap.get(j.id);
              return aiScore ? { ...j, ...aiScore } : j;
            })
            .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        );
      } finally {
        setAiScoring(false);
      }
    },
    [jobs, profile]
  );

  const setJobFeedback = useCallback(
    async (job: DiscoveredJob, feedback: JobFeedback, note?: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, feedback, feedbackNote: note ?? j.feedbackNote } : j
        )
      );

      if ((feedback === "liked" || feedback === "disliked") && onFeedbackRecorded) {
        onFeedbackRecorded({
          jobTitle: job.title,
          company: job.company,
          signal: feedback,
          reason: note,
        });
      }

      if (user && supabase) {
        await supabase
          .from("discovered_jobs")
          .update({ feedback, feedback_note: note ?? null })
          .eq("user_id", user.id)
          .eq("source", job.source)
          .eq("external_id", job.externalId);
      }
    },
    [user, onFeedbackRecorded]
  );

  return {
    watchers,
    jobs,
    scanning,
    aiScoring,
    scanErrors,
    addWatcher,
    toggleWatcher,
    deleteWatcher,
    runScan,
    runAiDeepScore,
    setJobFeedback,
  };
}
