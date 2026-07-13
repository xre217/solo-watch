#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { badgeSvg, formatReport, scanRepo } from "./scan.js";
import { appendHistory, readHistory } from "./history.js";
function usage() {
    console.log(`solo-watch — Solo Leveling Forge (repo / deploy health)

Usage:
  solo-watch [scan] [path] [--json] [--min-score N] [--history] [--badge [file]]
  solo-watch history [path] [--limit N]
  solo-watch badge [path] [--out file.svg]
  solo-watch help
  solo-watch version

Flags:
  --json          machine report
  --min-score N   pass floor (default 55)
  --history       append scan to .solo-watch/history.jsonl
  --badge [file]  write SVG badge (default .solo-watch/badge.svg)

Exit: 0 pass · 1 below min-score · 2 usage

Instrument panel energy. Not a coworker persona.
`);
}
function parseArgs(argv) {
    let json = false;
    let minScore = 55;
    let history = false;
    /** false = off; true = default path; string = explicit path */
    let badge = false;
    let limit = 20;
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--json")
            json = true;
        else if (a === "--history")
            history = true;
        else if (a === "--min-score" || a === "--fail-below") {
            const n = Number(argv[++i]);
            if (!Number.isFinite(n))
                throw new Error(`${a} requires a number`);
            minScore = n;
        }
        else if (a === "--limit") {
            limit = Number(argv[++i]) || 20;
        }
        else if (a === "--badge") {
            const next = argv[i + 1];
            if (next && !next.startsWith("--")) {
                badge = next;
                i++;
            }
            else {
                badge = true;
            }
        }
        else if (a === "--out") {
            badge = argv[++i] || true;
        }
        else if (a === "--help" || a === "-h")
            positional.push("help");
        else if (a.startsWith("--"))
            throw new Error(`unknown flag: ${a}`);
        else
            positional.push(a);
    }
    return { json, minScore, history, badge, limit, positional };
}
function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : e);
        usage();
        process.exit(2);
    }
    const { json, minScore, history, badge, limit, positional } = opts;
    const head = positional[0];
    if (head === "help") {
        usage();
        return;
    }
    if (head === "version" || head === "-v" || head === "--version") {
        console.log("0.2.0");
        return;
    }
    if (head === "history") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const lines = readHistory(target, limit);
        if (json)
            console.log(JSON.stringify(lines, null, 2));
        else if (!lines.length)
            console.log("no history yet — run: solo-watch scan --history");
        else {
            for (const l of lines) {
                console.log(`${l.ts.slice(0, 19)}  ${l.grade} ${String(l.score).padStart(3)}  ${l.finding_ids.join(",") || "—"}`);
            }
        }
        return;
    }
    if (head === "badge") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const report = scanRepo(target);
        const out = typeof badge === "string"
            ? badge
            : path.join(target, ".solo-watch", "badge.svg");
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, badgeSvg(report.score, report.grade), "utf8");
        console.log(`badge  ${out}  (${report.grade} ${report.score})`);
        return;
    }
    let target = process.cwd();
    if (head === "scan")
        target = positional[1] ?? process.cwd();
    else if (head && head !== "scan")
        target = head;
    const report = scanRepo(target);
    if (history) {
        const hp = appendHistory(report);
        if (!json)
            console.error(`history ${hp}`);
    }
    if (badge) {
        const out = badge === true
            ? path.join(report.root, ".solo-watch", "badge.svg")
            : path.resolve(String(badge));
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, badgeSvg(report.score, report.grade), "utf8");
        if (!json)
            console.error(`badge   ${out}`);
    }
    if (json) {
        console.log(JSON.stringify({ ...report, minScore }, null, 2));
    }
    else {
        console.log(formatReport(report));
        console.log(`\nmin-score ${minScore}  →  ${report.score >= minScore ? "PASS" : "FAIL"}`);
    }
    process.exit(report.score >= minScore ? 0 : 1);
}
main();
