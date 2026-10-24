// Coach Command contract tests — no production credentials or athlete data.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'coach-command.js'),'utf8');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const makeEl=()=>({innerHTML:'',children:[],dataset:{},addEventListener(name,fn){this.handlers??={};this.handlers[name]=fn;},append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;}});
const ctx={window:{},document:{createElement:makeEl},URL,console,alert(){throw Error('unexpected alert')}};
vm.runInNewContext(source,ctx,{filename:'coach-command.js'});
const mount=ctx.window.DuCoachCommand.mount;
const fixture={role:'staff',cohort:{id:'school-1',name:"Saints <College>",currentWeek:4},programme:{title:'Jumps',sessions:[
{id:'d1',title:'Acceleration',day:'Day 1',duration:'45 min',requirement:'Mandatory',prescriptions:[{sectionTitle:'Warm-up',exerciseCode:'WU01',dosage:'2 x 10',cues:'Stay tall'}]},
{id:'d2',title:'Landing',day:'Day 2',requirement:'Mandatory',prescriptions:[]},
{id:'d3',title:'Mobility',day:'Day 3',requirement:'Optional',prescriptions:[]},
{id:'d4',title:'Extra published session',day:'Day 4',requirement:'Optional',prescriptions:[]}
]},exercises:[{code:'WU01',title:'Pogos',videoId:'6Dlac5mxD6k',coachingNote:'Short contacts'}]};
assert.throws(()=>mount(makeEl(),{...fixture,role:'athlete'}),/staff/);
const host=makeEl();mount(host,fixture);const root=host.children[1];
assert.match(root.innerHTML,/Team Command/);
assert.match(root.innerHTML,/Athletes have not been connected/);
assert.doesNotMatch(root.innerHTML,/undefined\/undefined/);
assert.match(root.innerHTML,/Day 4/);
assert.match(root.innerHTML,/Weekly coach feedback/);
assert.match(root.innerHTML,/Saints &lt;College&gt;/);
assert.doesNotMatch(root.innerHTML,/Saints <College>/);
root.handlers.click({target:{closest:()=>({dataset:{day:'0'}})}});
assert.match(root.innerHTML,/Full Workout/);
assert.match(root.innerHTML,/Pogos/);
assert.match(root.innerHTML,/2 x 10/);
assert.match(root.innerHTML,/<details class="coach-cue"><summary>How to do it<\/summary>/);
assert.doesNotMatch(root.innerHTML,/<details class="coach-cue" open/);
const cueDetails=[{open:false},{open:true}];
root.querySelectorAll=()=>cueDetails;
ctx.window.print=()=>assert.ok(cueDetails.every(d=>d.open),'Print includes all cue content');
root.handlers.click({target:{closest:()=>({dataset:{action:'print'}})}});
assert.equal(cueDetails[0].open,false,'Print restores closed cue');
assert.equal(cueDetails[1].open,true,'Print preserves open cue');
assert.match(root.innerHTML,/Watch Pogos demonstration/);
root.handlers.click({target:{closest:()=>({dataset:{day:'2'}})}});
assert.match(root.innerHTML,/OPTIONAL EXTRA/);
root.handlers.click({target:{closest:()=>({dataset:{action:'back'}})}});
assert.match(root.innerHTML,/Team Command/);
const unauthorized=makeEl();mount(unauthorized,fixture,{rosterVerified:true,roster:[{cohort_id:'other',full_name:'Private Person'}]});
assert.doesNotMatch(unauthorized.children[1].innerHTML,/Private Person/);
const authorized=makeEl();mount(authorized,fixture,{rosterVerified:true,roster:[{cohort_id:'school-1',display_name:'Athlete A',access_status:'active'}]});
assert.match(authorized.children[1].innerHTML,/Athlete A/);
assert.match(authorized.children[1].innerHTML,/1\/1/);
// School tier sheets use human-readable text, not library exercise codes.
const schoolFixture={...fixture,programme:{...fixture.programme,sessions:[{
  id:'school-day',day:'Day 1',title:'Strength for Forms',requirement:'Mandatory',
  itemSections:[{title:'Main Strength',items:['Form 2 — 2 x 6 split squat; 2 x 8 single-leg glute bridge; 2 x 10 calf raise','Form 3 — acceleration runs']}]
}]},exercises:[
  {code:'STR01',title:'Split Squat',videoUrl:'https://www.youtube.com/shorts/fq72qz8JHtU'},
  {code:'ACT02',title:'Single-Leg Glute Bridge',videoUrl:'https://www.youtube.com/shorts/zZD--pmOBLM'},
  {code:'ANK01',title:'Calf Raise',videoUrl:'https://www.youtube.com/shorts/C3BmRILCdK8'}
]};
const schoolHost=makeEl();mount(schoolHost,schoolFixture);const schoolRoot=schoolHost.children[1];
schoolRoot.handlers.click({target:{closest:()=>({dataset:{day:'0'}})}});
assert.match(schoolRoot.innerHTML,/Watch Split Squat demonstration/);
assert.match(schoolRoot.innerHTML,/Watch Single-Leg Glute Bridge demonstration/);
assert.match(schoolRoot.innerHTML,/Watch Calf Raise demonstration/);
assert.doesNotMatch(schoolRoot.innerHTML,/Watch Acceleration Runs demonstration/);
assert.doesNotMatch(schoolRoot.innerHTML,/movement-list/);
assert.doesNotMatch(schoolRoot.innerHTML,/tier-label/);
assert.match(schoolRoot.innerHTML,/Form 2 — 2 x 6 split squat; 2 x 8 single-leg glute bridge; 2 x 10 calf raise/);
assert.match(schoolRoot.innerHTML,/Watch demos|Hide demos/);
assert.doesNotMatch(schoolRoot.innerHTML,/Instructions: On|Instructions: Off/);
assert.match(schoolRoot.innerHTML,/Watch Split Squat demonstration/);
schoolRoot.handlers.click({target:{closest:()=>({dataset:{action:'videos'}})}});
assert.doesNotMatch(schoolRoot.innerHTML,/Watch Split Squat demonstration/);
assert.match(schoolRoot.innerHTML,/Watch demos/);
assert.doesNotMatch(schoolRoot.innerHTML,/movement-list/);
schoolRoot.handlers.click({target:{closest:()=>({dataset:{action:'videos'}})}});
assert.match(schoolRoot.innerHTML,/Watch Split Squat demonstration/);

assert.match(html,/src="\/coach-command\/coach-command\.js"/);
assert.match(html,/session\(\)\?\.role==='staff' && window\.DuCoachCommand/);
assert.match(html,/using original staff view/);
const script=html.match(/<script id="performance-hub-app">([\s\S]*?)<\/script>/);
assert.ok(script,'existing hub script must remain');
new vm.Script(script[1],{filename:'performance-hub-app'});
console.log('Coach Command QA passed: access, zero roster, published days, prescriptions, optional session, navigation, video, HTML escaping, roster isolation, integration and Hub syntax.');
