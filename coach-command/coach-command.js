/* DU Airlines Coach Command — read-only presentation of an already-authorized staff bootstrap.
   No access codes, service-role keys, athlete identities, or database writes belong here.
   Usage: DuCoachCommand.mount(element, staffBootstrap, { roster: verifiedRoster })
   roster MUST come from a separately authorized, cohort-scoped backend response. */
(function(global){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt=v=>typeof v==='string'?v.trim():'';
  const styles=`
.ducc{--ink:var(--hub-bg,#090909);--gold:var(--hub-gold,#c7a25a);--line:var(--hub-line,rgba(199,162,90,.18));font:14px/1.45 system-ui,Arial,sans-serif;color:var(--hub-text,#f5f1e8);max-width:1080px;margin:auto;background:var(--hub-bg,#090909);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.ducc *{box-sizing:border-box}.ducc header{background:var(--hub-panel,#111111);color:var(--hub-text,#f5f1e8);padding:22px}.ducc header small{color:var(--gold);font-weight:800;letter-spacing:.12em}.ducc h1{font-size:24px;margin:5px 0}.ducc h2{font-size:19px;margin:4px 0}.ducc h3{font-size:14px;margin:0 0 10px}.ducc p{margin:4px 0}.ducc .muted{color:var(--hub-muted,#aaa69f);font-size:12px}.ducc main{padding:18px;display:grid;gap:14px}.ducc .stats,.ducc .days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ducc .days{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.ducc a.button{text-decoration:none;display:inline-flex;align-items:center}.ducc .tile,.ducc .panel{border:1px solid var(--line);border-radius:12px;padding:13px;background:var(--hub-panel,#111111)}.ducc .tile b{display:block;font-size:24px}.ducc .day{color:var(--hub-text,#f5f1e8);text-align:left;cursor:pointer;font:inherit}.ducc .day strong,.ducc .day span{display:block}.ducc .day strong{font-size:16px}.ducc .day span{font-size:11px;margin-top:5px}.ducc .selected{border:2px solid var(--gold)}.ducc button{cursor:pointer;font:inherit}.ducc .button{background:var(--hub-maroon,#6e1726);color:var(--hub-text,#f5f1e8);border:0;border-radius:9px;padding:11px 13px;font-weight:750}.ducc .secondary{background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border:1px solid var(--line)}.ducc .actions{display:flex;flex-wrap:wrap;gap:8px}.ducc .exercise{display:block;padding:14px 0;border-top:1px solid var(--line);line-height:1.65}.ducc .exercise+.exercise{margin-top:2px}.ducc .exercise-content b{display:block;font-weight:600;white-space:normal;overflow-wrap:anywhere}.ducc .exercise-content .muted{margin-top:5px}.ducc .exercise-content{min-width:0}.ducc .coach-cue{color:var(--hub-text,#f5f1e8);font-size:.95em;margin-top:7px}.ducc .coach-cue strong{color:var(--gold);margin-right:.35em}.ducc .exercise:first-child{border-top:0}.ducc .exercise b{font-size:13px}.ducc .section{border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--hub-panel,#111111)}.ducc .section h3{color:var(--gold);letter-spacing:.02em}.ducc .warmup summary{cursor:pointer;font-weight:800;color:var(--gold);padding:5px 0;list-style-position:inside}.ducc .warmup .warmup-inner{padding-top:8px}.ducc .warmup summary small{font-weight:400;color:var(--hub-muted,#aaa69f);margin-left:8px}.ducc button:focus-visible,.ducc summary:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.ducc .roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ducc .roster button{border:1px solid var(--line);border-radius:9px;padding:10px;background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);text-align:left}.ducc .demo-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;max-width:100%}.ducc .demo-links button{font-size:11px;padding:7px 10px;white-space:normal;text-align:left}.ducc .video{position:fixed;z-index:9999;inset:auto 10px 12px;max-width:720px;margin:auto;box-shadow:0 12px 45px #000b;background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border-radius:10px;padding:12px}.ducc .video iframe{width:100%;aspect-ratio:16/9;border:0}.ducc [hidden]{display:none!important}
@media(max-width:450px){.ducc main{padding:11px}.ducc header{padding:17px}.ducc .tile,.ducc .day{padding:9px}.ducc .day span{font-size:10px}.ducc .roster{grid-template-columns:1fr 1fr}}
.ducc .exercise{padding:7px 0;line-height:1.4}.ducc .coach-cue{margin-top:3px}.ducc .demo-links{margin-top:4px}.ducc .section{min-width:0}.ducc .section h3{margin-bottom:5px}
 .ducc header{background:radial-gradient(ellipse at top right,#314335,transparent 65%),#17251c;padding:clamp(16px,3vw,30px)}
.ducc header h1{font-size:clamp(22px,4vw,35px);line-height:1.15}
.ducc .week-head,.ducc .workout-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ducc .day{min-height:68px;background:linear-gradient(125deg,#4a252e,#261d22);border-color:#734653}
.ducc .day.selected{background:linear-gradient(120deg,#713747,#34232a);border:1px solid #e5a0a7}
.ducc .day span{font-size:12px}.ducc .days .day{min-width:0}.ducc .session-kicker{color:var(--gold);font-size:.8rem;font-weight:750}
.ducc .present-button{background:#e7c78b;color:#24190a}.ducc summary{cursor:pointer;min-height:38px;padding:7px 0}
.ducc .section>summary{font-weight:750;color:var(--gold)}.ducc .movement-detail>summary{font-size:.86rem;color:var(--gold)}
.ducc .session-note{border-left:2px solid var(--gold);padding-left:8px;margin:6px 0;white-space:pre-line}
.ducc .presentation{position:fixed;inset:0;z-index:9990;overflow:auto;background:#14281e;color:#fff8e9;padding:clamp(20px,5vw,68px)}
.ducc .presentation .actions{justify-content:space-between;margin-bottom:16px}.ducc .presentation h2{font-size:clamp(26px,5vw,64px);margin-bottom:16px}
.ducc .presentation-movement{border-top:1px solid #6b8978;padding:12px 0}.ducc .presentation-movement h3{font-size:clamp(20px,3vw,42px);margin:0}
.ducc .presentation-movement p{font-size:clamp(16px,2.1vw,29px)}.ducc .presentation-movement .dose{color:#f1ce89;font-weight:750}
.ducc .presentation-movement .demo-links button{font-size:1rem}
.ducc .print-sheet{display:none}
@media(max-width:540px){.ducc .days{grid-template-columns:1fr}.ducc .day{min-height:54px}.ducc .day strong,.ducc .day span{display:inline}.ducc .day span{margin:0 0 0 7px}}
@media print{
 @page{margin:12mm}
 body:has(.ducc .print-sheet){background:#fff!important;color:#000!important}
 body:has(.ducc .print-sheet) :is(.hub-topbar,#schoolAttendanceRoot,.hub-premium-routines){display:none!important}
 body:has(.ducc .print-sheet) :is(.hub-shell,.hub-main,.hub-wrap,#du-coach-command-root,.ducc){background:#fff!important;color:#000!important;border:0!important;box-shadow:none!important;margin:0!important;padding:0!important;overflow:visible!important}
 .ducc:has(.print-sheet)>:not(.print-sheet){display:none!important}
 .ducc .print-sheet{display:block;color:#000;background:#fff;font:10pt/1.35 system-ui,sans-serif}
 .ducc .print-sheet h1{font-size:17pt}.ducc .print-sheet h2{font-size:13pt;margin-top:12px}.ducc .print-sheet h3{font-size:11pt;margin:6px 0 2px}
 .ducc .print-sheet h4{font-size:10pt;margin:4px 0}.ducc .print-sheet p{margin:2px 0;white-space:pre-line}
 .ducc .print-sheet :is(h1,h2,h3,h4){color:#000!important;break-after:avoid}
 .ducc .print-sheet li{break-inside:avoid;margin:0 0 4px}.ducc .print-sheet ul{margin:0;padding-left:18px}
 .ducc .print-day+.print-day{border-top:1px solid #777;margin-top:10px}
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
    let day=initialDay>=0?initialDay:0,view=initialDay>=0?'workout':'overview',showVideos=true,athlete=null,block=0;
    const style=document.createElement('style');style.textContent=styles;host.replaceChildren(style);
    const root=document.createElement('div');root.className='ducc';host.append(root);
    const session=()=>sessions[day]||{};
    const optional=s=>/optional|extra/i.test(txt(s.requirement))||/optional|extra/i.test(txt(s.day));
    const prescriptions=s=>Array.isArray(s.prescriptions)?s.prescriptions:[];
    const dayLabel=(s,index)=>txt(s.day)||'Day '+(index+1);
    const cohortLabel=()=>[data.cohort.name,'Week '+(data.cohort.currentWeek||programme.week||'—')].join(' · ');
    const prescriptionLine=p=>[p.dosage,p.rest?'Rest: '+p.rest:''].filter(Boolean).join(' · ');
    const sessionNotes=(s,includeStaff=false)=>[...new Set([s.watch,s.athleteNote,includeStaff&&!/george/i.test(data.cohort.name||'')?s.staffNote:''].map(txt).filter(Boolean))];
    const purpose=s=>txt(s.why)||txt(s.objective);
    const isWarmup=title=>/warm[\s-]?up|preparation|activation/i.test(title);
    const sections=s=>{const map=new Map();for(const p of prescriptions(s)){const k=txt(p.sectionTitle)||'Workout';if(!map.has(k))map.set(k,[]);map.get(k).push(p);}{const legacy=Array.isArray(s.itemSections)&&s.itemSections.length?s.itemSections:[{title:'Session instructions',items:Array.isArray(s.items)?s.items:[]}];for(const block of legacy){const k=txt(block.title)||'Session instructions';const entries=(Array.isArray(block.items)?block.items:[]).map((x,itemIndex)=>({exerciseCode:x,dosage:'',cues:'',...(Array.isArray(block.videoLinks)?{savedDemos:block.videoLinks.filter(link=>link.itemIndex===itemIndex)}:{})})).filter(p=>typeof p.exerciseCode==='string'&&p.exerciseCode.trim());if(entries.length&&!map.has(k))map.set(k,entries);}}return [...map];};
    // Legacy school workouts are tier-specific text, not exercise-code prescriptions.
    // Only show demo links when a named movement matches the existing video library.
    const demoCatalog=[...exercises.values()].filter(ex=>safeVideo(ex.videoUrl||(ex.videoId?'https://www.youtube.com/watch?v='+ex.videoId:''))).sort((a,b)=>(b.title||'').length-(a.title||'').length);
    function matchingDemos(p){
      const exact=exercises.get(p.exerciseCode);
      if(exact){const url=safeVideo(exact.videoUrl||(exact.videoId?'https://www.youtube.com/watch?v='+exact.videoId:''));return url?[{title:exact.title||p.exerciseCode,url}]:[];}
      if(Array.isArray(p.savedDemos)){
        const seen=new Set();return p.savedDemos.flatMap(link=>{const url=safeVideo(link.url),title=txt(link.title),key=title+'|'+url;
          if(!url||!title||seen.has(key))return [];seen.add(key);return [{title,url}];});
      }
      const source=txt(p.exerciseCode).toLowerCase(),out=[],seen=new Set();
      for(const ex of demoCatalog){
        const title=txt(ex.title).toLowerCase();
        if(!title||title.length<5||seen.has(title))continue;
        const escaped=title.split('').map(ch=>'^$.*+?()[]{}|'.includes(ch)?String.fromCharCode(92)+ch:ch).join('');
        const match=new RegExp('(^|[^a-z])'+escaped+'(?=$|[^a-z])','i').test(source);
        if(!match)continue;
        const url=safeVideo(ex.videoUrl||(ex.videoId?'https://www.youtube.com/watch?v='+ex.videoId:''));
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
    function teachingRows(rows){
      return rows.filter(([label,value])=>label==='Coach cue'||label==='For this session'||label==='Coach alternative'||label==='Watch for'||(label==='How to do it'&&/confirm the movement sequence/i.test(value)));
    }
    function demoButtons(demos){
      return showVideos&&demos.length?'<div class="demo-links">'+demos.map(d=>'<button type="button" class="button secondary" data-video="'+esc(d.url)+'" aria-label="Watch '+esc(d.title)+' demonstration">▶ '+esc(d.title)+'</button>').join('')+'</div>':'';
    }
    function workoutRow(p,previous){
      const phase=delivery.sessionCoaching(p.cues).phase;
      const heading=phase&&phase!==delivery.sessionCoaching(previous?.cues).phase?'<h4>'+esc(phase)+'</h4>':'';
      const ex=exercises.get(p.exerciseCode)||{},demos=matchingDemos(p);
      const rows=movementCoaching(p,ex);
      const immediate=teachingRows(rows);
      const detail=renderRows(rows.filter(row=>!immediate.includes(row)))+reviewedMovementCoaching(p,demos).map(({title,rows})=>
        '<div class="coach-cue"><b>'+esc(title)+'</b>'+renderRows(rows)+'</div>').join('')+demoButtons(demos);
      const dosage=prescriptionLine(p);
      return heading+'<div class="exercise"><div class="exercise-content"><b>'+esc(ex.title||p.exerciseCode)+'</b>'+
        (dosage?'<p class="muted">'+esc(dosage)+'</p>':'')+(immediate.length?'<div class="coach-cue session-note">'+renderRows(immediate)+'</div>':'')+
        (detail?'<details class="movement-detail"><summary>'+(showVideos&&demos.length?'Technique &amp; demo':'Technique')+'</summary><div class="coach-cue">'+detail+'</div></details>':'')+'</div></div>';
    }
    function weekCards(){
      return '<div class="days" aria-label="Choose training day">'+sessions.map((s,i)=>
        '<button type="button" class="tile day '+(i===day?'selected':'')+'" aria-pressed="'+(i===day)+'" data-day="'+i+'"><strong>'+esc(dayLabel(s,i))+'</strong><span>'+esc(s.title||'Session being prepared')+'</span>'+(optional(s)?'<span>Optional extra</span>':'')+'</button>').join('')+'</div>';
    }
    function showPrint(week){
      const selected=week?sessions.map((s,index)=>({s,index})):[{s:session(),index:day}];
      const printable=selected.filter(({s})=>!s.locked&&sections(s).length);
      if(!printable.length)return;
      const sheet=document.createElement('article');
      sheet.className='print-sheet';
      sheet.innerHTML='<h1>'+esc(week?'Training week':'Training session')+'</h1><p>'+esc(cohortLabel())+'</p>'+printable.map(({s,index})=>
        '<section class="print-day"><h2>'+esc(dayLabel(s,index))+' · '+esc(s.title||'Workout')+(optional(s)?' · Optional extra':'')+'</h2>'+
        [s.duration,purpose(s),...sessionNotes(s)].filter(Boolean).map(value=>'<p>'+esc(value)+'</p>').join('')+
        sections(s).map(([title,ps])=>'<h3>'+esc(title)+'</h3><ul>'+ps.map((p,index)=>{
          const ex=exercises.get(p.exerciseCode)||{},phase=delivery.sessionCoaching(p.cues).phase;
          const details=movementCoaching(p,ex);
          const reviewed=reviewedMovementCoaching(p,matchingDemos(p));
          return '<li>'+(phase&&phase!==delivery.sessionCoaching(ps[index-1]?.cues).phase?'<h4>'+esc(phase)+'</h4>':'')+
            '<b>'+esc(ex.title||p.exerciseCode)+'</b>'+(prescriptionLine(p)?' · '+esc(prescriptionLine(p)):'')+
            renderRows(details)+reviewed.map(({title,rows})=>'<p><b>'+esc(title)+'</b></p>'+renderRows(rows)).join('')+'</li>';
        }).join('')+'</ul>').join('')+'</section>').join('');
      root.querySelectorAll('.print-sheet').forEach(node=>node.remove());
      root.append(sheet);
      window.print();
    }
    function presentation(s){
      const blocks=sections(s),[title,ps]=blocks[block];
      return '<section class="presentation" tabindex="-1" aria-label="Workout presentation"><div class="actions"><button class="button secondary" data-action="exit-present">← Workout</button><div class="actions"><button class="button secondary" data-action="prev-block"'+(block?'':' disabled')+'>Previous block</button><button class="button secondary" data-action="next-block"'+(block+1<blocks.length?'':' disabled')+'>Next block</button></div></div>'+
        '<p class="session-kicker">'+esc(dayLabel(s,day))+' · '+esc(s.title||'Workout')+' · '+(block+1)+' / '+blocks.length+'</p><h2>'+esc(title)+'</h2>'+
        [purpose(s),...sessionNotes(s)].filter(Boolean).map(value=>'<p class="session-note">'+esc(value)+'</p>').join('')+
        ps.map((p,index)=>{
          const ex=exercises.get(p.exerciseCode)||{},phase=delivery.sessionCoaching(p.cues).phase;
          const rows=movementCoaching(p,ex),demos=matchingDemos(p);
          const essentials=teachingRows(rows);
          const instruction=rows.find(([label])=>label==='How to do it');
          if(instruction&&!essentials.includes(instruction)&&!essentials.some(([label])=>label==='Coach cue'))essentials.unshift(instruction);
          const reviewed=reviewedMovementCoaching(p,demos).map(({title,rows})=>{
            const guidance=teachingRows(rows);
            return guidance.length?'<div><h4>'+esc(title)+'</h4>'+renderRows(guidance)+'</div>':'';
          }).join('');
          return '<div class="presentation-movement">'+(phase&&phase!==delivery.sessionCoaching(ps[index-1]?.cues).phase?'<h4>'+esc(phase)+'</h4>':'')+
            '<h3>'+esc(ex.title||p.exerciseCode)+'</h3>'+(prescriptionLine(p)?'<p class="dose">'+esc(prescriptionLine(p))+'</p>':'')+
            renderRows(essentials)+reviewed+demoButtons(demos)+'</div>';
        }).join('')+'</section>';
    }
    function copyText(){
      const s=session();
      return [s.day||'Day '+(day+1),s.title||'',s.duration||'',purpose(s),...sessionNotes(s),...sections(s).flatMap(([title,ps])=>[
        '',title,...ps.flatMap((p,index)=>{
          const phase=delivery.sessionCoaching(p.cues).phase,ex=exercises.get(p.exerciseCode)||{},demos=matchingDemos(p);
          return [
            ...(phase&&phase!==delivery.sessionCoaching(ps[index-1]?.cues).phase?[phase]:[]),
            [ex.title||p.exerciseCode,p.dosage,p.rest?'Rest: '+p.rest:''].filter(Boolean).join(' — '),
            ...movementCoaching(p,ex).map(([label,value])=>'  '+label+': '+value),
            ...reviewedMovementCoaching(p,demos).flatMap(({title,rows})=>[
              '  '+title,...rows.map(([label,value])=>'    '+label+': '+value),
            ]),
            ...demos.map(d=>'  Demo — '+d.title+': '+d.url),
          ];
        }),
      ])].join('\n');
    }
    function render(){
      const s=session(),active=roster?.filter(a=>a.access_status==='active').length;
      if(view==='present'){
        root.innerHTML=presentation(s);
        root.querySelector?.('.presentation')?.focus();
        return;
      }
      const heading=view==='overview'?'Team Command':view==='workout'?'Full Workout':'Athlete Snapshot';
      const header='<header><small>DU AIRLINES / COACH ACCESS</small><h1>'+heading+'</h1><p>'+esc(cohortLabel())+'</p></header>';
      const weekPrint=sessions.some(item=>!item.locked&&sections(item).length)?'<button class="button secondary" data-action="print-week">Print week</button>':'';
      let body='';
      if(view==='overview'){
        body='<div class="week-head"><h2>This week’s sessions</h2>'+weekPrint+'</div>'+weekCards()+
          (sessions.length?'<div class="panel"><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc([s.duration,dayLabel(s,day)].filter(Boolean).join(' · '))+'</p><button class="button" data-action="workout">Open full workout →</button></div>':'<p class="muted">No published sessions available yet.</p>')+
          (programme.weeklyObjective?'<details class="panel"><summary>Weekly focus</summary><p>'+esc(programme.weeklyObjective)+'</p></details>':'')+
          '<div class="panel"><h3>Your squad'+(roster?' · '+active+'/'+roster.length+' active':'')+'</h3>'+
          (roster?'<div class="roster">'+roster.map((a,i)=>'<button data-athlete="'+i+'">'+esc(a.display_name||a.full_name||'Athlete')+'<br><span class="muted">'+esc(a.access_status==='active'?'Active':'Inactive')+'</span></button>').join('')+'</div>':'<p class="muted">Athletes have not been connected to this coach view yet.</p>')+'</div>'+
          '<div class="actions"><a class="button secondary" href="#/hub/coach-feedback">Weekly coach feedback →</a><a class="button secondary" href="#/hub/library">Exercise library →</a></div>';
      }else if(view==='athlete'){
        const a=roster?.[athlete];
        body='<div class="actions"><button class="button secondary" data-action="back">← Team</button></div><div class="panel"><h2>'+esc(a?.display_name||a?.full_name||'Athlete')+'</h2><p>Programme access: '+esc(a?.access_status||'Unknown')+'</p><button class="button" data-action="workout">View team workout →</button></div>';
      }else{
        const blocks=s.locked?[]:sections(s);
        body='<div class="week-head"><button class="button secondary" data-action="back">← Team</button>'+weekPrint+'</div>'+weekCards()+
          '<div class="workout-head"><div><small class="session-kicker">'+esc(dayLabel(s,day))+' · '+(optional(s)?'OPTIONAL EXTRA':'TRAINING')+'</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+'</p></div>'+
          (blocks.length?'<div class="actions"><button class="button present-button" data-action="present">Present workout</button><button class="button secondary" data-action="print">Print this day</button><button class="button secondary" data-action="copy">Copy complete workout</button></div>':'')+'</div>'+
          (purpose(s)?'<p><strong>Purpose</strong> '+esc(purpose(s))+'</p>':'')+
          sessionNotes(s,true).map(value=>'<p class="session-note">'+esc(value)+'</p>').join('')+
          (blocks.length?blocks.map(([title,ps])=>'<details class="section'+(isWarmup(title)?' warmup':'')+'"><summary>'+esc(title)+' <small>('+ps.length+')</small></summary>'+ps.map((p,index)=>workoutRow(p,ps[index-1])).join('')+'</details>').join('')+
          '<div class="actions"><button class="button secondary" data-action="videos" aria-pressed="'+showVideos+'">'+(showVideos?'Hide demos':'Watch demos')+'</button></div>':'<div class="panel">This session is being prepared.</div>');
      }
      root.innerHTML=header+'<main>'+body+'</main>';
    }
    function closeVideo(){root.querySelectorAll('.video').forEach(node=>node.remove());}
    root.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.day!==undefined){
        const next=Number(b.dataset.day);
        if(!sessions[next])return;
        day=next;view='workout';
      }
      if(b.dataset.athlete!==undefined){athlete=Number(b.dataset.athlete);view='athlete';}
      if(b.dataset.video){
        const url=safeVideo(b.dataset.video);
        if(!url)return;
        closeVideo();
        const overlay=document.createElement('div');overlay.className='video';
        overlay.innerHTML='<div class="actions"><button class="button secondary" data-action="close-video">Close video ✕</button></div><iframe src="'+esc(url)+'" title="Exercise demonstration" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        root.append(overlay);overlay.querySelector('button')?.focus();return;
      }
      switch(b.dataset.action){
        case 'back':view='overview';break;
        case 'workout':if(!sessions.length)return;view='workout';break;
        case 'videos':showVideos=!showVideos;break;
        case 'present':if(session().locked||!sections(session()).length)return;view='present';block=0;break;
        case 'exit-present':view='workout';break;
        case 'prev-block':block=Math.max(0,block-1);break;
        case 'next-block':block=Math.min(sections(session()).length-1,block+1);break;
        case 'close-video':closeVideo();return;
        case 'copy':if(session().locked)return;try{await navigator.clipboard.writeText(copyText());}catch(err){alert('Copy unavailable. Select the workout text to copy.');}return;
        case 'print':showPrint(false);return;
        case 'print-week':showPrint(true);return;
      }
      render();
      if(b.dataset.day!==undefined)root.querySelector?.('[data-day="'+day+'"]')?.focus();
      if(b.dataset.action==='exit-present')root.querySelector?.('[data-action="present"]')?.focus();
    });
    root.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      if(root.querySelector('.video')){closeVideo();return;}
      if(view==='present'){view='workout';render();root.querySelector('[data-action="present"]')?.focus();}
    });
    render();return {destroy(){host.replaceChildren();}};
  }
  global.DuCoachCommand=Object.freeze({mount});
})(window);
