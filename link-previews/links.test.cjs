const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const paths={'soccer':'#/soccer','club-registration':'#/club-registration','track':'#/track','track/register':'#/track/register','track/evaluation':'#/track/evaluation','track/enquire':'#/track/enquire','hub':'#/hub/login','hub/login':'#/hub/login'};
for(const [path,route] of Object.entries(paths)) test(`${path} has independent crawler metadata and opens the exact route`,()=>{
 assert.ok(fs.existsSync(`${path}/index.html`),`Missing crawler-readable /${path}/`);
 const html=fs.readFileSync(`${path}/index.html`,'utf8');
 const canonical=`https://duairlineseliteacademy.com/${path}/`;
 assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
 assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
 assert.match(html,/<meta property="og:title" content="[^"]+">/);
 assert.match(html,/<meta name="twitter:title" content="[^"]+">/);
 if(path!=='club-registration')assert.doesNotMatch(html,/Fever United/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const search of ['', '?source=coach%20name&campaign=november']){
  let target;
  vm.runInNewContext(script,{location:{search,replace:value=>target=value},URLSearchParams});
  assert.equal(target,'/'+search+route);
 }
 assert.ok(html.includes(`href="/${route}"`),'manual fallback opens same route');
});
test('homepage cannot inherit club preview',()=>{
 const head=(fs.readFileSync('index.html','utf8').split('</head>')[0].match(/<(?:meta|link)\b[^>]*>/g)||[]).join('');
 assert.doesNotMatch(head,/Fever United|#\/club-registration/);
 assert.match(head,/property="og:title"/);
 assert.match(head,/Du Airlines Elite Academy/);
});
