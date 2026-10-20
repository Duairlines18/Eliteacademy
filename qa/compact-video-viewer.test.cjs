const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('school, parent and private demos share compact modal as default',()=>{
 assert.match(html,/\.hub-video-modal:not\(\.expanded\)\{inset:auto 0 0/);
 assert.match(html,/\.hub-video-modal:not\(\.expanded\) \.hub-video-modal-panel\{width:min\(680px,100%\)/);
 assert.match(html,/modal\.classList\.remove\('expanded'\)/);
 assert.match(html,/data-hub-video-expand/);
});
test('expand and minimize keep existing iframe and workout scroll position',()=>{
 assert.match(html,/modal\.classList\.toggle\('expanded'\)/);
 assert.match(html,/expanded\?'Minimize ↙':'Expand ↗'/);
 assert.match(html,/HUB_VIDEO_SCROLL_Y=window\.scrollY/);
 assert.match(html,/window\.scrollTo\(\{top:HUB_VIDEO_SCROLL_Y/);
 assert.match(html,/allowfullscreen><\/iframe>/);
});
test('mobile compact player never forces full viewport height',()=>{
 assert.match(html,/\.hub-video-modal:not\(\.expanded\) \.hub-video-modal-panel\{height:auto;max-height:48dvh/);
 assert.match(html,/\.hub-video-modal:not\(\.expanded\) \.hub-video-modal-frame-wrap\.vertical\{height:min\(28dvh,245px\)/);
});
