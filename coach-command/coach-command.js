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
.ducc *{box-sizing:border-box}.ducc header{background:var(--hub-panel,#111111);color:var(--hub-text,#f5f1e8);padding:22px}.ducc header small{color:var(--gold);font-weight:800;letter-spacing:.12em}.ducc h1{font-size:24px;margin:5px 0}.ducc h2{font-size:19px;margin:4px 0}.ducc h3{font-size:14px;margin:0 0 10px}.ducc p{margin:4px 0}.ducc .muted{color:var(--hub-muted,#aaa69f);font-size:12px}.ducc main{padding:18px;display:grid;gap:14px}.ducc .stats,.ducc .days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ducc .days{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.ducc a.button{text-decoration:none;display:inline-flex;align-items:center}.ducc .tile,.ducc .panel{border:1px solid var(--line);border-radius:12px;padding:13px;background:var(--hub-panel,#111111)}.ducc .tile b{display:block;font-size:24px}.ducc .day{color:var(--hub-text,#f5f1e8);text-align:left;cursor:pointer;font:inherit}.ducc .day strong,.ducc .day span{display:block}.ducc .day strong{font-size:16px}.ducc .day span{font-size:11px;margin-top:5px}.ducc .selected{border:2px solid var(--gold)}.ducc button{cursor:pointer;font:inherit}.ducc .button{background:var(--hub-maroon,#6e1726);color:var(--hub-text,#f5f1e8);border:0;border-radius:9px;padding:11px 13px;font-weight:750}.ducc .secondary{background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border:1px solid var(--line)}.ducc .actions{display:flex;flex-wrap:wrap;gap:8px}.ducc .exercise{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.ducc .exercise:first-child{border-top:0}.ducc .exercise b{font-size:13px}.ducc .section{border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--hub-panel,#111111)}.ducc .section h3{color:var(--gold);letter-spacing:.02em}.ducc .warmup summary{cursor:pointer;font-weight:800;color:var(--gold);padding:5px 0;list-style-position:inside}.ducc .warmup .warmup-inner{padding-top:8px}.ducc .warmup summary small{font-weight:400;color:var(--hub-muted,#aaa69f);margin-left:8px}.ducc button:focus-visible,.ducc summary:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.ducc .roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ducc .roster button{border:1px solid var(--line);border-radius:9px;padding:10px;background:#fafbf9;text-align:left}.ducc .demo-links{display:flex;flex-wrap:wrap;gap:6px;max-width:300px}.ducc .demo-links button{font-size:11px;padding:7px 9px;white-space:normal;text-align:left}.ducc .video{position:fixed;z-index:9999;inset:auto 10px 12px;max-width:720px;margin:auto;box-shadow:0 12px 45px #000b;background:var(--hub-panel-2,#171717);color:var(--hub-text,#f5f1e8);border-radius:10px;padding:12px}.ducc .video iframe{width:100%;aspect-ratio:16/9;border:0}.ducc [hidden]{display:none!important}
@media(max-width:450px){.ducc main{padding:11px}.ducc header{padding:17px}.ducc .tile,.ducc .day{padding:9px}.ducc .day span{font-size:10px}.ducc .roster{grid-template-columns:1fr 1fr}}
@media print{.ducc header,.ducc .actions,.ducc .video,.ducc .days,.ducc .roster{display:none!important}.ducc main{display:block}.ducc .section{break-inside:avoid}.ducc .panel{border:0}}
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
    const programme=data.programme, sessions=Array.isArray(programme.sessions)?programme.sessions:[];
    const exercises=new Map((Array.isArray(data.exercises)?data.exercises:[]).map(e=>[e.code,e]));
    const roster=opts.rosterVerified===true&&Array.isArray(opts.roster)&&opts.roster.every(a=>a&&a.cohort_id===data.cohort.id)?opts.roster:null;
    let day=0,view='overview',showCues=true,showVideos=true,video='',athlete=null;
    const style=document.createElement('style');style.textContent=styles;host.replaceChildren(style);
    const root=document.createElement('div');root.className='ducc';host.append(root);
    const session=()=>sessions[day]||{};
    const optional=s=>/optional|extra/i.test(txt(s.requirement))||/optional|extra/i.test(txt(s.day));
    const prescriptions=s=>Array.isArray(s.prescriptions)?s.prescriptions:[];
    const isWarmup=title=>/warm[\s-]?up|preparation|activation/i.test(title);
    const sections=s=>{const map=new Map();for(const p of prescriptions(s)){const k=txt(p.sectionTitle)||'Workout';if(!map.has(k))map.set(k,[]);map.get(k).push(p);}if(!map.size){const legacy=Array.isArray(s.itemSections)&&s.itemSections.length?s.itemSections:[{title:'Session instructions',items:Array.isArray(s.items)?s.items:[]}];for(const block of legacy){const k=txt(block.title)||'Session instructions';const entries=(Array.isArray(block.items)?block.items:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>({exerciseCode:x,dosage:'',cues:''}));if(entries.length)map.set(k,entries);}}return [...map];};
    // Legacy school workouts are tier-specific text, not exercise-code prescriptions.
    // Only show demo links when a named movement matches the existing video library.
    const demoCatalog=[...exercises.values()].filter(ex=>safeVideo(ex.videoUrl||(ex.videoId?'https://www.youtube.com/watch?v='+ex.videoId:''))).sort((a,b)=>(b.title||'').length-(a.title||'').length);
    function matchingDemos(p){
      const exact=exercises.get(p.exerciseCode);
      if(exact){const url=safeVideo(exact.videoUrl||(exact.videoId?'https://www.youtube.com/watch?v='+exact.videoId:''));return url?[{title:exact.title||p.exerciseCode,url}]:[];}
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
    function copyText(){
      const s=session();return [s.day||'Day '+(day+1),s.title||'',s.duration||'',...sections(s).flatMap(([title,ps])=>['',title,...ps.map(p=>{const ex=exercises.get(p.exerciseCode)||{};return [ex.title||p.exerciseCode,p.dosage||'',p.rest?'Rest: '+p.rest:'',showCues?(p.cues||ex.coachingCues||ex.coachingNote||''):''].filter(Boolean).join(' — ');})])].join('\n');
    }
    function render(){
      const s=session(),total=roster?roster.length:null,active=roster?roster.filter(a=>a.access_status==='active').length:null;
      const header='<header><small>DU AIRLINES / COACH ACCESS</small><h1>'+esc(view==='overview'?'Team Command':view==='workout'?'Full Workout':'Athlete Snapshot')+'</h1><p>'+esc(data.cohort.name)+' · Week '+esc(data.cohort.currentWeek||programme.week||'—')+'</p></header>';
      let body='';
      if(view==='overview'){
        body='<div class="stats"><div class="tile"><b>'+esc(active===null?'—':active+'/'+total)+'</b><span class="muted">Active athletes</span></div><div class="tile"><b>'+sessions.filter(x=>!optional(x)).length+'</b><span class="muted">Athletics days</span></div><div class="tile"><b>'+sessions.filter(optional).length+'</b><span class="muted">Optional extra</span></div></div>'+
        '<div class="panel selected"><small>SELECTED SESSION</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+' · '+esc(s.day||'Day '+(day+1))+'</p>'+(sessions.length?'<button class="button" data-action="workout">Open full workout →</button>':'<p class="muted">No published sessions available yet.</p>')+'</div>'+
        (programme.weeklyObjective?'<div class="panel"><h3>Weekly focus</h3><p>'+esc(programme.weeklyObjective)+'</p></div>':'')+'<h3>This week · Monday–Friday</h3><div class="days">'+sessions.map((x,i)=>'<button class="tile day '+(i===day?'selected':'')+'" data-day="'+i+'"><strong>Day '+(i+1)+'</strong><span>'+esc(x.title||'Not published')+'</span><span>'+(optional(x)?'Optional extra':'Athletics')+'</span></button>').join('')+'</div>'+
        '<div class="panel"><h3>Your squad</h3>'+(roster?'<div class="roster">'+roster.map((a,i)=>'<button data-athlete="'+i+'">'+esc(a.display_name||a.full_name||'Athlete')+'<br><span class="muted">'+esc(a.access_status==='active'?'Active':'Inactive')+'</span></button>').join('')+'</div>':'<p class="muted">Athletes have not been connected to this coach view yet. Your training sessions are ready to use. Athlete profiles will appear here once securely assigned.</p>')+'</div><div class="actions"><a class="button secondary" href="#/hub/coach-feedback">Weekly coach feedback →</a><a class="button secondary" href="#/hub/library">Exercise library →</a></div>';
      }else if(view==='athlete'){
        const a=roster&&roster[athlete];body='<div class="actions"><button class="button secondary" data-action="back">← Team</button></div><div class="panel"><h2>'+esc(a?.display_name||a?.full_name||'Athlete')+'</h2><p class="muted">Programme access: '+esc(a?.access_status||'Unknown')+'</p><p>Assigned team: '+esc(data.cohort.name)+'</p><button class="button" data-action="workout">View team workout →</button></div>';
      }else{
        body='<div class="actions"><button class="button secondary" data-action="back">← Team</button><button class="button" data-action="copy">Copy workout</button><button class="button secondary" data-action="print">Print</button></div><div><small>DAY '+(day+1)+' · '+(optional(s)?'OPTIONAL EXTRA':'ATHLETICS')+'</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+' · '+esc(s.objective||'')+'</p></div>'+
        (s.staffNote?'<div class="panel"><h3>Coach note</h3><p>'+esc(s.staffNote)+'</p></div>':'')+'<div class="actions"><button class="button secondary" data-action="cues">Instructions: '+(showCues?'On':'Off')+'</button><button class="button secondary" data-action="videos">Videos: '+(showVideos?'On':'Off')+'</button></div>'+
        (s.locked?'<div class="panel">This programme week is being prepared.</div>':sections(s).map(([title,ps])=>(isWarmup(title)?'<details class="section warmup"><summary>'+esc(title)+' <small>Tap to view full warm-up ('+ps.length+' exercises)</small></summary><div class="warmup-inner">':'<section class="section"><h3>'+esc(title)+'</h3>')+ps.map(p=>{const ex=exercises.get(p.exerciseCode)||{},demos=matchingDemos(p);return '<div class="exercise"><div><b>'+esc(ex.title||p.exerciseCode)+'</b><p class="muted">'+esc(p.dosage||'')+(p.rest?' · Rest: '+esc(p.rest):'')+'</p>'+(showCues?'<p>'+esc(p.cues||ex.coachingCues||ex.coachingNote||'')+'</p>':'')+'</div>'+(showVideos&&demos.length?'<div class="demo-links">'+demos.map(d=>'<button class="button secondary" data-video="'+esc(d.url)+'" aria-label="Watch '+esc(d.title)+' demonstration">▶ '+esc(d.title)+'</button>').join('')+'</div>':'')+'</div>';}).join('')+(isWarmup(title)?'</div></details>':'</section>')).join(''))+
        
        '<div class="actions"><button class="button" data-action="copy">Copy complete workout</button></div>';
      }
      root.innerHTML=header+'<main>'+body+'</main>'; 
    }
    root.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.day!==undefined){day=Number(b.dataset.day);view='workout';video='';}
      if(b.dataset.athlete!==undefined){athlete=Number(b.dataset.athlete);view='athlete';}
      if(b.dataset.video){video=b.dataset.video;const overlay=document.createElement('div');overlay.className='video';overlay.innerHTML='<div class="actions"><button class="button secondary" data-action="close-video">Close video ✕</button></div><iframe src="'+esc(video)+'" title="Exercise demonstration" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';root.querySelectorAll('.video').forEach(v=>v.remove());root.append(overlay);return;}
      switch(b.dataset.action){
        case 'back':view='overview';video='';break;
        case 'workout':view='workout';break;
        case 'cues':showCues=!showCues;break;
        case 'videos':showVideos=!showVideos;video='';break;
        case 'close-video':video='';root.querySelectorAll('.video').forEach(v=>v.remove());return;
        case 'copy':try{await navigator.clipboard.writeText(copyText());}catch(err){alert('Copy unavailable. Select the workout text to copy.');}return;
        case 'print':window.print();return;
      }
      render();
    });
    render();return {destroy(){host.replaceChildren();}};
  }
  global.DuCoachCommand=Object.freeze({mount});
})(window);
