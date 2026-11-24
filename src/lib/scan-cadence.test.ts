import { describe, it, expect } from "vitest";
import { computeScanCadence, isWatcherDueForScan } from "./scan-cadence";

describe("scan-cadence", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("decays active users from Daily -> 3d -> Weekly -> Bi-weekly -> Paused", () => {
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    expect(computeScanCadence(daysAgo(2), "actively_looking", now).intervalHours).toBe(24);
    expect(computeScanCadence(daysAgo(14), "actively_looking", now).intervalHours).toBe(72);
    expect(computeScanCadence(daysAgo(30), "actively_looking", now).intervalHours).toBe(168);
    expect(computeScanCadence(daysAgo(50), "actively_looking", now).intervalHours).toBe(336);
    expect(computeScanCadence(daysAgo(65), "actively_looking", now).intervalHours).toBeNull();
  });

  it("uses a gentler decay curve for passive users", () => {
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

    expect(computeScanCadence(daysAgo(10), "open_passively", now).intervalHours).toBe(72);
    expect(computeScanCadence(daysAgo(60), "open_passively", now).intervalHours).toBe(168);
    expect(computeScanCadence(daysAgo(100), "open_passively", now).intervalHours).toBe(336);
    expect(computeScanCadence(daysAgo(130), "open_passively", now).intervalHours).toBeNull();
  });

  it("determines whether a watcher is due based on lastRunAt and paused state", () => {
    const daily = computeScanCadence(now.toISOString(), "actively_looking", now);
    const paused = computeScanCadence("2026-01-01T00:00:00Z", "actively_looking", now);

    expect(isWatcherDueForScan(null, daily, now)).toBe(true);
    expect(isWatcherDueForScan("2026-11-24T06:00:00Z", daily, now)).toBe(false);
    expect(isWatcherDueForScan("2026-11-23T12:00:00Z", daily, now)).toBe(true);
    expect(isWatcherDueForScan("2026-01-01T00:00:00Z", paused, now)).toBe(false);
  });
});
