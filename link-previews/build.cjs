// Static entry pages give social crawlers metadata before JavaScript runs.
const fs=require('node:fs');
const pages=[
 ['soccer','soccer','Soccer Performance Development','Speed, movement and athletic development for soccer players.'],
 ['club-registration','club-registration','Fever United | Soccer Performance Registration','Register for Du Airlines × Fever United soccer performance sessions in Southlake, Texas.'],
 ['track','track','Track & Field Development','Specialist speed and horizontal jumps coaching with Du Airlines Elite Academy.'],
 ['track/register','track/register','Track & Field Clinic Registration','Register for a Du Airlines Elite Academy track and field clinic.'],
 ['track/evaluation','track/evaluation','Athlete Performance Evaluation','Book a performance evaluation with Du Airlines Elite Academy.'],
 ['track/enquire','track/enquire','Track & Field Enquiries','Explore track and field development with Du Airlines Elite Academy.'],
 ['hub','hub/login','Du Airlines Performance Hub','Access your assigned training programme, movement guides and coach feedback.'],
 ['hub/login','hub/login','Du Airlines Performance Hub | Login','Sign in to your Du Airlines Performance Hub.']
];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const [path,route,title,description] of pages){
 const url=`https://duairlineseliteacademy.com/${path}/`;
 const target=`/#/${route}`;
 const html=`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} — Du Airlines Elite Academy</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Du Airlines Elite Academy">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="theme-color" content="#0f271c">
<script>location.replace('/' + location.search + ${JSON.stringify(target.slice(1))});</script>
</head><body><main><h1>${escape(title)}</h1><p>${escape(description)}</p><p><a href="${target}">Continue to ${escape(title)}</a></p></main></body></html>
`;
 fs.mkdirSync(path,{recursive:true});fs.writeFileSync(`${path}/index.html`,html);
}
