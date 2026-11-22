/* DU Airlines Coach Command — read-only presentation of an already-authorized staff bootstrap.
   No access codes, service-role keys, athlete identities, or database writes belong here.
   Usage: DuCoachCommand.mount(element, staffBootstrap, { roster: verifiedRoster })
   roster MUST come from a separately authorized, cohort-scoped backend response. */
(function(global){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt=v=>typeof v==='string'?v.trim():'';
  const restriction=/\b(?:stop|pain|injur\w*|safety|unsafe|never|avoid|only if|hours between|do not|don.t|must(?: not)?|no running|no sprint(?:ing)?|before progressing)\b/i;
  const styles=`
.ducc{--ink:var(--hub-bg,#090909);--gold:var(--hub-gold,#c7a25a);--line:var(--hub-line,rgba(199,162,90,.18));font:14px/1.45 system-ui,Arial,sans-serif;color:var(--hub-text,#f5f1e8);max-width:1080px;margin:auto;background:var(--hub-bg,#090909);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.ducc *{box-sizing:border-box}.ducc header{background:var(--hub-panel,#111111);color:var(--hub-text,#f5f1e8);padding:22px}.ducc header small{color:var(--gold);font-weight:800;letter-spacing:.12em}.ducc h1{font-size:24px;margin:5px 0}.ducc h2{font-size:19px;margin:4px 0}.ducc h3{font-size:14px;margin:0 0 10px}.ducc p{margin:4px 0}.ducc .muted{color:var(--hub-muted,#aaa69f);font-size:12px}.ducc main{padding:18px;display:grid;gap:14px}.ducc .stats,.ducc .days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ducc .days{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.ducc a.button{text-decoration:none;display:inline-flex;align-items:center}.ducc .tile,.ducc .panel{border:1px solid var(--line);border-radius:12px;padding:13px;background:var(--hub-panel,#111111)}.ducc .tile b{display:block;font-size:24px}.ducc .day{color:var(--hub-text,#f5f1e8);text-align:left;cursor:pointer;font:inherit}.ducc .day strong,.ducc .day span{display:block}.ducc .day strong{font-size:16px}.ducc .day span{font-size:11px;margin-top:5px}.ducc .selected{border:2px solid var(--gold)}.ducc button{cursor:pointer;font:inherit}.ducc .button{background:var(--hub-maroon,#6e1726);color:var(--hub-text,#f5f1e8);border:0;border-radius:9px;padding:11px 13px;font-weight:750}.ducc .secondary{background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border:1px solid var(--line)}.ducc .actions{display:flex;flex-wrap:wrap;gap:8px}.ducc button:focus-visible,.ducc summary:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.ducc .roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ducc .roster button{border:1px solid var(--line);border-radius:9px;padding:10px;background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);text-align:left}.ducc [hidden]{display:none!important}
@media(max-width:450px){.ducc main{padding:11px}.ducc header{padding:17px}.ducc .tile,.ducc .day{padding:9px}.ducc .day span{font-size:10px}.ducc .roster{grid-template-columns:1fr 1fr}}
 .ducc header{background:radial-gradient(ellipse at top right,#314335,transparent 65%),#17251c;padding:clamp(16px,3vw,30px)}
.ducc header h1{font-size:clamp(22px,4vw,35px);line-height:1.15}
.ducc .week-head,.ducc .workout-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ducc .day{min-height:68px;background:linear-gradient(125deg,#4a252e,#261d22);border-color:#734653}
.ducc .day.selected{background:linear-gradient(120deg,#713747,#34232a);border:1px solid #e5a0a7}
.ducc .day span{font-size:12px}.ducc .days .day{min-width:0}.ducc .session-kicker{color:var(--gold);font-size:.8rem;font-weight:750}
/* Staff workout views */
.ducc header.workout-header{padding:12px clamp(12px,2vw,18px)}
.ducc header.workout-header h1{font-size:1.12rem;margin:0}
.ducc header.workout-header p{margin:3px 0 0}
.ducc .workout-navigation .days{flex:1;min-width:0}
.ducc .workout-navigation > .button{flex:none;min-height:44px}
.ducc .workout-navigation .days .day{min-height:44px}
.ducc .workout-head h2{font-size:clamp(21px,3vw,32px);line-height:1.15;overflow-wrap:anywhere}
.ducc .workout-head .muted{font-size:.9rem}
.ducc .workout-actions{gap:6px}
.ducc .workout-actions .button{min-height:44px}
.ducc .coaching-views{
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;width:100%;max-width:540px;
 padding:4px;border:1px solid #3f3524;border-radius:12px;background:#101010;
}
.ducc .coaching-views .button{min-height:44px;padding:5px;color:#e9e0cf;background:transparent}
.ducc .coaching-views [aria-current="true"]{display:grid;place-items:center;background:#e7c78b;color:#24190a;cursor:default}
.ducc .coaching-views .button:disabled{opacity:.55;cursor:default}
.ducc .workout-section{background:#151515;border:1px solid #373025;border-radius:13px;padding:clamp(11px,2vw,18px)}
.ducc .workout-section h3{color:#f5f1e8;font-size:1.08rem;margin:0 0 5px}
.ducc .workout-section h4{font-size:.9rem;color:#ebca8b;margin:12px 0 4px}
.ducc .workout-section ol{list-style:none;padding:0;margin:0}
.ducc .workout-row + .workout-row{border-top:1px solid #33302b}
.ducc .workout-row{padding:9px 0;color:#f5f1e8;min-width:0}
.ducc .workout-row:last-child{padding-bottom:0}
.ducc .row-heading{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:16px;row-gap:2px}
.ducc .row-name,.ducc .row-dose{white-space:pre-line}
.ducc .row-name{font-size:1rem;font-weight:700}
.ducc .row-dose{color:#ebca8b;font-size:1rem;font-weight:700}
.ducc .row-instructions,.ducc .learn-guidance{font-size:.9rem}
.ducc .row-instructions p,.ducc .learn-guidance p{margin:4px 0}
.ducc .row-instructions strong,.ducc .learn-guidance strong{color:#ebca8b;margin-right:.25em}
.ducc .learn-card > summary{
 display:grid;grid-template-columns:minmax(0,1fr) 20px;align-items:center;gap:8px;
 padding:4px 2px;list-style:none;
}
.ducc .learn-card > summary::-webkit-details-marker{display:none}
.ducc .learn-card > summary::after{
 content:"";justify-self:center;width:8px;height:8px;border:solid #ebca8b;
 border-width:0 2px 2px 0;transform:rotate(45deg);
}
.ducc .learn-card[open] > summary::after{transform:rotate(225deg)}
.ducc .learn-body{padding:8px 0 4px}
.ducc .learn-media{--present-gold:#ebca8b;--present-cream:#fff8e9;max-width:560px;margin-bottom:10px}
.ducc .learn-media .presentation-stage{aspect-ratio:16/9;max-height:340px;background:#0b0b0b}
.ducc .learn-media .presentation-stage.portrait:has(iframe){min-height:320px}
.ducc .learn-media .presentation-stage.portrait iframe{min-width:0}
.ducc .learn-media .presentation-demo-options .button{min-height:44px}
.ducc .learn-guidance{max-width:68ch;white-space:pre-line}
@media(max-width:540px){
 .ducc .row-heading{display:grid;gap:2px}
 .ducc:has(.workout-header) main{gap:8px}
 .ducc .workout-head{gap:8px}
 .ducc .workout-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}
 .ducc .workout-actions .button{padding:6px 4px;min-width:0;font-size:.82rem;line-height:1.2;white-space:normal}
 .ducc .workout-navigation{gap:6px;flex-wrap:nowrap}
 .ducc .workout-navigation > .button{padding-inline:9px}
 .ducc .days.workout-days{grid-template-columns:repeat(auto-fit,minmax(49px,1fr));gap:4px}
 .ducc .workout-days .day{min-height:44px;padding:6px 4px;text-align:center}
 .ducc .workout-days .day strong{font-size:.88rem;display:block}
 .ducc .workout-days .day-title{display:none}
 .ducc .workout-days .day-option{display:block;margin:0;font-size:.72rem}
}
body:has(.ducc .presentation):not(:has(.ducc .print-sheet)){overflow:hidden}
.ducc .presentation{
 --present-green:#092219;--present-cream:#fff8e9;--present-gold:#f6d681;--present-line:#4c6857;
 --present-gutter:clamp(12px,2.4vw,36px);
 position:fixed;inset:0;z-index:9990;display:flex;flex-direction:column;overflow:auto;
 overscroll-behavior:contain;background:var(--present-green);color:var(--present-cream);
 font:clamp(16px,1.45vw,24px)/1.35 system-ui,Arial,sans-serif;overflow-wrap:anywhere;
}
.ducc .presentation-toolbar,.ducc .presentation-footer{
 position:sticky;z-index:2;display:flex;gap:clamp(8px,1.45vw,22px);align-items:center;
 padding:10px var(--present-gutter);background:var(--present-green);
}
.ducc .presentation-toolbar{top:0;border-bottom:1px solid var(--present-line)}
.ducc .presentation-actions{display:flex;align-items:center;gap:6px}
.ducc .presentation-exports{position:relative}
.ducc .presentation-exports summary{list-style:none;display:grid;place-items:center;min-height:44px;padding-inline:10px}
.ducc .presentation-exports summary::-webkit-details-marker{display:none}
.ducc .presentation-export-options{
 position:absolute;inset:calc(100% + 4px) 0 auto auto;width:max-content;max-width:78vw;
 display:grid;gap:5px;padding:6px;background:var(--present-green);
 border:1px solid var(--present-line);border-radius:10px;
}
.ducc .presentation-kicker,.ducc .presentation-block{
 color:var(--present-gold);font-size:clamp(13px,1.2vw,19px);font-weight:800;letter-spacing:.09em;text-transform:uppercase;
}
.ducc .presentation-toolbar h2{
 flex:1;min-width:0;margin:0;padding-left:clamp(8px,1.6vw,24px);border-left:1px solid var(--present-line);
 color:var(--present-cream);font-size:clamp(16px,2vw,30px);line-height:1.18;
}
.ducc .presentation-progress{
 white-space:nowrap;border:1px solid var(--present-gold);border-radius:999px;padding:5px 11px;
 color:var(--present-gold);font-size:clamp(14px,1.4vw,21px);font-weight:750;font-variant-numeric:tabular-nums;
}
.ducc .presentation .button{
 min-height:44px;border:1px solid #698574;border-radius:12px;background:#153629;color:var(--present-cream);
 font-size:clamp(15px,1.3vw,21px);font-weight:750;
}
.ducc .presentation .button:disabled{opacity:.5;cursor:default}
.ducc .presentation .primary{background:var(--present-gold);color:#14261c;border-color:var(--present-gold)}
.ducc .presentation :is(button,summary,a):focus-visible{outline:3px solid var(--present-gold);outline-offset:3px}
.ducc .presentation-layout{
 display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:start;align-content:center;flex:1 0 auto;
 width:100%;max-width:1720px;margin:0 auto;padding:clamp(14px,2vw,30px) var(--present-gutter);gap:clamp(16px,2.6vw,40px);
}
.ducc .presentation-media,.ducc .presentation-card{min-width:0}
.ducc .presentation-stage{
 position:relative;display:grid;place-items:center;aspect-ratio:3/2;overflow:hidden;
 border:1px solid var(--present-gold);border-radius:clamp(12px,1.65vw,24px);background:#071a13;
}
.ducc .presentation-stage.empty{border-color:var(--present-line);padding:16px;text-align:center}
.ducc .presentation-stage img,.ducc .presentation-stage iframe{
 position:absolute;inset:0;display:block;width:100%;height:100%;border:0;object-fit:contain;
}
.ducc .presentation-stage:has(iframe){min-height:200px}
.ducc .presentation-stage.portrait iframe{width:auto;min-width:200px;height:100%;aspect-ratio:9/16;margin:auto}
.ducc .presentation-stage img[hidden]{display:none}
.ducc .presentation-play{
 position:absolute;inset:0;width:100%;display:grid;place-items:center;padding:0;background:transparent;border:0;color:var(--present-cream);
}
.ducc .presentation-play:focus-visible{outline-offset:-5px}
.ducc .presentation-play span{
 display:grid;place-items:center;width:clamp(54px,7vw,105px);aspect-ratio:1;border:3px solid var(--present-gold);
 border-radius:50%;background:#071611e8;
}
.ducc .presentation-play span::before{
 content:'';width:40%;aspect-ratio:1;background:currentColor;clip-path:polygon(12% 0,100% 50%,12% 100%);transform:translateX(9%);
}
.ducc .presentation-video-help{font-size:.78em}
.ducc .presentation-video-help a{color:var(--present-gold);display:inline-block;padding-block:10px}
.ducc .presentation-demo-options{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ducc .presentation-heading{border-left:4px solid var(--present-gold);padding-left:clamp(10px,1.25vw,20px)}
.ducc .presentation h3{margin:4px 0 0;font-size:clamp(28px,4.45vw,72px);line-height:1.06}
.ducc .presentation h3.long-title,.ducc .presentation h3.legacy-instruction{font-size:clamp(23px,3vw,48px);white-space:pre-wrap}
.ducc .presentation .dose{
 width:fit-content;max-width:100%;border-radius:16px;margin:12px 0 0;padding:6px 15px;
 background:var(--present-gold);color:#14261c;font-size:clamp(19px,2.2vw,34px);font-weight:800;line-height:1.18;white-space:pre-wrap;
}
.ducc .presentation .dose.long-dose{font-size:clamp(17px,1.6vw,25px)}
.ducc .presentation-guidance{display:grid;gap:clamp(8px,1vw,16px);margin-top:clamp(12px,1.5vw,22px)}
.ducc .presentation-guidance p,.ducc .presentation-details p{white-space:pre-wrap}
.ducc .presentation-guidance p{margin:0;padding-left:12px;border-left:1px solid var(--present-line)}
.ducc .presentation-guidance strong{display:block;color:var(--present-gold);font-size:.9em}
.ducc .presentation-details{margin-top:clamp(12px,1.5vw,22px);font-size:.86em}
.ducc .presentation-details summary{
 min-height:44px;padding:10px 13px;border:1px solid #698574;border-radius:12px;color:var(--present-gold);font-weight:750;
}
.ducc .presentation-details[open]>div{padding:8px 13px}
.ducc .presentation-details h4{margin:12px 0 4px;color:var(--present-gold)}
.ducc .presentation-footer{bottom:0;justify-content:space-between;border-top:1px solid var(--present-line)}
.ducc .presentation-footer .button{min-width:clamp(88px,12vw,190px)}
.ducc .presentation-demo-options [aria-pressed="true"]{border-color:var(--present-gold);color:var(--present-gold)}
.ducc .presentation-footer progress{
 appearance:none;width:clamp(36px,22vw,320px);height:8px;border:0;border-radius:999px;overflow:hidden;background:#385a49;
}
.ducc .presentation-footer progress::-webkit-progress-bar{background:#385a49}
.ducc .presentation-footer progress::-webkit-progress-value{background:#f6d681}
.ducc .presentation-footer progress::-moz-progress-bar{background:#f6d681}
@media(max-width:850px){
 .ducc .presentation-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto}
 .ducc .presentation-toolbar h2{grid-row:2;grid-column:1/-1;padding:0;border:0}
}
@media(max-width:900px) and (orientation:portrait),(max-width:700px){
 .ducc .presentation-layout{grid-template-columns:minmax(0,1fr);align-content:start}
 .ducc .presentation-stage{aspect-ratio:16/9}
 .ducc .presentation-stage.portrait:has(iframe){min-height:clamp(300px,75vw,355px)}
}
@media(max-height:490px){
 .ducc .presentation-toolbar{position:static}
 .ducc .presentation-layout{align-content:start}
 .ducc .presentation-stage{aspect-ratio:16/9}
}
@media screen{
 .ducc:has(.print-sheet)>:not(.print-sheet){display:none}
 .ducc .print-sheet{background:#fff;color:#141414;padding:clamp(12px,4vw,28px);overflow-wrap:anywhere}
 .ducc .print-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:.65rem}
 .ducc .print-actions .button{min-height:44px}
 .ducc .print-help{color:#484848;margin:0 0 1rem}
 .ducc .print-brand{font-weight:800;letter-spacing:.08em}
}
@media(max-width:540px){.ducc .days{grid-template-columns:1fr}.ducc .day{min-height:54px}.ducc .day strong,.ducc .day span{display:inline}.ducc .day span{margin:0 0 0 7px}}
@media print{
 @page{margin:10mm}
 body:has(.ducc .print-sheet){background:#fff!important;color:#000!important}
 body:has(.ducc .print-sheet) :is(.hub-shell > :not(.hub-main),.hub-wrap > :not(#du-coach-command-root)){display:none!important}
 body:has(.ducc .print-sheet) :is(#hub-root,.hub-shell,.hub-main,.hub-wrap,#du-coach-command-root,.ducc){min-height:0!important;background:#fff!important;color:#000!important;border:0!important;box-shadow:none!important;margin:0!important;padding:0!important;overflow:visible!important}
 body:has(.ducc .print-sheet) .hub-wrap{width:100%!important;max-width:none!important}
 .ducc:has(.print-sheet)>:not(.print-sheet){display:none!important}
 .ducc .print-sheet{display:block;color:#000;background:#fff;font:9pt/1.15 Arial,sans-serif}
 .ducc :is(.print-actions,.print-help){display:none!important}
 .ducc .print-brand{font-weight:750}
 .ducc .print-week{column-count:2;column-gap:5mm}
 .ducc .print-sheet h1{font-size:14pt;margin:1px 0 2px}.ducc .print-sheet h2{font-size:11pt;margin:5px 0 2px}
 .ducc .print-sheet h3{font-size:10pt;margin:3px 0 1px}.ducc .print-sheet p{margin:0}
 .ducc .print-sheet :is(h1,h2,h3){color:#000!important;break-after:avoid;break-inside:avoid}
 .ducc .print-sheet ul{margin:0;padding-left:15px}
 .ducc .print-sheet li{break-inside:avoid;margin:0 0 1px;overflow-wrap:anywhere;white-space:pre-line}
 .ducc .print-day+.print-day{border-top:1px solid #aaa;margin-top:5px}
}
`;
  function safeVideo(value){
    const raw=txt(value);if(!raw)return '';
    try{const u=new URL(raw);if(u.protocol!=='https:')return '';
      if(['www.youtube.com','youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname)){
        let id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||(u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/)||[])[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?'https://www.youtube-nocookie.com/embed/'+id:'';
      }
    }catch(e){}
    return '';
  }
  function mount(host,data,opts={}){
    if(!host||!data||data.role!=='staff'||!data.cohort||!data.programme)throw Error('A validated staff programme response is required.');
    const delivery=global.DuHubDelivery;
    const programme=data.programme, sessions=Array.isArray(programme.sessions)?programme.sessions:[];
    const exercises=new Map((Array.isArray(data.exercises)?data.exercises:[]).map(e=>[e.code,e]));
    const roster=opts.rosterVerified===true&&Array.isArray(opts.roster)&&opts.roster.every(a=>a&&a.cohort_id===data.cohort.id)?opts.roster:null;
    const initialDay=opts.initialSessionId?sessions.findIndex(s=>String(s.id)===String(opts.initialSessionId)):-1;
    let day=initialDay>=0?initialDay:0,view=initialDay>=0?'workout':'overview';
    let athlete=null,slide=0,sequence=[],detailsOpen=false,openLearnRows=new Set();
    const style=document.createElement('style');style.textContent=styles;host.replaceChildren(style);
    const root=document.createElement('div');root.className='ducc';host.append(root);
    const session=()=>sessions[day]||{};
    const optional=s=>/optional|extra/i.test(txt(s.requirement))||/optional|extra/i.test(txt(s.day))||/^optional\b/i.test(txt(s.title));
    const prescriptions=s=>Array.isArray(s.prescriptions)?s.prescriptions:[];
    const dayLabel=(s,index)=>txt(s.day)||'Day '+(index+1);
    const cohortLabel=()=>[data.cohort.name,'Week '+(data.cohort.currentWeek||programme.week||'—')].join(' · ');
    const prescriptionLine=p=>[p.dosage,p.rest?'Rest: '+p.rest:''].filter(Boolean).join(' · ');
    const sessionNotes=(s,includeStaff=false)=>[...new Set([
      s.watch,s.athleteNote,includeStaff&&!/george/i.test(data.cohort.name||'')?s.staffNote:'',
    ].map(note=>txt(note).split(/\r?\n/)
      .filter(line=>!/^Coach-approved readiness required before plyometric additions\.?$/i.test(line.trim()))
      .join('\n').trim()).filter(Boolean))];
    const purpose=s=>txt(s.why)||txt(s.objective);
    const nameOf=row=>exercises.get(row.exerciseCode)?.title||row.exerciseCode;
    const assignedContext=row=>[
      ['Equipment',row.equipment],
      ['Prescribed alternative',exercises.get(row.alternativeExerciseCode)?.title||row.alternativeExerciseCode],
    ].filter(([,value])=>txt(value));
    function sections(s, workoutView=false){
      const map=new Map();
      function add(title,order,row){
        const key=order+'|'+title;
        if(!map.has(key))map.set(key,{title,order,rows:[]});
        map.get(key).rows.push(row);
      }
      for(const row of prescriptions(s))add(txt(row.sectionTitle)||'Workout',row.sectionOrder??0,row);
      const saved=Array.isArray(s.itemSections)&&s.itemSections.length?s.itemSections:[{title:'Session instructions',items:s.items}];
      for(const block of saved){
        const items=Array.isArray(block.items)?block.items:[];
        items.forEach((item,index)=>{
          if(!txt(item))return;
          const savedDemos=Array.isArray(block.videoLinks)?block.videoLinks.filter(link=>link.itemIndex===index):undefined;
          add(txt(block.title)||'Session instructions',block.order??0,{exerciseCode:item,sourceOrder:block.sourceOrders?.[index],savedDemos});
        });
      }
      return [...map.values()]
        .filter(({title})=>!workoutView||!/^landing readiness(?: and skill check)?$/i.test(title))
        .sort((a,b)=>a.order-b.order).map(({title,rows})=>{
        if(rows.every(row=>Number.isInteger(row.sourceOrder)))rows.sort((a,b)=>a.sourceOrder-b.sourceOrder);
        return [title,rows];
      });
    }
    // Legacy school workouts are tier-specific text, not exercise-code prescriptions.
    // Only show demo links when a named movement matches the existing video library.
    const libraryDemo=ex=>delivery.safeVideo(ex.videoUrl,ex.videoId);
    const demoCatalog=[...exercises.values()].filter(libraryDemo).sort((a,b)=>(b.title||'').length-(a.title||'').length);
    function matchingDemos(p){
      const exact=exercises.get(p.exerciseCode);
      if(exact){
        const url=libraryDemo(exact);
        return url?[{title:exact.title||p.exerciseCode,url}]:[];
      }
      if(Array.isArray(p.savedDemos)){
        const seen=new Set();return p.savedDemos.flatMap(link=>{
          const url=delivery.safeVideo(link.url),title=txt(link.title),key=title+'|'+url;
          if(!url||!title||seen.has(key))return [];
          seen.add(key);return [{title,url}];
        });
      }
      const source=txt(p.exerciseCode).toLowerCase(),out=[],seen=new Set();
      for(const ex of demoCatalog){
        const title=txt(ex.title).toLowerCase();
        if(!title||title.length<5||seen.has(title))continue;
        const escaped=title.split('').map(ch=>'^$.*+?()[]{}|'.includes(ch)?String.fromCharCode(92)+ch:ch).join('');
        const match=new RegExp('(^|[^a-z])'+escaped+'(?=$|[^a-z])','i').test(source);
        if(!match)continue;
        const url=libraryDemo(ex);
        if(url){out.push({title:ex.title,url});seen.add(title);}
      }
      return out;
    }
    function movementCoaching(p,ex){
      const saved=delivery.sessionCoaching(p.cues),library=delivery.coachingParts(ex.coachingCues||ex.coachingNote);
      return delivery.coachingRows({
        description:ex.description,libraryCue:library.cue,libraryAvoid:library.avoid,
        sessionCue:saved.cue,sessionAvoid:saved.avoid,substitutionNote:p.substitutionNote,
      });
    }
    function reviewedMovementCoaching(p,demos){
      if(!Array.isArray(p.savedDemos))return [];
      return demos.flatMap(demo=>{
        const canonical=[...exercises.values()].find(item=>item.title===demo.title);
        const rows=canonical?movementCoaching({},canonical):[];
        return rows.length?[{title:demo.title,rows}]:[];
      });
    }
    function renderRows(rows){
      return rows.map(([label,value])=>'<p><strong>'+esc(label)+'</strong> '+esc(value)+'</p>').join('');
    }
    function prescriptionNotes(row,saved){
      const cautions=[
        ['For this session',restriction.test(saved.cue)?saved.cue:''],
        ['Watch for',saved.avoid],
        ...assignedContext(row),
        ['Coach alternative',row.substitutionNote],
      ].filter(([,value])=>txt(value));
      return cautions.length?'<div class="row-instructions">'+renderRows(cautions)+'</div>':'';
    }
    function demoPlayer(demos,lazy=false){
      const options=demos.length>1?'<div class="presentation-demo-options" aria-label="Exercise demonstrations">'+
        demos.map((demo,index)=>'<button type="button" class="button'+(lazy?' secondary':'')+'" data-demo-url="'+esc(demo.url)+'" data-demo-title="'+esc(demo.title)+
          '" aria-pressed="'+(index===0)+'">'+esc(demo.title)+'</button>').join('')+'</div>':'';
      return '<div class="demo-picker"><div class="presentation-player">'+
        (demos.length?presentMedia(demos[0],lazy):'<div class="presentation-stage empty"><p>No video for this exercise.</p></div>')+
        '</div>'+options+'</div>';
    }
    function workoutRow(row,previous,sectionIndex,rowIndex){
      const saved=delivery.sessionCoaching(row.cues);
      const heading=saved.phase&&saved.phase!==delivery.sessionCoaching(previous?.cues).phase
        ?'<h4>'+esc(saved.phase)+'</h4>':'';
      const dose=prescriptionLine(row);
      const summary='<span class="row-heading"><span class="row-name">'+esc(nameOf(row))+'</span>'+
        (dose?'<span class="row-dose">'+esc(dose)+'</span>':'')+'</span>';
      const ex=exercises.get(row.exerciseCode)||{};
      const demos=matchingDemos(row).filter(demo=>safeVideo(demo.url));
      const guidance=renderRows([...movementCoaching(row,ex),...assignedContext(row)])+
        reviewedMovementCoaching(row,demos).map(({title,rows})=>'<div><h4>'+esc(title)+'</h4>'+renderRows(rows)+'</div>').join('');
      const cautions=prescriptionNotes(row,saved);
      if(!demos.length&&!guidance)return '<li class="workout-row">'+heading+summary+cautions+'</li>';
      const key=sectionIndex+'-'+rowIndex;
      return '<li class="workout-row">'+heading+'<details class="learn-card" data-learn-row="'+key+'"'+
        (openLearnRows.has(key)?' open':'')+'><summary>'+summary+'</summary><div class="learn-body">'+
        (demos.length?'<div class="learn-media">'+demoPlayer(demos,true)+'</div>':'')+
        (guidance?'<div class="learn-guidance">'+guidance+'</div>':'')+'</div></details>'+cautions+'</li>';
    }
    function viewSelector(hasBlocks){
      return '<div class="coaching-views" role="group" aria-label="Coaching view">'+
        '<span class="button" aria-current="true">Workout</span>'+
        '<button type="button" class="button" data-action="present"'+
        (hasBlocks?'':' disabled')+'>Present Workout</button></div>';
    }
    function exportButtons(includeWeek){
      return '<button type="button" class="button secondary" data-action="print">Print this day</button>'+
        (includeWeek?'<button type="button" class="button secondary" data-action="print-week">Print week</button>':'')+
        '<button type="button" class="button secondary" data-action="copy">Copy complete workout</button>';
    }
    function weekCards(compact=false){
      return '<div class="days'+(compact?' workout-days':'')+'" aria-label="Choose training day">'+sessions.map((s,i)=>{
        const label=dayLabel(s,i),title=s.title||'Session being prepared',extra=optional(s);
        return '<button type="button" class="tile day '+(i===day?'selected':'')+'" aria-pressed="'+(i===day)+
          '" data-day="'+i+'" aria-label="'+esc([label,title,extra?'Optional':''].filter(Boolean).join(' · '))+'">'+
          '<strong>'+esc(label)+'</strong><span class="day-title">'+esc(title)+'</span>'+
          (extra?'<span class="day-option">Optional</span>':'')+'</button>';
      }).join('')+'</div>';
    }
    let printTrigger=null;
    function showPrint(week,trigger){
      const selected=week?sessions.map((s,index)=>({s,index})):[{s:session(),index:day}];
      const printable=selected.filter(({s})=>!s.locked).map(({s,index})=>({s,index,blocks:sections(s)})).filter(({blocks})=>blocks.length);
      if(!printable.length)return;
      const sheet=document.createElement('article');
      sheet.className='print-sheet';
      sheet.innerHTML='<div class="print-actions">'+
        '<button type="button" class="button" data-action="print-now">Print or save PDF</button>'+
        '<button type="button" class="button secondary" data-action="close-print">Back to workout</button></div>'+
        '<p class="print-help">If the print dialog does not open, use Print in your browser menu.</p>'+
        '<p class="print-brand">DU AIRLINES ELITE ACADEMY</p><h1>'+esc(week?'Training week':'Training session')+'</h1><p>'+esc(cohortLabel())+'</p>'+
        '<div'+(week?' class="print-week"':'')+'>'+printable.map(({s,index,blocks})=>
          '<section class="print-day"><h2>'+esc(dayLabel(s,index)+' · '+(s.title||'Workout')+(optional(s)?' · Optional':''))+'</h2>'+
          blocks.map(([title,rows])=>'<h3>'+esc(title)+'</h3><ul>'+rows.map(row=>{
            const name=nameOf(row);
            const dose=prescriptionLine(row);
            return '<li>'+esc(name)+(dose?' — <strong>'+esc(dose)+'</strong>':'')+'</li>';
          }).join('')+'</ul>').join('')+'</section>'
        ).join('')+'</div>';
      root.querySelectorAll('.print-sheet').forEach(node=>node.remove());
      root.append(sheet);
      printTrigger=trigger;
      sheet.querySelector?.('[data-action="print-now"]')?.focus();
    }
    function closePrint(){
      root.querySelectorAll('.print-sheet').forEach(node=>node.remove());
      printTrigger?.focus?.();
      printTrigger=null;
    }
    function presentMedia(demo,lazy=false){
      const embed=safeVideo(demo.url);
      const id=embed.split('/').pop();
      const portrait=new URL(demo.url).pathname.startsWith('/shorts/');
      return '<div class="presentation-stage'+(portrait?' portrait':'')+'">'+
        '<img src="https://i.ytimg.com/vi/'+id+'/hqdefault.jpg" alt="" referrerpolicy="no-referrer"'+(lazy?' loading="lazy"':'')+'>'+
        '<button type="button" class="presentation-play" data-play-demo="'+esc(demo.url)+'" data-demo-title="'+esc(demo.title)+
        '" aria-label="Play '+esc(demo.title)+' demonstration"><span aria-hidden="true"></span></button></div>';
    }
    function playPresentationVideo(button){
      const link=button.dataset.playDemo, embed=safeVideo(link);
      if(!embed)return;
      const stage=button.closest('.presentation-stage');
      const frame=document.createElement('iframe');
      frame.title=button.dataset.demoTitle+' demonstration';
      frame.dataset.url=link;
      frame.dataset.title=button.dataset.demoTitle;
      frame.allow='autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen=true;
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.src=embed+'?autoplay=1&playsinline=1';
      stage.replaceChildren(frame);
      const help=document.createElement('p');
      help.className='presentation-video-help';
      help.innerHTML='If the video won’t play, <a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">open it on YouTube</a>.';
      stage.after(help);
      frame.focus();
    }
    function presentation(s){
      const {title, row}=sequence[slide];
      const ex=exercises.get(row.exerciseCode)||{};
      const saved=delivery.sessionCoaching(row.cues);
      const library=delivery.coachingParts(ex.coachingCues||ex.coachingNote);
      const demos=matchingDemos(row).filter(demo=>safeVideo(demo.url));
      const reviewed=reviewedMovementCoaching(row,demos);
      const reviewedRows=demos.length===1&&reviewed.length===1?new Map(reviewed[0].rows):null;
      const ankleRockRangeNote=row.exerciseCode==='WU01'&&saved.cue==='Comfortable controlled range.';
      const cues=(ankleRockRangeNote
        ?[library.cue,reviewedRows?.get('Coach cue'),saved.cue]
        :[saved.cue,library.cue,reviewedRows?.get('Coach cue')]).filter(Boolean);
      const important=/\b(?:stop|pain|injur\w*|safety|unsafe|never|avoid|only if|hours between|do not|don.t|must not)\b/i;
      const cue=cues.find(value=>!important.test(value));
      const correction=library.avoid||reviewedRows?.get('Watch for')||saved.avoid;
      const description=ex.description||reviewedRows?.get('How to do it');
      const brief=value=>{
        const copy=txt(value);
        if(copy.length<=155)return copy;
        return copy.match(/^.+?(?:[.!?](?=\s)|(?=\r?\n))/)?.[0]||copy;
      };
      const guidance=[
        ['How to do it',brief(description)],
        ['Coaching cue',brief(cue)],
        ['Watch for',brief(correction)],
      ].filter(([,value])=>value);
      const exerciseName=ex.title||row.exerciseCode;
      const nameClass=exercises.has(row.exerciseCode)?(exerciseName.length>54?'long-title':''):'legacy-instruction';
      const dose=prescriptionLine(row);
      const context=assignedContext(row);
      const sessionDetails=renderRows([
        ['Purpose',purpose(s)],['Focus',txt(s.focus)!==purpose(s)?s.focus:''],
      ].filter(([,value])=>txt(value)))+sessionNotes(s).map(note=>'<p>'+esc(note)+'</p>').join('');
      const details=renderRows([...movementCoaching(row,ex),...context])+
        reviewed.map(({title,rows})=>'<div><h4>'+esc(title)+'</h4>'+renderRows(rows)+'</div>').join('')+
        (sessionDetails?'<h4>Session guidance</h4>'+sessionDetails:'');
      return '<section class="presentation" tabindex="-1" aria-label="Workout presentation">'+
        '<div class="presentation-toolbar"><span class="presentation-kicker">Present Workout</span>'+
        '<h2>'+esc(dayLabel(s,day)+' · '+(s.title||'Workout'))+'</h2>'+
        '<span class="presentation-progress" aria-live="polite">'+(slide+1)+' of '+sequence.length+'</span>'+
        '<div class="presentation-actions"><details class="presentation-exports"><summary class="button">Export</summary>'+
        '<div class="presentation-export-options">'+exportButtons(true)+'</div></details>'+
        '<button type="button" class="button" data-action="exit-present" aria-label="Exit presentation">Exit</button></div></div>'+
        '<div class="presentation-layout"><div class="presentation-media">'+demoPlayer(demos)+
        '</div><div class="presentation-card"><div class="presentation-heading">'+
        '<p class="presentation-block">'+esc(saved.phase||title)+'</p>'+
        '<h3'+(nameClass?' class="'+nameClass+'"':'')+'>'+esc(exerciseName)+'</h3></div>'+
        (dose?'<p class="dose'+(dose.length>72?' long-dose':'')+'">'+esc(dose)+'</p>':'')+
        (guidance.length?'<div class="presentation-guidance">'+guidance.map(([label,value])=>
          '<p><strong>'+label+'</strong>'+esc(value)+'</p>').join('')+'</div>':'')+
        (details?'<details class="presentation-details"'+(detailsOpen?' open':'')+'><summary>Coach Details</summary><div>'+
          details+'</div></details>':'')+'</div></div>'+
        '<nav class="presentation-footer" aria-label="Exercise navigation">'+
        '<button type="button" class="button" data-action="prev-slide"'+(slide?'':' disabled')+'>Previous</button>'+
        '<progress max="'+sequence.length+'" value="'+(slide+1)+'" aria-label="Workout progress"></progress>'+
        '<button type="button" class="button primary" data-action="next-slide"'+(slide+1<sequence.length?'':' disabled')+'>Next</button></nav></section>';
    }
    function moveSlide(next){
      if(next<0||next>=sequence.length)return;
      detailsOpen=root.querySelector?.('.presentation-details')?.open??detailsOpen;
      slide=next;
      render();
    }
    function copyText(){
      const s=session();
      const lines=['DU AIRLINES ELITE ACADEMY',cohortLabel(),dayLabel(s,day)+(s.title?' · '+s.title:'')+(optional(s)?' · Optional':'')];
      sections(s).forEach(([title,rows])=>{
        lines.push('',title.toUpperCase());
        rows.forEach((row,index)=>{
          const name=nameOf(row);
          const dose=prescriptionLine(row);
          lines.push((index+1)+'. '+name+(dose?' — '+dose:''));
        });
      });
      return lines.join('\n').trimEnd();
    }
    function render(){
      const s=session(),active=roster?.filter(a=>a.access_status==='active').length;
      if(view==='present'){
        root.innerHTML=presentation(s);
        root.querySelector?.('.presentation')?.focus();
        return;
      }
      const heading=view==='overview'?'Team Command':view==='workout'?'Full Workout':'Athlete Snapshot';
      const header=(view==='workout'?'<header class="workout-header">':'<header><small>DU AIRLINES / COACH ACCESS</small>')+
        '<h1>'+heading+'</h1><p>'+esc(cohortLabel())+'</p></header>';
      const canPrintWeek=sessions.some(item=>!item.locked&&sections(item).length);
      const weekPrint=canPrintWeek?'<button class="button secondary" data-action="print-week">Print week</button>':'';
      let body='';
      if(view==='overview'){
        body='<div class="week-head"><h2>This week’s sessions</h2>'+weekPrint+'</div>'+weekCards()+
          (sessions.length?'<div class="panel"><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc([s.duration,dayLabel(s,day)].filter(Boolean).join(' · '))+'</p><button class="button" data-action="workout">Open full workout →</button></div>':'<p class="muted">No published sessions available yet.</p>')+
          (programme.weeklyObjective?'<div class="panel"><h3>Weekly focus</h3><p>'+esc(programme.weeklyObjective)+'</p></div>':'')+
          '<div class="panel"><h3>Your squad'+(roster?' · '+active+'/'+roster.length+' active':'')+'</h3>'+
          (roster?'<div class="roster">'+roster.map((a,i)=>'<button data-athlete="'+i+'">'+esc(a.display_name||a.full_name||'Athlete')+'<br><span class="muted">'+esc(a.access_status==='active'?'Active':'Inactive')+'</span></button>').join('')+'</div>':'<p class="muted">Athletes have not been connected to this coach view yet.</p>')+'</div>'+
          '<div class="actions"><a class="button secondary" href="#/hub/coach-feedback">Weekly coach feedback →</a><a class="button secondary" href="#/hub/library">Exercise library →</a></div>';
      }else if(view==='athlete'){
        const a=roster?.[athlete];
        body='<div class="actions"><button class="button secondary" data-action="back">← Team</button></div><div class="panel"><h2>'+esc(a?.display_name||a?.full_name||'Athlete')+'</h2><p>Programme access: '+esc(a?.access_status||'Unknown')+'</p><button class="button" data-action="workout">View team workout →</button></div>';
      }else{
        const blocks=s.locked?[]:sections(s,true);
        body='<div class="week-head workout-navigation"><button class="button secondary" data-action="back">← Team</button>'+weekCards(true)+'</div>'+
          '<div class="workout-head"><div><small class="session-kicker">'+esc(dayLabel(s,day))+' · '+(optional(s)?'OPTIONAL EXTRA':'TRAINING')+'</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+'</p></div>'+
          '<div class="actions workout-actions">'+(blocks.length?exportButtons(canPrintWeek):weekPrint)+'</div></div>'+
          viewSelector(blocks.length)+
          (blocks.length?blocks.map(([title,rows],sectionIndex)=>
            '<section class="workout-section"><h3>'+esc(title)+'</h3><ol>'+
            rows.map((row,index)=>workoutRow(row,rows[index-1],sectionIndex,index)).join('')+'</ol></section>'
          ).join(''):'<div class="panel">This session is being prepared.</div>');
      }
      root.innerHTML=header+'<main>'+body+'</main>';
    }
    function openWorkout(){
      view='workout';openLearnRows.clear();
    }
    root.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.day!==undefined){
        const next=Number(b.dataset.day);
        if(!sessions[next])return;
        day=next;openWorkout();
      }
      if(b.dataset.athlete!==undefined){athlete=Number(b.dataset.athlete);view='athlete';}
      if(b.dataset.playDemo){playPresentationVideo(b);return;}
      if(b.dataset.demoUrl){
        const picker=b.closest('.demo-picker');
        picker.querySelector('.presentation-player').innerHTML=presentMedia(
          {url:b.dataset.demoUrl,title:b.dataset.demoTitle},!!b.closest('.learn-card')
        );
        picker.querySelectorAll('[data-demo-url]').forEach(option=>option.setAttribute('aria-pressed',String(option===b)));
        picker.querySelector('.presentation-play').focus();
        return;
      }
      switch(b.dataset.action){
        case 'back':view='overview';break;
        case 'workout':if(!sessions.length)return;openWorkout();break;
        case 'present':
          if(session().locked)return;
          sequence=sections(session(),true).flatMap(([title,rows])=>rows.map(row=>({title,row})));
          if(!sequence.length)return;
          openLearnRows=new Set(Array.from(root.querySelectorAll?.('.learn-card[open]')||[],card=>card.dataset.learnRow));
          view='present';slide=0;detailsOpen=false;break;
        case 'exit-present':view='workout';break;
        case 'prev-slide':moveSlide(slide-1);return;
        case 'next-slide':moveSlide(slide+1);return;
        case 'copy':{
          if(session().locked)return;
          const text=copyText();
          const container=b.parentElement;
          container?.querySelector('.hub-copy-fallback')?.remove();
          try{
            await navigator.clipboard.writeText(text);
          }catch{
            const field=document.createElement('textarea');
            field.className='hub-copy-fallback';
            field.setAttribute('aria-label','Workout text to copy');
            field.readOnly=true;
            field.rows=8;
            field.value=text;
            container.append(field);
            field.focus();
            field.select();
          }
          return;
        }
        case 'print':showPrint(false,b);return;
        case 'print-week':showPrint(true,b);return;
        case 'print-now':
          if(!root.querySelectorAll('.print-sheet').length)return;
          window.print?.();
          return;
        case 'close-print':closePrint();return;
      }
      render();
      if(b.dataset.day!==undefined)root.querySelector?.('[data-day="'+day+'"]')?.focus();
      if(b.dataset.action==='exit-present')root.querySelector?.('[data-action="present"]')?.focus();
    });
    root.addEventListener('error',event=>{
      if(event.target.matches?.('.presentation-stage img'))event.target.hidden=true;
    },true);
    root.addEventListener('toggle',event=>{
      const card=event.target;
      if(!card.matches?.('.learn-card')||card.open)return;
      const player=card.querySelector('.presentation-player');
      const frame=player.querySelector('iframe');
      if(!frame)return;
      const demo=frame.dataset;
      player.innerHTML=presentMedia({url:demo.url,title:demo.title},true);
    },true);
    root.addEventListener('keydown',event=>{
      if(root.querySelector('.print-sheet')){
        if(event.key==='Escape'){event.preventDefault();closePrint();}
        return;
      }
      if(view!=='present'||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      if(event.key==='Escape'){
        event.preventDefault();view='workout';render();root.querySelector('[data-action="present"]')?.focus();
      }else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();
        moveSlide(slide+(event.key==='ArrowRight'?1:-1));
      }
    });
    render();return {destroy(){host.replaceChildren();}};
  }
  global.DuCoachCommand=Object.freeze({mount});
})(window);
