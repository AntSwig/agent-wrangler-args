# AGENTS.md

Developer notes for Agent Wrangler args, an installable Agent Wrangler extension that adds
a "Local + args" runtime. Only the non-obvious things.

## This repository is public open source

> **Everything here is public: code, commits, branch names, PR titles and bodies,
> docs and test fixtures.** Never include anything specific to an employer or its
> customers: internal repo or service names, hostnames, URLs, ticket keys, chat
> channels, colleague names, credentials or internal process. Keep examples
> generic (`example.com`, `acme/widgets`, `PROJ-123`).

## How it works

- `server/manifest.js` is the manifest; the root `index.js` only re-exports it. The
  wrangler's leaf-import scanner quarantines any own file that imports `../index.js`,
  so tests and scripts import `server/manifest.js`, never the root.
- The dialog field (`public/index.js`, a `dispatch.field`) sends `ext.args`;
  `onBeforeDispatch` only stages it. `wrapLaunch` pins the effective args (dialog, else
  the parent's on a fork, else the agent's Settings default) to the card in
  `server/store.js`, writing to disk first and failing the launch if it cannot. Resume
  and fork then repeat them exactly, even after a restart or a change to the defaults.
  `preflight` validates the dialog args, or the default it would fall back to, before
  anything is created.
- `server/args.js` inserts the args right after the `claude` or `codex` binary in
  core's finished command. `server/core.test.js` (needs `AW_REPO`) fails if core's
  command shape or launch flags drift from `RESERVED` or the regex.

## Commands

- `npm test` runs `node --test` over `server/*.test.js` and `public/*.test.js`.
  With `AW_REPO=<agent-wrangler checkout>` set (CI does) it also runs `server/core.test.js`
  against core's real adapters; without it those two tests skip.
- `AW_REPO=<agent-wrangler checkout> node scripts/validate-manifest.mjs` runs the
  real loader over this repo.
- Dev install: **copy** (never symlink; discovery only sees real directories) this
  checkout to `<AW_DATA_DIR>/extensions/agent-wrangler-args` and restart the wrangler. The
  directory name must be `agent-wrangler-args`, the manifest `id`.
