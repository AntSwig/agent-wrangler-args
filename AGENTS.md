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
- The dialog field (`public/index.js`, a `dispatch.field` contribution) sends
  `ext.args`; `onBeforeDispatch` stores it per card id (`server/store.js`, persisted
  so resume survives a restart), `preflight` validates it before anything is created,
  and a fork copies its parent's entry via `parentId`. Settings hold per-agent defaults.
- The runtime's `wrapLaunch({ inner, sessionId, parentId, settings, host })` is called
  at dispatch, resume and fork. `server/args.js` finds the `claude` or `codex` binary in `inner` and inserts
  the configured flags right after it. Flags before a Codex subcommand
  (`codex --search resume <id>`) are accepted by Codex 0.163.
- Flags the wrangler manages itself are refused (`RESERVED` in `server/args.js`);
  single-dash tokens are checked letter by letter so `-sdanger-full-access` and `-rc`
  can't slip through. Keep that list in step with core's args.
- A bad setting throws from `wrapLaunch`, which fails the launch loudly instead of
  starting an agent without the flags.

## Commands

- `npm test` runs `node --test` over `server/*.test.js`.
- `AW_REPO=<agent-wrangler checkout> node scripts/validate-manifest.mjs` runs the
  real loader over this repo.
- Dev install: **copy** (never symlink; discovery only sees real directories) this
  checkout to `<AW_DATA_DIR>/extensions/agent-wrangler-args` and restart the wrangler. The
  directory name must be `agent-wrangler-args`, the manifest `id`.
