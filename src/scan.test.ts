import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { badgeSvg, formatAnnotations, formatMarkdown, scanRepo } from "./scan.js";
import {
  appendHistory,
  deltaAgainstHistory,
  formatDelta,
  readHistory,
} from "./history.js";

describe("scanRepo", () => {
  it("flags empty non-git tree", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    const r = scanRepo(dir);
    assert.ok(r.score < 100);
    assert.ok(r.findings.some((f) => f.id === "no-git"));
    assert.ok(r.scanned_at);
  });

  it("scores healthier tree with tests + readme + package + license + ci", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "x",
        engines: { node: ">=20" },
        scripts: { test: "node -e 0", build: "tsc" },
      }),
    );
    writeFileSync(path.join(dir, "package-lock.json"), "{}");
    writeFileSync(path.join(dir, "README.md"), "# x\n");
    writeFileSync(path.join(dir, "LICENSE"), "MIT\n");
    writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
    mkdirSync(path.join(dir, "tests"));
    writeFileSync(path.join(dir, "tests", "a.test.js"), "ok");
    mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    writeFileSync(path.join(dir, ".github", "workflows", "ci.yml"), "name: ci\n");
    const r = scanRepo(dir);
    assert.ok(r.meta.hasTests);
    assert.ok(r.meta.hasCi);
    assert.ok(r.meta.hasReadme);
    assert.ok(r.meta.hasLicense);
    assert.ok(r.findings.some((f) => f.id === "has-ci" && f.severity === "ok"));
    assert.ok(r.score >= 50);
  });

  it("history append + read", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    writeFileSync(path.join(dir, "README.md"), "# x\n");
    const r = scanRepo(dir);
    appendHistory(r);
    appendHistory(r);
    const h = readHistory(dir, 10);
    assert.equal(h.length, 2);
    assert.equal(h[0].grade, r.grade);
  });

  it("badge svg contains grade", () => {
    const svg = badgeSvg(88, "A");
    assert.ok(svg.includes("A 88"));
    assert.ok(svg.includes("solo-watch"));
  });

  it("markdown and annotations emit", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    writeFileSync(path.join(dir, "README.md"), "# x\n");
    const r = scanRepo(dir);
    assert.ok(formatMarkdown(r).includes("# solo-watch"));
    assert.ok(formatAnnotations(r).includes("::"));
  });

  it("delta detects score movement", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    writeFileSync(path.join(dir, "README.md"), "# x\n");
    const r1 = scanRepo(dir);
    appendHistory(r1);
    writeFileSync(path.join(dir, "LICENSE"), "MIT\n");
    mkdirSync(path.join(dir, "tests"));
    writeFileSync(path.join(dir, "tests", "a.test.js"), "ok");
    const r2 = scanRepo(dir);
    const d = deltaAgainstHistory(r2, readHistory(dir, 1)[0]);
    assert.equal(d.has_prior, true);
    assert.ok(formatDelta(d).includes("score"));
  });
});
