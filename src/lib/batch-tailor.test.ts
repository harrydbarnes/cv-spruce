import { describe, expect, it } from "vitest";
import { dateFlags } from "./batch-tailor";

describe("job date flags", () => {
  const now = new Date(2026, 10, 27, 12);
  it("flags closing dates without treating missing dates as urgent", () => {
    expect(dateFlags({ closingDate: "2026-11-27", postedDate: "" }, now)).toContain("Closes today");
    expect(dateFlags({ closingDate: "2026-11-26", postedDate: "" }, now)).toContain("Closing date passed");
    expect(dateFlags({ closingDate: "2026-12-04", postedDate: "" }, now)).toContain("Closes in 7 days");
    expect(dateFlags({ closingDate: "", postedDate: "" }, now)).toEqual(["Dates unknown"]);
  });
  it("flags older listings without implying they are closed", () => {
    expect(dateFlags({ closingDate: "", postedDate: "2026-10-28" }, now)).toEqual(["Posted 30 days ago"]);
  });
});
