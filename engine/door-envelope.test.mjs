import test from 'node:test';
import assert from 'node:assert/strict';
import {createDoorEnvelope,checkedDoorEvent,doorClosedAmount} from './door-envelope.mjs';
import {renderRecipe,validateRecipe,decodeWav} from './foley-engine.mjs';
const recipe=(closed=true,at=.5,echoAmount=.3,duration=1)=>({version:3,doorClosed:closed,echoAmount,doorEvent:{at},trajectory:[{t:0,x:.4,y:.2},{t:duration,x:.6,y:.2}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} vs ${b}`);
for(const closed of [true,false])test(`door envelope exact bounds and tail: ${closed}`,()=>{
 const f=createDoorEnvelope(closed,{at:.5},1),initial=Number(closed);
 assert.equal(f(0),initial);assert.equal(f(.5),initial);near(f(.575),.5);assert.equal(f(.65),1-initial);assert.equal(f(2.5),1-initial);
 near(createDoorEnvelope(closed,{at:.9},1)(.95),.5);
 assert.equal(createDoorEnvelope(closed,{at:0},1)(0),initial);
 near(createDoorEnvelope(closed,{at:0},1)(.075),.5);
 const tiny=createDoorEnvelope(closed,{at:.5},1/48000);assert.equal(tiny(1/48000),1-initial);
 const stat=createDoorEnvelope(closed,null,1);assert.equal(stat(100),initial);
});
test('envelope snapshots event and visual helper matches',()=>{
 const r=recipe(),f=createDoorEnvelope(true,r.doorEvent,1);r.doorEvent.at=.8;near(f(.575),.5);
 for(const closed of [false,true])for(const at of [0,.1,.5,.9])for(const t of [0,.2,.5,.6,1,2])assert.equal(doorClosedAmount(recipe(closed,at),t,1),createDoorEnvelope(closed,{at},1)(t));
 for(const version of [1,2])assert.equal(doorClosedAmount({version,doorClosed:true},1,1),1);
});
test('strict event validation rejects malformed data without invoking getter',()=>{
 for(const e of [null,undefined,[],{},{at:-.1},{at:1},{at:NaN},{at:Infinity},{at:'0.5'},{at:.5,extra:1},{at:.5,[Symbol()]:0},Object.create({at:.5})])assert.throws(()=>checkedDoorEvent(e));
 let invoked=false;assert.throws(()=>checkedDoorEvent({get at(){invoked=true;return .5;}}));assert.equal(invoked,false);
 for(const d of [0,-1,Infinity,NaN,9])assert.throws(()=>createDoorEnvelope(true,{at:.5},d));
 for(const t of [-1,NaN,Infinity])assert.throws(()=>createDoorEnvelope(true,{at:.5},1)(t));
 assert.throws(()=>createDoorEnvelope(1,{at:.5},1));assert.throws(()=>doorClosedAmount({...recipe(),doorEvent:null},0,1));
});
test('recipe v3 requires event and echo; legacy rejects event; validation deep copies',()=>{
 for(const key of ['echoAmount','doorEvent']){const r=recipe();delete r[key];assert.throws(()=>validateRecipe(r,1));}
 for(const echoAmount of [-.1,.61,NaN])assert.throws(()=>validateRecipe(recipe(true,.5,echoAmount),1));
 const r=recipe();for(const version of [1,2])assert.throws(()=>validateRecipe({...r,version},1));
 const v=validateRecipe(r,1);r.doorEvent.at=.7;assert.equal(v.doorEvent.at,.5);
});
for(const rate of [24000,48000])for(const closed of [false,true])test(`render prefix and reproducible output ${rate}/${closed}`,()=>{
 const source=Float32Array.from({length:rate},(_,i)=>.1*Math.sin(i*.31));
 const r=recipe(closed),result=renderRecipe(source,rate,r);
 const legacy={...r,version:2};delete legacy.doorEvent;
 const reference=renderRecipe(source,rate,legacy);
 assert.equal(result.normalizationGain,1);assert.equal(reference.normalizationGain,1);
 assert.deepEqual(result.wavBytes.subarray(44,44+4*(rate/2+1)),reference.wavBytes.subarray(44,44+4*(rate/2+1)));
 assert.notDeepEqual(result.wavBytes,reference.wavBytes);
 assert.deepEqual(result.wavBytes,renderRecipe(source,rate,r).wavBytes);
 assert.deepEqual(result.previewChannels,decodeWav(result.wavBytes).channels);
 assert.notDeepEqual(renderRecipe(source,rate,recipe(closed,.5,0)).wavBytes,renderRecipe(source,rate,recipe(closed,.5,.6)).wavBytes);
 for(const channel of result.previewChannels)assert.ok(channel.every(v=>Number.isFinite(v)&&Math.abs(v)<=.951));
});
test('one-sample source renders bounded shortened event without changing output duration',()=>{
 const duration=1/48000,result=renderRecipe(Float32Array.of(.2),48000,recipe(true,.9,0,duration));
 assert.equal(result.outputFrames,72001);assert.equal(result.recipe.doorEvent.at,.9);
});
