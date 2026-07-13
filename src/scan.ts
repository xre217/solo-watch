import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export type Finding = {
  id: string;
  severity: "info" | "warn" | "fail" | "ok";
  title: string;
  detail: string;
  weight: number; // penalty if fail/warn; bonus if ok (negative weight applied as bonus)
};

export type ScanReport = {
  root: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: Finding[];
  meta: {
    isGit: boolean;
    hasPackageJson: boolean;
    hasCi: boolean;
    hasTests: boolean;
    hasReadme: boolean;
    hasLicense: boolean;
    hasDocker: boolean;
    dirty: boolean;
    lastCommitDays: number | null;
    branch: string | null;
  };
  scanned_at: string;
};

function exists(root: string, rel: string): boolean {
  return existsSync(path.join(root, rel));
}

function tryGit(root: string, args: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function listDeep(root: string, max = 5000): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (out.length >= max) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (
        name === "node_modules" ||
        name === ".git" ||
        name === "dist" ||
        name === "target" ||
        name === ".next" ||
        name === "coverage"
      ) {
        continue;
      }
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
}

export function scanRepo(rootInput: string): ScanReport {
  const root = path.resolve(rootInput);
  const findings: Finding[] = [];
  const isGit = exists(root, ".git");
  const hasPackageJson = exists(root, "package.json");
  const hasCargo = exists(root, "Cargo.toml");
  const hasPy =
    exists(root, "pyproject.toml") ||
    exists(root, "requirements.txt") ||
    exists(root, "setup.py");
  const hasReadme =
    exists(root, "README.md") || exists(root, "README") || exists(root, "readme.md");
  const hasLicense =
    exists(root, "LICENSE") ||
    exists(root, "LICENSE.md") ||
    exists(root, "LICENSE.txt") ||
    exists(root, "COPYING");
  const hasCi =
    exists(root, ".github/workflows") ||
    exists(root, ".gitlab-ci.yml") ||
    exists(root, "Jenkinsfile") ||
    exists(root, ".circleci/config.yml") ||
    exists(root, ".buildkite");
  const hasDocker =
    exists(root, "Dockerfile") ||
    exists(root, "docker-compose.yml") ||
    exists(root, "compose.yml");
  const hasEditorconfig = exists(root, ".editorconfig");
  const hasGitignore = exists(root, ".gitignore");
  const hasCodeowners =
    exists(root, "CODEOWNERS") || exists(root, ".github/CODEOWNERS");
  const hasSecurity =
    exists(root, "SECURITY.md") || exists(root, ".github/SECURITY.md");
  const hasContributing =
    exists(root, "CONTRIBUTING.md") || exists(root, "CONTRIBUTING");

  const files = listDeep(root);
  const hasTests =
    files.some((f) => /(^|\/)(tests?|__tests__)(\/|$)/i.test(f)) ||
    files.some((f) => /\.(test|spec)\.(ts|js|tsx|jsx|rs|py)$/i.test(f));
  const hasLock =
    exists(root, "package-lock.json") ||
    exists(root, "pnpm-lock.yaml") ||
    exists(root, "yarn.lock") ||
    exists(root, "Cargo.lock") ||
    exists(root, "poetry.lock") ||
    exists(root, "uv.lock");

  const dirtyOut = isGit ? tryGit(root, "status --porcelain") : null;
  const dirty = Boolean(dirtyOut && dirtyOut.length > 0);
  const branch = isGit ? tryGit(root, "rev-parse --abbrev-ref HEAD") : null;

  let lastCommitDays: number | null = null;
  if (isGit) {
    const ts = tryGit(root, "log -1 --format=%ct");
    if (ts && /^\d+$/.test(ts)) {
      lastCommitDays = (Date.now() / 1000 - Number(ts)) / 86400;
    }
  }

  // --- penalties ---
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
      detail: "No README.md — operators lack entry docs",
      weight: 10,
    });
  }

  if (!hasLicense && (hasPackageJson || hasCargo || hasPy)) {
    findings.push({
      id: "no-license",
      severity: "warn",
      title: "No LICENSE file",
      detail: "Public or shared code without an explicit license",
      weight: 8,
    });
  }

  if (!hasCi) {
    findings.push({
      id: "no-ci",
      severity: "warn",
      title: "No CI config detected",
      detail: "No GitHub Actions / GitLab CI / Circle / Jenkins / Buildkite",
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
      detail: "Reproducible installs need a lockfile",
      weight: 12,
    });
  }

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
        scripts?: Record<string, string>;
        private?: boolean;
        engines?: unknown;
      };
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
      if (exists(root, "tsconfig.json") && !scripts.build && !scripts.prepare) {
        findings.push({
          id: "no-build-script",
          severity: "info",
          title: "TypeScript without build/prepare script",
          detail: "tsconfig present but no scripts.build/prepare",
          weight: 4,
        });
      }
      if (!pkg.engines) {
        findings.push({
          id: "no-engines",
          severity: "info",
          title: "No engines field",
          detail: "package.json missing engines — runtime floor unclear",
          weight: 2,
        });
      }
    } catch {
      findings.push({
        id: "bad-package-json",
        severity: "fail",
        title: "Invalid package.json",
        detail: "Could not parse package.json",
        weight: 15,
      });
    }
  }

  if (!hasPackageJson && !hasCargo && !hasPy) {
    findings.push({
      id: "no-manifest",
      severity: "info",
      title: "No common language manifest",
      detail: "No package.json / Cargo.toml / pyproject / requirements",
      weight: 5,
    });
  }

  if (!hasGitignore && isGit) {
    findings.push({
      id: "no-gitignore",
      severity: "info",
      title: "No .gitignore",
      detail: "Risk of committing build artifacts or secrets",
      weight: 4,
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
  } else if (lastCommitDays != null && lastCommitDays > 30) {
    findings.push({
      id: "aging-commits",
      severity: "info",
      title: "Quiet repository",
      detail: `Last commit ~${Math.floor(lastCommitDays)} days ago`,
      weight: 3,
    });
  }

  const secretNames = files.filter((f) =>
    /(^|\/)\.env($|\.)|(^|\/)id_rsa$|(^|\/)credentials\.json$|(^|\/)service-account.*\.json$|(^|\/)\.aws\/credentials$/i.test(
      f,
    ),
  );
  if (secretNames.length) {
    findings.push({
      id: "secret-filenames",
      severity: "fail",
      title: "Sensitive filenames present",
      detail: secretNames.slice(0, 5).join(", ") + (secretNames.length > 5 ? "…" : ""),
      weight: 18,
    });
  }

  // large binary-ish dumps
  if (files.some((f) => /\.(pem|p12|pfx|keystore)$/i.test(f))) {
    findings.push({
      id: "key-material-files",
      severity: "fail",
      title: "Key material filenames",
      detail: "Found .pem/.p12/.pfx/.keystore paths in tree",
      weight: 16,
    });
  }

  // --- bonuses (ok findings, negative contribution to penalty) ---
  if (hasCi) {
    findings.push({
      id: "has-ci",
      severity: "ok",
      title: "CI present",
      detail: "Continuous integration config detected",
      weight: -5,
    });
  }
  if (hasTests) {
    findings.push({
      id: "has-tests",
      severity: "ok",
      title: "Tests present",
      detail: "Test layout or files detected",
      weight: -5,
    });
  }
  if (hasLicense) {
    findings.push({
      id: "has-license",
      severity: "ok",
      title: "LICENSE present",
      detail: "Explicit license file",
      weight: -3,
    });
  }
  if (hasDocker) {
    findings.push({
      id: "has-docker",
      severity: "ok",
      title: "Container config",
      detail: "Dockerfile or compose present",
      weight: -2,
    });
  }
  if (hasCodeowners) {
    findings.push({
      id: "has-codeowners",
      severity: "ok",
      title: "CODEOWNERS",
      detail: "Ownership map present",
      weight: -2,
    });
  }
  if (hasSecurity) {
    findings.push({
      id: "has-security-md",
      severity: "ok",
      title: "SECURITY.md",
      detail: "Vulnerability reporting surface",
      weight: -2,
    });
  }
  if (hasContributing) {
    findings.push({
      id: "has-contributing",
      severity: "ok",
      title: "CONTRIBUTING",
      detail: "Contribution path documented",
      weight: -1,
    });
  }
  if (hasEditorconfig) {
    findings.push({
      id: "has-editorconfig",
      severity: "ok",
      title: ".editorconfig",
      detail: "Consistent editor baseline",
      weight: -1,
    });
  }

  const net = findings.reduce((s, f) => s + f.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - net));
  const grade =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

  return {
    root,
    score,
    grade,
    findings: findings.sort((a, b) => {
      const order = { fail: 0, warn: 1, info: 2, ok: 3 };
      return order[a.severity] - order[b.severity] || Math.abs(b.weight) - Math.abs(a.weight);
    }),
    meta: {
      isGit,
      hasPackageJson,
      hasCi,
      hasTests,
      hasReadme,
      hasLicense,
      hasDocker,
      dirty,
      lastCommitDays,
      branch,
    },
    scanned_at: new Date().toISOString(),
  };
}

export function formatReport(r: ScanReport): string {
  const lines: string[] = [
    `solo-watch · repo health`,
    `root    ${r.root}`,
    `score   ${r.score}/100  grade ${r.grade}`,
    `meta    git=${r.meta.isGit} branch=${r.meta.branch ?? "—"} ci=${r.meta.hasCi} tests=${r.meta.hasTests} readme=${r.meta.hasReadme} license=${r.meta.hasLicense} docker=${r.meta.hasDocker} dirty=${r.meta.dirty}`,
    `at      ${r.scanned_at}`,
    ``,
  ];
  const problems = r.findings.filter((f) => f.severity !== "ok");
  const oks = r.findings.filter((f) => f.severity === "ok");
  if (!problems.length) {
    lines.push("findings: none negative — tree looks healthy under current rules");
  } else {
    lines.push("findings:");
    for (const f of problems) {
      const sign = f.weight > 0 ? `+${f.weight}` : String(f.weight);
      lines.push(`  [${f.severity}] ${f.id} (${sign}) ${f.title}`);
      lines.push(`           ${f.detail}`);
    }
  }
  if (oks.length) {
    lines.push("");
    lines.push("signals:");
    for (const f of oks) {
      lines.push(`  [ok] ${f.id} (${f.weight}) ${f.title}`);
    }
  }
  return lines.join("\n");
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#3d8b40";
    case "B":
      return "#4caf50";
    case "C":
      return "#c49a00";
    case "D":
      return "#e65100";
    default:
      return "#b3261e";
  }
}

/** Tiny SVG badge for READMEs / dashboards — instrument, not persona. */
export function badgeSvg(score: number, grade: string): string {
  const color = gradeColor(grade);
  const label = "solo-watch";
  const value = `${grade} ${score}`;
  const lw = 72;
  const vw = 54;
  const w = lw + vw;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="m"><rect width="${w}" height="20" rx="3" fill="#fff"/></mask>
  <g mask="url(#m)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="14">${value}</text>
  </g>
</svg>
`;
}
