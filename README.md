# Agent Wrangler args

An [Agent Wrangler](https://github.com/PortSwigger/agent-wrangler) extension that adds
a **Local + args** runtime. Sessions launched on it run on the host exactly like
Local, with extra CLI flags from the extension's settings added to the agent command,
for example `--chrome` for Claude or `--search` for Codex.

## Use

1. Install from this repository's git URL in **Settings → Extensions**, then restart
   the wrangler.
2. In the dispatch dialog, choose **Advanced options → Runtime → Local + args**. A
   **Launch args** field appears: type args for this session, such as `--chrome`
   for Claude or `--search` for Codex.
3. Optionally set per-agent defaults in **Settings → Extensions → Agent Wrangler args**.
   They apply to new sessions when the field is left empty.

The args a session launches with are saved with it and repeated on every resume and
fork (a fork carries its parent's), even if you later change the defaults. Flags Agent Wrangler manages itself (session id,
permissions, MCP, model, sandbox) are refused before anything launches. A flag the
agent does not recognise makes its CLI exit, so the session pane closes.

## Limits

- The field only appears while **Local + args** is selected, and flags typed
  for a session are not editable after launch.
- The dialog's additional-folders control needs the Local runtime, so it is off while
  this runtime is selected.

## Develop

```
npm test
AW_REPO=<agent-wrangler checkout> node scripts/validate-manifest.mjs
```

## Licence

Apache-2.0, see `LICENSE`.
