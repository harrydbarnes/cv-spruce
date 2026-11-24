import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  EMPTY_CAREER_PROFILE,
  calculateProfileStrength,
  type CareerProfile,
  type FeedbackSignal,
} from "@/lib/profile-types";

const LOCAL_STORAGE_KEY = "cv-spruce-career-profile-v1";

function loadLocalProfile(): CareerProfile {
  if (typeof window === "undefined") return EMPTY_CAREER_PROFILE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return EMPTY_CAREER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<CareerProfile>;
    return {
      ...EMPTY_CAREER_PROFILE,
      ...parsed,
      basics: { ...EMPTY_CAREER_PROFILE.basics, ...(parsed.basics ?? {}) },
      preferences: { ...EMPTY_CAREER_PROFILE.preferences, ...(parsed.preferences ?? {}) },
    };
  } catch {
    return EMPTY_CAREER_PROFILE;
  }
}

function saveLocalProfile(profile: CareerProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function useCareerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CareerProfile>(() => loadLocalProfile());
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Sync from Supabase when signed in
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    setLoading(true);

    supabase
      .from("career_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) return;

        if (data) {
          const hydrated: CareerProfile = {
            basics: { ...EMPTY_CAREER_PROFILE.basics, ...(data.basics ?? {}) },
            summary: data.summary ?? "",
            experience: Array.isArray(data.experience) ? data.experience : [],
            skills: Array.isArray(data.skills) ? data.skills : [],
            projects: Array.isArray(data.projects) ? data.projects : [],
            education: Array.isArray(data.education) ? data.education : [],
            certifications: Array.isArray(data.certifications) ? data.certifications : [],
            careerStory: data.career_story ?? "",
            preferences: { ...EMPTY_CAREER_PROFILE.preferences, ...(data.preferences ?? {}) },
            feedbackMemory: Array.isArray(data.feedback_memory) ? data.feedback_memory : [],
            rawCvText: data.raw_cv_text ?? "",
          };
          setProfile(hydrated);
          saveLocalProfile(hydrated);
        } else {
          // Migrate existing local profile up to cloud if it has content
          const local = loadLocalProfile();
          if (calculateProfileStrength(local).score > 0) {
            void supabase.from("career_profiles").upsert(
              {
                user_id: user.id,
                basics: local.basics,
                summary: local.summary,
                experience: local.experience,
                skills: local.skills,
                projects: local.projects,
                education: local.education,
                certifications: local.certifications,
                career_story: local.careerStory,
                preferences: local.preferences,
                feedback_memory: local.feedbackMemory,
                raw_cv_text: local.rawCvText,
              },
              { onConflict: "user_id" }
            );
          }
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const updateProfile = useCallback(
    async (updater: CareerProfile | ((prev: CareerProfile) => CareerProfile)) => {
      let nextProfile: CareerProfile = EMPTY_CAREER_PROFILE;
      setProfile((prev) => {
        nextProfile = typeof updater === "function" ? updater(prev) : updater;
        saveLocalProfile(nextProfile);
        return nextProfile;
      });

      if (user && supabase) {
        setSaving(true);
        await supabase.from("career_profiles").upsert(
          {
            user_id: user.id,
            basics: nextProfile.basics,
            summary: nextProfile.summary,
            experience: nextProfile.experience,
            skills: nextProfile.skills,
            projects: nextProfile.projects,
            education: nextProfile.education,
            certifications: nextProfile.certifications,
            career_story: nextProfile.careerStory,
            preferences: nextProfile.preferences,
            feedback_memory: nextProfile.feedbackMemory,
            raw_cv_text: nextProfile.rawCvText,
          },
          { onConflict: "user_id" }
        );
        setSaving(false);
      }
    },
    [user]
  );

  const recordFeedbackSignal = useCallback(
    async (signal: Omit<FeedbackSignal, "id" | "createdAt">) => {
      const entry: FeedbackSignal = {
        ...signal,
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      await updateProfile((prev) => ({
        ...prev,
        feedbackMemory: [entry, ...prev.feedbackMemory].slice(0, 40),
      }));
    },
    [updateProfile]
  );

  const removeFeedbackSignal = useCallback(
    async (id: string) => {
      await updateProfile((prev) => ({
        ...prev,
        feedbackMemory: prev.feedbackMemory.filter((f) => f.id !== id),
      }));
    },
    [updateProfile]
  );

  const [lastActiveAt, setLastActiveAt] = useState<string>(() => {
    if (typeof window === "undefined") return new Date().toISOString();
    return localStorage.getItem("cv-spruce-last-active-at") || new Date().toISOString();
  });

  const touchActivity = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const prevMs = new Date(lastActiveAt).getTime();
    // Throttle cloud writes to at most once per hour
    const shouldWriteCloud = Number.isNaN(prevMs) || Date.now() - prevMs >= 60 * 60 * 1000;

    setLastActiveAt(nowIso);
    if (typeof window !== "undefined") {
      localStorage.setItem("cv-spruce-last-active-at", nowIso);
    }

    if (shouldWriteCloud && user && supabase) {
      await supabase
        .from("career_profiles")
        .update({ last_active_at: nowIso })
        .eq("user_id", user.id);
    }
  }, [lastActiveAt, user]);

  const strength = useMemo(() => calculateProfileStrength(profile), [profile]);

  return {
    profile,
    loading,
    saving,
    strength,
    lastActiveAt,
    touchActivity,
    updateProfile,
    recordFeedbackSignal,
    removeFeedbackSignal,
  };
}
