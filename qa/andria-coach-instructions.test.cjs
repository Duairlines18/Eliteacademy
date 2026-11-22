const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const cleanup = 'isAndriaCoachInstructionsCleanup()';
const guard = html.match(/^  function isAndriaCoachInstructionsCleanup\(\).*$/m)[0];
const title = 'Andria Torres — Volleyball Development';
for (const [audience, role, assignedTitle, expected] of [
  ['parent', 'athlete', title, true],
  ['parent', 'athlete', title + ' (Archive)', false],
  ['parent', 'athlete', 'Other athlete', false],
  ['parent', 'athlete', undefined, false],
  ['parent', 'staff', title, false],
  ['private-athlete', 'athlete', title, false],
  ['school', 'athlete', title, false],
  ['school', 'staff', title, false],
]) {
  assert.equal(vm.runInNewContext(guard + '\n' + cleanup, {
    HUB_STATE: { audience },
    programme: () => assignedTitle === undefined ? null : { title: assignedTitle },
    session: () => ({ role }),
  }), expected, `${audience}, ${role}, ${assignedTitle}`);
}
assert.ok(html.includes("const notes=!"+cleanup+"&&sessionNotes.length?"), 'demo panel must be scoped out');
assert.ok(html.includes("const important=!"+cleanup+"&&!saintsAthleteView&&savedNotes.length?"), 'day panel must be scoped out');
assert.equal(html.split("const guidance=!"+cleanup+"&&notes.length?").length-1, 2, 'routine panels must be scoped out');
for (const label of ['How to do it','workoutCoaching(entry.item)','Watch for','data-presentation-step']) assert.ok(html.toLowerCase().includes(label.toLowerCase()), label+' preserved');
console.log('Andria coach instructions rendering guard regression passed');
