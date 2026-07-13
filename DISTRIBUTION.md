# Distribution — solo-watch (Forge)

How strangers (and CI) run the tool that feeds Solo Leveling haven.

## Local / monorepo

```bash
cd ~/Projects/solo-leveling/products/solo-watch
npm install
npm test
node dist/cli.js scan ~/SAO
```

## npx from this directory (no npm publish required)

```bash
cd ~/Projects/solo-leveling/products/solo-watch
npm install && npm run build
npx --yes . scan ~/SAO
# or
npx --yes . --min-score 60
```

## Global link (dev)

```bash
npm link
solo-watch scan .
```

## GitHub (public) — works **now** (no npm login)

```text
https://github.com/xre217/solo-watch
```

```bash
# zero-clone install via GitHub
npx --yes github:xre217/solo-watch scan .
npx --yes github:xre217/solo-watch@v0.2.0 scan . --min-score 55

# from a clone:
npm ci && npm test
npx --yes . scan .

# GitHub Action
# uses: xre217/solo-watch@main
# uses: xre217/solo-watch@v0.2.0
```

Release: https://github.com/xre217/solo-watch/releases

## npm registry publish (needs `npm login` once)

```bash
cd ~/Projects/solo-leveling/products/solo-watch
npm login --auth-type=web
./scripts/publish.sh
# then:
npx solo-watch@0.2.0 scan .
```

**Status:** package name free; machine has no `~/.npmrc` until you complete login.

**Haven rule:** prefer entity npm later; personal publish is optional and still $0 founder claim from product surplus.

## GitHub Action

Composite action: `action.yml` in this folder.

Self-test workflow: `.github/workflows/solo-watch.yml`  
Consumer template: `examples/consumer-workflow.yml`

```yaml
- uses: ./products/solo-watch   # if monorepo path
  with:
    path: "."
    min-score: "55"
```

## Harbor integration

```bash
cd ~/SAO
npm run sao -- firm harbor run forge-scan
```

## Paid path (later)

Not in this release. Distribution first → usage → pricing that funds **Treasury thrivability**, not humans.
