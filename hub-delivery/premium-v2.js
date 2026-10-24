(function(root){
  'use strict';
  const clean=value=>typeof value==='string'?value.trim():'';
  const first=value=>clean(value).split(/\s+/)[0]||'';
  function identity(state={}){
    const athlete=state.athlete||{},viewer=state.viewer||{};
    const athleteName=state.accessMode==='identified-school'?clean(athlete.displayName)||clean(athlete.fullName):first(athlete.displayName)||first(athlete.fullName);
    const parentName=first(viewer.firstName);
    const audience=clean(state.audience);
    return Object.freeze({
      headline:athleteName?'Hi, '+athleteName:'Your Performance Hub',
      athleteName:athleteName||'',
      parentLabel:audience==='parent'&&parentName?'Parent access: '+parentName:'',
      schoolLabel:clean(state.cohort?.name)||clean(state.programme?.school)||'',
    });
  }
  const api=Object.freeze({identity});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DuPremiumV2=api;
})(typeof globalThis==='object'?globalThis:this);
