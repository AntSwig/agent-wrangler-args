import test from 'node:test';
import assert from 'node:assert/strict';
import { addArgs, parseArgs } from './args.js';

const claudeCmd = `env -u CLAUDECODE -u CLAUDE_CODE_TMPDIR AW_SESSION_ID='s' AW_X='it'\\''s' claude '--session-id' 's' -- 'hi'`;
const codexCmd = `AW_SESSION_ID='s' codex 'resume' 'r' '-c' 'x=1' 'hi'`;

test('flags go right after the claude binary', () => {
  assert.equal(addArgs(claudeCmd, { claudeArgs: '--chrome' }),
    `env -u CLAUDECODE -u CLAUDE_CODE_TMPDIR AW_SESSION_ID='s' AW_X='it'\\''s' claude '--chrome' '--session-id' 's' -- 'hi'`);
});

test('codex gets its own flags; unset flags leave the command alone', () => {
  assert.equal(addArgs(codexCmd, { codexArgs: '--search' }), `AW_SESSION_ID='s' codex '--search' 'resume' 'r' '-c' 'x=1' 'hi'`);
  assert.equal(addArgs(codexCmd, { claudeArgs: '--chrome' }), codexCmd);
});

test('values are quoted, not interpreted', () => {
  assert.ok(addArgs(claudeCmd, { claudeArgs: `--x "a b; rm -rf /"` }).includes(`'a b; rm -rf /'`));
});

test('reserved flags, bare words and bad quotes are refused', () => {
  for (const bad of ['--permission-mode x', '--session-id=1', '-sdanger-full-access', '-rabc', 'chrome', '--a -- b', '--x "oops']) {
    assert.throws(() => parseArgs(bad), undefined, bad);
  }
});

test('an unrecognised command is an error, not a silent pass-through', () => {
  assert.throws(() => addArgs(`something else`, { claudeArgs: '--chrome' }), /could not find/);
});

test('flags typed for the session win over the Settings default', () => {
  assert.ok(addArgs(claudeCmd, { claudeArgs: '--chrome', sessionArgs: '--verbose' }).includes(`claude '--verbose' '--session-id'`));
  assert.ok(!addArgs(claudeCmd, { claudeArgs: '--chrome', sessionArgs: '--verbose' }).includes('--chrome'));
});
