import {canonicalWavDuration} from './wav-additive.mjs';
// Actual import handler under modeled file/decode dependencies, not native evidence.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const labelGuard=app.slice(app.indexOf('function validateSourceLabel('),app.indexOf('function installSource('));
const handler=app.slice(app.indexOf("$('source-file').addEventListener('change'"),app.indexOf('async function audioContext()'));
function harness(){
 let callback; const node={files:[],value:'selected',addEventListener(_,fn){callback=fn;}};
 const state={cue:'old-cue',source:'old-source',settings:'old-settings',locked:false,revoked:0,stops:0,installed:0};
 let decode=()=>Promise.reject(new Error('invalid audio'));
 const sandbox={canonicalWavDuration,Float32Array,RATE:48000,$:()=>node,document:{querySelectorAll:()=>[]},
 OfflineAudioContext:function(){this.decodeAudioData=(bytes)=>decode(bytes);},
 stopAudition(){},stopPlayback(){state.stops++;},controls(value){state.locked=value;},status(message){state.message=message;},
 installSource(mono,label){for(const n of mono)if(!Number.isFinite(n))throw new Error('invalid samples');state.source=label;state.cue=null;state.revoked++;state.installed++;state.samples=mono;},
 discardCue(){state.cue=null;state.revoked++;}};
 vm.createContext(sandbox);vm.runInContext('let loadId=0,busy=false,drawingArmed=false;'+labelGuard+handler,sandbox);
 return {state,node,setBusy(value){vm.runInContext('busy='+Boolean(value),sandbox);},setDrawing(value){vm.runInContext('drawingArmed='+Boolean(value),sandbox);},setDecode(fn){decode=fn;},select(file={name:'new.wav',size:10,arrayBuffer:async()=>new ArrayBuffer(4)}){node.files=[file];return callback();}};
}
function buffer(channels=[[1,0,-1]]){return {length:channels[0].length,numberOfChannels:channels.length,getChannelData:i=>channels[i]};}
test('decode rejection retains existing cue, source, settings and unlocks',async()=>{const h=harness();await h.select();assert.equal(h.state.cue,'old-cue');assert.equal(h.state.source,'old-source');assert.equal(h.state.settings,'old-settings');assert.equal(h.state.revoked,0);assert.equal(h.state.locked,false);assert.equal(h.node.value,'');});
test('oversized input never reads or decodes and retains cue',async()=>{const h=harness();await h.select({size:12*1024*1024+1,arrayBuffer(){throw new Error('must not read');}});assert.match(h.state.message,/12 MB/);assert.equal(h.state.revoked,0);});
test('overlong decoded sound retains cue',async()=>{const h=harness();h.setDecode(async()=>({length:384001}));await h.select();assert.match(h.state.message,/8 seconds/);assert.equal(h.state.cue,'old-cue');});
test('valid input replaces only after decode and averages stereo',async()=>{const h=harness();let resolve;h.setDecode(()=>new Promise(r=>resolve=r));const p=h.select();await new Promise(r=>setImmediate(r));assert.equal(h.state.cue,'old-cue');assert.equal(h.state.locked,true);resolve(buffer([[1,0,-1],[0,1,1]]));await p;assert.equal(h.state.cue,null);assert.equal(h.state.installed,1);assert.deepEqual([...h.state.samples],[.5,.5,0]);assert.equal(h.state.settings,'old-settings');});
test('older decode completion cannot replace newer source or unlock current import',async()=>{const h=harness();const pending=[];h.setDecode(()=>new Promise(r=>pending.push(r)));const a=h.select();await new Promise(r=>setImmediate(r));const b=h.select({name:'latest.wav',size:1,arrayBuffer:async()=>new ArrayBuffer(1)});await new Promise(r=>setImmediate(r));pending[0](buffer());await a;assert.equal(h.state.installed,0);assert.equal(h.state.locked,true);pending[1](buffer());await b;assert.equal(h.state.source,'latest.wav');assert.equal(h.state.installed,1);});
test('older decode failure cannot overwrite newer success status or source',async()=>{const h=harness();let reject;h.setDecode(()=>new Promise((_,r)=>reject=r));const a=h.select();await new Promise(r=>setImmediate(r));h.setDecode(async()=>buffer());await h.select({name:'latest.wav',size:1,arrayBuffer:async()=>new ArrayBuffer(1)});const message=h.state.message;reject(new Error('old error'));await a;assert.equal(h.state.source,'latest.wav');assert.equal(h.state.message,message);});
test('invalid samples do not commit source or revoke current cue',async()=>{const h=harness();h.setDecode(async()=>buffer([[NaN]]));await h.select();assert.equal(h.state.cue,'old-cue');assert.equal(h.state.installed,0);});

test('queued file change during rendering is ignored without disturbing cue or playback',async()=>{const h=harness();h.setBusy(true);await h.select();assert.equal(h.state.stops,0);assert.equal(h.state.installed,0);assert.equal(h.state.cue,'old-cue');assert.equal(h.node.value,'');});
test('queued file change during path drawing is ignored without disturbing the gesture',async()=>{const h=harness();h.setDrawing(true);await h.select();assert.equal(h.state.stops,0);assert.equal(h.state.installed,0);assert.equal(h.state.cue,'old-cue');assert.equal(h.node.value,'');});

test('canonical overlong WAV rejects before native decode and retains cue',async()=>{const bytes=new ArrayBuffer(44+16000*9),v=new DataView(bytes),u=new Uint8Array(bytes);for(const [p,s]of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']])for(let i=0;i<s.length;i++)u[p+i]=s.charCodeAt(i);for(const[p,n]of [[4,bytes.byteLength-8],[16,16],[24,8000],[28,16000],[40,bytes.byteLength-44]])v.setUint32(p,n,true);for(const[p,n]of [[20,1],[22,1],[32,2],[34,16]])v.setUint16(p,n,true);const h=harness();let decoded=0;h.setDecode(async()=>{decoded++;return buffer();});await h.select({name:'long.wav',size:bytes.byteLength,arrayBuffer:async()=>bytes});assert.equal(decoded,0);assert.equal(h.state.cue,'old-cue');assert.equal(h.state.locked,false);assert.match(h.state.message,/8 seconds/);});
