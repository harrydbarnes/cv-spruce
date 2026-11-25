export interface WorkspaceBackupV1 {
  schemaVersion: 1;
  exportedAt: string;
  careerProfile: unknown;
  watchers: unknown;
  discoveredJobs: unknown;
  applications: unknown;
  lastActiveAt: string | null;
}

const KEYS = {
  careerProfile: "cv-spruce-career-profile-v1",
  watchers: "cv-spruce-watchers-v1",
  discoveredJobs: "cv-spruce-discovered-jobs-v1",
  applications: "cv-spruce-applications-v1",
  lastActiveAt: "cv-spruce-last-active-at",
} as const;

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createWorkspaceBackup(): WorkspaceBackupV1 {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    careerProfile: safeParse(localStorage.getItem(KEYS.careerProfile)),
    watchers: safeParse(localStorage.getItem(KEYS.watchers)),
    discoveredJobs: safeParse(localStorage.getItem(KEYS.discoveredJobs)),
    applications: safeParse(localStorage.getItem(KEYS.applications)),
    lastActiveAt: localStorage.getItem(KEYS.lastActiveAt),
  };
}

export function downloadWorkspaceBackup(): string {
  const backup = createWorkspaceBackup();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `cv-spruce-backup-${dateStamp}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export function restoreWorkspaceBackup(rawJson: string): {
  restoredSections: string[];
} {
  let parsed: Partial<WorkspaceBackupV1>;
  try {
    parsed = JSON.parse(rawJson) as Partial<WorkspaceBackupV1>;
  } catch {
    throw new Error("Invalid JSON file. Please choose a valid CV Spruce backup file.");
  }

  if (parsed.schemaVersion !== 1) {
    throw new Error("Unsupported backup format or schema version.");
  }

  const restoredSections: string[] = [];

  if (parsed.careerProfile && typeof parsed.careerProfile === "object") {
    localStorage.setItem(KEYS.careerProfile, JSON.stringify(parsed.careerProfile));
    restoredSections.push("Master Profile");
  }
  if (Array.isArray(parsed.watchers)) {
    localStorage.setItem(KEYS.watchers, JSON.stringify(parsed.watchers));
    restoredSections.push(`${parsed.watchers.length} Watchers`);
  }
  if (Array.isArray(parsed.discoveredJobs)) {
    localStorage.setItem(KEYS.discoveredJobs, JSON.stringify(parsed.discoveredJobs));
    restoredSections.push(`${parsed.discoveredJobs.length} Discovered Jobs`);
  }
  if (Array.isArray(parsed.applications)) {
    localStorage.setItem(KEYS.applications, JSON.stringify(parsed.applications));
    restoredSections.push(`${parsed.applications.length} Applications`);
  }
  if (typeof parsed.lastActiveAt === "string") {
    localStorage.setItem(KEYS.lastActiveAt, parsed.lastActiveAt);
  }

  if (restoredSections.length === 0) {
    throw new Error("Backup file did not contain any CV Spruce workspace data.");
  }

  return { restoredSections };
}
