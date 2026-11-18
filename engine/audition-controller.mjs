// Genuine Kiro controller design, independently rewritten after review found queue,
// restart and overlapping-gain defects. Raw generated version is retained separately.
const MASTER_GAIN=0.35, FADE=0.04;
import {copyAuditionSettings as settingsCopy} from './audition-core.mjs';
export function createAuditionController({context,worker,decode,onState=()=>{},onError=()=>{},now=()=>performance.now()}){
 if(!context||!worker||typeof decode!=='function')throw new Error('Missing audition dependencies');
 let revision=0,active=false,disposed=false,sourceSettings=null,pending=null,inflight=null,ready=null,current=null,retiring=null,epochStart=0;
 const nodes=new Set();
 const emit=(state,latencyMs)=>{try{onState({state,revision,...(latencyMs===undefined?{}:{latencyMs})});}catch{}};
 const destroy=n=>{if(!n)return;n.source.onended=null;try{n.source.stop();}catch{}try{n.source.disconnect();}catch{}try{n.gain.disconnect();}catch{}nodes.delete(n);};
 function clearAudio(){for(const n of [...nodes])destroy(n);current=null;retiring=null;ready=null;}
 function stop(){revision++;active=false;pending=null;ready=null;clearAudio();emit('stopped');}
 function fail(error){stop();try{onError(error instanceof Error?error:new Error(String(error)));}catch{}}
 const valid=req=>active&&!disposed&&req.id===revision;
 function pump(){
  if(disposed||inflight||!pending)return;
  const req=pending;pending=null;inflight=req;
  try{worker.postMessage({id:req.id,settings:req.settings});}catch(e){inflight=null;if(valid(req))fail(e);}
 }
 function queue(settings){pending={id:++revision,settings,requested:now()};ready=null;emit('pending');pump();}
 function validateResult(result,req){
  const expectedFrames=req.settings.kind==='import' ? req.settings.source.length+Math.floor(1.5*req.settings.sampleRate) : Math.round((req.settings.kind==='creak'?1.2:2)*req.settings.sampleRate);
  if(req.settings.kind==='import' && result?.sourceId!==req.settings.sourceId)throw new Error('Imported source response mismatch');
  if(!result||!(result.wavBytes instanceof Uint8Array)||result.kind!==req.settings.kind||result.sampleRate!==req.settings.sampleRate||result.frames!==expectedFrames||result.wavBytes.length!==44+4*expectedFrames)throw new Error('Invalid worker audio result');
 }
 function validateBuffer(buffer,result){
  if(!buffer||buffer.numberOfChannels!==2||buffer.sampleRate!==result.sampleRate||buffer.length!==result.frames||!Number.isFinite(buffer.duration)||Math.abs(buffer.duration-buffer.length/buffer.sampleRate)>1e-7)throw new Error('Invalid decoded stereo format');
  for(let ch=0;ch<2;ch++){const a=buffer.getChannelData(ch);if(a.length!==buffer.length)throw new Error('Invalid channel length');for(const v of a)if(!Number.isFinite(v)||Math.abs(v)>1)throw new Error('Invalid decoded sample');}
 }
 function installReady(){
  if(!ready||retiring)return;
  const item=ready;ready=null;if(!valid(item.req))return;
  const {buffer,req}=item;
  const time=context.currentTime;
  // The first gain ramp must finish before the complementary transition begins.
  // Ramps and source starts/stops are scheduled on the audio clock, not wall timers.
  const begin=current?Math.max(time,current.fullAt):time;
  const end=begin+FADE;
  let n;
  try{
   const source=context.createBufferSource(),gain=context.createGain();
   n={source,gain,fullAt:end};nodes.add(n);
   source.buffer=buffer;source.loop=true;
   gain.gain.setValueAtTime(0,begin);gain.gain.linearRampToValueAtTime(MASTER_GAIN,end);
   source.connect(gain);gain.connect(context.destination);
   const old=current;
   if(!old)epochStart=begin;
   const offset=((begin-epochStart)%buffer.duration+buffer.duration)%buffer.duration;
   source.start(begin,offset);
   if(old){
    retiring=old;
    old.gain.gain.cancelScheduledValues(begin);
    old.gain.gain.setValueAtTime(MASTER_GAIN,begin);
    old.gain.gain.linearRampToValueAtTime(0,end);
    old.source.onended=()=>{
     if(!nodes.has(old))return;
     destroy(old);if(retiring===old)retiring=null;
     installReady();
    };
    old.source.stop(end);
   }
   current=n;
   emit('playing',Math.max(0,now()-req.requested+(begin-time)*1000));
  }catch(e){if(n)destroy(n);fail(e);}
 }
 worker.onmessage=async event=>{
  const data=event?.data;
  if(!inflight)return;
  if(!data||!Number.isSafeInteger(data.id)){inflight=null;fail(new Error('Malformed worker response'));return;}
  if(data.id!==inflight.id)return; // An unrelated or duplicate response cannot clear work.
  const req=inflight;
  try{
   if(!valid(req))return;
   if(data.error)throw new Error(`Worker error: ${String(data.error)}`);
   validateResult(data.result,req);
   const buffer=await decode(data.result.wavBytes);
   if(!valid(req))return;
   validateBuffer(buffer,data.result);
   ready={req,buffer};installReady();
  }catch(e){if(valid(req))fail(e);}
  finally{if(inflight===req)inflight=null;pump();}
 };
 worker.onerror=event=>{inflight=null;fail(new Error(`Worker error: ${event?.message||'unknown failure'}`));};
 worker.onmessageerror=()=>{inflight=null;fail(new Error('Worker message could not be decoded'));};
 return {
  start(settings){if(disposed)throw new Error('Audition disposed');const s=settingsCopy(settings);stop();active=true;sourceSettings=s;queue(s);},
  update(settings){if(disposed)throw new Error('Audition disposed');if(!active)return false;let s;try{s=settingsCopy(settings);}catch(e){stop();throw e;}if(s.kind!==sourceSettings.kind||s.sampleRate!==sourceSettings.sampleRate||(s.kind==='import'&&(s.sourceId!==sourceSettings.sourceId||s.source.length!==sourceSettings.source.length||s.source.some((v,i)=>!Object.is(v,sourceSettings.source[i]))))){stop();throw new Error('Source change requires explicit start');}queue(s);return true;},
  stop,
  dispose(){if(disposed)return;stop();disposed=true;worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();}
 };
}
