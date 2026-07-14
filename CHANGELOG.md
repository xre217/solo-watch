# Changelog

## 0.8.1

- Secret heuristic: allow `.env.example` / `.env.sample` / `.env.template` / `.env.dist` (still fail live `.env*`)
- Landing pin + docs stay on current public tag

## 0.8.0

- `--sarif <file>` SARIF 2.1.0 export
- `--strict` fail on any severity=fail finding
- NEXT LEVEL ship for Solo Leveling Forge

## 0.7.0

- `solo-watch doctor` — CLI + smoke scan self-check
- `solo-watch rank` — history score timeline / rank-up bar

## 0.6.0

- `solo-watch init` scaffolds `.solo-watch/config.json`
- `--quiet` / `-q` for CI gate without human report
- `AGENTS.md` for machine operators

## 0.5.0

- Config `skipDirs` for custom tree skips
- Built-in skip: `.solo-watch`, `vendor`, `__pycache__`, `.turbo`, `.cache`
- `scanRepo(root, { skipDirs })` options API

## 0.4.1

- Signals: Makefile, runtime pin (.nvmrc), AGENTS.md/CLAUDE.md

## 0.4.0

- Multi-path scan: `solo-watch scan ./a ./b`
- `.solo-watch/config.json` defaults (minScore, history, badge, delta)
- `--write <file>` JSON report export
- Multi-root `--json` summary (avg score, grades)

## 0.3.1

- `--md` markdown report
- `--annotate` GitHub Actions annotations
- Action: optional annotations step
- Tests for md/annotate

## 0.3.0

- `solo-watch watch` — interval rescan with auto-history + delta
- `--delta` — score/grade/finding movement vs last history line
- Stronger history helpers (`deltaAgainstHistory`, `formatDelta`)
- Version string 0.3.0

## 0.2.0

- More signals: LICENSE, Docker, CODEOWNERS, SECURITY, CONTRIBUTING, .gitignore, engines, key material
- Positive OK findings (bonuses) for healthy structure
- `solo-watch history` + `--history` → `.solo-watch/history.jsonl`
- `solo-watch badge` / `--badge` SVG instrument badge
- Meta: branch, license, docker; scanned_at timestamp
- Tests for history + badge

## 0.1.1

- Distribution: npm pack layout, MIT license, GHA action

## 0.1.0

- Initial scan
