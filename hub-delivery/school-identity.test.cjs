const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('./premium-v2.js').identity,html=fs.readFileSync('index.html','utf8');
test('full temporary school names remain distinguishable without changing private greetings',()=>{
 for(let n=1;n<=6;n++){const name='St. George’s Athlete 0'+n;assert.equal(identity({accessMode:'identified-school',athlete:{displayName:name,testing:true}}).headline,'Hi, '+name);}
 assert.equal(identity({audience:'private-athlete',athlete:{fullName:'Example Athlete'}}).headline,'Hi, Example');
});
test('identified-school form choice is per athlete and assigned form cannot be overridden',()=>{
 const s=html.indexOf('  function schoolGroupStorageKey('),e=html.indexOf('  function groupPicker(',s);assert.ok(s>=0&&e>s);
 const values=new Map(),ctx={HUB_STATE:{athlete:{id:'first',formTier:null}},SCHOOL_GROUP_KEY:'group',localStorage:{getItem:k=>values.get(k)||''}};
 vm.createContext(ctx);vm.runInContext(html.slice(s,e)+';globalThis.api={schoolGroup,schoolGroupStorageKey}',ctx);
 values.set(ctx.api.schoolGroupStorageKey(),'Form 2');assert.equal(ctx.api.schoolGroup(),'Form 2');
 ctx.HUB_STATE.athlete={id:'second',formTier:null};assert.equal(ctx.api.schoolGroup(),'');
 ctx.HUB_STATE.athlete.formTier='Form 3';values.set(ctx.api.schoolGroupStorageKey(),'Lower 6');assert.equal(ctx.api.schoolGroup(),'Form 3');
});
test('identified school mode enables persistence while legacy school/staff stay reference-only',()=>{
 assert.match(html,/isSharedSchoolViewer\(\)&&!isIdentifiedSchoolAthlete\(\)/);
 assert.match(html,/action:'logout'/);assert.match(html,/WORKOUT_COMPLETIONS=new Map\(\);Object.keys\(GUIDED_CURSOR\)/);
 assert.match(html,/data-completion-toggle/);
});
