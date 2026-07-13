#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { badgeSvg, formatAnnotations, formatMarkdown, formatReport, scanRepo, } from "./scan.js";
import { appendHistory, deltaAgainstHistory, formatDelta, readHistory, } from "./history.js";
import { loadConfig } from "./config.js";
const VERSION = "0.7.0";
function usage() {
    console.log(`solo-watch ${VERSION} — Solo Leveling Forge

Usage:
  solo-watch [scan] [path...] [flags]
  solo-watch watch [path] [--interval SEC] [flags]
  solo-watch history [path] [--limit N]
  solo-watch badge [path] [--out file.svg]
  solo-watch init [path]     scaffold .solo-watch/config.json
  solo-watch doctor [path]   self-check CLI + scan smoke
  solo-watch rank [path]     last N history ranks (score timeline)
  solo-watch help | version

Flags:
  --json --md --annotate
  --min-score N     (default 55, or .solo-watch/config.json)
  --history --badge [file] --delta
  --write <file>    write JSON report(s) to file
  --quiet           suppress human report (exit code only + optional json)
  --interval SEC    watch mode (default 30)

Multi-path: solo-watch scan ./a ./b --json
Config:     .solo-watch/config.json  { "minScore": 60, "history": true, "skipDirs": [] }

npx --yes github:xre217/solo-watch@v0.7.0 scan .
`);
}
function parseArgs(argv) {
    let json = false;
    let md = false;
    let annotate = false;
    let minScore;
    let history = false;
    let badge = false;
    let delta = false;
    let writePath = null;
    let quiet = false;
    let limit = 20;
    let interval = 30;
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--json")
            json = true;
        else if (a === "--md" || a === "--markdown")
            md = true;
        else if (a === "--annotate" || a === "--annotations")
            annotate = true;
        else if (a === "--history")
            history = true;
        else if (a === "--quiet" || a === "-q")
            quiet = true;
        else if (a === "--delta")
            delta = true;
        else if (a === "--min-score" || a === "--fail-below") {
            const n = Number(argv[++i]);
            if (!Number.isFinite(n))
                throw new Error(`${a} requires a number`);
            minScore = n;
        }
        else if (a === "--write") {
            writePath = argv[++i];
            if (!writePath)
                throw new Error("--write requires a path");
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
    return {
        json,
        md,
        annotate,
        minScore,
        history,
        badge,
        delta,
        writePath,
        quiet,
        limit,
        interval,
        positional,
    };
}
function executeScan(target, opts) {
    const cfg = loadConfig(target);
    const history = opts.history || Boolean(cfg.history);
    const badge = opts.badge || (cfg.badge ? true : false);
    const deltaFlag = opts.delta || Boolean(cfg.delta);
    const minScore = opts.minScore;
    const prior = deltaFlag || history ? readHistory(target, 1)[0] : null;
    const report = scanRepo(target, { skipDirs: cfg.skipDirs });
    const d = deltaFlag || history
        ? deltaAgainstHistory(report, prior ?? null)
        : null;
    if (history)
        appendHistory(report);
    if (badge) {
        const out = badge === true
            ? path.join(report.root, ".solo-watch", "badge.svg")
            : path.resolve(String(badge));
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, badgeSvg(report.score, report.grade), "utf8");
    }
    return {
        report,
        delta: d,
        code: report.score >= minScore ? 0 : 1,
    };
}
function printHuman(report, d, minScore, code) {
    console.log(formatReport(report));
    if (d)
        console.log("\n" + formatDelta(d));
    console.log(`\nmin-score ${minScore}  →  ${code === 0 ? "PASS" : "FAIL"}`);
}
function resolveMinScore(explicit, targets) {
    if (explicit != null)
        return explicit;
    for (const t of targets) {
        const c = loadConfig(t);
        if (c.minScore != null)
            return c.minScore;
    }
    return 55;
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
    const { json, md, annotate, minScore: minScoreArg, history, badge, delta, writePath, quiet, limit, interval, positional, } = opts;
    const head = positional[0];
    if (head === "help") {
        usage();
        return;
    }
    if (head === "version" || head === "-v" || head === "--version") {
        console.log(VERSION);
        return;
    }
    if (head === "init") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const dir = path.join(target, ".solo-watch");
        mkdirSync(dir, { recursive: true });
        const cfgPath = path.join(dir, "config.json");
        const body = {
            minScore: 55,
            history: true,
            badge: true,
            delta: true,
            skipDirs: [],
        };
        writeFileSync(cfgPath, JSON.stringify(body, null, 2) + "\n", "utf8");
        console.log(`init  ${cfgPath}`);
        console.log(`run   solo-watch scan ${target} --history --badge`);
        return;
    }
    if (head === "doctor") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const checks = [];
        checks.push({
            name: "node",
            ok: true,
            detail: process.version,
        });
        checks.push({
            name: "scan_fn",
            ok: typeof scanRepo === "function",
            detail: "scanRepo export",
        });
        let smokeOk = false;
        let smokeScore = -1;
        try {
            const r = scanRepo(target);
            smokeOk = r.score >= 0 && Boolean(r.grade);
            smokeScore = r.score;
        }
        catch (e) {
            checks.push({
                name: "smoke_scan",
                ok: false,
                detail: e instanceof Error ? e.message : String(e),
            });
        }
        if (smokeScore >= 0) {
            checks.push({
                name: "smoke_scan",
                ok: smokeOk,
                detail: `score ${smokeScore} on ${target}`,
            });
        }
        const cfg = loadConfig(target);
        checks.push({
            name: "config",
            ok: true,
            detail: Object.keys(cfg).length
                ? `loaded keys: ${Object.keys(cfg).join(",")}`
                : "defaults (no config.json)",
        });
        console.log(`doctor · solo-watch ${VERSION}\n`);
        let fails = 0;
        for (const c of checks) {
            if (!c.ok)
                fails++;
            console.log(`  ${c.ok ? "✓" : "✗"} ${c.name.padEnd(12)} ${c.detail}`);
        }
        console.log(fails ? `\n  FAIL ${fails}` : `\n  PASS`);
        process.exit(fails ? 1 : 0);
    }
    if (head === "rank") {
        const target = path.resolve(positional[1] ?? process.cwd());
        const lines = readHistory(target, limit);
        if (!lines.length) {
            console.log("no history — run: solo-watch scan --history");
            process.exit(0);
        }
        if (json) {
            console.log(JSON.stringify(lines, null, 2));
            return;
        }
        console.log(`rank · last ${lines.length} scans · ${target}\n`);
        for (const l of lines) {
            const bar = "█".repeat(Math.max(1, Math.round(l.score / 5)));
            console.log(`  ${l.ts.slice(0, 19)}  ${l.grade} ${String(l.score).padStart(3)}  ${bar}`);
        }
        const first = lines[0];
        const last = lines[lines.length - 1];
        const d = last.score - first.score;
        console.log(`\n  span  ${first.score} → ${last.score}  (${d >= 0 ? "+" : ""}${d})`);
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
        const minScore = resolveMinScore(minScoreArg, [target]);
        console.error(`watch  ${target}  every ${interval}s  (ctrl-c stop)`);
        for (;;) {
            console.error(`\n── ${new Date().toISOString()} ──`);
            const { report, delta: d, code } = executeScan(target, {
                minScore,
                history: true,
                badge,
                delta: true,
            });
            if (annotate)
                console.log(formatAnnotations(report));
            if (json) {
                console.log(JSON.stringify({ ...report, minScore, delta: d }, null, 2));
            }
            else if (md) {
                console.log(formatMarkdown(report));
                if (d)
                    console.log("\n" + formatDelta(d));
            }
            else {
                printHuman(report, d, minScore, code);
            }
            await new Promise((r) => setTimeout(r, interval * 1000));
        }
    }
    let paths = [];
    if (head === "scan")
        paths = positional.slice(1);
    else if (head)
        paths = positional;
    if (!paths.length)
        paths = [process.cwd()];
    paths = paths.map((p) => path.resolve(p));
    const minScore = resolveMinScore(minScoreArg, paths);
    const runOpts = { minScore, history, badge, delta };
    if (paths.length === 1) {
        const { report, delta: d, code } = executeScan(paths[0], runOpts);
        if (annotate)
            console.log(formatAnnotations(report));
        if (writePath) {
            const p = path.resolve(writePath);
            mkdirSync(path.dirname(p), { recursive: true });
            writeFileSync(p, JSON.stringify({ ...report, minScore, delta: d }, null, 2) + "\n");
            if (!json)
                console.error(`wrote   ${p}`);
        }
        if (json) {
            console.log(JSON.stringify({ ...report, minScore, delta: d }, null, 2));
        }
        else if (md) {
            console.log(formatMarkdown(report));
            if (d)
                console.log("\n" + formatDelta(d));
        }
        else if (quiet) {
            console.error(`solo-watch ${report.grade} ${report.score} min=${minScore} → ${code === 0 ? "PASS" : "FAIL"}`);
        }
        else if (!annotate || process.env.SOLO_WATCH_HUMAN === "1") {
            printHuman(report, d, minScore, code);
        }
        else {
            console.error(`solo-watch ${report.grade} ${report.score} min=${minScore} → ${code === 0 ? "PASS" : "FAIL"}`);
        }
        process.exit(code);
    }
    // multi-path
    const bundle = [];
    let worst = 0;
    for (const p of paths) {
        if (!json && !md)
            console.log(`\n══ ${p} ══`);
        const r = executeScan(p, runOpts);
        bundle.push(r);
        if (r.code > worst)
            worst = r.code;
        if (!json) {
            if (annotate)
                console.log(formatAnnotations(r.report));
            if (md) {
                console.log(formatMarkdown(r.report));
                if (r.delta)
                    console.log("\n" + formatDelta(r.delta));
            }
            else {
                printHuman(r.report, r.delta, minScore, r.code);
            }
        }
    }
    if (json) {
        console.log(JSON.stringify({
            version: VERSION,
            minScore,
            reports: bundle.map((b) => ({
                ...b.report,
                delta: b.delta,
            })),
            summary: {
                count: bundle.length,
                avg_score: Math.round(bundle.reduce((s, b) => s + b.report.score, 0) / bundle.length),
                grades: bundle.map((b) => b.report.grade),
                pass: worst === 0,
            },
        }, null, 2));
    }
    else {
        const avg = Math.round(bundle.reduce((s, b) => s + b.report.score, 0) / bundle.length);
        console.log(`\nsummary  ${bundle.length} roots  avg ${avg}  worst_exit ${worst}`);
    }
    if (writePath) {
        const p = path.resolve(writePath);
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, JSON.stringify({
            version: VERSION,
            minScore,
            reports: bundle.map((b) => b.report),
        }, null, 2) + "\n");
        console.error(`wrote   ${p}`);
    }
    process.exit(worst);
}
main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
});
