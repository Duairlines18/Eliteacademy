const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const el=()=>({children:[],replaceChildren(...x){this.children=x},append(x){this.children.push(x)},addEventListener(n,f){this[n]=f},innerHTML:''});
const ctx={window:{},document:{createElement:el},URL,console};vm.runInNewContext(fs.readFileSync('coach-command/coach-command.js','utf8'),ctx);
const host=el();ctx.window.DuCoachCommand.mount(host,{role:'staff',cohort:{id:'test',name:'Test'},programme:{sessions:[{id:'one',title:'Practice',prescriptions:[{sectionTitle:'Air Zim Warm-Up',exerciseCode:'X',dosage:'8 per leg',cues:'[Mobility] Controlled'}],itemSections:[{title:'Main session',items:['Preserve every main workout and rest — 3 minutes']}]}]},exercises:[]});
const root=host.children[1];root.click({target:{closest:()=>({dataset:{day:'0'}})}});
assert.match(root.innerHTML,/Preserve every main workout and rest/,'adding warm-up prescriptions must not hide legacy main workouts');
assert.match(root.innerHTML,/Mobility/);console.log('Mixed coach prescriptions and legacy main-workout preservation passed.');
