import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMotion,motionTrajectory} from './custom-motion.mjs';
import {validateRecipe} from './foley-engine.mjs';
const points=()=>[{x:.9,y:.1,t:0},{x:.1,y:.9,t:.25},{x:.1,y:.9,t:.75},{x:.8,y:.2,t:1}];
test('exact reversal and stationary dwell keep their original temporal fractions',()=>{
 const raw=points().map(p=>({...p,t:3+p.t*4})),copy=structuredClone(raw);
 const normalized=normalizeMotion(raw);assert.deepEqual(normalized,points());assert.deepEqual(raw,copy);
 const trajectory=motionTrajectory(normalized,2);assert.deepEqual(trajectory.map(p=>p.t),[0,.5,1.5,2]);
 assert.deepEqual(validateRecipe({version:2,echoAmount:.3,doorClosed:false,trajectory},2).trajectory,trajectory);
 normalized[0].x=0;assert.equal(raw[0].x,.9);
});
test('strict non-enumerable, noncanonical index and missing-value accessor rejection',()=>{
 for(const fn of [normalizeMotion,p=>motionTrajectory(p,1)]){
  for(const mutate of [p=>Object.defineProperty(p,'extra',{value:1}),p=>{p['01']=p[1];},p=>Object.defineProperty(p,'1',{value:p[1],enumerable:false}),p=>Object.defineProperty(p[1],'x',{value:.1,enumerable:false}),p=>Object.defineProperty(p[1],'x',{get:undefined,set:undefined,enumerable:true}),p=>Object.defineProperty(p,'1',{get(){throw new Error('CALLED');},enumerable:true})]){const p=points();mutate(p);assert.throws(()=>fn(p),e=>e instanceof Error && !e.message.includes('CALLED'));}
  for(const point of [null,undefined,3,'x',[]]){const p=points();p[1]=point;assert.throws(()=>fn(p));}
 }
});
test('null-prototype data accepted; precision collapse rejected on retiming',()=>{
 const p=points().map(v=>Object.assign(Object.create(null),v));assert.deepEqual(normalizeMotion(p),points());
 assert.throws(()=>motionTrajectory(points(),Number.MIN_VALUE),/Precision collapse/);
 assert.deepEqual(motionTrajectory(points(),1e-16).map(v=>v.t),[0,2.5e-17,7.5e-17,1e-16]);
});
