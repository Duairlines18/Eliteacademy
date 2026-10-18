/* Progressive enhancement: narrative, source links and results remain usable without JS. */
(() => {
 'use strict';
 const data=JSON.parse(document.getElementById('story-data').textContent);
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const chart=document.getElementById('interactive-chart');
 const plot=document.getElementById('chart-plot');
 const selection=document.getElementById('chart-selection');
 let visible=[],mode='milestones';
 const dateLabel=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 function selectPoint(index){
  const p=visible[index];if(!p)return;
  plot.querySelectorAll('[data-point]').forEach(el=>{const selected=Number(el.dataset.point)===index;el.setAttribute('aria-pressed',String(selected));el.previousElementSibling.classList.toggle('chart-selected',selected);});
  selection.innerHTML=`<strong>${p.mark.toFixed(2)}<small> m</small></strong><p>${escape(p.title)}</p><small>${escape(dateLabel(p.date))} · ${escape(p.venue)} · ${p.environment}<br><a href="${escape(data.sources[p.sourceId].url)}">View official record <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></a></small>`;
 }
 function drawChart(nextMode){
  mode=nextMode;
  visible=data.performances.filter(p=>mode!=='pbs'||p.pb);
  const W=760,H=300,left=40,right=30,top=32,bottom=42;
  const minT=Date.parse('2017-01-01'),maxT=Date.parse('2027-01-01');
  const x=p=>left+(Date.parse(p.date)-minT)/(maxT-minT)*(W-left-right);
  const y=m=>top+(17.5-m)/1.5*(H-top-bottom);
  let svg=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="chart-title chart-desc"><title id="chart-title">${mode==='pbs'?'Selected outdoor personal-best breakthroughs':'Selected triple jump results'}</title><desc id="chart-desc">Distances in metres from 2017 to 2026. Horizontal spacing represents time. Indoor results have a dashed point outline. Use Tab to reach a result, Enter to select, or arrow keys to move.</desc><defs><linearGradient id="chart-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c7a25a" stop-opacity=".20"/><stop offset="100%" stop-color="#c7a25a" stop-opacity="0"/></linearGradient></defs>`;
  [16,16.5,17,17.5].forEach(m=>{svg+=`<line class="chart-grid" x1="${left}" y1="${y(m)}" x2="${W-right}" y2="${y(m)}"/><text class="chart-axis" x="0" y="${y(m)+4}">${m.toFixed(1)}</text>`;});
  [2017,2019,2021,2023,2026].forEach(year=>{const px=x({date:year+'-01-01'});svg+=`<text class="chart-axis" x="${px}" y="${H-12}" text-anchor="middle">${year}</text>`;});
  const points=visible.map(p=>`${x(p)},${y(p.mark)}`).join(' ');
  svg+=`<polygon class="chart-area" points="${x(visible[0])},${y(16)} ${points} ${x(visible.at(-1))},${y(16)}"/><polyline class="chart-line" points="${points}"/>`;
  visible.forEach((p,i)=>{
   const label=`${dateLabel(p.date)}, ${p.title}, ${p.mark.toFixed(2)} metres, ${p.environment}`;
   svg+=`<circle class="chart-point ${p.environment==='Indoor'?'indoor':''}" cx="${x(p)}" cy="${y(p.mark)}" r="6"/><circle class="chart-hit" role="button" tabindex="0" aria-label="${escape(label)}" aria-pressed="false" data-point="${i}" cx="${x(p)}" cy="${y(p.mark)}" r="27"/>`;
  });
  svg+='</svg>';plot.innerHTML=svg;
  document.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chart===mode)));
  document.getElementById('chart-help').textContent=mode==='pbs'?'Selected outdoor PB breakthroughs. Swipe the chart to explore; tap a point or use Tab and Enter.':'Selected results, not annual season bests. Dashed point = indoor. Swipe the chart to explore; tap a point or use Tab and Enter.';
  selectPoint(visible.findLastIndex(p=>p.pb));
 }
 plot.addEventListener('click',e=>{const el=e.target.closest('[data-point]');if(el)selectPoint(Number(el.dataset.point));});
 plot.addEventListener('keydown',e=>{
  const el=e.target.closest('[data-point]');if(!el)return;
  let i=Number(el.dataset.point);
  if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPoint(i);}
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();i=e.key==='Home'?0:e.key==='End'?visible.length-1:(i+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;
   plot.querySelector(`[data-point="${i}"]`).focus();selectPoint(i);
  }
 });
 document.querySelectorAll('[data-chart]').forEach(b=>b.addEventListener('click',()=>drawChart(b.dataset.chart)));
 drawChart(mode);chart.hidden=false;
 const table=document.querySelector('.results-details');table.open=false;
 document.querySelectorAll('.chapter-actions').forEach(el=>el.hidden=false);
 let statusTimer;
 function message(text){const el=document.getElementById('share-status');el.textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>el.textContent='',3500);}
 // Shares from the preview always retain the preview origin; published shares use the real origin.
 function chapterUrl(id){const url=new URL(location.href);url.hash=id;return url.href;}
 function chapterText(c){return [c.title.replace(/\n/g,' '),c.summary,c.story,'Du Airlines Elite Academy',chapterUrl(c.id)].join('\n\n');}
 function manualCopy(text){const dialog=document.getElementById('share-fallback');dialog.querySelector('textarea').value=text;dialog.showModal();dialog.querySelector('textarea').select();}
 document.addEventListener('click',async e=>{
  const share=e.target.closest('[data-share]'),copy=e.target.closest('[data-copy]');if(!share&&!copy)return;
  const c=data.chapters.find(c=>c.id===(share?share.dataset.share:copy.dataset.copy));if(!c)return;
  const text=chapterText(c);
  if(share&&navigator.share){try{await navigator.share({title:c.title.replace(/\n/g,' '),text:c.summary,url:chapterUrl(c.id)});return;}catch(error){if(error.name==='AbortError')return;}}
  try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(share?chapterUrl(c.id):text);message(share?'Chapter link copied.':'Story copied.');}catch{manualCopy(share?chapterUrl(c.id):text);}
 });
 const navLinks=[...document.querySelectorAll('.chapter-nav a')];
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){if(!entry.isIntersecting)continue;const link=navLinks.find(a=>a.hash==='#'+entry.target.id);if(!link)continue;navLinks.forEach(a=>a.removeAttribute('aria-current'));link.setAttribute('aria-current','location');}
  },{rootMargin:'-10% 0px -65% 0px',threshold:0});
  document.querySelectorAll('article.chapter,section.progression').forEach(el=>observer.observe(el));
 }
 // Native anchor navigation preserves browser history and works without scripting.
})();
