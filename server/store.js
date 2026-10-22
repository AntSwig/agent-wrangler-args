import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(process.env.AW_DATA_DIR || path.join(os.homedir(), '.agent-wrangler'), 'agent-wrangler-args.json');

// The flags typed in the dispatch dialog, keyed by card id, so resume (same card)
// and fork (the parent's card) can re-apply them after a restart. Sparse on disk.
export class ArgsStore {
  constructor(file = FILE) {
    this.file = file;
    this.args = new Map();
    try {
      for (const [sid, v] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) {
        if (typeof v === 'string' && v) this.args.set(sid, v);
      }
    } catch {
      // missing or unreadable means first run
    }
  }

  get(sessionId) { return this.args.get(sessionId) || ''; }

  set(sessionId, value) {
    if (value) this.args.set(sessionId, value); else this.args.delete(sessionId);
    this._save();
  }

  forget(sessionId) {
    if (this.args.delete(sessionId)) this._save();
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.args)));
    fs.renameSync(tmp, this.file);
  }
}
