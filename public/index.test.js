import test from 'node:test';
import assert from 'node:assert/strict';
import ext from './index.js';

function contribution() {
  let c;
  ext.register({ register: (slot, def) => { assert.equal(slot, 'dispatch.field'); c = def; } });
  const input = { value: '' };
  const field = { style: { display: '' } };
  const el = { innerHTML: '', querySelector: (sel) => (sel === 'input' ? input : field) };
  return { c, el, input, field };
}

test('registers in Advanced options and hides unless the Local + args runtime is selected', () => {
  const { c, el, field } = contribution();
  assert.equal(c.at, 'advanced');
  c.update(el, { draft: { runtime: 'local' } });
  assert.equal(field.style.display, 'none');
  c.update(el, { draft: { runtime: 'local-args' } });
  assert.equal(field.style.display, '');
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
