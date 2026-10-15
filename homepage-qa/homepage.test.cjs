'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
// These checks catch the duplicated homepage fragments and their stale controllers.
for(const id of ['sports','performance-hub','credentials','premium-story-grid']){
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,`${id} must identify one section`);
}
assert.equal((html.match(/aria-label="Championship credentials"/g)||[]).length,1,'one championship proof band');
assert.doesNotMatch(html,/data-du-role|data-da-role/,'only the active role controller remains');
assert.doesNotMatch(html,/id="da-premium-homepage|id="du-premium-homepage/,'remove abandoned homepage CSS and scripts');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(!/\btype="module"/.test(match[1])&&match[2].trim())new vm.Script(match[2]);
}
console.log('Homepage structure and inline JavaScript syntax passed.');
// Treat the last production main as an immutable integration baseline. This
// catches accidental changes to registration, payments, routing and Hub code.
const {execFileSync}=require('node:child_process');
const baseline=execFileSync('git',['show','af9a659:index.html'],{encoding:'utf8',maxBuffer:10*1024*1024});
const routeStart='<div class="site-view" hidden="" id="soccer-view">';
const homepageController='<script id="premium-homepage-interactions">';
assert.ok(html.includes(routeStart)&&baseline.includes(routeStart));
assert.equal(html.slice(html.indexOf(routeStart),html.indexOf(homepageController)),baseline.slice(baseline.indexOf(routeStart),baseline.indexOf(homepageController)),'registration/payment forms, routes and Hub implementation remain byte-for-byte unchanged');
const form=source=>source.match(/<form[^>]*id="partnershipForm"[\s\S]*?<\/form>/)[0];
assert.equal(form(html),form(baseline),'partnership form fields and submission destination preserved');
console.log('Production integration preservation passed.');
