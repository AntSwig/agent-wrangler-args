import { fileURLToPath } from 'node:url';
import { addArgs, parseArgs } from './args.js';
import { ArgsStore } from './store.js';

// The extension manifest. The repo root's index.js re-exports this: the wrangler's
// leaf-import scanner quarantines any own file importing '../index.js', so tests and
// scripts import THIS module, never the root.
export const dir = fileURLToPath(new URL('..', import.meta.url));

export const RUNTIME_ID = 'local-args';

// The dialog's args arrive as `ext.args`; null when nothing was sent.
const argsFrom = (ext) => (typeof ext?.args === 'string' ? ext.args.trim() : '');

// "Local + args": a runtime that runs the agent on the host exactly as Local does,
// but inserts flags right after the agent binary: the ones typed in the dispatch
// dialog for this session, else the per-agent defaults from Settings. wrapLaunch runs
// at dispatch, resume and fork, so the flags follow the session throughout.
export default {
  id: 'agent-wrangler-args',
  label: 'Agent Wrangler args',
  description: "A 'Local + args' runtime that adds CLI flags to Claude and Codex launches.",
  help: "Pick Advanced options → Runtime → Local + args in the dispatch dialog, then type flags for that session (e.g. --chrome for Claude, --search for Codex), or set per-agent defaults here. Flags the wrangler manages itself (session, permissions, MCP, model, sandbox) are refused.",
  author: 'Anthony Lawton',
  homepage: 'https://github.com/AntSwig/agent-wrangler-args',
  defaultEnabled: true,
  dir,
  requires: [],
  engines: { wranglerApi: '^1.37.0' },
  settings: [
    { key: 'claudeArgs', type: 'text', label: 'Default Claude args', placeholder: '--chrome', maxLength: 500, help: 'Used on the Local + args runtime when no flags are typed in the dispatch dialog.' },
    { key: 'codexArgs', type: 'text', label: 'Default Codex args', placeholder: '--search', maxLength: 500, help: 'Used on the Local + args runtime when no flags are typed in the dispatch dialog.' },
  ],
  stores: { args: () => new ArgsStore() },
  session: {
    // The one hook that runs after the card id exists and before the command is built.
    onBeforeDispatch: ({ sessionId, ext, host }) => {
      const args = argsFrom(ext);
      if (args) host.stores.args.set(sessionId, args);
    },
    onPurge: ({ sessionId, host }) => { host.stores.args.forget(sessionId); },
  },
  runtimes: [{
    id: RUNTIME_ID,
    label: 'Local + args',
    agents: ['claude', 'codex'],
    // Refuses before anything is created, so a bad string never starts an agent without its flags.
    preflight: async ({ ext }) => {
      try { parseArgs(argsFrom(ext)); } catch (e) { return e.message; }
      return null;
    },
    wrapLaunch: async ({ inner, sessionId, parentId, settings, host }) => {
      const store = host.stores.args;
      // A fork has a new card id: it carries the parent's flags.
      if (parentId && !store.get(sessionId) && store.get(parentId)) store.set(sessionId, store.get(parentId));
      return addArgs(inner, { ...settings, sessionArgs: store.get(sessionId) });
    },
  }],
  client: 'public/index.js',
};
