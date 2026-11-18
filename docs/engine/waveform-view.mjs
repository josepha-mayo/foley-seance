// UI-only summary; never mutates or rescales the audio samples.
export function waveformView(channels, sourceFrames, sampleRate, bins=64) {
 if(!Array.isArray(channels)||channels.length!==2||!channels[0].length||channels[0].length!==channels[1].length||!Number.isInteger(sourceFrames)||sourceFrames<1||sourceFrames>channels[0].length||!Number.isFinite(sampleRate)||sampleRate<=0||!Number.isInteger(bins)||bins<1||bins>256)throw new Error('Invalid waveform input');
 let peak=0;for(const channel of channels)for(const value of channel){if(!Number.isFinite(value))throw new Error('Invalid waveform sample');peak=Math.max(peak,Math.abs(value));}
 const length=channels[0].length,count=Math.min(bins,length),paths=[];
 for(let c=0;c<2;c++){
  const mid=c===0?25:75,values=[];
  for(let b=0;b<count;b++){let local=0;for(let i=Math.floor(b*length/count);i<Math.floor((b+1)*length/count);i++)local=Math.max(local,Math.abs(channels[c][i]));values.push(peak?local/peak*20:0);}
  let d=`M0 ${mid}`;
  for(let b=0;b<count;b++)d+=` L${((b+.5)*300/count).toFixed(3)} ${(mid-values[b]).toFixed(3)}`;
  d+=` L300 ${mid}`;
  for(let b=count-1;b>=0;b--)d+=` L${((b+.5)*300/count).toFixed(3)} ${(mid+values[b]).toFixed(3)}`;
  paths.push(d+' Z');
 }
 return{paths,peak,sourceX:300*sourceFrames/length,sourceSeconds:sourceFrames/sampleRate,tailSeconds:(length-sourceFrames)/sampleRate};
}
export function cueFilename(label,route,doorClosed,sampleRate,{doorEvent=false}={}){
 const stem=String(label).replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'source';
 const movement=['still','approach','retreat','cross','drawn'].includes(route)?route:'still';
 return `foley-${stem}-${movement}${doorEvent?'-door-event':''}-${doorClosed?'muffled':'open'}-${Math.round(sampleRate/1000)}k.wav`;
}
