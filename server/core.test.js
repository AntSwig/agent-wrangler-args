import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { addArgs, parseArgs, RESERVED } from './args.js';

// Runs against the real agent-wrangler adapters when AW_REPO points at a checkout
// (CI sets it), so a change to core's command shape or launch flags fails here.
const repo = process.env.AW_REPO;
const skip = repo ? false : 'set AW_REPO to an agent-wrangler checkout';
const load = async (rel) => import(pathToFileURL(path.join(repo, rel)).href);

async function commands() {
  const { claude } = await load('server/agents/claude.js');
  const { codex } = await load('server/agents/codex.js');
  const base = { sessionId: 'S1', model: 'sonnet', effort: 'high', addDirs: ['/tmp/x'], intent: 'hi' };
  return {
    claude: [claude.buildLaunch({ ...base, permissionMode: 'plan', autoCompactTokens: 200000 }), claude.buildResume({ ...base, resumeId: 'R1' }), claude.buildFork({ ...base, sourceId: 'R1' })],
    codex: [codex.buildLaunch({ ...base, model: undefined, autoCompactTokens: 200000 }), codex.buildResume({ ...base, resumeId: 'R1' }), codex.buildFork({ ...base, sourceId: 'R1' })],
  };
}

test('args land right after the binary in every real launch, resume and fork command', { skip }, async () => {
  const cmds = await commands();
  for (const [agent, list] of Object.entries(cmds)) {
    for (const cmd of list) {
      const out = addArgs(cmd, '--marker');
      assert.match(out, new RegExp(`(?:^|\\s)${agent} '--marker' `), `${agent}: ${out.slice(0, 160)}`);
    }
  }
});

test('every flag core puts on a launch command is reserved here', { skip }, async () => {
  const cmds = await commands();
  const seen = new Set();
  for (const list of Object.values(cmds)) {
    for (const cmd of list) {
      const rest = cmd.slice(cmd.search(/(?:^|\s)(claude|codex) '/) + 1);
      // Re-split the quoted command; flag-shaped tokens are core's own launch flags.
      for (const token of parseArgsLoose(rest)) if (/^--?[A-Za-z]/.test(token)) seen.add(token.split('=')[0]);
    }
  }
  const missing = [...seen].filter((f) => !RESERVED.has(f));
  assert.deepEqual(missing, [], `core launch flags not in RESERVED: ${missing.join(' ')}`);
  assert.ok(seen.size > 8, 'expected to see core\'s launch flags');
});

// Shell-style split without the policy checks (core's own flags are reserved by design).
function parseArgsLoose(cmd) {
  const out = [];
  const re = /'((?:[^']|'\\'')*)'|(\S+)/g;
  for (const m of cmd.matchAll(re)) out.push(m[1] !== undefined ? m[1].replace(/'\\''/g, "'") : m[2]);
  return out;
}

test('the reserved list still refuses what it names (sanity)', () => {
  assert.throws(() => parseArgs('--permission-mode x'));
});
