const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
test('story is accessible without JavaScript and exposes sourced chapters',()=>{
 const html=fs.existsSync('my-journey/index.html')?fs.readFileSync('my-journey/index.html','utf8'):'';
 assert.match(html,/<h1[^>]*>The Du Airlines/);
 assert.match(html,/<details/);assert.match(html,/<table/);
 const data=JSON.parse(fs.readFileSync('my-journey/story.json'));
 assert.ok(data.chapters.length>=7);
 for(const chapter of data.chapters){assert.ok(html.includes(`id="${chapter.id}"`));assert.ok(chapter.sourceIds.length);}
 for(const p of data.performances){assert.ok(p.date&&p.mark&&data.sources[p.sourceId]);}
 assert.ok(data.rankings.every(r=>r.documentDate&&r.sourceId&&r.kind==='world-ranking-snapshot'));
});
test('new page contains no private academic records or unreviewed watermarks',()=>{
 for(const file of ['index.html','story.json','story.js']){
  const s=fs.readFileSync('my-journey/'+file,'utf8');
  assert.doesNotMatch(s,/2\.591|69\.7%|degree audit|term averages|transcript/i);
 }
 const manifest=JSON.parse(fs.readFileSync('my-journey/photos.json'));
 assert.equal(manifest.length,15);
 for(const p of manifest){assert.equal(p.publishAllowed,true);assert.ok(!p.visibleWatermark||p.watermarkType==='photographer-credit');assert.ok(!/getty|alamy/i.test(p.provider));assert.ok(fs.existsSync('my-journey/'+p.src));}
});
test('homepage changes are limited to the new navigation links',()=>{
 const old=execFileSync('git',['show','921607a:index.html'],{encoding:'utf8',maxBuffer:12e6});
 const current=fs.readFileSync('index.html','utf8');
 const strip=s=>s.replace(/<!-- DU STORY NAV START -->[\s\S]*?<!-- DU STORY NAV END -->/g,'');
 assert.equal(strip(current).replace(/\r\n/g,'\n'),old.replace(/\r\n/g,'\n'));
 assert.match(current,/href="\/my-journey\/"/);
});
test('all responsive photo variants are valid nonempty WebP files',()=>{
 const manifest=JSON.parse(fs.readFileSync('my-journey/photos.json'));
 for(const p of manifest)for(const width of [480,960,1440]){
  const bytes=fs.readFileSync('my-journey/assets/'+p.id+'-'+width+'.webp');
  assert.ok(bytes.length>100,'valid image payload: '+p.id+'-'+width);
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
});
test('manual copy dialog has an accessible name',()=>{
 const html=fs.readFileSync('my-journey/index.html','utf8');
 assert.ok(html.includes('id="share-fallback" aria-labelledby="share-dialog-title"'));
 assert.ok(html.includes('id="share-dialog-title"'));
});
test('chart tap targets retain at least 44 CSS pixels on narrow screens',()=>{
 const css=fs.readFileSync('my-journey/story.css','utf8'),js=fs.readFileSync('my-journey/story.js','utf8');
 const minWidth=Number(css.match(/\.chart-svg\{min-width:(\d+)px\}/)?.[1]||0);
 const radius=Number(js.match(/data-point=\\"\$\{i\}\\"[^\n]*?r=\\"(\d+)\\"/)?.[1]||js.match(/data-point="\$\{i\}"[^\n]*?r="(\d+)"/)?.[1]||0);
 assert.ok(minWidth*radius*2/760>=44,'44px target after SVG scaling');
 assert.match(css,/#chart-plot\{overflow-x:auto/);
});
test('preview navigation returns to the real academy and preserves chapter links',()=>{
 const html=fs.readFileSync('my-journey/index.html','utf8');
 assert.ok(html.includes('href="https://duairlineseliteacademy.com/#/hub/login"'));
 assert.ok(html.includes('href="https://duairlineseliteacademy.com/#sports"'));
 assert.ok(!html.includes('href="/"'));
});
test('a curious visitor can scan the entire trajectory before opening any chapter',()=>{
 const html=fs.readFileSync('my-journey/index.html','utf8'),data=JSON.parse(fs.readFileSync('my-journey/story.json'));
 assert.ok(html.includes('id="journey-at-a-glance"'));
 assert.ok(html.includes('aria-label="Career trajectory at a glance"'));
 const ids=data.chapters.map(c=>c.id);
 assert.ok(ids.indexOf('coaching-myself')<ids.indexOf('carrying-zimbabwe'));
 assert.match(html,/Chengetayi “Chenge” Mapaya/);
});
test('homepage biography entry sits immediately beneath expandable credentials',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(/<\/details><!-- DU STORY NAV START --><a class="du-story-entry"/.test(html));
 assert.ok(!html.includes('class="du-story-mobile-nav"'));
});
