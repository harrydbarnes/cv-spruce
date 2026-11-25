import { describe, it, expect, beforeEach } from "vitest";
import { createWorkspaceBackup, restoreWorkspaceBackup } from "./workspace-backup";

describe("workspace-backup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports and restores workspace JSON cleanly", () => {
    localStorage.setItem("cv-spruce-career-profile-v1", JSON.stringify({ summary: "UK Engineer" }));
    localStorage.setItem("cv-spruce-watchers-v1", JSON.stringify([{ id: "w1", name: "Monzo" }]));
    localStorage.setItem("cv-spruce-applications-v1", JSON.stringify([{ id: "a1", company: "Monzo" }]));

    const exported = createWorkspaceBackup();
    expect(exported.schemaVersion).toBe(1);

    localStorage.clear();
    const { restoredSections } = restoreWorkspaceBackup(JSON.stringify(exported));

    expect(restoredSections).toContain("Master Profile");
    expect(restoredSections).toContain("1 Watchers");
    expect(restoredSections).toContain("1 Applications");
    expect(JSON.parse(localStorage.getItem("cv-spruce-career-profile-v1") || "{}").summary).toBe(
      "UK Engineer"
    );
  });

  it("rejects invalid JSON or wrong schema version", () => {
    expect(() => restoreWorkspaceBackup("not-json")).toThrow("Invalid JSON");
    expect(() => restoreWorkspaceBackup(JSON.stringify({ schemaVersion: 99 }))).toThrow(
      "Unsupported backup format"
    );
  });
});
