# Changelog

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
