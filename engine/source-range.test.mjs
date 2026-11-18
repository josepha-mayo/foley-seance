import {canonicalWavDuration} from './wav-additive.mjs';
// Actual installSource + import handler, modeled browser decoder and DOM.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {encodeProject,decodeProject} from './project-file.mjs';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const install=app.slice(app.indexOf('function validateSourceLabel('),app.indexOf('function selectDemo('));
const handler=app.slice(app.indexOf("$('source-file').addEventListener('change'"),app.indexOf('async function audioContext()'));
function harness(channels,label='float.wav'){
 let change;const file={name:label,size:100,arrayBuffer:async()=>new ArrayBuffer(4)};
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',files:[file],textContent:'',addEventListener(_,fn){change=fn;}});return nodes.get(id);};
 const state={revoked:0,locked:false,message:'',decoded:0};
 const sandbox={canonicalWavDuration,Float32Array,RATE:48000,$:node,document:{querySelectorAll:()=>[]},
 OfflineAudioContext:function(){this.decodeAudioData=async()=>{state.decoded++;return ({length:channels[0].length,numberOfChannels:channels.length,getChannelData:i=>channels[i]});};},
 stopAudition(){},stopPlayback(){},updateRoom(){},controls(value){state.locked=value;},status(message){state.message=message;},discardCue(){state.revoked++;}};
 vm.createContext(sandbox);
 vm.runInContext("let source=new Float32Array([.25]),sourceLabel='old.wav',demoKind=null,sourceGeneration=4,loadId=0,busy=false,drawingArmed=false;"+install+handler,sandbox);
 return {state,notice:()=>node('source-notice').textContent,async run(){await change();},snapshot(){return vm.runInContext('({source:[...source],sourceLabel,sourceGeneration})',sandbox);}};
}
for(const amplitude of [1.00001,-1.00001,2,-2,Infinity,NaN])test(`invalid decoded mono amplitude ${amplitude} retains source and cue`,async()=>{
 const h=harness([[amplitude]]);await h.run();assert.equal(h.state.revoked,0);assert.equal(h.snapshot().sourceLabel,'old.wav');assert.equal(h.snapshot().sourceGeneration,4);assert.equal(h.snapshot().source[0],.25);assert.equal(h.state.locked,false);assert.match(h.state.message,/Previous source, room settings and rendered cue retained/);
 if(Number.isFinite(amplitude))assert.match(h.state.message,/Lower its level.*not been clipped or normalized/);
});
test('exact normalized bounds remain accepted without changing samples',async()=>{const h=harness([[-1,0,1]]);await h.run();assert.equal(h.state.revoked,1);assert.deepEqual(Array.from(h.snapshot().source),[-1,0,1]);assert.equal(h.snapshot().sourceLabel,'float.wav');});
test('validation follows stereo downmix; supported mono result remains unchanged',async()=>{const h=harness([[1.5,-1.5],[.5,-.5]]);await h.run();assert.equal(h.state.revoked,1);assert.deepEqual(Array.from(h.snapshot().source),[1,-1]);});
test('stereo downmix outside range cannot replace the previous cue',async()=>{const h=harness([[1.5],[1]]);await h.run();assert.equal(h.state.revoked,0);assert.equal(h.snapshot().sourceLabel,'old.wav');assert.match(h.state.message,/supported audio range/);});

for(const label of ['x'.repeat(205),'bad\nname.wav','bad\tname.wav','bad\x7fname.wav','  '])test('unsupported imported label preserves previous savable source: '+JSON.stringify(label),async()=>{
 const h=harness([[.3]],label);await h.run();assert.equal(h.state.revoked,0);assert.equal(h.state.decoded,0);const saved=h.snapshot();assert.equal(saved.sourceLabel,'old.wav');assert.equal(saved.sourceGeneration,4);assert.equal(saved.source[0],.25);assert.match(h.state.message,/Rename the audio file to 1–200 characters/);assert.match(h.state.message,/Previous source, room settings and rendered cue retained/);
 const encoded=await encodeProject({source:new Float32Array(saved.source),label:saved.sourceLabel,demoKind:null,x:50,y:50,route:'still',doorClosed:false});assert.equal((await decodeProject(encoded)).label,'old.wav');
});
for(const label of ['x'.repeat(200),'ordinary.wav','音の扉.wav'])test('accepted imported label can be saved and reopened: '+label.slice(0,30),async()=>{
 const h=harness([[.3]],label);await h.run();assert.equal(h.state.revoked,1);const saved=h.snapshot();assert.equal(saved.sourceLabel,label);
 const encoded=await encodeProject({source:new Float32Array(saved.source),label:saved.sourceLabel,demoKind:null,x:50,y:50,route:'still',doorClosed:false});assert.equal((await decodeProject(encoded)).label,label);
});

for(const [name,channels,expected] of [
 ['zero mono',[[0,0,0]],/only zero samples/],
 ['zero stereo',[[0,0],[0,0]],/only zero samples/],
 ['opposing stereo',[[.5,-.25],[-.5,.25]],/Averaging your channels to mono produced digital silence/],
 ['normal stereo',[[.5,.25],[.25,.5]],/^$/],
 ['mono',[[.5,-.5]],/^$/],
 ['quiet mono',[[1e-30]],/^$/],
 ['almost opposing',[[.5],[-.499999]],/^$/]
])test('source notice: '+name,async()=>{const h=harness(channels);await h.run();assert.match(h.notice(),expected);assert.equal(h.state.revoked,1);const saved=h.snapshot();const encoded=await encodeProject({source:new Float32Array(saved.source),label:saved.sourceLabel,demoKind:null,x:50,y:50,route:'still',doorClosed:false});assert.deepEqual(Array.from((await decodeProject(encoded)).source),Array.from(saved.source));});
test('source notice survives failed replacement and clears on valid nonsilent replacement',async()=>{const channels=[[0,0]];const h=harness(channels);await h.run();const notice=h.notice();channels[0]=[NaN];await h.run();assert.equal(h.notice(),notice);channels[0]=[.1];await h.run();assert.equal(h.notice(),'');});
