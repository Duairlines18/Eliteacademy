// Coach copy, presenter and print contracts against an authorized synthetic week.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({warmupCue='Quiet feet',libraryCue='Keep your heel down.'}={}){
 const el=()=>({children:[],innerHTML:'',replaceChildren(...x){this.children=x},append(x){x.remove=()=>{this.children=this.children.filter(child=>child!==x)};this.children.push(x)},addEventListener(n,f){this[n]=f},querySelectorAll(s){return this.children.filter(c=>'.'+c.className===s)}});
 let copied='',printed='';
 const ctx={window:{DuHubDelivery:require('../hub-delivery/delivery.js'),print(){printed=root.children.find(x=>x.className==='print-sheet').innerHTML}},document:{createElement:el},URL,navigator:{clipboard:{async writeText(x){copied=x}}},alert(){throw Error('copy failed')}};
 vm.runInNewContext(fs.readFileSync('coach-command/coach-command.js','utf8'),ctx);
 const host=el();
 const warmup={sectionTitle:'Warm-up',sectionOrder:0,sourceOrder:0,exerciseCode:'WU01',dosage:'2 × 8',rest:'30 seconds',cues:warmupCue};
 ctx.window.DuCoachCommand.mount(host,{role:'staff',cohort:{id:'test',name:'Synthetic school'},programme:{sessions:[
   {day:'Day 1',title:'Foundations',watch:'Coach-approved readiness required before plyometric additions.\nStop for pain.',itemSections:[{title:'Running',order:1,items:['Use the prescribed space first.'],sourceOrders:[0]}],prescriptions:[warmup,{sectionTitle:'Running',sectionOrder:1,sourceOrder:1,exerciseCode:'6 × 100 m at 75%',dosage:'6 × 100 m',rest:'1 minute'}]},
   {day:'Day 2',title:'Landing',prescriptions:[{...warmup,dosage:'1 × 5'}]},
   {day:'Day 3',title:'Unreleased workout',locked:true,prescriptions:[{...warmup,dosage:'Secret dose'}]},
 ]},exercises:[{code:'WU01',title:'Ankle Rock',videoId:'6Dlac5mxD6k',description:'Move your knee forward.',coachingCues:libraryCue+' Avoid: Forcing the range.'}]},{rosterVerified:true,roster:[{cohort_id:'test',display_name:'Private athlete'}]});
 const root=host.children[1];
 const click=dataset=>root.click({target:{closest:()=>({dataset:typeof dataset==='string'?{action:dataset}:dataset})}});
 return {root,click,copied:()=>copied,printed:()=>printed};
}
test('coach copy contains only workout identification, blocks and prescriptions',async()=>{
 const h=setup();await h.click('workout');await h.click('copy');
 assert.match(h.copied(),/^DU AIRLINES ELITE ACADEMY\n/);
 assert.match(h.copied(),/WARM-UP\n1\. Ankle Rock — 2 × 8 · Rest: 30 seconds/);
 assert.match(h.copied(),/RUNNING\n1\. Use the prescribed space first\.\n2\. 6 × 100 m at 75% — 6 × 100 m · Rest: 1 minute/);
 assert.doesNotMatch(h.copied(),/Coach-approved|Quiet feet|Stop for pain|How to do it|Coach cue|Watch for|https:/);
});
test('the Ankle Rock briefing uses the movement cue and retains the assigned range in Coach Details',async()=>{
 const h=setup({warmupCue:'[Mobility] Comfortable controlled range.',libraryCue:'Move the knee, keep the heel down.'});
 await h.click({day:'0'});
 await h.click('present');
 const [briefing,details]=h.root.innerHTML.split('<details class="presentation-details">');
 assert.match(briefing,/<strong>Coaching cue<\/strong>Move the knee, keep the heel down\./);
 assert.doesNotMatch(briefing,/Comfortable controlled range/);
 assert.match(details,/<strong>For this session<\/strong> Comfortable controlled range\./);
});
test('day and week print preserve prescriptions and exclude coaching material, locked sessions and rosters',async()=>{
 const h=setup();await h.click({day:'1'});await h.click('print');
 assert.match(h.printed(),/DU AIRLINES ELITE ACADEMY.*Day 2.*1 × 5/);
 assert.doesNotMatch(h.printed(),/Foundations/);
 await h.click('print-week');
 assert.match(h.printed(),/Day 1.*Day 2/);
 assert.match(h.printed(),/Ankle Rock — <strong>2 × 8 · Rest: 30 seconds<\/strong>.*6 × 100 m at 75% — <strong>6 × 100 m · Rest: 1 minute/);
 assert.doesNotMatch(h.printed(),/Private athlete|Unreleased workout|Secret dose|Coach-approved|How to do it|Quiet feet|Stop for pain|Forcing the range|https:|iframe/);
 assert.equal(h.root.children.filter(x=>x.className==='print-sheet').length,1);
});
test('presenter shows one exercise and returns to the selected day',async()=>{
 const h=setup();await h.click({day:'0'});
 assert.match(h.root.innerHTML,/Stop for pain\./);
 assert.doesNotMatch(h.root.innerHTML,/Coach-approved readiness/);
 assert.match(h.root.innerHTML,/Coach cue.*Keep your heel down.*Watch for.*Forcing the range.*For this session.*Quiet feet.*<details class="movement-detail"/);
 await h.click('present');
 const [briefing,details]=h.root.innerHTML.split('<details class="presentation-details">');
 assert.match(briefing,/Present Workout.*1 of 3.*i\.ytimg\.com\/vi\/6Dlac5mxD6k\/hqdefault\.jpg.*Play Ankle Rock demonstration.*Warm-up.*Ankle Rock.*2 × 8.*30 seconds/);
 assert.match(briefing,/How to do it.*Move your knee forward.*Coaching cue.*Quiet feet.*Watch for.*Forcing the range/);
 assert.doesNotMatch(briefing,/Stop for pain|Coach-approved readiness|<iframe/);
 assert.match(details,/<h4>Session guidance<\/h4><p>Stop for pain\.<\/p>/);
 assert.match(details,/<progress max="3" value="1"/);
 assert.match(h.root.innerHTML,/Stop for pain\./);
 assert.doesNotMatch(h.root.innerHTML,/Coach-approved readiness/);
 assert.doesNotMatch(h.root.innerHTML,/Private athlete|6 × 100 m/);
 await h.click('next-slide');
 assert.match(h.root.innerHTML,/2 of 3.*Running.*Use the prescribed space first/);
 assert.doesNotMatch(h.root.innerHTML,/Ankle Rock|6Dlac5mxD6k|Coaching cue/);
 assert.match(h.root.innerHTML,/No video for this exercise/);
 await h.click('next-slide');
 assert.match(h.root.innerHTML,/3 of 3.*6 × 100 m at 75%.*1 minute/);
 await h.click('exit-present');
 assert.match(h.root.innerHTML,/Full Workout.*Foundations/);
});

test('long exercise guidance shows the existing first instruction and retains the full wording in Coach Details',async()=>{
 const h=setup({warmupCue:'',libraryCue:'Keep your heel down. '+('Use a smooth tempo through each repetition. '.repeat(5))});
 await h.click({day:'0'});
 await h.click('present');
 const [briefing,details]=h.root.innerHTML.split('<details class="presentation-details">');
 assert.match(briefing,/<strong>Coaching cue<\/strong>Keep your heel down\.<\/p>/);
 assert.doesNotMatch(briefing,/Use a smooth tempo/);
 assert.match(details,/Keep your heel down\. Use a smooth tempo/);
});
