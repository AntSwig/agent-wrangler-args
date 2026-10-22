import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import manifest from './manifest.js';
import { ArgsStore } from './store.js';

const rt = manifest.runtimes[0];
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lf-')), 'agent-wrangler-args.json');
const host = (file = tmp()) => ({ stores: { args: new ArgsStore(file) }, file });
const inner = `AW_SESSION_ID='s' claude '--session-id' 's'`;

test('onBeforeDispatch stores the dialog flags and wrapLaunch applies them', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'A', ext: { args: ' --chrome ' }, host: h });
  assert.equal(await rt.wrapLaunch({ inner, sessionId: 'A', settings: {}, host: h }), `AW_SESSION_ID='s' claude '--chrome' '--session-id' 's'`);
});

test('no dialog flags falls back to the per-agent Settings default; none leaves the command alone', async () => {
  const h = host();
  assert.ok((await rt.wrapLaunch({ inner, sessionId: 'B', settings: { claudeArgs: '--chrome' }, host: h })).includes(`'--chrome'`));
  assert.equal(await rt.wrapLaunch({ inner, sessionId: 'B', settings: {}, host: h }), inner);
});

test('a fork inherits its parent flags, and keeps them on later resumes', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'P', ext: { args: '--chrome' }, host: h });
  assert.ok((await rt.wrapLaunch({ inner, sessionId: 'F', parentId: 'P', settings: {}, host: h })).includes(`'--chrome'`));
  assert.ok((await rt.wrapLaunch({ inner, sessionId: 'F', settings: {}, host: h })).includes(`'--chrome'`));
});

test('flags survive a restart (store reloads from disk) and purge forgets them', async () => {
  const h = host();
  manifest.session.onBeforeDispatch({ sessionId: 'A', ext: { args: '--chrome' }, host: h });
  const reloaded = { stores: { args: new ArgsStore(h.file) } };
  assert.equal(reloaded.stores.args.get('A'), '--chrome');
  manifest.session.onPurge({ sessionId: 'A', host: reloaded });
  assert.equal(new ArgsStore(h.file).get('A'), '');
});

test('preflight refuses bad dialog flags and passes good or absent ones', async () => {
  assert.match(await rt.preflight({ ext: { args: '--permission-mode x' } }), /managed by Agent Wrangler/);
  assert.match(await rt.preflight({ ext: { args: 'chrome' } }), /must start with a flag/);
  assert.equal(await rt.preflight({ ext: { args: '--chrome' } }), null);
  assert.equal(await rt.preflight({ ext: null }), null);
});
