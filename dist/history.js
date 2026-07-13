import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
export function historyPath(root) {
    return path.join(root, ".solo-watch", "history.jsonl");
}
export function appendHistory(report) {
    const dir = path.join(report.root, ".solo-watch");
    mkdirSync(dir, { recursive: true });
    const line = {
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
export function readHistory(root, limit = 20) {
    const p = historyPath(path.resolve(root));
    if (!existsSync(p))
        return [];
    return readFileSync(p, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-limit)
        .map((l) => JSON.parse(l));
}
