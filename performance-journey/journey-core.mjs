// Pure presentation rules. These describe assigned work, never physiological adaptation.
const text=x=>typeof x==='string'?x.trim():'';
export function weekTheme(w){
  const s=[w.phase,w.weekly_objective,w.running_focus,w.strength_focus,w.event_focus].map(text).join(' ').toLowerCase();
  if(/reload|deload|consolidat|absorb|recovery/.test(text(w.phase).toLowerCase())||/^reduce total stress\b/.test(text(w.weekly_objective).toLowerCase()))return 'recovery';
  if(/return|hamstring|re.?entry|rebuild/.test(text(w.phase).toLowerCase()))return 'return';
  if(/horizontal jump|long.jump foundation|takeoff|triple.jump.*techni/.test(s))return 'jumps';
  if(/volleyball|vertical|landing/.test(s)&&!/sprint capacity/.test(s))return 'control';
  if(/aerobic|800m|600m|running economy|endurance/.test(s)&&!/sprint capacity/.test(s))return 'endurance';
  if(/sprint|speed|acceleration/.test(s))return 'speed';
  if(/strength/.test(s))return 'strength';
  return 'foundation';
}
const themes={
  recovery:{title:'Recover. Keep your rhythm.',body:'A lighter training load makes room for recovery.',purpose:'Recovery weeks help you manage the work before your next training step.',next:'Share how you feel before the training load changes.'},
  return:{title:'Build your rhythm with control',body:'Your plan uses controlled work to rebuild a steady training rhythm.',purpose:'You’re building a consistent starting point for the work ahead.',next:'Tell Coach Du how the sessions and next-day recovery feel.'},
  jumps:{title:'Connect your run to your jump',body:'Your plan brings running, takeoff practice and controlled landings together.',purpose:'Your running and strength work support the approach, takeoff and landing.',next:'Show Coach Du your movement before adding harder jump work.'},
  control:{title:'Make each movement count',body:'Your plan combines strength, jump practice and landing control.',purpose:'You’re practising the strength and control used in your jumps and landings.',next:'Send your requested movement clip and share how training feels.'},
  endurance:{title:'Build endurance. Keep your rhythm.',body:'Your plan combines controlled running, intervals and supporting strength.',purpose:'You’re laying a running foundation to carry your pace for longer.',next:'Log your interval times, effort and recovery to guide the next step.'},
  speed:{title:'Build your sprint foundation',body:'Your plan combines running rhythm, sprint work and supporting strength.',purpose:'Your sessions connect running mechanics, speed practice and strength.',next:'Share your training response so Coach Du can guide the next speed step.'},
  strength:{title:'Build strength with control',body:'Your plan develops familiar strength and movement patterns.',purpose:'You’re building the strength and movement foundation for your sport.',next:'Keep your movements controlled and share your next check-in.'},
  foundation:{title:'Build your starting point',body:'Your plan starts with movement quality and a consistent training rhythm.',purpose:'You’re laying a foundation for your next training phase.',next:'Complete your check-in so Coach Du can guide your next step.'}
};
export function buildJourney(source={},options={}){
  const group=options.group===true,parent=options.parent===true;
  const week=Number(source.current_week)||1;
  const weeks=(source.weeks||[]).filter(w=>Number(w.week_number)<=week&&(!w.status||['live','completed'].includes(w.status)||(w.status==='archived'&&w.week_number<week))&&(w.verification_status==null||w.verification_status==='verified')&&(w.published_at!==null)).sort((a,b)=>a.week_number-b.week_number);
  const name=text(source.name)||'Athlete';
  const heading=group?'Your group’s training journey':parent?name+'’s training journey':name+', here’s your journey.';
  if(!weeks.length)return {heading,steps:[],purpose:'Your journey begins when Coach Du publishes your first training week.',weeks:[],evidence:'Your first published programme is being prepared.'};
  const latest=weeks.at(-1),first=weeks[0],now=themes[weekTheme(latest)];
  const adapt=s=>group?s.replaceAll('Your plan','Your group’s plan').replaceAll('You’re','Your group is').replaceAll('you ','the group ').replaceAll('your ','the group’s '):s;
  const steps=[];
  if(first!==latest){const f=themes[weekTheme(first)];steps.push({kind:'past',label:'WEEK '+first.week_number+' · YOUR START',title:f.title,body:adapt(f.body)});}
  const recovery=weeks.filter(w=>w!==latest&&w!==first&&weekTheme(w)==='recovery').at(-1);
  if(recovery)steps.push({kind:'past',label:'WEEK '+recovery.week_number+' · RECOVERY',title:themes.recovery.title,body:adapt(themes.recovery.body)});
  steps.push({kind:'current',label:'WEEK '+latest.week_number+' · '+(latest.week_number<week?'LATEST PUBLISHED':group?'CURRENT GROUP FOCUS':'YOU ARE HERE'),title:now.title,body:adapt(now.body)});
  const context=source.context?.programme_id===source.programme?.id?source.context:null;
  const next=text(context?.next_focus)||now.next;
  steps.push({kind:'next',label:'UP AHEAD · '+(group?'GROUP DIRECTION':'YOUR DIRECTION'),title:text(context?.next_title)||'Your next step starts with feedback',body:adapt(next)});
  const all=[source.programme?.name,source.programme?.sport,...weeks.map(w=>w.event_focus)].join(' ');
  let purpose=text(context?.purpose)||now.purpose;
  if(!context?.purpose&&/800m|800 m/.test(all)&&weekTheme(latest)==='endurance')purpose='You’re laying the foundation to hold your pace through your 800m.';
  let evidence='Your next check-in will help Coach Du see how the training is landing.';
  const e=source.evidence||{},parts=[];
  if(group){if(e.roster_count>0)parts.push((e.respondents||0)+' of '+e.roster_count+' roster athletes have recorded feedback');if(e.shared_submissions>0)parts.push(e.shared_submissions+' shared check-in submissions (not a unique-athlete count)');if(e.coach_checkins>0)parts.push(e.coach_checkins+' coach check-ins');}
  else{if(e.checked_items>0)parts.push(e.checked_items+' exercise items checked — this does not confirm full-session completion');if(e.checkins>0)parts.push(e.checkins+' check-ins');if(e.reviewed_videos>0)parts.push(e.reviewed_videos+' coach-reviewed videos');if(Array.isArray(e.improvements)&&e.improvements.length)parts.push('Reported in check-ins: '+e.improvements.join(', '));}
  if(parts.length)evidence=parts.join(' · ')+'.';
  if(e.override_count>0)evidence+=' Your assigned adjustments still apply; follow your training sheet.';
  if(source.evidence_since)evidence+=' Since '+String(source.evidence_since).slice(0,10)+'.';
  return {heading,steps,purpose:adapt(purpose),weeks:weeks.map(w=>({week:w.week_number,title:themes[weekTheme(w)].title,objective:text(w.weekly_objective),phase:text(w.phase)})),evidence,contextUpdatedAt:context?.synced_at||null};
}
