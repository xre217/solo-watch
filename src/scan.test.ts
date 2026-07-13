import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { scanRepo } from "./scan.js";

describe("scanRepo", () => {
  it("flags empty non-git tree", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    const r = scanRepo(dir);
    assert.ok(r.score < 100);
    assert.ok(r.findings.some((f) => f.id === "no-git"));
  });

  it("scores healthier tree with tests + readme + package", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "solo-watch-"));
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "x", scripts: { test: "node -e 0", build: "tsc" } }),
    );
    writeFileSync(path.join(dir, "package-lock.json"), "{}");
    writeFileSync(path.join(dir, "README.md"), "# x\n");
    writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    mkdirSync(path.join(dir, "tests"));
    writeFileSync(path.join(dir, "tests", "a.test.js"), "ok");
    mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    writeFileSync(path.join(dir, ".github", "workflows", "ci.yml"), "name: ci\n");
    // still no git → penalty but structure ok
    const r = scanRepo(dir);
    assert.ok(r.meta.hasTests);
    assert.ok(r.meta.hasCi);
    assert.ok(r.meta.hasReadme);
    assert.ok(r.score >= 40);
  });
});
