#!/usr/bin/env node
// Validate this extension against the REAL wrangler loader, the way a boot would:
// discovery (id/dir-name check + leaf-import scan), validateManifest, loadExtensions
// (collisions, quarantine reasons) and buildHostApi (capabilities + engines range).
//
//   AW_REPO=~/path/to/agent-wrangler node scripts/validate-manifest.mjs
//
// AW_REPO must be an agent-wrangler checkout with its dependencies installed.
// Exits 1 on any refusal, 2 when AW_REPO is not a wrangler checkout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = process.env.AW_REPO && path.resolve(process.env.AW_REPO.replace(/^~/, os.homedir()));
if (!repo || !fs.existsSync(path.join(repo, 'server/extensions/index.js'))) {
  console.error('Set AW_REPO to an agent-wrangler checkout that has server/extensions/index.js');
  process.exit(2);
}
process.env.AW_DATA_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wrangler-args-validate-'));
const mod = (rel) => import(pathToFileURL(path.join(repo, rel)).href);
const { validateManifest, loadExtensions } = await mod('server/extensions/index.js');
const { discoverExternal } = await mod('server/extensions/external.js');
const { buildHostApi } = await mod('server/host-api/index.js');
const { HOST_API_VERSION } = await mod('server/host-api/version.js');

const root = fileURLToPath(new URL('..', import.meta.url));
let failed = false;
const fail = (msg) => { failed = true; console.error('✗', msg); };
const ok = (msg) => console.log('✓', msg);

// 1. Discovery from an extensions dir holding <id> -> a COPY of this repo (discovery
//    only sees real directories, so a symlinked dev install is never found).
const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wrangler-args-ext-'));
const declared = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).wranglerExtension;
fs.cpSync(root, path.join(extDir, declared.id), { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) });
const [found] = await discoverExternal({ dir: extDir, provenance: {} });
if (!found) fail('discoverExternal found nothing');
else if (found.quarantine) fail(`discovery quarantined: ${found.quarantine}`);
else ok(`discovered as "${found.id}"`);

// 2. The manifest against what package.json discloses.
const { default: manifest } = await import(pathToFileURL(path.join(root, 'server/manifest.js')).href);
try { validateManifest(manifest); ok('validateManifest'); } catch (e) { fail(e.message); }
if (manifest.id !== declared.id) fail(`manifest id "${manifest.id}" != package.json id "${declared.id}"`);
const undisclosed = (manifest.requires || []).filter((c) => !(declared.requires || []).includes(c));
if (undisclosed.length) fail(`manifest requires more than package.json discloses: ${undisclosed.join(', ')}`);
else ok('requires ⊆ disclosed requires');
for (const [key, mine, theirs] of [['label', manifest.label, declared.label], ['description', manifest.description, declared.description], ['author', manifest.author, declared.author], ['homepage', manifest.homepage, declared.homepage], ['engines.wranglerApi', manifest.engines?.wranglerApi, declared.engines?.wranglerApi]]) {
  if (mine !== theirs) fail(`manifest ${key} "${mine}" != package.json wranglerExtension.${key} "${theirs}"`);
}

// 3. The loader: the runtime must register without a quarantine.
const loaded = loadExtensions({ cfg: {}, builtin: [{ ...manifest, external: true }], coreToolNames: [], coreHandlerTypes: [] });
const entry = loaded.list.find((e) => e.id === manifest.id);
if (!entry) fail('loadExtensions produced no entry');
else if (entry.quarantine) fail(`loadExtensions quarantined: ${entry.quarantine}`);
else ok(`loadExtensions: runtimes [${(entry.runtimes || []).map((r) => r.id).join(', ')}]`);

// 4. The façade against the served host API version.
try {
  const host = buildHostApi({ id: manifest.id, requires: manifest.requires, range: manifest.engines?.wranglerApi, core: {}, rebuild: () => {}, broadcast: () => {}, archiveSession: () => {}, stores: {}, log: () => {} });
  ok(`buildHostApi: serves ${HOST_API_VERSION}, keys [${Object.keys(host).join(', ')}]`);
} catch (e) { fail(e.message); }

fs.rmSync(extDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
