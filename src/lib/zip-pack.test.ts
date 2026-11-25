import { describe, it, expect } from "vitest";
import { extractAtsKeywordCoverage, markdownToPrintHtml } from "./application-utils";
import { buildZipBlob, buildZipBytes } from "./zip-pack";

describe("ATS keyword coverage, preview HTML & Apply Pack ZIP", () => {
  it("computes matched vs missing keywords from job spec and tailored CV", () => {
    const spec =
      "We need a Senior TypeScript Engineer with React, PostgreSQL, GraphQL, and Kubernetes experience.";
    const cv = "Senior Engineer skilled in TypeScript, React, and PostgreSQL.";

    const cov = extractAtsKeywordCoverage(spec, cv);
    expect(cov.matched).toContain("TypeScript");
    expect(cov.matched).toContain("React");
    expect(cov.matched).toContain("PostgreSQL");
    expect(cov.missing).toContain("GraphQL");
    expect(cov.coveragePct).toBeGreaterThan(0);
    expect(cov.coveragePct).toBeLessThan(100);
  });

  it("renders markdown headings and bullets into safe HTML", () => {
    const html = markdownToPrintHtml("# Jane Doe\n## Skills\n- TypeScript & <script>");
    expect(html).toContain("<h1>Jane Doe</h1>");
    expect(html).toContain("<h2>Skills</h2>");
    expect(html).toContain("<li>TypeScript &amp; &lt;script&gt;</li>");
  });

  it("builds a valid PKZIP archive blob for Apply Pack downloads", () => {
    const entries = [
      { name: "01-Tailored-CV.md", content: "# CV Content" },
      { name: "02-Cover-Letter.md", content: "Dear Hiring Manager" },
    ];
    const buf = buildZipBytes(entries);
    const blob = buildZipBlob(entries);
    // PKZIP local header magic signature: 0x50 0x4B 0x03 0x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
    expect(blob.type).toBe("application/zip");
  });
});
