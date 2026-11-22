const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function isParentManagedWorkout(');
const end = html.indexOf('  function athleteDemo(', start);
assert.ok(start >= 0 && end > start);
const ctx = {
  HUB_STATE: {},
  role: 'athlete',
  session: () => ({ role: ctx.role }),
  escapeHtml: text => text.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);

for (const [audience, role, expected] of [
  ['parent', 'athlete', true],
  ['parent', 'staff', false],
  ['private-athlete', 'athlete', false],
  ['school', 'athlete', false],
  ['school', 'staff', false],
]) {
  ctx.HUB_STATE.audience = audience;
  ctx.role = role;
  assert.equal(ctx.isParentManagedWorkout(), expected, `${audience}, ${role}`);
}

const notes = ['Stop if pain increases.\r\nUse the <lower> step.', ' Stop if pain increases. ', ''];
assert.equal(ctx.renderParentSessionNotes(notes), '<p class="hub-parent-session-notes">Stop if pain increases.<br>Use the &lt;lower&gt; step.</p>');
assert.match(ctx.renderParentSessionNotes(notes, false), /^<details class="hub-parent-session-notes"><summary>Session notes<\/summary>/);
assert.match(ctx.renderParentSessionNotes(notes, true), /^<details class="hub-parent-session-notes" open>/);
assert.equal(ctx.renderParentSessionNotes(['  '], false), '');
assert.equal(notes.length, 3);
console.log('Parent session notes role, escaping and rendering regression passed');
