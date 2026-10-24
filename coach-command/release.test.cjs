// Release regressions: complete coach export and printable collapsed warm-up.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const el=()=>({children:[],innerHTML:'',replaceChildren(...x){this.children=x},append(x){this.children.push(x)},addEventListener(n,f){this[n]=f}});
 let copied='',printed=false;const warmup={open:false},cue={open:false};
 const ctx={window:{print(){printed=true;assert.ok(warmup.open,'printed warm-up is expanded');assert.ok(cue.open,'printed cue is expanded')}},document:{createElement:el},URL,navigator:{clipboard:{async writeText(x){copied=x}}},alert(){throw Error('copy failed')}};
 vm.runInNewContext(fs.readFileSync('coach-command/coach-command.js','utf8'),ctx);
 const host=el();ctx.window.DuCoachCommand.mount(host,{role:'staff',cohort:{id:'test',name:'Synthetic school'},programme:{sessions:[{day:'Day 1',title:'Foundations',prescriptions:[{sectionTitle:'Warm-up',exerciseCode:'WU01',dosage:'2 × 8',rest:'30 seconds',cues:'Quiet feet'}]}]},exercises:[{code:'WU01',title:'Ankle Rock',videoId:'6Dlac5mxD6k'}]});
 const root=host.children[1];root.querySelectorAll=s=>s.includes('warmup')?[warmup,cue]:[cue];
 const click=action=>root.click({target:{closest:()=>({dataset:{action}})}});
 click('workout');return {root,click,warmup,cue,copied:()=>copied,printed:()=>printed};
}
test('coach copy includes prescription, rest, cue and canonical demonstration link',async()=>{
 const h=setup();await h.click('copy');const text=h.copied();for(const token of ['Ankle Rock','2 × 8','30 seconds','Quiet feet','https://www.youtube-nocookie.com/embed/6Dlac5mxD6k'])assert.ok(text.includes(token),token);
});
test('coach print expands warm-up and cues then restores disclosure state',async()=>{
 const h=setup();await h.click('print');assert.ok(h.printed());assert.equal(h.warmup.open,false);assert.equal(h.cue.open,false);
});
