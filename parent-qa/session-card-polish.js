/* Visual metadata only. Never changes workouts, navigation or progress. */
(function(){
  'use strict';
  function iconFor(label){
    const s=String(label||'').toLowerCase();
    if(/warm.?up|game.day|activation/.test(s))return 'warmup';
    if(/recover|reset|mobility|breath/.test(s))return 'recovery';
    if(/strength|weight|lift/.test(s))return 'strength';
    if(/sprint|accel|run|aerobic|tempo/.test(s))return 'running';
    if(/core|trunk|plank/.test(s))return 'core';
    if(/movement|reactive|landing|balance|control|plyo/.test(s))return 'movement';
    return 'general';
  }
  function enhance(){
    document.querySelectorAll('.hub-parent-session-card').forEach(function(card){
      const label=card.textContent||'';
      const type=iconFor(label);
      if(card.dataset.sessionIcon!==type)card.dataset.sessionIcon=type;
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  function start(){
    enhance();
    const root=document.querySelector('#app')||document.body;
    if(!root||!window.MutationObserver)return;
    let pending=false;
    new MutationObserver(function(){
      if(pending)return;
      pending=true;
      requestAnimationFrame(function(){pending=false;enhance();});
    }).observe(root,{childList:true,subtree:true});
  }
})();
