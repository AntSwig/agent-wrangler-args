import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(process.env.AW_DATA_DIR || path.join(os.homedir(), '.agent-wrangler'), 'agent-wrangler-args.json');

// The args each session was launched with, keyed by card id, so resume (same card)
// and fork (the parent's card) re-apply exactly what the first launch used, even
// after a restart or a change to the Settings defaults. '' means "launched with none".
export class ArgsStore {
  constructor(file = FILE) {
    this.file = file;
    this.args = new Map();
    this.staged = new Set(); // in memory only, not yet written to disk
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`[agent-wrangler-args] cannot read ${file}: ${e.message}`);
      return;
    }
    try {
      for (const [sid, v] of Object.entries(JSON.parse(raw))) if (typeof v === 'string') this.args.set(sid, v);
    } catch (e) {
      // Keep the unreadable file rather than overwrite it with the next save.
      const kept = `${file}.corrupt-${Date.now()}`;
      try { fs.renameSync(file, kept); } catch { /* best effort */ }
      console.warn(`[agent-wrangler-args] ${file} is not valid JSON (${e.message}); kept as ${kept} and starting empty`);
    }
  }

  has(sessionId) { return this.args.has(sessionId) && !this.staged.has(sessionId); }

  // The args typed in the dialog: held in memory until the launch pins them.
  stage(sessionId, value) {
    this.args.set(sessionId, value);
    this.staged.add(sessionId);
  }

  get(sessionId) { return this.args.get(sessionId) || ''; }

  // Writes to disk first and throws on failure, so a launch can't proceed unrecorded.
  set(sessionId, value) {
    this._save({ ...Object.fromEntries(this.args), [sessionId]: value });
    this.args.set(sessionId, value);
    this.staged.delete(sessionId);
  }

  forget(sessionId) {
    this.staged.delete(sessionId);
    if (!this.args.has(sessionId)) return;
    const next = Object.fromEntries(this.args);
    delete next[sessionId];
    this._save(next);
    this.args.delete(sessionId);
  }

  _save(obj) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, this.file);
  }
}
