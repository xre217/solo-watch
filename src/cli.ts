#!/usr/bin/env node
import { formatReport, scanRepo } from "./scan.js";

function usage(): void {
  console.log(`solo-watch — Solo Leveling Forge (repo / deploy health)

Usage:
  solo-watch [scan] [path] [--json] [--min-score N]
  solo-watch help
  solo-watch version

Examples:
  solo-watch
  solo-watch scan .
  solo-watch scan ~/SAO --json
  solo-watch --min-score 70

Exit codes:
  0  score >= min-score (default 55)
  1  score < min-score
  2  usage error

Forge of Solo Leveling haven — surplus funds thrivability, not founders.
`);
}

function parseArgs(argv: string[]) {
  let json = false;
  let minScore = 55;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") json = true;
    else if (a === "--min-score" || a === "--fail-below") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n)) throw new Error(`${a} requires a number`);
      minScore = n;
    } else if (a === "--help" || a === "-h") positional.push("help");
    else if (a.startsWith("--")) throw new Error(`unknown flag: ${a}`);
    else positional.push(a);
  }
  return { json, minScore, positional };
}

function main(): void {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    usage();
    process.exit(2);
  }

  const { json, minScore, positional } = opts;
  const head = positional[0];

  if (head === "help") {
    usage();
    return;
  }
  if (head === "version" || head === "-v" || head === "--version") {
    console.log("0.1.1");
    return;
  }

  // `solo-watch`, `solo-watch scan`, `solo-watch .`, `solo-watch scan ./path`
  let target = process.cwd();
  if (head === "scan") {
    target = positional[1] ?? process.cwd();
  } else if (head && head !== "scan") {
    target = head;
  }

  const report = scanRepo(target);
  if (json) {
    console.log(JSON.stringify({ ...report, minScore }, null, 2));
  } else {
    console.log(formatReport(report));
    console.log(`\nmin-score ${minScore}  →  ${report.score >= minScore ? "PASS" : "FAIL"}`);
  }
  process.exit(report.score >= minScore ? 0 : 1);
}

main();
