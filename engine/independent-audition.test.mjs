import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuditionController} from './audition-controller.mjs';
import {buildAudition} from './audition-core.mjs';
import {decodeWav,renderRecipe,encodeWav} from './foley-engine.mjs';
const setting=(x=.5)=>({kind:'creak',sampleRate:24000,x,y:.25,doorClosed:false});
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(decodeOverride){
 const sources=[],gains=[],states=[],errors=[];
 const context={currentTime:1,destination:{},createBufferSource(){const s={connect(){},disconnect(){this.disconnected=true;},start(t,o){this.startAt=t;this.offset=o;},stop(t){this.stopAt=t??context.currentTime;}};sources.push(s);return s;},createGain(){const events=[];const g={events,gain:{setValueAtTime(v,t){events.push(['set',v,t]);},linearRampToValueAtTime(v,t){events.push(['ramp',v,t]);},cancelScheduledValues(t){events.push(['cancel',t]);}},connect(){},disconnect(){this.disconnected=true;}};gains.push(g);return g;}};
 const worker={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.terminated=true;}};
 const buffer={numberOfChannels:2,sampleRate:24000,length:28800,duration:1.2,getChannelData(){return new Float32Array(28800);}};
 const controller=createAuditionController({context,worker,decode:decodeOverride||(()=>Promise.resolve(buffer)),onState:s=>states.push(s),onError:e=>errors.push(e),now:()=>100});
 const reply=async(m=worker.sent.at(-1),extra={})=>{await worker.onmessage({data:{id:m.id,result:{wavBytes:new Uint8Array(115244),kind:'creak',sampleRate:24000,frames:28800},...extra}});};
 return {controller,worker,context,sources,gains,states,errors,reply,buffer};
}
test('core uses shared DSP, exact duration, finite PCM and seam silence for both original sources',()=>{
 for(const kind of ['creak','breath'])for(const x of [0,.5,1]){
  const out=buildAudition({...setting(x),kind});const d=decodeWav(out.wavBytes);
  assert.ok(out.warmupMaxDifference <= 1/32768);assert.ok(out.warmupRmsDifference <= 1/32768);
  assert.equal(out.frames,Math.round((kind==='creak'?1.2:2)*24000));
  for(const a of d.channels){assert.equal(a[0],0);assert.equal(a.at(-1),0);assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));}
 }
});
test('core rejects accessors/extra fields without evaluating getters',()=>{let read=false;const s=setting();Object.defineProperty(s,'x',{get(){read=true;return.5;}});assert.throws(()=>buildAudition(s));assert.equal(read,false);assert.throws(()=>buildAudition({...setting(),extra:1}));});
test('latest-only queue releases stale response and processes newest request',async()=>{
 const f=fixture();f.controller.start(setting());const old=f.worker.sent[0];for(let i=0;i<10;i++)f.controller.update(setting(i/10));assert.equal(f.worker.sent.length,1);await f.reply(old);assert.equal(f.worker.sent.length,2);assert.equal(f.worker.sent[1].settings.x,.9);await f.reply();assert.equal(f.sources.length,1);assert.equal(f.states.at(-1).state,'playing');
});
test('stop during decode cannot restart; update after stop never autoplays',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.controller.start(setting());const p=f.reply();f.controller.stop();resolve(f.buffer);await p;assert.equal(f.sources.length,0);assert.equal(f.controller.update(setting()),false);assert.equal(f.worker.sent.length,1);
});
test('new start waits stale in-flight, then starts only current source',async()=>{
 const f=fixture();f.controller.start(setting(.1));const old=f.worker.sent[0];f.controller.stop();f.controller.start(setting(.9));assert.equal(f.worker.sent.length,1);await f.reply(old);assert.equal(f.worker.sent.length,2);await f.reply();assert.equal(f.sources.length,1);
});
test('crossfades are source-time aligned and bound live nodes to two',async()=>{
 const f=fixture();f.controller.start(setting());await f.reply();f.context.currentTime=1.5;f.controller.update(setting(.8));await f.reply();assert.equal(f.sources[1].offset,.5);assert.equal(f.sources.length,2);
 assert.deepEqual(f.gains[1].events.slice(0,2),[['set',0,1.5],['ramp',.35,1.54]]);assert.deepEqual(f.gains[0].events.slice(-2),[['set',.35,1.5],['ramp',0,1.54]]);
 for(const x of [.2,.3,.4]){f.controller.update(setting(x));await f.reply();}assert.equal(f.sources.length,2);
 f.context.currentTime=1.54;f.sources[0].onended();assert.equal(f.sources.length,3);assert.equal(f.sources.filter(s=>!s.disconnected).length,2);assert.ok(Math.abs(f.sources[2].offset-.54)<1e-9);
 f.controller.stop();assert.ok(f.sources.every(s=>s.disconnected));assert.ok(f.gains.every(g=>g.disconnected));
});
test('stop clears deferred ready transition and all scheduled audio',async()=>{
 const f=fixture();f.controller.start(setting());await f.reply();f.controller.update(setting(.8));await f.reply();f.controller.update(setting(.3));await f.reply();f.controller.stop();assert.ok(f.sources.every(s=>s.disconnected));assert.equal(f.sources.length,2);
});
test('decode/worker/malformed errors stop existing audio and do not leave stale playing state',async()=>{
 for(const response of [{error:'broken'},{result:{}},null]){
  const f=fixture();f.controller.start(setting());await f.reply();f.controller.update(setting(.8));if(response)await f.reply(undefined,response);else await f.worker.onmessage({data:null});assert.equal(f.errors.length,1);assert.equal(f.states.at(-1).state,'stopped');assert.ok(f.sources.every(s=>s.disconnected));
 }
 const f=fixture(()=>Promise.reject(new Error('decode')));f.controller.start(setting());await f.reply();assert.equal(f.errors.length,1);
});
test('source change requires explicit restart; dispose terminates and prevents restart',async()=>{
 const f=fixture();f.controller.start(setting());await f.reply();assert.throws(()=>f.controller.update({...setting(),kind:'breath'}));assert.ok(f.sources.every(s=>s.disconnected));f.controller.dispose();assert.equal(f.worker.terminated,true);assert.throws(()=>f.controller.start(setting()));assert.equal(f.worker.onmessage,null);
});
test('start exception disconnects created nodes',async()=>{
 const f=fixture();f.context.createBufferSource=()=>{const s={connect(){},disconnect(){this.disconnected=true;},start(){throw new Error('start');},stop(){}};f.sources.push(s);return s;};f.controller.start(setting());await f.reply();assert.equal(f.errors.length,1);assert.ok(f.sources.every(s=>s.disconnected));
});

// Integrator-authored imported-source acceptance checks, not newly Kiro-generated.
const imported=(source, sampleRate=48000, sourceId='import-test-1')=>({kind:'import',sourceId,source,sampleRate,x:.2,y:.1,doorClosed:false});
test('import loop preserves every source frame plus full bounded tail at both rates',()=>{
 for(const rate of [24000,48000]){
  const source=new Float32Array(Math.round(rate*.113));
  for(let i=0;i<source.length;i++)source[i]=.3*Math.sin(i*.07);
  source[source.length-1]=.8;
  const settings=imported(source,rate),out=buildAudition(settings);
  const rendered=renderRecipe(source,rate,{version:1,doorClosed:false,trajectory:[{t:0,x:.2,y:.1},{t:source.length/rate,x:.2,y:.1}]});
  assert.equal(out.frames,source.length+1.5*rate);assert.equal(out.sourceId,settings.sourceId);
  const fade=Math.floor(.02*rate),expected=rendered.previewChannels.map(a=>Float32Array.from(a,(v,i)=>v*(i<fade?i/(fade-1):1)*(i>=a.length-fade?(a.length-1-i)/(fade-1):1)));
  assert.deepEqual(out.wavBytes,encodeWav(expected,rate));
  assert.ok(expected.some(a=>a.slice(source.length,source.length+Math.round(rate*.15)).some(v=>v!==0)),'tail contains decaying source, not truncation');
  assert.ok(!Object.hasOwn(out,'warmupMaxDifference'),'imports do not claim built-in cycle convergence');
 }
});
test('import keeps down-only normalization and supports full eight-second source',()=>{
 const s=imported(new Float32Array(48000*8).fill(1));s.x=0;s.y=0;
 const out=buildAudition(s);assert.equal(out.frames,48000*9.5);assert.ok(out.normalizationGain>0&&out.normalizationGain<1);
 const d=decodeWav(out.wavBytes);assert.ok(d.channels.every(a=>a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.951)));
});
test('import rejects invalid IDs, durations, samples, shared or non-float sources',()=>{
 const base=imported(new Float32Array([.1]));
 for(const source of [new Float32Array(),new Float32Array(8*48000+1),new Float32Array([NaN]),new Float32Array([Infinity]),new Float32Array([1.01]),[.1],new Float64Array([.1])])assert.throws(()=>buildAudition({...base,source}));
 for(const sourceId of ['', '   ', 'x'.repeat(129), 42])assert.throws(()=>buildAudition({...base,sourceId}));
 if(typeof SharedArrayBuffer!=='undefined')assert.throws(()=>buildAudition({...base,source:new Float32Array(new SharedArrayBuffer(4))}));
});
test('controller snapshots import bytes and source identity; updates cannot silently switch them',()=>{
 const source=new Float32Array([.2,.3]),f=fixture(),s=imported(source);
 f.controller.start(s);source[0]=.8;assert.equal(f.worker.sent[0].settings.source[0],Math.fround(.2));
 assert.throws(()=>f.controller.update(s),/Source change/);assert.equal(f.states.at(-1).state,'stopped');
 f.controller.start(imported(new Float32Array([.2,.3])));
 assert.throws(()=>f.controller.update(imported(new Float32Array([.2,.3]),48000,'different')),/Source change/);
 const g=fixture();g.controller.start(imported(new Float32Array([.2,.3])));assert.equal(g.controller.update({...imported(new Float32Array([.2,.3])),x:.8}),true);
});
test('controller binds imported response ID and length and rejects mismatched source',async()=>{
 const source=new Float32Array(480),s=imported(source),out=buildAudition(s);
 const decoded=decodeWav(out.wavBytes),buffer={numberOfChannels:2,sampleRate:48000,length:out.frames,duration:out.frames/48000,getChannelData:c=>decoded.channels[c]};
 const f=fixture(()=>Promise.resolve(buffer));f.controller.start(s);await f.reply(undefined,{result:out});assert.equal(f.sources.length,1);assert.equal(f.states.at(-1).state,'playing');
 f.controller.update({...s,x:.7});await f.reply(undefined,{result:{...out,sourceId:'wrong'}});assert.equal(f.errors.length,1);assert.ok(f.sources.every(n=>n.disconnected));
 const g=fixture(()=>Promise.resolve(buffer));g.controller.start(s);await g.reply(undefined,{result:{...out,frames:out.frames-1}});assert.equal(g.errors.length,1);assert.equal(g.sources.length,0);
});
test('import stop during decode and stale source response cannot restart',async()=>{
 const s=imported(new Float32Array(480)),out=buildAudition(s);let resolve;
 const f=fixture(()=>new Promise(r=>resolve=r));f.controller.start(s);const p=f.reply(undefined,{result:out});f.controller.stop();resolve({});await p;assert.equal(f.sources.length,0);
 const g=fixture();g.controller.start(s);const old=g.worker.sent[0];g.controller.stop();g.controller.start(imported(new Float32Array(480),48000,'new-source'));await g.reply(old,{result:out});assert.equal(g.sources.length,0);assert.equal(g.worker.sent.at(-1).settings.sourceId,'new-source');
});
