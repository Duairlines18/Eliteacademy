// Secure partnership email endpoint. Deploy only after RESEND_API_KEY,
// PARTNERSHIP_FROM_EMAIL (verified domain), and TURNSTILE_SECRET_KEY are configured.
// No database access, no athlete data, and no secrets exposed to the browser.
const origin = "https://duairlineseliteacademy.com";
const headers = {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const clean=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond(405,{ok:false,error:"Method not allowed"});
 if(req.headers.get("origin")!==origin)return respond(403,{ok:false,error:"Invalid origin"});
 const apiKey=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("PARTNERSHIP_FROM_EMAIL"),captchaSecret=Deno.env.get("TURNSTILE_SECRET_KEY");
 if(!apiKey||!from||!captchaSecret)return respond(503,{ok:false,error:"Enquiry service temporarily unavailable"});
 if(Number(req.headers.get("content-length")||0)>12000)return respond(413,{ok:false,error:"Request too large"});
 let data:Record<string,unknown>;
 try{data=await req.json()}catch{return respond(400,{ok:false,error:"Invalid request"})}
 if(clean(data.website,100))return respond(200,{ok:true});
 const name=clean(data.name,120),email=clean(data.email,180),organisation=clean(data.organisation,140),message=clean(data.message,2000),token=clean(data.captchaToken,3000);
 if(!name||!organisation||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!token)return respond(400,{ok:false,error:"Please complete all required fields"});
 const ip=req.headers.get("cf-connecting-ip")||"";
 const verification=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret:captchaSecret,response:token,remoteip:ip})});
 if(!verification.ok||!(await verification.json()).success)return respond(403,{ok:false,error:"Verification failed. Please try again"});
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:["coachdu@duairlineseliteacademy.com"],reply_to:email,subject:"2027 Partnership Enquiry — "+organisation,text:"Name: "+name+"\nEmail: "+email+"\nOrganisation: "+organisation+"\n\n"+message})});
 if(!response.ok){console.error("Partnership email provider rejected request",response.status);return respond(502,{ok:false,error:"Unable to send. Please try again later"})}
 return respond(200,{ok:true});
});