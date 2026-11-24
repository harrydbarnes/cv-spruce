import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ApplicationRecord, ApplicationStatus } from "@/lib/application-utils";

const LOCAL_KEY = "cv-spruce-applications-v1";

function loadLocalApps(): ApplicationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as ApplicationRecord[]) : [];
  } catch {
    return [];
  }
}

export function useApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>(() => loadLocalApps());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    setLoading(true);

    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setLoading(false);
        if (data && data.length > 0) {
          setApplications(
            data.map((row) => ({
              id: row.id,
              jobId: row.job_id ?? undefined,
              company: row.company,
              roleTitle: row.role_title,
              location: row.location ?? "",
              salary: row.salary ?? undefined,
              jobUrl: row.job_url ?? undefined,
              jobSpecText: row.job_spec_text ?? "",
              status: row.status as ApplicationStatus,
              matchPercentage: row.match_percentage ?? undefined,
              matchingHighlights: row.matching_highlights ?? [],
              missingSkills: row.missing_skills ?? [],
              tailoredCv: row.tailored_cv ?? "",
              coverLetter: row.cover_letter ?? "",
              interviewQna: Array.isArray(row.interview_qna) ? row.interview_qna : [],
              industryUpdates: Array.isArray(row.industry_updates) ? row.industry_updates : [],
              cvVersions: Array.isArray(row.cv_versions) ? row.cv_versions : [],
              chatHistory: Array.isArray(row.chat_history) ? row.chat_history : [],
              notes: row.notes ?? "",
              appliedAt: row.applied_at ?? undefined,
              nextFollowUpAt: row.next_follow_up_at ?? undefined,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }))
          );
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const upsertToCloud = useCallback(
    async (app: ApplicationRecord) => {
      if (!user || !supabase) return;
      await supabase.from("applications").upsert(
        {
          id: app.id,
          user_id: user.id,
          company: app.company,
          role_title: app.roleTitle,
          location: app.location,
          salary: app.salary ?? null,
          job_url: app.jobUrl ?? null,
          job_spec_text: app.jobSpecText,
          status: app.status,
          match_percentage: app.matchPercentage ?? null,
          matching_highlights: app.matchingHighlights,
          missing_skills: app.missingSkills,
          tailored_cv: app.tailoredCv,
          cover_letter: app.coverLetter,
          interview_qna: app.interviewQna,
          industry_updates: app.industryUpdates,
          cv_versions: app.cvVersions,
          chat_history: app.chatHistory,
          notes: app.notes,
          applied_at: app.appliedAt ?? null,
          next_follow_up_at: app.nextFollowUpAt ?? null,
        },
        { onConflict: "id" }
      );
    },
    [user]
  );

  const createApplication = useCallback(
    async (
      input: Partial<ApplicationRecord> & { company: string; roleTitle: string }
    ): Promise<ApplicationRecord> => {
      const now = new Date().toISOString();
      const created: ApplicationRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : `app-${Date.now()}`,
        company: input.company,
        roleTitle: input.roleTitle,
        location: input.location ?? "",
        salary: input.salary,
        jobUrl: input.jobUrl,
        jobId: input.jobId,
        jobSpecText: input.jobSpecText ?? "",
        status: input.status ?? "drafting",
        matchPercentage: input.matchPercentage,
        matchingHighlights: input.matchingHighlights ?? [],
        missingSkills: input.missingSkills ?? [],
        tailoredCv: input.tailoredCv ?? "",
        coverLetter: input.coverLetter ?? "",
        interviewQna: input.interviewQna ?? [],
        industryUpdates: input.industryUpdates ?? [],
        cvVersions: input.cvVersions ?? [],
        chatHistory: input.chatHistory ?? [],
        notes: input.notes ?? "",
        appliedAt: input.appliedAt,
        nextFollowUpAt: input.nextFollowUpAt,
        createdAt: now,
        updatedAt: now,
      };

      setApplications((prev) => [created, ...prev]);
      await upsertToCloud(created);
      return created;
    },
    [upsertToCloud]
  );

  const updateApplication = useCallback(
    async (
      id: string,
      patch: Partial<ApplicationRecord> | ((prev: ApplicationRecord) => ApplicationRecord)
    ) => {
      let updatedRecord: ApplicationRecord | null = null;
      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== id) return app;
          const next =
            typeof patch === "function"
              ? patch(app)
              : {
                  ...app,
                  ...patch,
                  appliedAt:
                    patch.status === "applied" && !app.appliedAt
                      ? new Date().toISOString()
                      : patch.appliedAt ?? app.appliedAt,
                  updatedAt: new Date().toISOString(),
                };
          updatedRecord = next;
          return next;
        })
      );

      if (updatedRecord) {
        await upsertToCloud(updatedRecord);
      }
    },
    [upsertToCloud]
  );

  const deleteApplication = useCallback(
    async (id: string) => {
      setApplications((prev) => prev.filter((a) => a.id !== id));
      if (user && supabase) {
        await supabase.from("applications").delete().eq("id", id).eq("user_id", user.id);
      }
    },
    [user]
  );

  return {
    applications,
    loading,
    createApplication,
    updateApplication,
    deleteApplication,
  };
}
