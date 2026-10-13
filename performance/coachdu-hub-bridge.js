/* Owner-only professional hub bridge: never changes other member views. */
(function(){
  'use strict';
  const TARGET='coachdu@duairlineseliteacademy.com';
  const DEST='/performance/';
  const PROJECT='hiktwkdfvlujszczthdu';
  let busy=false,redirected=false;
  async function check(){
    if(busy||redirected||location.pathname.startsWith('/performance'))return;
    const text=document.body?.innerText||'';
    if(!/Programme Assignment Pending|Activation Pending/i.test(text))return;
    const auth=window.supabase;
    if(!auth?.createClient)return;
    busy=true;
    try{
      const client=auth.createClient('https://'+PROJECT+'.supabase.co','sb_publishable_MKg9hNp7WuDlnK0TnlwwtQ_n8j4-dYx',{auth:{persistSession:true,autoRefreshToken:false}});
      const {data,error}=await client.auth.getUser();
      if(!error&&data?.user?.email?.toLowerCase()===TARGET){
        redirected=true;
        location.replace(DEST);
      }
    }catch(e){console.warn('Performance bridge unavailable',e)}
    finally{busy=false}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check);
  else check();
  const observer=new MutationObserver(()=>{if(!busy&&!redirected)check()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',check);
})();
