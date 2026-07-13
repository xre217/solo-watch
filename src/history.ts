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
    finding_ids: report.findings.filter((f) => f.severity !== "ok").map((f) => f.id),
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
