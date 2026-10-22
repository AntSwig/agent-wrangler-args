// Client half: a "Agent Wrangler args" text field in the dispatch dialog's Advanced options,
// shown only while the Local + args runtime is selected. Its value rides the dispatch
// as `ext.agent-wrangler-args.args`; the server half stores it against the new card.
const RUNTIME_ID = 'local-args';

const HTML = `
  <div class="dispatch-field">
    <label>Launch args</label>
    <input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. --chrome" />
  </div>`;

const inputOf = (el) => el.querySelector('input');

export default {
  register(slots) {
    slots.register('dispatch.field', {
      id: 'args',
      at: 'advanced',
      mount(el) { el.innerHTML = HTML; },
      // The field only means something on this runtime, so it hides on any other.
      update(el, ctx) { el.hidden = ctx.draft.runtime !== RUNTIME_ID; },
      // `undefined` sends nothing, so other runtimes' dispatches carry no bag.
      ext(el, ctx) {
        const args = inputOf(el).value.trim();
        return ctx.draft.runtime === RUNTIME_ID && args ? { args } : undefined;
      },
      // A schedule saved with args restores them; a fresh dialog starts empty.
      open(el, ctx) { inputOf(el).value = ctx.saved?.args || ''; },
    });
  },
};
