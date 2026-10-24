// ISO BMFF/QuickTime duration validator. Rejects malformed/fragmented files.
export function inspectVideo(bytes: Uint8Array): {durationMs:number; format:string} {
  if (bytes.length < 32) throw Error('Invalid video');
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (p:number) => d.getUint32(p);
  const tag = (p:number) => String.fromCharCode(...bytes.subarray(p,p+4));
  let brand='', movie=false, fragmented=false;
  const durations:number[]=[];
  function boxes(start:number,end:number,depth:number):void {
    if(depth>8)throw Error('Invalid container');
    let p=start;
    while(p+8<=end) {
      let size=u32(p), head=8; const kind=tag(p+4);
      if(size===1) {
        if(p+16>end)throw Error('Invalid box');
        const high=u32(p+8);if(high!==0)throw Error('Oversized box');
        size=u32(p+12);head=16;
      } else if(size===0)size=end-p;
      if(size<head || p+size>end)throw Error('Malformed box');
      if(kind==='ftyp'){if(size<16)throw Error('Invalid ftyp');brand=tag(p+head);}
      if(kind==='moof')fragmented=true;
      if(kind==='moov')movie=true;
      if(kind==='mvhd'||kind==='mdhd') {
        const q=p+head,version=bytes[q];
        if(version!==0&&version!==1)throw Error('Unsupported media version');
        const offset=kind==='mvhd'?(version===1?20:12):(version===1?20:12);
        const at=q+offset,need=version===1?12:8;
        if(at+need>p+size)throw Error('Truncated duration');
        const scale=u32(at);
        const ticks=version===1?u32(at+4)*4294967296+u32(at+8):u32(at+4);
        if(scale===0||!Number.isSafeInteger(ticks))throw Error('Invalid duration');
        durations.push(ticks*1000/scale);
      }
      if(['moov','trak','mdia'].includes(kind))boxes(p+head,p+size,depth+1);
      p+=size;
    }
    if(p!==end)throw Error('Invalid trailing bytes');
  }
  boxes(0,bytes.length,0);
  if(!brand||!movie||fragmented||durations.length===0)throw Error('Unsupported video container');
  const durationMs=Math.ceil(Math.max(...durations));
  if(durationMs<1||durationMs>20000)throw Error('Video must be 20 seconds or shorter');
  return {durationMs,format:brand};
}

