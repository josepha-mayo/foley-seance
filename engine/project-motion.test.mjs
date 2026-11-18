import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeProject,decodeProject} from './project-file.mjs';
const path=()=>[{t:0,x:.2,y:.3},{t:.4,x:.2,y:.3},{t:1,x:.8,y:.7}];
const base=()=>({source:new Float32Array([0,-0,.1,-.5]),label:'Owned source',demoKind:null,x:90,y:10,route:'cross',doorClosed:true});
const drawn=()=>({...base(),route:'drawn',echoAmount:.6,motionPoints:path()});
test('v3 preserves source bytes, dwell, normalized motion and independent cursor',async()=>{
 const input=drawn(),text=await encodeProject(input),out=await decodeProject(text);
 assert.equal(JSON.parse(text).version,3);assert.deepEqual(out,input);assert.notEqual(out.motionPoints,input.motionPoints);assert.notEqual(out.motionPoints[0],input.motionPoints[0]);assert.notEqual(out.source,input.source);assert.ok(Object.is(out.source[1],-0));
});
test('v3 takes owned path and source snapshot before digest await',async()=>{
 const p=drawn(),expected=structuredClone(p),pending=encodeProject(p);p.motionPoints[1].t=.9;p.motionPoints.push({t:1,x:0,y:0});p.source[2]=.9;
 assert.deepEqual(await decodeProject(await pending),expected);
});
test('legacy v1/v2 shape and serialization roundtrip unchanged',async()=>{
 for(const p of [base(),{...base(),echoAmount:.3}]){const text=await encodeProject(p);assert.equal(JSON.parse(text).version,Object.hasOwn(p,'echoAmount')?2:1);assert.deepEqual(await decodeProject(text),p);assert.equal(await encodeProject(await decodeProject(text)),text);}
});
test('v3 strict version route echo and field combinations',async()=>{
 const raw=JSON.parse(await encodeProject(drawn()));
 for(const patch of [{version:1},{version:2},{version:4},{route:'cross'},{echoAmount:.235},{echoAmount:null},{extra:1}])await assert.rejects(decodeProject(JSON.stringify({...raw,...patch})));
 for(const key of ['echoAmount','motionPoints']){const p={...raw};delete p[key];await assert.rejects(decodeProject(JSON.stringify(p)));}
 await assert.rejects(encodeProject({...base(),route:'drawn'}));await assert.rejects(encodeProject({...drawn(),route:'cross'}));
});
test('motion bound accepts 2 and 128 points, rejects empty single and 129',async()=>{
 for(const n of [2,128]){const p={...drawn(),motionPoints:Array.from({length:n},(_,i)=>({t:i/(n-1),x:.5,y:.5}))};assert.deepEqual((await decodeProject(await encodeProject(p))).motionPoints,p.motionPoints);}
 for(const n of [0,1,129])await assert.rejects(encodeProject({...drawn(),motionPoints:Array.from({length:n},(_,i)=>({t:i/(n-1),x:0,y:0}))}));
});
test('malformed path, order, range and descriptors fail without getters',async()=>{
 for(const points of [null,{},[{t:.1,x:0,y:0},{t:1,x:0,y:0}],[{t:0,x:0,y:0},{t:.9,x:0,y:0}],[{t:0,x:0,y:0},{t:0,x:0,y:0},{t:1,x:0,y:0}],[{t:0,x:0,y:0},{t:.7,x:0,y:0},{t:.6,x:0,y:0},{t:1,x:0,y:0}]])await assert.rejects(encodeProject({...drawn(),motionPoints:points}));
 for(const key of ['t','x','y'])for(const value of [NaN,Infinity,-Infinity,'0',null,true,-.1,1.1]){const points=path();points[1][key]=value;await assert.rejects(encodeProject({...drawn(),motionPoints:points}));}
 let called=false;const points=path();Object.defineProperty(points[1],'x',{get(){called=true;return 0;}});await assert.rejects(encodeProject({...drawn(),motionPoints:points}));assert.equal(called,false);
 const slots=path();Object.defineProperty(slots,'1',{get(){called=true;return path()[1];}});await assert.rejects(encodeProject({...drawn(),motionPoints:slots}));assert.equal(called,false);
 const sparse=path();delete sparse[1];await assert.rejects(encodeProject({...drawn(),motionPoints:sparse}));
 const extra=path();extra.foo=1;await assert.rejects(encodeProject({...drawn(),motionPoints:extra}));
 const hidden=path();Object.defineProperty(hidden[1],'x',{value:.5,enumerable:false});await assert.rejects(encodeProject({...drawn(),motionPoints:hidden}));
});
