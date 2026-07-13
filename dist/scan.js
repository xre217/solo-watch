import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
function exists(root, rel) {
    return existsSync(path.join(root, rel));
}
function tryGit(root, args) {
    try {
        return execSync(`git ${args}`, {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    }
    catch {
        return null;
    }
}
function listDeep(root, max = 4000) {
    const out = [];
    const walk = (dir) => {
        if (out.length >= max)
            return;
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const name of entries) {
            if (name === "node_modules" || name === ".git" || name === "dist" || name === "target") {
                continue;
            }
            const full = path.join(dir, name);
            let st;
            try {
                st = statSync(full);
            }
            catch {
                continue;
            }
            const rel = path.relative(root, full);
            if (st.isDirectory())
                walk(full);
            else
                out.push(rel);
        }
    };
    walk(root);
    return out;
}
export function scanRepo(rootInput) {
    const root = path.resolve(rootInput);
    const findings = [];
    const isGit = exists(root, ".git");
    const hasPackageJson = exists(root, "package.json");
    const hasCargo = exists(root, "Cargo.toml");
    const hasReadme = exists(root, "README.md") || exists(root, "README") || exists(root, "readme.md");
    const hasCi = exists(root, ".github/workflows") ||
        exists(root, ".gitlab-ci.yml") ||
        exists(root, "Jenkinsfile") ||
        exists(root, ".circleci/config.yml");
    const files = listDeep(root);
    const hasTests = files.some((f) => /(^|\/)(tests?|__tests__)(\/|$)/i.test(f)) ||
        files.some((f) => /\.(test|spec)\.(ts|js|tsx|jsx|rs|py)$/i.test(f));
    const hasLock = exists(root, "package-lock.json") ||
        exists(root, "pnpm-lock.yaml") ||
        exists(root, "yarn.lock") ||
        exists(root, "Cargo.lock");
    const dirtyOut = isGit ? tryGit(root, "status --porcelain") : null;
    const dirty = Boolean(dirtyOut && dirtyOut.length > 0);
    let lastCommitDays = null;
    if (isGit) {
        const ts = tryGit(root, "log -1 --format=%ct");
        if (ts && /^\d+$/.test(ts)) {
            lastCommitDays = (Date.now() / 1000 - Number(ts)) / 86400;
        }
    }
    if (!isGit) {
        findings.push({
            id: "no-git",
            severity: "fail",
            title: "Not a git repository",
            detail: "No .git — cannot track deploy drift or history",
            weight: 25,
        });
    }
    if (!hasReadme) {
        findings.push({
            id: "no-readme",
            severity: "warn",
            title: "Missing README",
            detail: "No README.md — operators and agents lack entry docs",
            weight: 10,
        });
    }
    if (!hasCi) {
        findings.push({
            id: "no-ci",
            severity: "warn",
            title: "No CI config detected",
            detail: "No GitHub Actions / GitLab CI / Circle / Jenkins",
            weight: 15,
        });
    }
    if (!hasTests) {
        findings.push({
            id: "no-tests",
            severity: "fail",
            title: "No tests detected",
            detail: "No test dirs or *.test.* / *.spec.* files",
            weight: 20,
        });
    }
    if (hasPackageJson && !hasLock) {
        findings.push({
            id: "no-lockfile",
            severity: "warn",
            title: "package.json without lockfile",
            detail: "Reproducible installs need package-lock / pnpm-lock / yarn.lock",
            weight: 12,
        });
    }
    if (hasPackageJson) {
        try {
            const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
            const scripts = pkg.scripts ?? {};
            if (!scripts.test && !scripts["test:unit"]) {
                findings.push({
                    id: "no-test-script",
                    severity: "warn",
                    title: "No npm test script",
                    detail: "package.json missing scripts.test",
                    weight: 8,
                });
            }
            if (!scripts.build && !scripts.prepare && hasPackageJson) {
                // only mild — libraries may not need build
                if (exists(root, "tsconfig.json") && !scripts.build) {
                    findings.push({
                        id: "no-build-script",
                        severity: "info",
                        title: "TypeScript without build script",
                        detail: "tsconfig present but no scripts.build",
                        weight: 4,
                    });
                }
            }
        }
        catch {
            findings.push({
                id: "bad-package-json",
                severity: "fail",
                title: "Invalid package.json",
                detail: "Could not parse package.json",
                weight: 15,
            });
        }
    }
    if (!hasPackageJson && !hasCargo) {
        findings.push({
            id: "no-manifest",
            severity: "info",
            title: "No package.json or Cargo.toml",
            detail: "Scanner is optimized for JS/TS and Rust trees",
            weight: 5,
        });
    }
    if (dirty) {
        findings.push({
            id: "dirty-tree",
            severity: "warn",
            title: "Dirty working tree",
            detail: "Uncommitted changes — deploy may not match git HEAD",
            weight: 8,
        });
    }
    if (lastCommitDays != null && lastCommitDays > 90) {
        findings.push({
            id: "stale-commits",
            severity: "warn",
            title: "Stale repository",
            detail: `Last commit ~${Math.floor(lastCommitDays)} days ago`,
            weight: 10,
        });
    }
    // Secret-ish filenames (not content scan — keep safe/simple)
    const secretNames = files.filter((f) => /(^|\/)\.env($|\.)|(^|\/)id_rsa$|(^|\/)credentials\.json$|(^|\/)service-account.*\.json$/i.test(f));
    if (secretNames.length) {
        findings.push({
            id: "secret-filenames",
            severity: "fail",
            title: "Sensitive filenames present",
            detail: secretNames.slice(0, 5).join(", ") + (secretNames.length > 5 ? "…" : ""),
            weight: 18,
        });
    }
    const penalty = findings.reduce((s, f) => s + f.weight, 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
    return {
        root,
        score,
        grade,
        findings: findings.sort((a, b) => b.weight - a.weight),
        meta: {
            isGit,
            hasPackageJson,
            hasCi,
            hasTests,
            hasReadme,
            dirty,
            lastCommitDays,
        },
    };
}
export function formatReport(r) {
    const lines = [
        `solo-watch · repo health`,
        `root    ${r.root}`,
        `score   ${r.score}/100  grade ${r.grade}`,
        `meta    git=${r.meta.isGit} ci=${r.meta.hasCi} tests=${r.meta.hasTests} readme=${r.meta.hasReadme} dirty=${r.meta.dirty}`,
        ``,
    ];
    if (!r.findings.length) {
        lines.push("findings: none — tree looks healthy under current rules");
    }
    else {
        lines.push("findings:");
        for (const f of r.findings) {
            lines.push(`  [${f.severity}] ${f.id} (+${f.weight}) ${f.title}`);
            lines.push(`           ${f.detail}`);
        }
    }
    return lines.join("\n");
}
