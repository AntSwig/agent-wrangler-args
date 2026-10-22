import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(process.env.AW_DATA_DIR || path.join(os.homedir(), '.agent-wrangler'), 'agent-wrangler-args.json');

// The args each session launched with, by card id: a mirror of the file on disk.
// '' means "launched with none". Dialog args wait in `pending` until the launch pins them.
export class ArgsStore {
  constructor(file = FILE) {
    this.file = file;
    this.args = new Map();
    this.pending = new Map();
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

  // Pinned on disk?
  has(sessionId) { return this.args.has(sessionId); }

  // Pinned args, else dialog args not yet pinned, else undefined.
  get(sessionId) { return this.args.get(sessionId) ?? this.pending.get(sessionId); }

  stage(sessionId, value) { this.pending.set(sessionId, value); }

  // Writes to disk first and throws on failure, so a launch can't proceed unrecorded.
  set(sessionId, value) {
    this._commit((next) => next.set(sessionId, value));
    this.pending.delete(sessionId);
  }

  forget(sessionId) {
    this.pending.delete(sessionId);
    if (this.args.has(sessionId)) this._commit((next) => next.delete(sessionId));
  }

  _commit(mutate) {
    const next = new Map(this.args);
    mutate(next);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(next)));
    fs.renameSync(tmp, this.file);
    this.args = next;
  }
}
