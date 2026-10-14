/* Surgical audience selector. Requires integration into original homepage.
   Does not touch forms, Supabase, registration, payments or Hub logic. */
(()=>{'use strict';
const host=document.querySelector('[data-du-audience]');if(!host)return;
const tabs=[...host.querySelectorAll('[role="tab"]')];
function select(i,focus=false){tabs.forEach((tab,j)=>{const on=i===j;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;const panel=document.getElementById(tab.getAttribute('aria-controls'));if(panel)panel.hidden=!on});if(focus)tabs[i].focus()}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(i));tab.addEventListener('keydown',e=>{const j=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(j!==null){e.preventDefault();select(j,true)}})});
select(0);
})();