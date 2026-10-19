(function(root){
  'use strict';
  const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const text=value=>typeof value==='string'?value.trim():'';
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
    const lines=['DU AIRLINES ELITE ACADEMY',text(athleteName)||'Assigned school programme','Week '+String(week??'to confirm')+' · '+text(session.day),text(session.title)];
    if(group)lines.push('Training group: '+group);
    for(const [label,value] of [['Duration',session.duration],['Focus',session.focus],['Objective',session.objective],['Purpose',session.why],['Important',session.watch],['Coach instructions',session.athleteNote]])if(text(value))lines.push(label+': '+text(value));
    for(const section of sections){
      if(/Additional movement references/i.test(section.title||''))continue;
      lines.push('',String(section.title||'Workout'));
      for(const item of section.items||[]){
        lines.push('- '+(item.group?'['+item.group+'] ':'')+String(item.title||'Exercise')+(item.dosage?' — '+item.dosage:'')+(item.rest?' · Rest: '+item.rest:''));
        for(const [label,value] of [['Cue',item.cue],['How',item.description],['Avoid',item.avoid],['Coach alternative',item.substitutionNote]])if(text(value))lines.push('  '+label+': '+text(value));
        const demos=Array.isArray(item.demos)?item.demos:[{title:item.title,url:item.videoUrl,id:item.videoId}];
        for(const demo of demos){const url=safeVideo(demo.url,demo.id);if(url)lines.push('  Demo'+(demo.title?' — '+demo.title:'')+': '+url);}
      }
    }
    // Preserve prescribed text in full if a legacy/structured duplicate was normalized away.
    const known=()=>lines.join('\n').toLowerCase().replace(/\s+/g,' ');
    const extra=(session.items||[]).filter(raw=>typeof raw==='string'&&!known().includes(raw.trim().toLowerCase().replace(/\s+/g,' ')));
    if(extra.length)lines.push('','Full programme instructions',...extra.map(s=>'- '+s));
    return lines.filter((s,i)=>s||i>0).join('\n');
  }
  function overview(programme={}){
    const sessions=Array.isArray(programme.sessions)?programme.sessions:[];
    const warmups=sessions.filter(s=>/^(?:game|standard|air zim)\s*warm[ -]?up$/i.test(text(s.day))||/^standard warm[ -]?up\b/i.test(text(s.title))&& !/^day\s*\d+/i.test(text(s.day)));
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
  const api=Object.freeze({safeVideo,canCopy,copyWorkout,overview});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DuHubDelivery=api;
})(typeof globalThis==='object'?globalThis:this);
