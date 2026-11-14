const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={URL};vm.createContext(ctx);const path='qa/workout-validation.js';if(fs.existsSync(path))vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
const check=(blocks,library)=>{assert.equal(typeof ctx.workoutDeliveryIssues,'function');return ctx.workoutDeliveryIssues(blocks,library)};
const library=[{code:'STR01',name:'Calf Raise',active:true,video_url:'https://www.youtube.com/watch?v=abcdefghijk'}];
test('publication check rejects missing demo and incomplete dose',()=>{
 const blocks=[{title:'Strength',content:{prescriptions:[{exerciseCode:'STR01',dosage:''}]}}];
 const errors=check(blocks,library.map(e=>({...e,video_url:''})));
 assert.ok(errors.some(e=>/dosage/i.test(e)));assert.ok(errors.some(e=>/demo/i.test(e)));
});
test('publication check rejects broken text mappings',()=>{
 const errors=check([{content:{items:['Calf Raise — 3 × 10'],video_links:[{item_index:2,exercise:'Calf Raise'}]}}],library);
 assert.ok(errors.some(e=>/row/i.test(e)));
});
test('publication check accepts ordinary run instructions without inventing exercise videos',()=>{
 assert.equal(check([{content:{items:['30-minute easy run only.']}}],library).length,0);
});
test('explicit instruction-only prescriptions are valid and empty instructions fail',()=>{
 assert.equal(check([{content:{prescriptions:[{instruction:'3 x 80m; rest 3 min'}]}}],library).length,0);
 assert.ok(check([{content:{prescriptions:[{instruction:''}]}}],library).length>0);
});
test('a more specific movement is not mistaken for its shorter parent name',()=>{
 const ex=[{code:'A',name:'Dead Bug',active:true,video_url:'https://www.youtube.com/watch?v=abcdefghijk'},{code:'B',name:'Dead Bug Heel Tap',active:true,video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}];
 assert.equal(check([{content:{items:['Dead Bug Heel Tap — 2 × 6'],video_links:[{item_index:0,exercise:'Dead Bug Heel Tap'}]}}],ex).length,0);
});

test('rejects a video URL that does not match its exercise library entry',()=>{
 const errors=check([{title:'Strength',content:{items:['Calf Raise — 3 × 10'],video_links:[{item_index:0,exercise:'Calf Raise',video_url:'https://www.youtube.com/watch?v=wrong'}]}}],library);
 assert.ok(errors.some(e=>/URL differs from library/i.test(e)));
});
test('rejects another movement linked to a coded prescription row',()=>{
 const ex=[...library,{code:'STR02',name:'Dead Bug',active:true,video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}];
 const errors=check([{title:'Strength',content:{items:['Calf Raise — 3 × 10'],prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}],video_links:[{item_index:0,exercise:'Dead Bug',video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}]}}],ex);
 assert.ok(errors.some(e=>/does not match prescribed code/i.test(e)));
});
test('accepts correctly linked coded prescription with canonical URL',()=>{
 const errors=check([{title:'Strength',content:{items:['Calf Raise — 3 × 10'],prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}],video_links:[{item_index:0,exercise:'Calf Raise',video_url:'https://www.youtube.com/watch?v=abcdefghijk'}]}}],library);
 assert.equal(errors.length,0);
});

test('grouped multi-exercise school rows do not create false code mismatch alarms',()=>{
 const ex=[...library,{code:'STR02',name:'Dead Bug',active:true,video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}];
 const errors=check([{title:'School Circuit',content:{items:['Form 2 — 3 x 10 calf raise; 2 x 6 dead bug'],prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}],video_links:[{item_index:0,exercise:'Dead Bug',video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}]}}],ex);
 assert.ok(!errors.some(e=>/does not match prescribed code/i.test(e)));
});

test('synthetic private athlete: coded workout and canonical demo stay aligned',()=>{
 const blocks=[{title:'Private Strength',content:{items:['Calf Raise — 3 × 10'],prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}],video_links:[{item_index:0,exercise:'Calf Raise',video_url:library[0].video_url}]}}];
 assert.equal(check(blocks,library).length,0);
});
test('synthetic parent-managed workout: incorrect linked demo is blocked',()=>{
 const ex=[...library,{code:'CORE01',name:'Dead Bug',active:true,video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}];
 const blocks=[{title:'Parent Guided',content:{items:['Calf Raise — 3 × 10'],prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}],video_links:[{item_index:0,exercise:'Dead Bug',video_url:ex[1].video_url}]}}];
 assert.ok(check(blocks,ex).some(e=>/does not match prescribed code/i.test(e)));
});
test('synthetic school grouped rows retain reviewed multiple demo links',()=>{
 const ex=[...library,{code:'CORE01',name:'Dead Bug',active:true,video_url:'https://www.youtube.com/watch?v=bcdefghijkl'}];
 const blocks=[{title:'School Groups',content:{items:['Form 2 — 3 x 10 calf raise; 2 x 6 dead bug'],video_links:[{item_index:0,exercise:'Calf Raise',video_url:ex[0].video_url},{item_index:0,exercise:'Dead Bug',video_url:ex[1].video_url}]}}];
 assert.equal(check(blocks,ex).length,0);
});

test('rejects malformed video identifiers that the athlete Hub cannot play',()=>{
 const invalid=[{code:'STR01',name:'Calf Raise',active:true,video_id:'shortid',video_url:''}];
 const errors=check([{title:'Strength',content:{prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}]}}],invalid);
 assert.ok(errors.some(e=>/approved active demo missing/i.test(e)));
});
test('rejects misleading YouTube URL with invalid video ID',()=>{
 const invalid=[{code:'STR01',name:'Calf Raise',active:true,video_url:'https://www.youtube.com/watch?v=not-eleven-characters'}];
 assert.ok(check([{content:{prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}]}}],invalid).some(e=>/demo missing/i.test(e)));
});
test('accepts valid 11-character YouTube shorts',()=>{
 const valid=[{code:'STR01',name:'Calf Raise',active:true,video_url:'https://www.youtube.com/shorts/abcdefghijk'}];
 assert.equal(check([{content:{prescriptions:[{exerciseCode:'STR01',dosage:'3 x 10'}]}}],valid).length,0);
});
