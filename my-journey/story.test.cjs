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
 assert.ok(data.rankings.every(r=>r.documentDate&&r.sourceId&&['world-ranking-snapshot','annual-top-list','reported-world-position','championship-result'].includes(r.kind)));
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
test('homepage changes are limited to navigation and the authorized pathway arrival',()=>{
 const old=execFileSync('git',['show','921607a:index.html'],{encoding:'utf8',maxBuffer:12e6});
 const current=fs.readFileSync('index.html','utf8').replace(/Loughborough University Student-Athlete/g,'Future Loughborough University Student-Athlete').replace('<p>Kutama College Sports Captain</p>','<p>800m Athlete · Kutama College</p>').replace('— Kutama College Sports Captain</div>','— 800m Athlete, Kutama College</div>');
 const strip=s=>s.replace(/<!-- DU STORY NAV START -->[\s\S]*?<!-- DU STORY NAV END -->/g,'').replace(/      if \(activeView === homeView && location.hash === '#sports'\) \{[\s\S]*?      \} else \{\r?\n        window.scrollTo\(\{top:0, behavior:'instant'\}\);\r?\n      \}/,"      window.scrollTo({top:0, behavior:'instant'});");
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
 assert.match(html,/Chengetayi “Du Airlines” Mapaya/);
});
test('homepage biography entry sits immediately beneath expandable credentials',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(/<\/details><!-- DU STORY NAV START --><a class="du-story-entry"/.test(html));
 assert.ok(!html.includes('class="du-story-mobile-nav"'));
});

test('historical top lists stay distinct from points-based world rankings',()=>{
 const data=JSON.parse(fs.readFileSync('my-journey/story.json'));
 const junior=data.rankings.find(r=>r.kind==='annual-top-list'&&r.ageCategory==='u20');
 assert.ok(junior,'a sourced U20 annual list is included');
 assert.equal(junior.season,2017);assert.equal(junior.rank,10);
 assert.equal(junior.mark,16.30);assert.ok(data.sources[junior.sourceId].url.includes('ageCategory=u20'));
 for(const r of data.rankings){assert.ok(r.heading&&r.context&&r.dateLabel);}
});

test('Story CTA opens pathways at the correct header offset and preserves other routes',()=>{
 const vm=require('node:vm');
 const home=fs.readFileSync('index.html','utf8');
 const html=fs.readFileSync('my-journey/index.html','utf8');
 const arrival=home.match(/      if \(activeView === homeView && location.hash === '#sports'\) \{[\s\S]*?      \} else \{\r?\n        window.scrollTo\(\{top:0, behavior:'instant'\}\);\r?\n      \}/)[0];
 for(const height of [54,84])for(const hash of ['#sports','#/','#/hub/login']){
  const details={open:false};let scroll;
  const homeView={querySelector:()=>({offsetHeight:height})};
  const context={activeView:homeView,homeView,location:{hash},document:{getElementById:id=>{assert.equal(id,'sports');return {querySelector:()=>details,getBoundingClientRect:()=>({top:900})};}},window:{scrollY:100,scrollTo:options=>{scroll=options;}}};
  vm.runInNewContext(arrival,context);
  assert.equal(details.open,hash==='#sports');assert.equal(scroll.top,hash==='#sports'?1000-height-16:0);
 }
 assert.ok(html.includes('Partner with Du Airlines'));
 assert.ok(!html.includes('Bring Du Airlines to your school'));
});

test('results and awards preserve performance data and distinguish sourced recognition',()=>{
 const data=JSON.parse(fs.readFileSync('my-journey/story.json','utf8'));
 const html=fs.readFileSync('my-journey/index.html','utf8');
 const embedded=JSON.parse(html.match(/<script type="application\/json" id="story-data">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(embedded,data,'visible data and chart data must agree');
 const prior=JSON.parse(execFileSync('git',['show','5146430:my-journey/story.json'],{encoding:'utf8'}));
 assert.deepEqual(data.performances,prior.performances,'awards cannot become distance-chart points');
 assert.deepEqual(data.rankings,prior.rankings,'rankings remain separate from awards');
 assert.equal(data.overview.find(o=>o.era==='AFTER TCU').title,'Three World Champs Qualifications.');
 assert.equal(data.overview.find(o=>o.era==='2026 →').title,'Du Airlines Elite Academy. The next generation.');
 assert.match(html,/Selected results and awards/);assert.doesNotMatch(html,/All selected results/);
 assert.equal(data.awards.length,15);
 for(const a of data.awards){assert.match(a.url,/^https:\/\//);assert.ok(a.period&&a.title&&a.detail&&a.sourceLabel);assert.ok(html.includes(a.url.replace(/&/g,'&amp;')));}
 for(const year of ['2016','2017'])assert.ok(data.awards.some(a=>a.period===year&&a.title==='ANSA Junior Sportsman of the Year'&&a.detail.startsWith('Runner-up')));
 assert.ok(data.awards.some(a=>a.period==='2019'&&a.title==='ANSA Sportsman of the Year'&&a.detail.startsWith('Runner-up')));
 for(const a of data.awards.filter(a=>a.title==='Big 12 Male Athlete of the Year'))assert.match(a.detail,/Nominee/);
 assert.equal(JSON.parse(fs.readFileSync('my-journey/awards.json','utf8')).length,data.awards.length);
});
