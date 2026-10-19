'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
// The owner authorized My Journey navigation only. Exact removal is separately
// verified by my-journey/story.test.cjs against the branch starting commit.
const currentHtml=fs.readFileSync('index.html','utf8');
assert.equal((currentHtml.match(/Loughborough University Student-Athlete/g)||[]).length,2);
assert.equal((currentHtml.match(/Kutama College Sports Captain/g)||[]).length,2);
assert.doesNotMatch(currentHtml,/Future Loughborough|800m Athlete[ ·,]+Kutama College/);
const restoreTitles=source=>source.replace(/Loughborough University Student-Athlete/g,'Future Loughborough University Student-Athlete').replace('<p>Kutama College Sports Captain</p>','<p>800m Athlete · Kutama College</p>').replace('— Kutama College Sports Captain</div>','— 800m Athlete, Kutama College</div>');
// Owner-approved credentials copy is the only additional homepage exception.
const approvedCredentials="<div class=\"premium-more-grid\"><span>9× All-American</span><span>5× Big 12 Champion</span><span>TCU Co-Male Athlete of the Year · 2018–19</span><span>African U20 Champion · 2017</span><span>African U20 Championships Meet Record Holder · 16.30m, 2017</span><span>TCU Triple Jump Record Holder · Indoor &amp; Outdoor</span><span>The Bowerman Preseason Watch List · 2020</span></div>";
const previousCredentials="<div class=\"premium-more-grid\"><span>TCU Record Holder</span><span>7× World Championships Qualifier</span><span>African Junior Champion</span><span>African Junior Championships Record Holder</span></div>";
assert.ok(currentHtml.includes(approvedCredentials),'approved seven credentials remain intact');
const html=restoreTitles(currentHtml).replace(/<!-- DU STORY NAV START -->[\s\S]*?<!-- DU STORY NAV END -->/g,'').replace(approvedCredentials,previousCredentials);
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
let baseline=execFileSync('git',['show','86794de:index.html'],{encoding:'utf8',maxBuffer:10*1024*1024});
// Apply the owner's permanent retirement of the promotional pathway to the baseline.
assert.doesNotMatch(html,/id="professional-view"|data-route="professional"/);
baseline=baseline.replace(/<!-- ===== PROFESSIONAL PERFORMANCE: integrated pathway ===== -->[\s\S]*?(?=<script>)/,'');
baseline=baseline.replace("    if (hashPath === '#/professional-performance') return 'professional';", "    if (['#/professional-performance', '#/professional-join', '#/professional-hub'].includes(hashPath)) { history.replaceState(null, '', '#/'); return 'home'; }");
for(const route of ['professional-join','professional-hub']) baseline=baseline.replace("    if (hashPath === '#/"+route+"') { location.hash='#/hub/login/professional'; return 'hub'; }\r\n",'');
const routeStart='<div class="site-view" hidden="" id="soccer-view">';
const homepageController='<script id="premium-homepage-interactions">';
assert.ok(html.includes(routeStart)&&baseline.includes(routeStart));
// Air Zim is an authorized Hub change; its behavior has dedicated athlete/coach tests.
// Keep the remaining Hub, all public pages and registration code under the original byte check.
const withoutAirZimPresentation=source=>source
 .replace(/  function assignedAirZim\([\s\S]*?(?=  function renderLibrary\()/,'')
 .replace(/\+airZimTool\((?:p)?\)/g,'')
 .replace(/    else if\(route==='\/library\/air-zim'\)renderAssignedAirZim\(\);\r?\n/,'')
 .replace(/  \.hub-air-zim-stage\{[^\n]+\n/,'')
 .replace(/    \{slug:'warm-up',title:[^\n]+\n/, '    WARM_UP_CATEGORY\n')
 .replace(/    \{slug:'plyometric-foundation',title:[^\n]+\n/,'    LANDING_CATEGORY\n')
 .replace(/  function normalizeExerciseCategories\([^\n]+\n/,'  CATEGORY_TRANSLATION\n')
 .replace(/  async function loadHubData\([\s\S]*?(?=  function categoryRoute\()/,'  SHARED_BOOTSTRAP\n')
 // Workout delivery has its own dose/rest/cue/demo regression suite.
 .replace(/  function normalizedTextItem\([\s\S]*?(?=  function normalizeWorkoutSession\()/,'  WORKOUT_TEXT_DELIVERY\n')
 .replace(/  function athleteCopyText\([\s\S]*?(?=  function schoolAthleteDelivery\()/,'  WORKOUT_COPY_DELIVERY\n')
 .replace(/  function normalizeWorkoutSession\([\s\S]*?(?=  function visibleNormalizedSections\()/,'  WORKOUT_NORMALIZER\n')
 .replace(/  function schoolAthleteDelivery\([\s\S]*?(?=  function renderWorkoutExperience\()/,'  ATHLETE_DELIVERY\n')
 .replace(/  function renderWarmup\([^\n]+\n/,'  WARM_UP_LIBRARY\n');
const currentProduction=execFileSync('git',['show','ee633b7:index.html'],{encoding:'utf8',maxBuffer:10*1024*1024});
// Approved Journey additions are isolated Hub presentation. Keep every other byte protected.
const withoutJourneyPresentation=source=>source
 .replace('<link rel="stylesheet" href="/performance-journey/journey.css?v=20261017">\n','')
 .replace("    if(HUB_STATE.audience!=='professional')links.splice(1,0,['journey','#/hub/journey',staff?'Group Journey':'My Journey']);\n",'')
 .replace(/    else if\(route==='\/journey'&&HUB_STATE\.audience!=='professional'\)[^\n]+\n/,'')
 .replace(/    \/\/ Performance Journey reads its own authorized endpoint; workout\/video flows stay independent\.[\s\S]*?(?=    \/\/ School coach Technique Review: independent of individual athlete assignments\.)/,'');
const journeyStyles=fs.readFileSync('performance-journey/journey.css','utf8');
for(const match of journeyStyles.matchAll(/([^{}]+)\{/g)){
 const selector=match[1].trim();
 if(selector.startsWith('@media'))continue;
 assert.ok(selector.split(',').every(part=>part.trim().startsWith('.duj')),'Journey CSS cannot style the public homepage');
}
const withoutHubAssets=source=>source.replace(/<script src="\/hub-delivery\/delivery\.js\?v=20261019"><\/script>\r?\n/,'').replace(/<link rel="stylesheet" href="\/hub-delivery\/delivery\.css\?v=20261019">\r?\n/,'');
assert.equal(withoutHubAssets(withoutJourneyPresentation(html.slice(0,html.indexOf(routeStart)))),currentProduction.slice(0,currentProduction.indexOf(routeStart)),'locked homepage remains unchanged apart from isolated Hub asset links');
const withoutHubRepair=source=>source
 .replace(/  function guidedCard\([^\n]+\n/,'  GUIDED_PRESCRIPTION\n')
 .replace(/  async function loadAccountHubData\([\s\S]*?(?=  async function loadHubData\()/,'  ACCOUNT_BOOTSTRAP\n')
 .replace(/  function mergeExercises\([^\n]+\n/,'  LIBRARY_MERGE\n')
 .replace(/  function copyWorkoutAllowed\([\s\S]*?(?=  function athleteCopyText\()/,'')
 .replace(/  function staffAllGroupsExperience\([\s\S]*?(?=  function privateSelfServeViewer\()/,'  STAFF_DELIVERY\n')
 .replace(/  function renderSession\([^\n]+\n/,'  SESSION_DELIVERY\n')
 .replace(/  function renderPrivateAthleteCompact\([\s\S]*?(?=  function parentSessionLabel\()/,'  PRIVATE_DASHBOARD\n')
 .replace(/  function renderSharedWeeklyDashboard\([\s\S]*?(?=  function renderParentSimpleDashboard\()/,'')
 .replace(/  function renderParentSimpleDashboard\([\s\S]*?(?=  function renderAthleteDashboard\()/,'  PARENT_DASHBOARD\n')
 .replace(/  function weekBrowser\([\s\S]*?(?=  function compactSchoolWeek\()/,'  PUBLISHED_WEEK_PREVIEW\n')
 .replace(/    const copyButton=[\s\S]*?(?=    const videoClose=)/,'  COPY_CLICK_HANDLER\n');
// Story arrival is covered by my-journey/story.test.cjs; exclude only its exact scoped branch.
const withoutPartnershipPresentation=source=>source.replace(/      if \(activeView === homeView && location.hash === '#stories'\) \{[\s\S]*?      \} else\r?\n/, '').replace(/      if \(activeView === homeView && location.hash === '#sports'\) \{[\s\S]*?      \} else \{\r?\n        window.scrollTo\(\{top:0, behavior:'instant'\}\);\r?\n      \}/,"      window.scrollTo({top:0, behavior:'instant'});").replace(/  const openButton=document.getElementById\('openPartnershipForm'\);[\s\S]*?(?=  const method=document.getElementById\('partner-contact'\);)/,'');
assert.equal(withoutJourneyPresentation(withoutAirZimPresentation(withoutHubRepair(withoutPartnershipPresentation(html.slice(html.indexOf(routeStart),html.indexOf(homepageController)))))),withoutJourneyPresentation(withoutAirZimPresentation(withoutHubRepair(withoutPartnershipPresentation(baseline.slice(baseline.indexOf(routeStart),baseline.indexOf(homepageController)))))),'registration/payment forms, routes and unrelated Hub implementation remain byte-for-byte unchanged');
const form=source=>source.match(/<form[^>]*id="partnershipForm"[\s\S]*?<\/form>/)[0];
assert.equal(form(html),form(baseline),'partnership form fields and submission destination preserved');
console.log('Production integration preservation passed.');
