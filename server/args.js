// Parsing, policy and command rewriting for the "Local + args" runtime. Pure
// functions only, so the tests need no wrangler.

const RESERVED = new Set([
  '--session-id', '--resume', '-r', '--continue', '-c', '--fork-session',
  '--permission-mode', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
  '--permission-prompt-tool', '--add-dir', '--mcp-config', '--settings', '--plugin-dir',
  '--allowedTools', '--allowed-tools', '--append-system-prompt',
  '--model', '-m', '--effort', '--autocompact', '-p', '--print',
  '--config', '--profile', '--sandbox', '-s', '--ask-for-approval', '-a',
  '--dangerously-bypass-approvals-and-sandbox', '--yolo', '--full-auto', '--cd', '-C',
]);

const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Shell-style split honouring quotes and backslash escapes; throws on bad input.
export function parseArgs(value) {
  const args = [];
  let cur = '';
  let inToken = false;
  let q = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (q === "'") { if (c === "'") q = null; else cur += c; }
    else if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && (value[i + 1] === '"' || value[i + 1] === '\\')) cur += value[++i];
      else cur += c;
    } else if (c === "'" || c === '"') { q = c; inToken = true; }
    else if (c === '\\' && i + 1 < value.length) { cur += value[++i]; inToken = true; }
    else if (/\s/.test(c)) { if (inToken) { args.push(cur); cur = ''; inToken = false; } }
    else { cur += c; inToken = true; }
  }
  if (q) throw new Error('Agent Wrangler args have an unterminated quote.');
  if (inToken) args.push(cur);
  if (args.length && !args[0].startsWith('-')) throw new Error(`Agent Wrangler args must start with a flag (got "${args[0]}").`);
  for (const token of args) {
    if (token === '--') throw new Error('Agent Wrangler args cannot contain a bare "--".');
    if (!token.startsWith('-')) continue;
    const eq = token.indexOf('=');
    const name = eq < 0 ? token : token.slice(0, eq);
    // `-sdanger-full-access` attaches a value and `-rc` bundles flags: check each letter.
    const flags = /^-[^-]/.test(name) ? [...name.slice(1)].map((ch) => `-${ch}`) : [name];
    const bad = flags.find((f) => RESERVED.has(f));
    if (bad) throw new Error(`"${bad}" is managed by Agent Wrangler and can't be used in args.`);
  }
  return args;
}

// The command is `[env -u X …] [VAR='v' …] claude|codex 'arg' …`; flags go right after the binary.
const BINARY = /^((?:env(?: -u \w+)*\s+)?(?:\w+='(?:[^']|'\\'')*'\s+)*)(claude|codex)(?=\s)/;

export function addArgs(inner, { claudeArgs = '', codexArgs = '', sessionArgs = '' } = {}) {
  const m = BINARY.exec(inner);
  if (!m) throw new Error('Agent Wrangler args could not find the agent command to extend.');
  // A flag string typed for this session wins over the per-agent default in Settings.
  const raw = String(sessionArgs || (m[2] === 'claude' ? claudeArgs : codexArgs) || '').trim();
  const flags = parseArgs(raw);
  if (!flags.length) return inner;
  return `${m[1]}${m[2]} ${flags.map(quote).join(' ')}${inner.slice(m[0].length)}`;
}
