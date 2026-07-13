# solo-watch

**Solo Leveling Forge** — repo / deploy health scanner.

Real CLI: CI, tests, lockfiles, README, dirty git, stale commits, sensitive filenames → **score + grade + findings**.

Feeds the **haven**: distribution → users → (later) revenue → Treasury thrivability only.

## Quick start

```bash
cd ~/Projects/solo-leveling/products/solo-watch
npm install
npm test
node dist/cli.js                # scan cwd
node dist/cli.js scan ~/SAO --history --badge --delta
node dist/cli.js history .
node dist/cli.js badge .
node dist/cli.js watch . --interval 60
node dist/cli.js scan . --json --min-score 70
```

### npx (works now — GitHub, no npm account)

```bash
npx --yes github:xre217/solo-watch scan .
npx --yes github:xre217/solo-watch@v0.4.0 scan . --history --badge --delta
npx --yes github:xre217/solo-watch@v0.4.0 scan ./a ./b --json
```

### npx (from this package dir)

```bash
npx --yes . scan .
```

### After npm registry publish (needs `npm login` + `./scripts/publish.sh`)

```bash
npx solo-watch@0.2.0 scan .
```

## GitHub

**Repo:** https://github.com/xre217/solo-watch

```yaml
- uses: xre217/solo-watch@main
  with:
    path: "."
    min-score: "55"
```

See `DISTRIBUTION.md` and `examples/consumer-workflow.yml`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | score ≥ min-score (default 55) |
| 1 | score &lt; min-score |
| 2 | usage error |

## Anti-hollow bar

| Bar | Status |
|-----|--------|
| Working product | ✓ CLI + library export |
| Docs | ✓ README · DISTRIBUTION · CHANGELOG |
| CI Action | ✓ `action.yml` |
| npx-ready pack | ✓ `files` + bin + build |
| Auth / paid | ✗ later (entity billing) |

## Firm

**Solo Leveling** sanctuary · SAO-operated · founder $0  
`~/Projects/solo-leveling/HAVEN.md`
