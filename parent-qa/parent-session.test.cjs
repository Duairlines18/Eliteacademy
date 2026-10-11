'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
for(const script of scripts){if(script.trim())new vm.Script(script);}
const app=scripts.find(s=>s.includes('function parentTrainingDays('));
assert.ok(app,'Hub app script found');
const begin=app.indexOf('  function parentSessionLabel('),end=app.indexOf('  function renderAthleteDashboard(){',begin);
assert.ok(begin>=0&&end>begin,'parent rendering functions available');
const code=app.slice(begin,end)+';globalThis.api={parentSessionLabel,parentSessionHeading,parentTrainingDays,renderParentSimpleDashboard};';
const ctx={encodeURIComponent,escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),programme:()=>ctx.p,athleteDemo:()=>({displayName:'Andria'}),HUB_STATE:{contentStatus:'live'},weekLabel:()=> 'Week 4 of 6',root:{innerHTML:''},shell:s=>s};
vm.createContext(ctx);vm.runInContext(code,ctx);
const sessions=[
{id:'one',day:'Day 1',title:'Day 1 — Recovery Reset',duration:'15–20 min'},
{id:'two',day:'Day 2',title:'Day 2 — Movement + Reactive Control',duration:'25–30 min'},
{id:'three',day:'Day 3',title:'Day 3 — Recovery Reset + Gentle Core',duration:'25–30 min'},
{id:'warm',day:'Game Warm-Up',title:'Standard Warm-Up Before Games',duration:'8–10 min'}];
ctx.p={title:'Andria Volleyball Development',sessions,weeklyObjective:'Move well and control landings'};
const nav=ctx.api.parentTrainingDays(ctx.p);
assert.equal((nav.match(/hub-parent-session-card/g)||[]).length,4,'four published session cards');
for(const s of sessions)assert.match(nav,new RegExp(s.title.replace(/^Day \d+ — /,'')),'uses published workout heading');
assert.match(nav,/15–20 min/);assert.match(nav,/25–30 min/);assert.match(nav,/8–10 min/);
assert.doesNotMatch(nav,/Day 1 — Day 1/);
assert.match(ctx.api.parentTrainingDays(ctx.p,'two'),/hub-parent-session-card selected/);
ctx.api.renderParentSimpleDashboard();
assert.match(ctx.root.innerHTML,/Week 4 of 6/);
assert.match(ctx.root.innerHTML,/This week’s focus/);
assert.doesNotMatch(ctx.root.innerHTML,/PREVIOUS WEEKS|Parent Guide/);
ctx.p={...ctx.p,sessions:[{id:'x',day:'Day 1',title:'Day 1 — Acceleration + Strength',duration:'45 min'}],weeklyObjective:''};
const changed=ctx.api.parentTrainingDays(ctx.p);
assert.match(changed,/Acceleration \+ Strength/);
assert.doesNotMatch(changed,/Recovery Reset/);
assert.match(app,/Guided Workout/);
assert.match(app,/data-workout-mode="guided"/);
assert.match(app,/isWorkoutComplete/);
assert.match(app,/Watch Demo|Watch demo/);
console.log('Parent QA passed: dynamic published titles, durations, selected states, no duplicate days, no history, guided mode preserved, inline JS syntax.');
