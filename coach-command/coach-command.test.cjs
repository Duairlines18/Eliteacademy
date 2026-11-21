// Coach Command contract tests — no production credentials or athlete data.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'coach-command.js'),'utf8');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const makeEl=()=>({innerHTML:'',children:[],dataset:{},addEventListener(name,fn){this.handlers??={};this.handlers[name]=fn;},append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;}});
const ctx={window:{DuHubDelivery:require("../hub-delivery/delivery.js")},document:{createElement:makeEl},URL,console,alert(){throw Error('unexpected alert')}};
vm.runInNewContext(source,ctx,{filename:'coach-command.js'});
const mount=ctx.window.DuCoachCommand.mount;
const fixture={role:'staff',cohort:{id:'school-1',name:"Saints <College>",currentWeek:4},programme:{title:'Jumps',sessions:[
{id:'d1',title:'Acceleration',day:'Day 1',duration:'45 min',requirement:'Mandatory',prescriptions:[{sectionTitle:'Warm-up',exerciseCode:'WU01',dosage:'2 x 10',cues:'[Activation] Stay tall'}]},
{id:'d2',title:'Landing',day:'Day 2',requirement:'Mandatory',prescriptions:[]},
{id:'d3',title:'Mobility',day:'Day 3',requirement:'Optional',prescriptions:[]},
{id:'d4',title:'Extra published session',day:'Day 4',requirement:'Optional',prescriptions:[]}
]},exercises:[{code:'WU01',title:'Pogos',videoId:'6Dlac5mxD6k',description:'Keep each bounce low.',coachingNote:'Cue: Short contacts. Avoid: Heavy landings.'}]};
assert.throws(()=>mount(makeEl(),{...fixture,role:'athlete'}),/staff/);
const host=makeEl();mount(host,fixture);const root=host.children[1];
assert.match(root.innerHTML,/Team Command/);
assert.match(root.innerHTML,/Athletes have not been connected/);
assert.doesNotMatch(root.innerHTML,/undefined\/undefined/);
assert.match(root.innerHTML,/Day 4/);
assert.match(root.innerHTML,/Weekly coach feedback/);
assert.match(root.innerHTML,/Saints &lt;College&gt;/);
assert.doesNotMatch(root.innerHTML,/Saints <College>/);
const directHost=makeEl();mount(directHost,fixture,{initialSessionId:'d2'});
assert.match(directHost.children[1].innerHTML,/Full Workout/,'saved session links open the same coach workout');
assert.match(directHost.children[1].innerHTML,/<h2>Landing<\/h2>/,'saved session links select the requested day');
const missingHost=makeEl();mount(missingHost,fixture,{initialSessionId:'unpublished'});
assert.match(missingHost.children[1].innerHTML,/Team Command/,'unknown session cannot open an unassigned workout');
root.handlers.click({target:{closest:()=>({dataset:{day:'0'}})}});
assert.match(root.innerHTML,/Full Workout/);
assert.match(root.innerHTML,/Pogos/);
assert.match(root.innerHTML,/2 x 10/);
assert.match(root.innerHTML,/aria-current="true">Workout<.*data-action="present">Present Workout</);
assert.doesNotMatch(root.innerHTML,/data-action="learn"|<iframe/);
assert.match(root.innerHTML,/<summary>Session instructions<\/summary>.*Stay tall/);
assert.match(root.innerHTML,/<h4>Activation<\/h4>/);
assert.doesNotMatch(root.innerHTML,/\[Activation\]/);
assert.match(root.innerHTML,/<details class="learn-card".*Play Pogos demonstration.*How to do it.*Keep each bounce low/);
assert.match(root.innerHTML,/<strong>Coach cue<\/strong> Short contacts/);
assert.match(root.innerHTML,/<strong>For this session<\/strong> Stay tall/);
assert.match(root.innerHTML,/<strong>Watch for<\/strong> Heavy landings/);
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
assert.match(schoolRoot.innerHTML,/Form 2 — 2 x 6 split squat; 2 x 8 single-leg glute bridge; 2 x 10 calf raise/);
assert.doesNotMatch(schoolRoot.innerHTML,/<iframe|movement-list|tier-label/);
assert.match(schoolRoot.innerHTML,/Play Single-Leg Glute Bridge demonstration/);
assert.match(schoolRoot.innerHTML,/data-demo-title="Split Squat"/);
assert.match(schoolRoot.innerHTML,/data-demo-title="Calf Raise"/);
assert.doesNotMatch(schoolRoot.innerHTML,/Play Acceleration Runs demonstration/);
assert.match(schoolRoot.innerHTML,/Form 3 — acceleration runs<\/span><\/span><\/li>/);

assert.match(html,/src="\/coach-command\/coach-command\.js(?:\?[^" ]+)?"/);
assert.match(html,/session\(\)\?\.role==='staff' && window\.DuCoachCommand/);
assert.match(html,/using original staff view/);
const script=html.match(/<script id="performance-hub-app">([\s\S]*?)<\/script>/);
assert.ok(script,'existing hub script must remain');
new vm.Script(script[1],{filename:'performance-hub-app'});
console.log('Coach Command QA passed: access, zero roster, published days, prescriptions, optional session, navigation, video, HTML escaping, roster isolation, integration and Hub syntax.');
