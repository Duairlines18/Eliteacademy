// Coach copy, presenter and print contracts against an authorized synthetic week.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const el=()=>({children:[],innerHTML:'',replaceChildren(...x){this.children=x},append(x){x.remove=()=>{this.children=this.children.filter(child=>child!==x)};this.children.push(x)},addEventListener(n,f){this[n]=f},querySelectorAll(s){return this.children.filter(c=>'.'+c.className===s)}});
 let copied='',printed='';
 const ctx={window:{DuHubDelivery:require('../hub-delivery/delivery.js'),print(){printed=root.children.find(x=>x.className==='print-sheet').innerHTML}},document:{createElement:el},URL,navigator:{clipboard:{async writeText(x){copied=x}}},alert(){throw Error('copy failed')}};
 vm.runInNewContext(fs.readFileSync('coach-command/coach-command.js','utf8'),ctx);
 const host=el();
 const warmup={sectionTitle:'Warm-up',exerciseCode:'WU01',dosage:'2 × 8',rest:'30 seconds',cues:'Quiet feet'};
 ctx.window.DuCoachCommand.mount(host,{role:'staff',cohort:{id:'test',name:'Synthetic school'},programme:{sessions:[
   {day:'Day 1',title:'Foundations',watch:'Stop for pain.',prescriptions:[warmup,{sectionTitle:'Running',exerciseCode:'6 × 100 m at 75%',dosage:'6 × 100 m',rest:'1 minute'}]},
   {day:'Day 2',title:'Landing',prescriptions:[{...warmup,dosage:'1 × 5'}]},
   {day:'Day 3',title:'Unreleased workout',locked:true,prescriptions:[{...warmup,dosage:'Secret dose'}]},
 ]},exercises:[{code:'WU01',title:'Ankle Rock',videoId:'6Dlac5mxD6k',description:'Keep your heel down.'}]},{rosterVerified:true,roster:[{cohort_id:'test',display_name:'Private athlete'}]});
 const root=host.children[1];
 const click=dataset=>root.click({target:{closest:()=>({dataset:typeof dataset==='string'?{action:dataset}:dataset})}});
 return {root,click,copied:()=>copied,printed:()=>printed};
}
test('coach copy includes prescription, rest, session safety, cue and canonical demo',async()=>{
 const h=setup();await h.click('workout');await h.click('copy');
 for(const token of ['Ankle Rock','2 × 8','30 seconds','Quiet feet','Stop for pain.','https://www.youtube-nocookie.com/embed/6Dlac5mxD6k'])assert.ok(h.copied().includes(token),token);
});
test('day and week print use a dedicated sheet and exclude locked and roster content',async()=>{
 const h=setup();await h.click({day:'1'});await h.click('print');
 assert.match(h.printed(),/Day 2.*1 × 5/);
 assert.doesNotMatch(h.printed(),/Foundations|Private athlete|iframe/);
 await h.click('print-week');
 assert.match(h.printed(),/Day 1.*Day 2/);
 assert.match(h.printed(),/Keep your heel down.*Quiet feet.*6 × 100 m.*1 minute/);
 assert.doesNotMatch(h.printed(),/Private athlete|Unreleased workout|Secret dose|iframe/);
 assert.equal(h.root.children.filter(x=>x.className==='print-sheet').length,1);
});
test('presenter shows one block and returns to the selected day',async()=>{
 const h=setup();await h.click({day:'0'});await h.click('present');
 assert.match(h.root.innerHTML,/Workout presentation.*Warm-up.*Quiet feet/);
 assert.doesNotMatch(h.root.innerHTML,/Private athlete|6 × 100 m/);
 await h.click('next-block');
 assert.match(h.root.innerHTML,/Running.*6 × 100 m.*1 minute/);
 assert.doesNotMatch(h.root.innerHTML,/Ankle Rock/);
 await h.click('exit-present');
 assert.match(h.root.innerHTML,/Full Workout.*Foundations/);
});
