'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const routes=['school-services','parent-coaching','strategic-partnership','travel-support'];
for(const route of routes){
 const html=fs.readFileSync(route+'/index.html','utf8');
 assert.match(html,/#204735/);assert.match(html,/Playfair Display/);assert.match(html,/<form id="enquiry">/);assert.match(html,/Nothing is sent automatically/);
 const fields=[...html.matchAll(/data-label="([^"]+)"/g)].map(m=>({dataset:{label:m[1]},value:'Test & sample / +'}));
 assert.ok(fields.length>=4);
 const events={},location={href:'unchanged'},status={textContent:''};
 const form={querySelectorAll:()=>fields,reportValidity:()=>true,addEventListener:(type,fn)=>events[type]=fn};
 const copy={addEventListener:(type,fn)=>events.copy=fn};
 const document={getElementById:id=>({enquiry:form,status,copy})[id]};
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{document,location,navigator:{}});
 assert.equal(location.href,'unchanged','no auto email');
 assert.equal(typeof events.submit,'function');assert.equal(typeof events.copy,'function');
 events.submit({preventDefault(){}});
 assert.match(location.href,/^mailto:coachdu@duairlineseliteacademy\.com\?subject=/);
 const params=new URLSearchParams(location.href.split('?')[1]);assert.ok(params.get('subject'));
 assert.ok(params.get('body').includes('Test & sample / +'));assert.ok(params.get('body').includes(fields[0].dataset.label));
 for(const dest of ['/my-journey/','/'])assert.ok(html.includes('href="'+dest+'"'));
 console.log(route+' guided enquiry passed');
}
const school=fs.readFileSync('school-booking/index.html','utf8');
assert.match(school,/#204735/);assert.match(school,/Leadership address — USD 300/);assert.match(school,/Specialist technical clinic — USD 450/);assert.match(school,/Performance masterclass — USD 750/);
for(const option of ['leadership','clinic','masterclass'])assert.ok(school.includes(option+':'));
new vm.Script(school.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('Speaking pricing and booking routes preserved');
