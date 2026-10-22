import { fileURLToPath } from 'node:url';
import { addArgs, agentOf, defaultArgs, parseArgs } from './args.js';
import { ArgsStore } from './store.js';

// The manifest. The root index.js re-exports it (see AGENTS.md for why).
export const dir = fileURLToPath(new URL('..', import.meta.url));

const RUNTIME_ID = 'local-args';

// The dialog's args arrive as `ext.args`; '' when nothing was sent.
const argsFrom = (ext) => (typeof ext?.args === 'string' ? ext.args.trim() : '');

// "Local + args": a runtime that runs the agent on the host exactly as Local does,
// but inserts args right after the agent binary: the ones typed in the dispatch
// dialog for this session, else the per-agent defaults from Settings. The first
// launch pins what it used to the session, so resume and fork repeat it exactly.
export default {
  id: 'agent-wrangler-args',
  label: 'Agent Wrangler args',
  description: "A 'Local + args' runtime that adds CLI args to Claude and Codex launches.",
  help: "Pick Advanced options → Runtime → Local + args in the dispatch dialog, then type args for that session (e.g. --chrome for Claude, --search for Codex), or set per-agent defaults here. Flags the wrangler manages itself (session, permissions, MCP, model, sandbox) are refused.",
  author: 'Anthony Lawton',
  homepage: 'https://github.com/AntSwig/agent-wrangler-args',
  defaultEnabled: true,
  dir,
  requires: [],
  engines: { wranglerApi: '^1.37.0' },
  settings: [['claude', '--chrome'], ['codex', '--search']].map(([agent, placeholder]) => ({
    key: `${agent}Args`,
    type: 'text',
    label: `Default ${agent === 'claude' ? 'Claude' : 'Codex'} args`,
    placeholder,
    maxLength: 500,
    help: 'Used on the Local + args runtime when no args are typed in the dispatch dialog.',
  })),
  stores: { args: () => new ArgsStore() },
  session: {
    // Runs after the card id exists and before the command is built. Staged in memory
    // only: wrapLaunch pins it to disk, and fails the launch if it cannot.
    onBeforeDispatch: ({ sessionId, ext, host }) => {
      const args = argsFrom(ext);
      if (args) host.stores.args.stage(sessionId, args);
    },
    onPurge: ({ sessionId, host }) => { host.stores.args.forget(sessionId); },
  },
  runtimes: [{
    id: RUNTIME_ID,
    label: 'Local + args',
    agents: ['claude', 'codex'],
    // Refuses before anything is created: bad dialog args, or a bad Settings default
    // that this launch would fall back to.
    preflight: async ({ ext, agent, settings }) => {
      try { parseArgs(argsFrom(ext) || defaultArgs(agent, settings)); } catch (e) { return e.message; }
      return null;
    },
    wrapLaunch: async ({ inner, sessionId, parentId, settings, host }) => {
      const store = host.stores.args;
      // Already pinned (resume), typed in the dialog, a fork's parent, else the agent's default.
      const args = store.get(sessionId) ?? store.get(parentId) ?? defaultArgs(agentOf(inner), settings);
      if (!store.has(sessionId)) store.set(sessionId, args); // throws if it cannot be written
      return addArgs(inner, args);
    },
  }],
  client: 'public/index.js',
};
