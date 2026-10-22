// Parsing, policy and command rewriting for the "Local + args" runtime. Pure
// functions only, so the tests need no wrangler.

export const RESERVED = new Set([
  '--session-id', '--resume', '-r', '--continue', '-c', '--fork-session',
  '--permission-mode', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
  '--permission-prompt-tool', '--add-dir', '--mcp-config', '--settings', '--plugin-dir',
  '--allowedTools', '--allowed-tools', '--append-system-prompt',
  '--model', '-m', '--effort', '--autocompact', '-p', '--print',
  '--config', '--profile', '--sandbox', '-s', '--ask-for-approval', '-a',
  '--dangerously-bypass-approvals-and-sandbox', '--yolo', '--full-auto', '--cd', '-C',
]);

export const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Shell-style split honouring quotes and backslash escapes; throws on an unterminated quote.
export function tokenize(value) {
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
  if (q) throw new Error('Args have an unterminated quote.');
  if (inToken) args.push(cur);
  return args;
}

// Tokenize, then refuse anything the wrangler manages itself.
export function parseArgs(value) {
  const args = tokenize(value);
  if (args.length && !args[0].startsWith('-')) throw new Error(`Args must start with a flag (got "${args[0]}").`);
  for (const token of args) {
    if (token === '--') throw new Error('Args cannot contain a bare "--".');
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

// The command is `[env -u X …] [VAR='v' …] claude|codex 'arg' …`; args go right after the binary.
const BINARY = /^((?:env(?: -u \w+)*\s+)?(?:\w+='(?:[^']|'\\'')*'\s+)*)(claude|codex)(?=\s)/;

function locate(inner) {
  const m = BINARY.exec(inner);
  if (!m) throw new Error('Could not find the agent command to add args to.');
  return m;
}

// Which agent a launch command runs.
export const agentOf = (inner) => locate(inner)[2];

// Inserts the (already chosen) args string right after the agent binary.
export function addArgs(inner, value) {
  const m = locate(inner);
  const args = parseArgs(value);
  if (!args.length) return inner;
  return `${m[1]}${m[2]} ${args.map(quote).join(' ')}${inner.slice(m[0].length)}`;
}

// The per-agent default from Settings, used when no args were typed for the session.
export const defaultArgs = (agent, settings = {}) => String((agent === 'claude' ? settings.claudeArgs : settings.codexArgs) || '').trim();
