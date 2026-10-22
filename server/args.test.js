import test from 'node:test';
import assert from 'node:assert/strict';
import { addArgs, agentOf, defaultArgs, parseArgs } from './args.js';

const claudeCmd = `env -u CLAUDECODE -u CLAUDE_CODE_TMPDIR AW_SESSION_ID='s' AW_X='it'\\''s' claude '--session-id' 's' -- 'hi'`;
const codexCmd = `AW_SESSION_ID='s' codex 'resume' 'r' '-c' 'x=1' 'hi'`;

test('args go right after the claude binary', () => {
  assert.equal(addArgs(claudeCmd, '--chrome'),
    `env -u CLAUDECODE -u CLAUDE_CODE_TMPDIR AW_SESSION_ID='s' AW_X='it'\\''s' claude '--chrome' '--session-id' 's' -- 'hi'`);
});

test('args go before a codex subcommand; empty args leave the command alone', () => {
  assert.equal(addArgs(codexCmd, '--search'), `AW_SESSION_ID='s' codex '--search' 'resume' 'r' '-c' 'x=1' 'hi'`);
  assert.equal(addArgs(codexCmd, ''), codexCmd);
});

test('values are quoted, not interpreted', () => {
  assert.ok(addArgs(claudeCmd, `--x "a b; rm -rf /"`).includes(`'a b; rm -rf /'`));
});

test('reserved flags, bare words and bad quotes are refused', () => {
  for (const bad of ['--permission-mode x', '--session-id=1', '-sdanger-full-access', '-rabc', '-vc', 'chrome', '--a -- b', '--x "oops']) {
    assert.throws(() => parseArgs(bad), undefined, bad);
  }
});

test('an unrecognised command is an error, not a silent pass-through', () => {
  assert.throws(() => addArgs('something else', '--chrome'), /Could not find/);
});

test('agentOf and defaultArgs pick the per-agent default', () => {
  assert.equal(agentOf(claudeCmd), 'claude');
  assert.equal(agentOf(codexCmd), 'codex');
  const settings = { claudeArgs: ' --chrome ', codexArgs: '--search' };
  assert.equal(defaultArgs('claude', settings), '--chrome');
  assert.equal(defaultArgs('codex', settings), '--search');
  assert.equal(defaultArgs('codex', {}), '');
});
