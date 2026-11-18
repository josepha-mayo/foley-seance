// Actual reference-slot functions and handlers; DOM/audio modeled.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
function harness(){
 const elements=new Map(),events=[],played=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,textContent:'',open:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},focus(){events.push('focus:'+id);}});return elements.get(id);};
 const sandbox={$: $,status:m=>events.push(m),stopAudition:()=>{},stopPlayback:()=>{},play:async b=>{played.push(b);return true;},setTimeout:fn=>fn()};vm.createContext(sandbox);
 vm.runInContext(`let busy=false,drawingArmed=false,current=null,referenceTake=null,referencePlayback=false,sourceLabel='Synthetic creak',source={length:57600}; const RATE=48000;`+app.slice(app.indexOf('function refreshReference('),app.indexOf('function discardCue('))+app.slice(app.indexOf("$('keep-reference').addEventListener"),app.indexOf("$('play-wet').addEventListener")),sandbox);
 return {$,events,played,run:s=>vm.runInContext(s,sandbox),click:async id=>$(id).handlers.click(),setCue(){vm.runInContext("current={buffer:{duration:2.7,id:'old'},bytes:new Uint8Array(20),recipe:{doorClosed:true,doorEvent:{at:.5}}}",sandbox);}};
}
test('keeping reference retains only immutable rendered buffer and meaningful label without autoplay',async()=>{const h=harness();h.setCue();await h.click('keep-reference');assert.equal(h.run('referenceTake.buffer===current.buffer'),true);assert.deepEqual(Array.from(h.run('Object.keys(referenceTake)')),['buffer','label']);assert.match(h.$('reference-note').textContent,/0.60 s/);assert.equal(h.played.length,0);});
test('reference survives current cue invalidation and plays old buffer without room recipe',async()=>{const h=harness();h.setCue();await h.click('keep-reference');h.run('current=null;refreshReference()');assert.equal(h.$('play-reference').disabled,false);await h.click('play-reference');assert.equal(h.played[0].id,'old');assert.equal(h.run('referencePlayback'),true);});
test('reference replacement is explicit and cancel preserves old reference',async()=>{const h=harness();h.setCue();await h.click('keep-reference');h.run("current={buffer:{duration:3,id:'new'},recipe:{doorClosed:false}}");await h.click('keep-reference');assert.equal(h.$('reference-confirm').open,true);await h.click('reference-cancel');assert.equal(h.run('referenceTake.buffer.id'),'old');await h.click('keep-reference');await h.click('reference-replace');assert.equal(h.run('referenceTake.buffer.id'),'new');});
test('clear reference leaves current cue and source unchanged and stops playback',async()=>{const h=harness();h.setCue();await h.click('keep-reference');await h.click('clear-reference');assert.equal(h.run('referenceTake'),null);assert.equal(h.run('current.buffer.id'),'old');assert.equal(h.$('play-reference').disabled,true);});
test('busy and drawing lock actions including dispatched clicks',async()=>{const h=harness();h.setCue();h.run('busy=true;refreshReference()');await h.click('keep-reference');assert.equal(h.run('referenceTake'),null);h.run('busy=false;drawingArmed=true');await h.click('keep-reference');assert.equal(h.run('referenceTake'),null);});
test('successful source replacement clears slot only after all source validation',()=>{const body=app.slice(app.indexOf('function installSource('),app.indexOf('function selectDemo('));assert.ok(body.indexOf('referenceTake=null')>body.indexOf('The decoded mono sound exceeds'));assert.ok(body.indexOf('referenceTake=null')>body.indexOf('validateSourceLabel(label)'));assert.match(body,/discardCue\(/);});

test('actual installSource rejects invalid input without clearing reference then clears on valid source',()=>{
 const h=harness();h.setCue();h.run('keepReference()');
 h.run("globalThis.Float32Array=globalThis.Float32Array; let sourceGeneration=0,demoKind='creak'; function discardCue(){current=null;refreshReference();} function updateRoom(){} function controls(){} ");
 const functions=app.slice(app.indexOf('function validateSourceLabel('),app.indexOf('function selectDemo('));
 // Execute in same modeled application lexical scope.
 h.run(functions);
 assert.throws(()=>h.run("installSource(new Float32Array([0]),'x'.repeat(201))"),/Rename/);
 assert.equal(h.run('referenceTake.buffer.id'),'old');
 assert.throws(()=>h.run("installSource(new Float32Array([2]),'valid')"),/supported audio range/);
 assert.equal(h.run('referenceTake.buffer.id'),'old');
 h.run("installSource(new Float32Array([0]),'valid')");assert.equal(h.run('referenceTake'),null);
});
