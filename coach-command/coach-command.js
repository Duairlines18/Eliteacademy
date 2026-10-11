/* DU Airlines Coach Command — read-only presentation of an already-authorized staff bootstrap.
   No access codes, service-role keys, athlete identities, or database writes belong here.
   Usage: DuCoachCommand.mount(element, staffBootstrap, { roster: verifiedRoster })
   roster MUST come from a separately authorized, cohort-scoped backend response. */
(function(global){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt=v=>typeof v==='string'?v.trim():'';
  const styles=`
.ducc{--ink:#123025;--gold:#e4c17d;--line:#dfe7df;font:14px/1.45 system-ui,Arial,sans-serif;color:#172b21;max-width:1080px;margin:auto;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.ducc *{box-sizing:border-box}.ducc header{background:var(--ink);color:white;padding:22px}.ducc header small{color:var(--gold);font-weight:800;letter-spacing:.12em}.ducc h1{font-size:24px;margin:5px 0}.ducc h2{font-size:19px;margin:4px 0}.ducc h3{font-size:14px;margin:0 0 10px}.ducc p{margin:4px 0}.ducc .muted{color:#68776e;font-size:12px}.ducc main{padding:18px;display:grid;gap:14px}.ducc .stats,.ducc .days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ducc .tile,.ducc .panel{border:1px solid var(--line);border-radius:12px;padding:13px;background:#fafbf9}.ducc .tile b{display:block;font-size:24px}.ducc .day{color:inherit;text-align:left;cursor:pointer;font:inherit}.ducc .day strong,.ducc .day span{display:block}.ducc .day strong{font-size:16px}.ducc .day span{font-size:11px;margin-top:5px}.ducc .selected{border:2px solid #2e8459}.ducc button{cursor:pointer;font:inherit}.ducc .button{background:#18553b;color:white;border:0;border-radius:9px;padding:11px 13px;font-weight:750}.ducc .secondary{background:white;color:#1b4331;border:1px solid var(--line)}.ducc .actions{display:flex;flex-wrap:wrap;gap:8px}.ducc .exercise{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.ducc .exercise:first-child{border-top:0}.ducc .exercise b{font-size:13px}.ducc .section{border:1px solid var(--line);border-radius:11px;padding:12px}.ducc .roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ducc .roster button{border:1px solid var(--line);border-radius:9px;padding:10px;background:#fafbf9;text-align:left}.ducc .video{background:#0c2018;color:white;border-radius:10px;padding:12px}.ducc .video iframe{width:100%;aspect-ratio:16/9;border:0}.ducc [hidden]{display:none!important}
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
    const roster=opts.rosterVerified===true&&Array.isArray(opts.roster)&&opts.roster.every(a=>a.cohort_id===data.cohort.id)?opts.roster:null;
    let day=0,view='overview',showCues=true,showVideos=true,video='',athlete=null;
    const style=document.createElement('style');style.textContent=styles;host.replaceChildren(style);
    const root=document.createElement('div');root.className='ducc';host.append(root);
    const session=()=>sessions[day]||{};
    const prescriptions=s=>Array.isArray(s.prescriptions)?s.prescriptions:[];
    const sections=s=>{const map=new Map();for(const p of prescriptions(s)){const k=txt(p.sectionTitle)||'Workout';if(!map.has(k))map.set(k,[]);map.get(k).push(p);}return [...map];};
    function copyText(){
      const s=session();return [s.day||'Day '+(day+1),s.title||'',s.duration||'',...sections(s).flatMap(([title,ps])=>['',title,...ps.map(p=>{const ex=exercises.get(p.exerciseCode)||{};return [ex.name||p.exerciseCode,p.dosage||'',p.rest?'Rest: '+p.rest:'',showCues?(p.cues||ex.coaching_cues||''):''].filter(Boolean).join(' — ');})])].join('\n');
    }
    function render(){
      const s=session(),total=roster?roster.length:null,active=roster?roster.filter(a=>a.access_status==='active').length:null;
      const header='<header><small>DU AIRLINES / COACH ACCESS</small><h1>'+esc(view==='overview'?'Team Command':view==='workout'?'Full Workout':'Athlete Snapshot')+'</h1><p>'+esc(data.cohort.name)+' · Week '+esc(data.cohort.currentWeek||programme.week||'—')+'</p></header>';
      let body='';
      if(view==='overview'){
        body='<div class="stats"><div class="tile"><b>'+esc(active===null?'—':active+'/'+total)+'</b><span class="muted">Active athletes</span></div><div class="tile"><b>2</b><span class="muted">Athletics days</span></div><div class="tile"><b>1</b><span class="muted">Optional extra</span></div></div>'+
        '<div class="panel selected"><small>SELECTED SESSION</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+' · '+esc(s.day||'Day '+(day+1))+'</p><button class="button" data-action="workout">Open full workout →</button></div>'+
        '<h3>This week · Monday–Friday</h3><div class="days">'+sessions.slice(0,3).map((x,i)=>'<button class="tile day '+(i===day?'selected':'')+'" data-day="'+i+'"><strong>Day '+(i+1)+'</strong><span>'+esc(x.title||'Not published')+'</span><span>'+((i===2)?'Optional extra':'Athletics')+'</span></button>').join('')+'</div>'+
        '<div class="panel"><h3>Your squad</h3>'+(roster?'<div class="roster">'+roster.map((a,i)=>'<button data-athlete="'+i+'">'+esc(a.display_name||a.full_name||'Athlete')+'<br><span class="muted">'+esc(a.access_status==='active'?'Active':'Inactive')+'</span></button>').join('')+'</div>':'<p class="muted">Roster not available until cohort-scoped coach authorization is connected. Programme workouts remain accessible.</p>')+'</div>';
      }else if(view==='athlete'){
        const a=roster&&roster[athlete];body='<div class="actions"><button class="button secondary" data-action="back">← Team</button></div><div class="panel"><h2>'+esc(a?.display_name||a?.full_name||'Athlete')+'</h2><p class="muted">Programme access: '+esc(a?.access_status||'Unknown')+'</p><p>Assigned team: '+esc(data.cohort.name)+'</p><button class="button" data-action="workout">View team workout →</button></div>';
      }else{
        body='<div class="actions"><button class="button secondary" data-action="back">← Team</button><button class="button" data-action="copy">Copy workout</button><button class="button secondary" data-action="print">Print</button></div><div><small>DAY '+(day+1)+' · '+(day===2?'OPTIONAL EXTRA':'ATHLETICS')+'</small><h2>'+esc(s.title||'Session being prepared')+'</h2><p class="muted">'+esc(s.duration||'')+' · '+esc(s.objective||'')+'</p></div>'+
        '<div class="actions"><button class="button secondary" data-action="cues">Instructions: '+(showCues?'On':'Off')+'</button><button class="button secondary" data-action="videos">Videos: '+(showVideos?'On':'Off')+'</button></div>'+
        (s.locked?'<div class="panel">This programme week is being prepared.</div>':sections(s).map(([title,ps])=>'<section class="section"><h3>'+esc(title)+'</h3>'+ps.map(p=>{const ex=exercises.get(p.exerciseCode)||{},link=safeVideo(ex.video_url|| (ex.video_id?'https://www.youtube.com/watch?v='+ex.video_id:''));return '<div class="exercise"><div><b>'+esc(ex.name||p.exerciseCode)+'</b><p class="muted">'+esc(p.dosage||'')+(p.rest?' · Rest: '+esc(p.rest):'')+'</p>'+(showCues?'<p>'+esc(p.cues||ex.coaching_cues||'')+'</p>':'')+'</div>'+(showVideos&&link?'<button class="button secondary" data-video="'+esc(link)+'">▶ Video</button>':'')+'</div>';}).join('')+'</section>').join(''))+
        (video?'<div class="video"><div class="actions"><button class="button secondary" data-action="close-video">Close video</button></div><iframe src="'+esc(video)+'" title="Exercise demonstration" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>':'')+
        '<div class="actions"><button class="button" data-action="copy">Copy complete workout</button></div>';
      }
      root.innerHTML=header+'<main>'+body+'</main>'; 
    }
    root.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.day!==undefined){day=Number(b.dataset.day);view='workout';video='';}
      if(b.dataset.athlete!==undefined){athlete=Number(b.dataset.athlete);view='athlete';}
      if(b.dataset.video){video=b.dataset.video;}
      switch(b.dataset.action){
        case 'back':view='overview';video='';break;
        case 'workout':view='workout';break;
        case 'cues':showCues=!showCues;break;
        case 'videos':showVideos=!showVideos;video='';break;
        case 'close-video':video='';break;
        case 'copy':try{await navigator.clipboard.writeText(copyText());}catch(err){alert('Copy unavailable. Select the workout text to copy.');}return;
        case 'print':window.print();return;
      }
      render();
    });
    render();return {destroy(){host.replaceChildren();}};
  }
  global.DuCoachCommand=Object.freeze({mount});
})(window);
