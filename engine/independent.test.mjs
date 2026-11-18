import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderRecipe,encodeWav,decodeWav,validateRecipe} from './foley-engine.mjs';
const rate=24000;
const recipe=(n,x=0.5,y=0,doorClosed=false)=>({version:1,doorClosed,trajectory:[{t:0,x,y},{t:n/rate,x,y}]});
test('independent: PCM contract and endpoint values',()=>{
 const a=new Float32Array([-1,-0.5,0,0.5,1]);
 const w=encodeWav([a,a],rate);const d=decodeWav(w);
 assert.equal(w.length,64);assert.equal(d.channels[0][0],-1);assert.equal(d.channels[1][4],1); // Native Chrome PCM16 convention verified in actual browser.
 for(const bad of [0,22050,44100,NaN,Infinity,'24000']) assert.throws(()=>encodeWav([a,a],bad));
 const bad=w.slice();const v=new DataView(bad.buffer);v.setUint32(24,22050,true);v.setUint32(28,88200,true);assert.throws(()=>decodeWav(bad));
});
test('independent: no clipping before normalization and tail ends at zero',()=>{
 const a=new Float32Array(rate).fill(1);const result=renderRecipe(a,rate,recipe(a.length,0));
 assert.ok(result.normalizationGain<0.94,'must measure unclipped peak above1');
 assert.equal(result.outputFrames,a.length+36000);
 for(const channel of result.previewChannels){assert.equal(channel.at(-1),0);for(const x of channel)assert.ok(Number.isFinite(x)&&Math.abs(x)<=0.951);}
 const decoded=decodeWav(result.wavBytes);assert.deepEqual(result.previewChannels,decoded.channels);
 assert.ok(result.previewChannels[0].slice(a.length).some(x=>Math.abs(x)>0));
});
test('independent: data descriptors rejected without invoking getters',()=>{
 let hits=0;const r=recipe(10);Object.defineProperty(r,'doorClosed',{get(){hits++;return false},enumerable:true});assert.throws(()=>validateRecipe(r,10/rate));assert.equal(hits,0);
});
test('independent: max duration and both sample rates',()=>{
 for(const sr of [24000,48000]){const a=new Float32Array(sr*8);const r={version:1,doorClosed:false,trajectory:[{t:0,x:0,y:0},{t:8,x:1,y:1}]};const out=renderRecipe(a,sr,r);assert.equal(out.outputFrames,sr*9.5);assert.ok(out.previewChannels[0].every(x=>x===0));assert.equal(out.normalizationGain,1);assert.throws(()=>renderRecipe(new Float32Array(sr*8+1),sr,r));}
});
