import test from 'node:test';
import assert from 'node:assert/strict';
import ext from './index.js';

function contribution() {
  let c;
  ext.register({ register: (slot, def) => { assert.equal(slot, 'dispatch.field'); c = def; } });
  const input = { value: '' };
  const el = { hidden: false, innerHTML: '', querySelector: () => input };
  return { c, el, input };
}

test('registers in Advanced options and hides unless the Local + args runtime is selected', () => {
  const { c, el } = contribution();
  assert.equal(c.at, 'advanced');
  c.update(el, { draft: { runtime: 'local' } });
  assert.equal(el.hidden, true);
  c.update(el, { draft: { runtime: 'local-args' } });
  assert.equal(el.hidden, false);
});

test('sends flags only on this runtime, restores a saved value on open', () => {
  const { c, el, input } = contribution();
  input.value = ' --chrome ';
  assert.deepEqual(c.ext(el, { draft: { runtime: 'local-args' } }), { args: '--chrome' });
  assert.equal(c.ext(el, { draft: { runtime: 'local' } }), undefined);
  input.value = '';
  assert.equal(c.ext(el, { draft: { runtime: 'local-args' } }), undefined);
  c.open(el, { saved: { args: '--search' } });
  assert.equal(input.value, '--search');
  c.open(el, { saved: null });
  assert.equal(input.value, '');
});
