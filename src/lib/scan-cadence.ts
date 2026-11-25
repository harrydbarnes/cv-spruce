import type { CareerProfile } from "./profile-types";

export type SearchStatus = CareerProfile["preferences"]["searchStatus"];

export interface ScanCadenceInfo {
  /** Human-readable label, e.g. "Daily", "Every 3 days", "Weekly", "Bi-weekly", "Paused" */
  label: string;
  /** Interval in hours between background scans, or null when paused (0 scans) */
  intervalHours: number | null;
  /** Short explanation for the UI pill */
  reason: string;
  /** Days since user was last active */
  inactiveDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Computes an adaptive background scan cadence based on inactivity and search status.
 * - Actively looking / Preparing: Daily (0-7d) -> Every 3d (8-21d) -> Weekly (22-45d) -> Bi-weekly (46-60d) -> Paused (>60d)
 * - Open passively: Every 3d (0-30d) -> Weekly (31-90d) -> Bi-weekly (91-120d) -> Paused (>120d)
 */
export function computeScanCadence(
  lastActiveAt: string | Date | null | undefined,
  searchStatus: SearchStatus = "actively_looking",
  now: Date = new Date()
): ScanCadenceInfo {
  const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : now.getTime();
  const inactiveDays = Number.isNaN(lastActiveMs)
    ? 0
    : Math.max(0, Math.floor((now.getTime() - lastActiveMs) / MS_PER_DAY));

  if (searchStatus === "open_passively") {
    if (inactiveDays <= 30) {
      return {
        label: "Every 3 days",
        intervalHours: 72,
        reason: "Passive mode checks quietly every 3 days",
        inactiveDays,
      };
    }
    if (inactiveDays <= 90) {
      return {
        label: "Weekly",
        intervalHours: 168,
        reason: "Passive mode slowed to weekly while away",
        inactiveDays,
      };
    }
    if (inactiveDays <= 120) {
      return {
        label: "Bi-weekly",
        intervalHours: 336,
        reason: "Final check-in cadence before auto-pausing",
        inactiveDays,
      };
    }
    return {
      label: "Paused",
      intervalHours: null,
      reason: "Auto-paused after 120 days idle — resumes immediately on visit",
      inactiveDays,
    };
  }

  // Active or Preparing
  if (inactiveDays <= 7) {
    return {
      label: "Daily",
      intervalHours: 24,
      reason: "Active cadence — auto-slows if you step away",
      inactiveDays,
    };
  }
  if (inactiveDays <= 21) {
    return {
      label: "Every 3 days",
      intervalHours: 72,
      reason: "Slowed after 7+ days away — visit to reset to Daily",
      inactiveDays,
    };
  }
  if (inactiveDays <= 45) {
    return {
      label: "Weekly",
      intervalHours: 168,
      reason: "Slowed to weekly while idle",
      inactiveDays,
    };
  }
  if (inactiveDays <= 60) {
    return {
      label: "Bi-weekly",
      intervalHours: 336,
      reason: "Slowing down before auto-pausing at 60 days",
      inactiveDays,
    };
  }
  return {
    label: "Paused",
    intervalHours: null,
    reason: "Auto-paused after 60 days idle — resumes immediately on visit",
    inactiveDays,
  };
}

/**
 * Determines whether a watcher is due for a background scan given its lastRunAt
 * and the user's current adaptive cadence.
 */
export function isWatcherDueForScan(
  lastRunAt: string | null | undefined,
  cadence: ScanCadenceInfo,
  now: Date = new Date()
): boolean {
  if (cadence.intervalHours === null) return false;
  if (!lastRunAt) return true;
  const lastRunMs = new Date(lastRunAt).getTime();
  if (Number.isNaN(lastRunMs)) return true;
  const elapsedHours = (now.getTime() - lastRunMs) / (60 * 60 * 1000);
  // 1-hour grace window so daily cron jobs don't skip due to slight drift
  return elapsedHours >= cadence.intervalHours - 1;
}
