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
  `ext.args`; `onBeforeDispatch` only stages it in memory. `wrapLaunch` pins the
  effective args (dialog args, else the agent's Settings default, else the parent's on
  a fork) to the card in `server/store.js`, so resume and fork repeat them exactly,
  even after a restart or a change to the defaults. The pin is written to disk first
  and a failure fails the launch. `preflight` validates the dialog args, or the
  default it would fall back to, before anything is created.
- The runtime's `wrapLaunch({ inner, sessionId, parentId, settings, host })` is called
  at dispatch, resume and fork. `server/args.js` finds the `claude` or `codex` binary in `inner` and inserts
  the configured flags right after it. Flags before a Codex subcommand
  (`codex --search resume <id>`) are accepted by Codex 0.163.
- Flags the wrangler manages itself are refused (`RESERVED` in `server/args.js`);
  single-dash tokens are checked letter by letter so `-sdanger-full-access` and `-rc`
  can't slip through. `server/core.test.js` fails when a flag core puts on a launch
  command is missing from `RESERVED`, or when core's command shape stops matching.
- A bad setting throws from `wrapLaunch`, which fails the launch loudly instead of
  starting an agent without the args.

## Commands

- `npm test` runs `node --test` over `server/*.test.js` and `public/*.test.js`.
  With `AW_REPO=<agent-wrangler checkout>` set (CI does) it also runs `server/core.test.js`
  against core's real adapters; without it those two tests skip.
- `AW_REPO=<agent-wrangler checkout> node scripts/validate-manifest.mjs` runs the
  real loader over this repo.
- Dev install: **copy** (never symlink; discovery only sees real directories) this
  checkout to `<AW_DATA_DIR>/extensions/agent-wrangler-args` and restart the wrangler. The
  directory name must be `agent-wrangler-args`, the manifest `id`.
