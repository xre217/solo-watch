#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { badgeSvg, formatReport, scanRepo } from "./scan.js";
import { appendHistory, deltaAgainstHistory, formatDelta, readHistory, } from "./history.js";
const VERSION = "0.3.0";
function usage() {
    console.log(`solo-watch ${VERSION} — Solo Leveling Forge (repo / deploy health)

Usage:
  solo-watch [scan] [path] [flags]
  solo-watch watch [path] [--interval SEC] [flags]
  solo-watch history [path] [--limit N]
  solo-watch badge [path] [--out file.svg]
  solo-watch help | version

Flags:
  --json            machine report
  --min-score N     pass floor (default 55)
  --history         append to .solo-watch/history.jsonl
  --badge [file]    write SVG badge
  --delta           show score/finding delta vs last history
  --interval SEC    watch poll interval (default 30)

Exit: 0 pass · 1 below min-score · 2 usage

npx --yes github:xre217/solo-watch@v0.3.0 scan .
Instrument panel. Not a coworker. Theme: provisional / operator choice.
`);
}
function parseArgs(argv) {
    let json = false;
    let minScore = 55;
    let history = false;
    let badge = false;
    let delta = false;
    let limit = 20;
    let interval = 30;
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--json")
            json = true;
        else if (a === "--history")
            history = true;
        else if (a === "--delta")
            delta = true;
        else if (a === "--min-score" || a === "--fail-below") {
            const n = Number(argv[++i]);
            if (!Number.isFinite(n))
                throw new Error(`${a} requires a number`);
            minScore = n;
        }
        else if (a === "--limit") {
            limit = Number(argv[++i]) || 20;
        }
        else if (a === "--interval") {
            interval = Math.max(5, Number(argv[++i]) || 30);
        }
        else if (a === "--badge") {
            const next = argv[i + 1];
            if (next && !next.startsWith("--")) {
                badge = next;
                i++;
            }
            else
                badge = true;
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
    return { json, minScore, history, badge, delta, limit, interval, positional };
}
function runOnce(target, opts) {
    const prior = opts.delta || opts.history ? readHistory(target, 1)[0] : null;
    const report = scanRepo(target);
    const d = opts.delta || opts.history
        ? deltaAgainstHistory(report, prior ?? null)
        : null;
    if (opts.history) {
        const hp = appendHistory(report);
        if (!opts.json)
            console.error(`history ${hp}`);
    }
    if (opts.badge) {
        const out = opts.badge === true
            ? path.join(report.root, ".solo-watch", "badge.svg")
            : path.resolve(String(opts.badge));
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, badgeSvg(report.score, report.grade), "utf8");
        if (!opts.json)
            console.error(`badge   ${out}`);
    }
    if (opts.json) {
        console.log(JSON.stringify({ ...report, minScore: opts.minScore, delta: d }, null, 2));
    }
    else {
        console.log(formatReport(report));
        if (d)
            console.log("\n" + formatDelta(d));
        console.log(`\nmin-score ${opts.minScore}  →  ${report.score >= opts.minScore ? "PASS" : "FAIL"}`);
    }
    return report.score >= opts.minScore ? 0 : 1;
}
async function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : e);
        usage();
        process.exit(2);
    }
    const { json, minScore, history, badge, delta, limit, interval, positional } = opts;
    const head = positional[0];
    if (head === "help") {
        usage();
        return;
    }
    if (head === "version" || head === "-v" || head === "--version") {
        console.log(VERSION);
        return;
    }
    if (head === "history") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const lines = readHistory(target, limit);
        if (json)
            console.log(JSON.stringify(lines, null, 2));
        else if (!lines.length) {
            console.log("no history yet — run: solo-watch scan --history");
        }
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
    if (head === "watch") {
        const target = path.resolve(positional[1] ?? process.cwd());
        console.error(`watch  ${target}  every ${interval}s  (ctrl-c stop)`);
        for (;;) {
            console.error(`\n── ${new Date().toISOString()} ──`);
            runOnce(target, {
                json,
                minScore,
                history: history || true,
                badge,
                delta: true,
            });
            await new Promise((r) => setTimeout(r, interval * 1000));
        }
    }
    let target = process.cwd();
    if (head === "scan")
        target = positional[1] ?? process.cwd();
    else if (head && head !== "scan")
        target = head;
    process.exit(runOnce(path.resolve(target), { json, minScore, history, badge, delta }));
}
main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
});
