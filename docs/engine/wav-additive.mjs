// Additive hint ONLY: unknown means defer to existing importer, not accept as safe.
// Never transforms data or rejects unknown/extended/compressed WAV variants.
export function canonicalWavDuration(input){
 if(!(input instanceof ArrayBuffer)||input.byteLength<44)return null;
 const v=new DataView(input),n=input.byteLength;
 const id=(p,s)=>[...s].every((c,i)=>v.getUint8(p+i)===c.charCodeAt(0));
 if(!id(0,'RIFF')||!id(8,'WAVE')||v.getUint32(4,true)+8!==n||!id(12,'fmt ')||v.getUint32(16,true)!==16||!id(36,'data'))return null;
 const tag=v.getUint16(20,true),channels=v.getUint16(22,true),rate=v.getUint32(24,true),byteRate=v.getUint32(28,true),align=v.getUint16(32,true),bits=v.getUint16(34,true),size=v.getUint32(40,true);
 if(![1,2].includes(channels)||rate<8000||rate>192000||!((tag===1&&[8,16,24,32].includes(bits))||(tag===3&&bits===32))||align!==channels*bits/8||byteRate!==rate*align||size%align||44+size+(size%2)!==n)return null;
 const frames=size/align;return {frames,sampleRate:rate,duration:frames/rate,exceedsEightSeconds:frames>rate*8};
}
