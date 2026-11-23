(function(root){
  'use strict';
  const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const text=value=>typeof value==='string'?value.trim():'';
  function coachingParts(note){
    const value=text(note),avoid=value.match(/\bAvoid:\s*([\s\S]*)$/i);
    return {cue:(avoid?value.slice(0,avoid.index):value).replace(/^Cue:\s*/i,'').trim(),avoid:avoid?avoid[1].trim():''};
  }
  function sessionCoaching(note){
    const value=text(note),tag=value.match(/^\[([^\]]+)\]\s*/);
    return {...coachingParts(tag?value.slice(tag[0].length):value),phase:tag?tag[1]:''};
  }
  function coachingRows(item){
    const normalized=value=>text(value).replace(/[.;!?]+$/,'').toLowerCase();
    const cue=item.libraryCue??item.cue,avoid=item.libraryAvoid??item.avoid;
    return [
      ['How to do it',item.description],
      ['Coach cue',cue],
      ['Watch for',avoid],
      ['For this session',[
        item.sessionCue&&normalized(item.sessionCue)!==normalized(cue)?item.sessionCue:'',
        item.sessionAvoid&&normalized(item.sessionAvoid)!==normalized(avoid)?'Avoid: '+item.sessionAvoid:'',
      ].filter(Boolean).join(' · ')],
      ['Coach alternative',item.substitutionNote],
    ].filter(([,value])=>text(value));
  }
  function displayRest(dosage,rest){
    return /^1\s*[×x]\s*/.test(text(dosage))&&/between sets/i.test(text(rest))?'':text(rest);
  }
  function preparationFor(programme={},session={}){
    const empty={routines:[],replacedSectionOrders:[]},spec=session.preparation,sessions=programme.sessions||[];
    if(!spec||!Array.isArray(spec.routineIds)||spec.routineIds.length!==2||new Set(spec.routineIds).size!==2)return empty;
    const routines=spec.routineIds.map(id=>sessions.filter(s=>s.id===id));
    if(routines.some(matches=>matches.length!==1)||routines.some(matches=>matches[0].id===session.id))return empty;
    const found=routines.map(matches=>matches[0]);
    if(found[0].routineKind!=='mobility'||found[1].routineKind!=='warm-up')return empty;
    // Only the original preparation block at order zero can be replaced. Never hide main training.
    if(!Array.isArray(spec.replacedSectionOrders)||spec.replacedSectionOrders.length!==1||spec.replacedSectionOrders[0]!==0)return empty;
    return {routines:found,replacedSectionOrders:[0]};
  }
  function assignedWarmUpFor(programme,session){
    const assignment=session.assignedWarmUp;
    if(!assignment||!Array.isArray(assignment.replacedSections)||assignment.routineId===session.id)return null;
    const matches=(programme.sessions||[]).filter(s=>s.id===assignment.routineId&&s.routineKind==='warm-up'
      &&typeof s.assignedWarmUpOverview==='string');
    return matches.length===1?matches[0]:null;
  }
  function trainingSections(programme,session,sections){
    const prep=preparationFor(programme,session);
    const warmUp=assignedWarmUpFor(programme,session);
    const visible=warmUp
      ? sections.filter(section=>!session.assignedWarmUp.replacedSections.some(old=>old.order===section.order&&old.title===section.title))
      : prep.routines.length?sections.filter(s=>!prep.replacedSectionOrders.includes(s.order)):sections;
    return programme.separateWarmups===true&&(session.prescriptions||[]).some(rx=>rx.sectionTitle==='Air Zim Warm-Up')?visible.filter(s=>s.title!=='Air Zim Warm-Up'):visible;
  }
  function explainDose(value){
    const dose=text(value),m=dose.match(/^(\d+)\s*[×x]\s*(\d+(?:\s*[–-]\s*\d+)?)(?:\s*(seconds?|secs?|s|breaths?|steps?))?(?:\s*\/\s*(leg|side))?$/i);
    if(!m)return '';
    const [,sets,count,unit,side]=m,where=side?' on each '+side:'',times=' Do this '+sets+(sets==='1'?' time.':' times.');
    if(unit&&/^(s|sec|second)/i.test(unit))return 'Hold for '+count+' seconds'+where+'.'+times;
    return 'Do '+count+' '+(unit?unit.toLowerCase():'repetitions')+where+'.'+times;
  }
  function trainingHelp(value){
    const s=text(value),lines=[];
    if(/\bISO(?:metric)?\b/i.test(s))lines.push('Hold the position without moving.');
    if(/\bflying\b/i.test(s))lines.push('Build up smoothly, then run the marked distance at the effort shown.');
    if(/\btempo\b/i.test(s))lines.push('Run steadily at the effort shown.');
    if(/\bapproach\b/i.test(s))lines.push('Practise your run-up rhythm.');
    if(/\d\s*%/.test(s))lines.push('The percentage shows effort: 100% is your hardest. Use the effort shown.');
    if(/\beffort\s*\d+(?:[–-]\d+)?\s*\/\s*10|\bRPE\b/i.test(s))lines.push('Effort is rated from 1 (very easy) to 10 (your hardest).');
    return lines;
  }
  function safeVideo(value,id){
    const raw=text(value)||(typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?'https://www.youtube.com/watch?v='+id:'');
    try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
      const host=u.hostname.toLowerCase();let key='';
      if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
        if(u.pathname==='/watch')key=u.searchParams.get('v')||'';
        else key=(u.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]+)\/?$/)||[])[1]||'';
      }else if(host==='youtu.be'||host==='www.youtu.be')key=u.pathname.slice(1).replace(/\/$/,'');
      return /^[A-Za-z0-9_-]{11}$/.test(key)?raw:'';
    }catch{return '';}
  }
  function canCopy({audience,delivery,published,school=false}={}){
    if(!published||audience==='parent')return false;
    if(school)return true;
    return audience==='private-athlete'&&delivery?.model==='private-athlete'&&delivery.copyWorkout===true;
  }
  function copyWorkout({athleteName,week,session={},sections=[],group=''}){
    const heading=['Week '+String(week??'to confirm'),text(session.day),text(session.title)].filter(Boolean).join(' · ');
    const lines=['DU AIRLINES ELITE ACADEMY',text(athleteName)||'Assigned school programme',heading];
    if(group)lines.push('Training group: '+group);
    for(const section of sections){
      if(!section.items?.length||/Additional movement references/i.test(section.title||''))continue;
      lines.push('',(text(section.title)||'Workout').toUpperCase());
      section.items.forEach((item,index)=>{
        const title=text(item.title)||'Exercise';
        lines.push((index+1)+'. '+(item.group?'['+item.group+'] ':'')+title+(item.dosage?' — '+item.dosage:'')+(item.rest?' · Rest: '+item.rest:''));
        const demos=Array.isArray(item.demos)?item.demos:[{title:item.title,url:item.videoUrl,id:item.videoId}];
        for(const demo of demos){
          const url=safeVideo(demo.url,demo.id),demoTitle=text(demo.title);
          if(url)lines.push('   Demo'+(demoTitle&&demoTitle!==title?' ('+demoTitle+')':'')+': '+url);
        }
      });
    }
    return lines.join('\n');
  }
  function overview(programme={}){
    const sessions=Array.isArray(programme.sessions)?programme.sessions:[];
    const warmups=sessions.filter(s=>['mobility','warm-up'].includes(s.routineKind)||/^(?:game|standard|air zim)\s*warm[ -]?up$/i.test(text(s.day))||/^standard warm[ -]?up\b/i.test(text(s.title))&& !/^day\s*\d+/i.test(text(s.day)));
    const training=sessions.filter(s=>!warmups.includes(s));
    const days=weekdays.map(day=>({day,sessions:[],note:''})),unplaced=[];
    for(const s of training){const day=weekdays.find(day=>new RegExp('^'+day+'(?:\\b)','i').test(text(s.day))||new RegExp('^'+day+'(?:\\b)','i').test(text(s.title)));if(day)days.find(d=>d.day===day).sessions.push(s);else unplaced.push(s);}
    const objective=text(programme.weeklyObjective);
    const fragments=objective.split(/;|\n/);
    for(const fragment of fragments){const m=fragment.trim().match(/(?:^|:\s*)(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*[:—–-]?\s*(.*)/i);if(m){const day=days.find(d=>d.day.toLowerCase()===m[1].toLowerCase());day.note=m[2].trim();}}
    const range=objective.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\s*[–—-]\s*(?:(?:[A-Za-z]+)\s+)?\d{1,2}/i);
    let scheduledRange='';
    if(programme.scheduledFor){const start=new Date(programme.scheduledFor);if(Number.isFinite(start.getTime())){const end=new Date(start.getTime()+6*86400000),fmt={month:'short',day:'numeric',timeZone:'UTC'};scheduledRange=start.toLocaleDateString('en-US',fmt)+'–'+end.toLocaleDateString('en-US',fmt);}}
    return {days,unplaced,warmups,training,dateRange:text(programme.dateRange)||(range?range[0]:scheduledRange||'Dates to confirm'),focus:objective};
  }
  // Presentation-only routine groups. Keep the original session IDs and completion keys.
  function routineCards(programme={},session={}){
    const sessions=Array.isArray(programme.sessions)?programme.sessions:[];
    const warmUp=assignedWarmUpFor(programme,session);
    if(warmUp)return [{id:'routine:'+warmUp.id,title:'My Warm-Up',kind:'assigned-warm-up',sessions:[warmUp]}];
    const preparation=preparationFor(programme,session);
    if(preparation.routines.length===2){
      return [{id:'combined:'+preparation.routines.map(r=>r.id).join(':'),title:'My Warm-Up',kind:'combined',sessions:preparation.routines}];
    }
    // Never infer a standard warm-up for an injured athlete or an unassigned day.
    const assignedIds=Array.isArray(session.preparation?.routineIds)?session.preparation.routineIds:[];
    const assigned=assignedIds.map(id=>sessions.filter(s=>s.id===id));
    if(assigned.some(matches=>matches.length!==1))return [];
    const cards=assigned.map(matches=>matches[0]).filter(r=>r.id!==session.id).map(r=>({
      id:'routine:'+r.id,title:r.title||r.day||'My Warm-Up',kind:'single',sessions:[r]
    }));
    if(!cards.length&&(session.prescriptions||[]).some(rx=>rx.sectionTitle==='Air Zim Warm-Up'))cards.push({id:'air-zim:'+session.id,title:'Air Zim Warm-Up',kind:'inline',sectionTitle:'Air Zim Warm-Up',sessions:[session]});
    return cards;
  }
  function dayDetail(programme={},sessionId=''){
    const overviewData=overview(programme);
    const selected=overviewData.training.find(s=>s.id===sessionId);
    return selected?{session:selected,routines:routineCards(programme,selected)}:null;
  }
  const api=Object.freeze({coachingParts,sessionCoaching,coachingRows,safeVideo,canCopy,copyWorkout,overview,explainDose,trainingHelp,displayRest,preparationFor,trainingSections,routineCards,dayDetail});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DuHubDelivery=api;
})(typeof globalThis==='object'?globalThis:this);
