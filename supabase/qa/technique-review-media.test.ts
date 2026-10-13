import { inspectVideo } from '../functions/technique-review-private/media.ts';
function assertThrows(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}if(!failed)throw Error('Expected rejection');}
function box(name:string, payload:Uint8Array):Uint8Array{
 const out=new Uint8Array(8+payload.length);const d=new DataView(out.buffer);
 d.setUint32(0,out.length);out.set([...name].map(x=>x.charCodeAt(0)),4);out.set(payload,8);return out;
}
function concat(...parts:Uint8Array[]){const out=new Uint8Array(parts.reduce((a,b)=>a+b.length,0));let p=0;for(const x of parts){out.set(x,p);p+=x.length;}return out;}
function sample(ms:number):Uint8Array{
 const ftyp=box('ftyp',new Uint8Array([105,115,111,109,0,0,0,0]));
 const mvhd=new Uint8Array(20);const d=new DataView(mvhd.buffer);d.setUint32(12,1000);d.setUint32(16,ms);
 return concat(ftyp,box('moov',box('mvhd',mvhd)));
}
Deno.test('15 seconds accepted',()=>{if(inspectVideo(sample(15000)).durationMs!==15000)throw Error('Wrong duration');});
Deno.test('16 seconds rejected',()=>assertThrows(()=>inspectVideo(sample(16000))));
Deno.test('zero duration rejected',()=>assertThrows(()=>inspectVideo(sample(0))));
Deno.test('random bytes rejected',()=>assertThrows(()=>inspectVideo(new Uint8Array(50))));
Deno.test('truncated box rejected',()=>assertThrows(()=>inspectVideo(sample(1000).slice(0,-2))));
