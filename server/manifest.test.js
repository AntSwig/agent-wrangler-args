import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import manifest from './manifest.js';
import { ArgsStore } from './store.js';

const rt = manifest.runtimes[0];
const dirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-args-')); dirs.push(d); return path.join(d, 'args.json'); };
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const host = (file = tmp()) => ({ stores: { args: new ArgsStore(file) }, file });
const inner = `AW_SESSION_ID='s' claude '--session-id' 's'`;
const launch = (h, over = {}) => rt.wrapLaunch({ inner, sessionId: 'A', settings: {}, host: h, ...over });

test('dialog args are staged, then pinned on launch and applied', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'A', ext: { args: ' --chrome ' }, host: h });
  assert.equal(fs.existsSync(h.file), false, 'staging alone writes nothing');
  assert.equal(await launch(h), `AW_SESSION_ID='s' claude '--chrome' '--session-id' 's'`);
  assert.equal(new ArgsStore(h.file).get('A'), '--chrome');
});

test('no dialog args falls back to the agent default, and that is pinned too', async () => {
  const h = host();
  assert.ok((await launch(h, { settings: { claudeArgs: '--chrome' } })).includes(`'--chrome'`));
  // A later change to the default does not alter an existing session's resume.
  assert.ok((await launch(h, { settings: { claudeArgs: '--other' } })).includes(`'--chrome'`));
  assert.equal(await launch(h, { sessionId: 'B' }), inner);
  assert.equal(await launch(h, { sessionId: 'B', settings: { claudeArgs: '--chrome' } }), inner, 'a session launched with none stays with none');
});

test('a fork inherits its parent args and pins them to its own card', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'P', ext: { args: '--chrome' }, host: h });
  await launch(h, { sessionId: 'P' });
  assert.ok((await launch(h, { sessionId: 'F', parentId: 'P' })).includes(`'--chrome'`));
  assert.equal(new ArgsStore(h.file).get('F'), '--chrome');
});

test('purge forgets a session; unwritable storage fails the launch instead of dropping args', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'A', ext: { args: '--chrome' }, host: h });
  await launch(h);
  manifest.session.onPurge({ sessionId: 'A', host: h });
  assert.equal(new ArgsStore(h.file).has('A'), false);

  const blocker = tmp(); // a plain file where the store's directory should be
  fs.writeFileSync(blocker, 'x');
  const bad = { stores: { args: new ArgsStore(path.join(blocker, 'args.json')) } };
  manifest.session.onBeforeDispatch({ sessionId: 'Z', ext: { args: '--chrome' }, host: bad });
  await assert.rejects(launch(bad, { sessionId: 'Z' }));
});

test('a corrupt store file is kept aside, not overwritten', () => {
  const file = tmp();
  fs.writeFileSync(file, '{not json');
  const store = new ArgsStore(file);
  assert.equal(store.has('A'), false);
  assert.ok(fs.readdirSync(path.dirname(file)).some((f) => f.includes('.corrupt-')));
  assert.equal(fs.existsSync(file), false);
});

test('preflight refuses bad dialog args and a bad Settings default, passes good or absent ones', async () => {
  assert.match(await rt.preflight({ ext: { args: '--permission-mode x' }, agent: 'claude', settings: {} }), /managed by Agent Wrangler/);
  assert.match(await rt.preflight({ ext: { args: 'chrome' }, agent: 'claude', settings: {} }), /must start with a flag/);
  assert.match(await rt.preflight({ ext: null, agent: 'claude', settings: { claudeArgs: '--permission-mode x' } }), /managed by Agent Wrangler/);
  assert.equal(await rt.preflight({ ext: null, agent: 'codex', settings: { claudeArgs: '--permission-mode x' } }), null, 'only the launching agent\'s default matters');
  assert.equal(await rt.preflight({ ext: { args: '--chrome' }, agent: 'claude', settings: {} }), null);
  assert.equal(await rt.preflight({ ext: null, agent: 'claude', settings: {} }), null);
});
