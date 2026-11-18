import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeProject,decodeProject,MAX_PROJECT_BYTES} from './project-file.mjs';
import {createDemoSource} from './foley-engine.mjs';
const project=(source=new Float32Array([0,-0,.25,-.75,1,-1]))=>({source,label:'Synthetic test source',demoKind:null,x:27,y:91,route:'cross',doorClosed:true});
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
test('exact imported float32 source and settings survive owned round trip',async()=>{
 const input=project(),text=await encodeProject(input),out=await decodeProject(text);
 assert.deepEqual(out,input);assert.notEqual(out.source,input.source);assert.ok(Object.is(out.source[1],-0));
 out.source[2]=.8;assert.equal(input.source[2],.25);
 const raw=JSON.parse(text);assert.equal(raw.sampleRate,48000);assert.equal(raw.encoding,'float32-le');assert.equal(raw.sourceFrames,6);
});
test('save snapshots source and settings before asynchronous digest',async()=>{
 const input=project(),pending=encodeProject(input);input.source[2]=.9;input.x=99;const out=await decodeProject(await pending);assert.equal(out.source[2],.25);assert.equal(out.x,27);
});
test('all exact built-ins retain semantic kind; forged kind rejected',async()=>{
 for(const kind of ['tap','creak','breath']){const p={...project(createDemoSource(48000,kind)),demoKind:kind};assert.equal((await decodeProject(await encodeProject(p))).demoKind,kind);p.source[0]=.4321;await assert.rejects(encodeProject(p),/Demo label/);}
 const raw=JSON.parse(await encodeProject(project()));raw.demoKind='creak';await assert.rejects(decodeProject(JSON.stringify(raw)),/Demo label/);
});
test('maximum 8 second source round trips within explicit 3 MB limit',async()=>{
 const source=new Float32Array(48000*8);source[0]=-.25;source[source.length-1]=.75;
 const text=await encodeProject(project(source));assert.ok(new TextEncoder().encode(text).length<MAX_PROJECT_BYTES);const out=await decodeProject(text);assert.deepEqual(out.source,source);
});
test('corrupt source bytes, digest and noncanonical base64 fail before returning data',async()=>{
 const raw=JSON.parse(await encodeProject(project()));
 for(const mutate of [o=>o.sourceBase64='A'+o.sourceBase64.slice(1),o=>o.sourceSha256='0'.repeat(64),o=>o.sourceBase64+='AAAA',o=>o.sourceBase64='!'+o.sourceBase64.slice(1)]){
  const value=structuredClone(raw);mutate(value);
  if(JSON.stringify(value)===JSON.stringify(raw))value.sourceBase64='B'+value.sourceBase64.slice(1);
  await assert.rejects(decodeProject(JSON.stringify(value)));
 }
 const one=JSON.parse(await encodeProject(project(new Float32Array([0]))));one.sourceBase64='AAAAAB==';await assert.rejects(decodeProject(JSON.stringify(one)),/Noncanonical/);
});
test('malformed float values remain rejected even with recomputed valid checksum',async()=>{
 const raw=JSON.parse(await encodeProject(project()));
 for(const value of [NaN,Infinity,-Infinity,1.1,-1.1]){
  const bytes=Uint8Array.from(atob(raw.sourceBase64),c=>c.charCodeAt(0));new DataView(bytes.buffer).setFloat32(0,value,true);
  const altered={...raw,sourceBase64:btoa(String.fromCharCode(...bytes)),sourceSha256:await digest(bytes)};
  await assert.rejects(decodeProject(JSON.stringify(altered)),/Invalid project source sample/);
 }
});
test('schema, size, sample rate, settings and labels are strictly bounded',async()=>{
 const raw=JSON.parse(await encodeProject(project()));
 for(const patch of [{version:2},{sampleRate:24000},{encoding:'url'},{sourceFrames:0},{sourceFrames:384001},{x:1.5},{x:-1},{y:101},{route:'javascript:alert(1)'},{doorClosed:1},{demoKind:'unknown'},{label:''},{label:'x'.repeat(201)},{label:'bad\nlabel'},{extra:'not allowed'}])await assert.rejects(decodeProject(JSON.stringify({...raw,...patch})));
 await assert.rejects(decodeProject(' '.repeat(MAX_PROJECT_BYTES+1)),/3 MB/);
 await assert.rejects(decodeProject('💀'.repeat(Math.ceil(MAX_PROJECT_BYTES/4)+1)),/3 MB/);
 await assert.rejects(decodeProject('{oops'));await assert.rejects(decodeProject('null'));
 const polluted=JSON.stringify(raw).slice(0,-1)+',"__proto__":{"polluted":true}}';await assert.rejects(decodeProject(polluted));assert.equal({}.polluted,undefined);
});
test('encode rejects invalid source and accessor objects without invoking getters',async()=>{
 for(const source of [new Float32Array(),new Float32Array(384001),new Float32Array([NaN]),new Float32Array([1.1]),[.1]])await assert.rejects(encodeProject(project(source)));
 let called=false;const input=project();Object.defineProperty(input,'label',{get(){called=true;return'x';}});await assert.rejects(encodeProject(input));assert.equal(called,false);
 if(typeof SharedArrayBuffer!=='undefined')await assert.rejects(encodeProject(project(new Float32Array(new SharedArrayBuffer(4)))));
});
