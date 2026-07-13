import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ScanReport } from "./scan.js";

export type HistoryLine = {
  ts: string;
  root: string;
  score: number;
  grade: string;
  finding_ids: string[];
};

export type HistoryDelta = {
  has_prior: boolean;
  score_delta: number;
  grade_before: string | null;
  grade_after: string;
  new_findings: string[];
  cleared_findings: string[];
};

export function historyPath(root: string): string {
  return path.join(root, ".solo-watch", "history.jsonl");
}

export function appendHistory(report: ScanReport): string {
  const dir = path.join(report.root, ".solo-watch");
  mkdirSync(dir, { recursive: true });
  const line: HistoryLine = {
    ts: report.scanned_at,
    root: report.root,
    score: report.score,
    grade: report.grade,
    finding_ids: report.findings
      .filter((f) => f.severity !== "ok")
      .map((f) => f.id),
  };
  const p = historyPath(report.root);
  appendFileSync(p, JSON.stringify(line) + "\n", "utf8");
  return p;
}

export function readHistory(root: string, limit = 20): HistoryLine[] {
  const p = historyPath(path.resolve(root));
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-limit)
    .map((l) => JSON.parse(l) as HistoryLine);
}

export function deltaAgainstHistory(
  report: ScanReport,
  prior?: HistoryLine | null,
): HistoryDelta {
  const prev =
    prior ??
    (() => {
      const h = readHistory(report.root, 2);
      // if last line is same second as current not yet written, use previous
      return h.length ? h[h.length - 1] : null;
    })();

  const afterIds = report.findings
    .filter((f) => f.severity !== "ok")
    .map((f) => f.id);

  if (!prev) {
    return {
      has_prior: false,
      score_delta: 0,
      grade_before: null,
      grade_after: report.grade,
      new_findings: afterIds,
      cleared_findings: [],
    };
  }

  const before = new Set(prev.finding_ids);
  const after = new Set(afterIds);
  return {
    has_prior: true,
    score_delta: report.score - prev.score,
    grade_before: prev.grade,
    grade_after: report.grade,
    new_findings: afterIds.filter((id) => !before.has(id)),
    cleared_findings: prev.finding_ids.filter((id) => !after.has(id)),
  };
}

export function formatDelta(d: HistoryDelta): string {
  if (!d.has_prior) return "delta   (no prior history)";
  const sign = d.score_delta > 0 ? `+${d.score_delta}` : String(d.score_delta);
  const lines = [
    `delta   score ${sign}  grade ${d.grade_before}→${d.grade_after}`,
  ];
  if (d.new_findings.length) {
    lines.push(`        new: ${d.new_findings.join(", ")}`);
  }
  if (d.cleared_findings.length) {
    lines.push(`        cleared: ${d.cleared_findings.join(", ")}`);
  }
  if (!d.new_findings.length && !d.cleared_findings.length) {
    lines.push(`        findings unchanged`);
  }
  return lines.join("\n");
}
