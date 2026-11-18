// Integrator tests of actual app helper code under a deterministic audio/DOM model.
// These are race tests, not native browser or perceptual listening evidence.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const retire=app.slice(app.indexOf('function retireListen()'),app.indexOf('let audition ='));
const stop=app.slice(app.indexOf('function stopPlayback()'),app.indexOf('function discardCue('));
const helper=app.slice(app.indexOf('async function audioContext()'),app.indexOf("$('stop').addEventListener"));
function harness(){
 let resolve,reject;const resume=new Promise((a,b)=>{resolve=a;reject=b;});let plays=0,stops=0,fail=false,onEnded=null;
 const el={disabled:true},timers=new Map();let serial=0;
 const ctx={state:'suspended',currentTime:0,resume:()=>resume};
 const sandbox={AudioContext:function(){return ctx;},RATE:48000,setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);},
  createMonitorPlayer:(_ctx,options)=>{onEnded=options.onEnded;return {play(){if(fail)throw new Error('output disconnected');plays++;return {startedAt:0};},stop(){stops++;}};},
  document:{body:{classList:{add(){},remove(){}}}},requestAnimationFrame(){},$:()=>el,updateRoom(){},setGhost(){},status(message){sandbox.message=message;}};
 vm.createContext(sandbox);
 vm.runInContext(`let referencePlayback=false,context=null,monitor=null,player=null,playbackId=0,revision=0,current=null,pendingListen=null;${retire}\n${stop}\n${helper}\nglobalThis.api={begin:()=>beginListen(revision),publish:i=>{current={buffer:{duration:1},recipe:{trajectory:[]}};i.cue=current;maybeListen(i);},stop:stopPlayback,change:()=>{revision++;stopPlayback();current=null;},hasCue:()=>!!current,pending:()=>!!pendingListen,play:()=>play({duration:1}),reference:()=>{referencePlayback=true;}};`,sandbox);
 return {api:sandbox.api,el,get plays(){return plays;},get message(){return sandbox.message;},get stops(){return stops;},ready(){ctx.state='running';resolve(ctx);},reject(){reject(new Error('denied'));},expire(){for(const fn of [...timers.values()])fn();},fail(){fail=true;},end(){onEnded?.();}};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
test('ready audio waits for validated cue, then starts exactly once',async()=>{const h=harness(),i=h.api.begin();assert.equal(h.el.disabled,false);h.ready();await flush();assert.equal(h.plays,0);h.api.publish(i);h.api.publish(i);assert.equal(h.plays,1);assert.equal(h.api.hasCue(),true);});
test('Stop before resume cancels listening but does not invalidate later valid render',async()=>{const h=harness(),i=h.api.begin();h.api.stop();h.ready();await flush();h.api.publish(i);assert.equal(h.plays,0);assert.equal(h.api.hasCue(),true);assert.equal(h.el.disabled,true);});
test('resume rejection is handled and preserves validated download cue',async()=>{const h=harness(),i=h.api.begin();h.reject();await flush();h.api.publish(i);assert.equal(h.plays,0);assert.equal(h.api.hasCue(),true);assert.match(h.message,/Cue ready; playback unavailable/);});
test('three-second resume expiry cannot start later; valid cue is retained',async()=>{const h=harness(),i=h.api.begin();h.api.publish(i);h.expire();h.ready();await flush();assert.equal(h.plays,0);assert.equal(h.api.hasCue(),true);assert.match(h.message,/within 3 seconds/);});
test('settings cancellation after resume before render cannot restart sound',async()=>{const h=harness(),i=h.api.begin();h.ready();await flush();h.api.change();h.api.publish(i);assert.equal(h.plays,0);});
test('monitor output failure keeps rendered cue and enables explicit retry',async()=>{const h=harness(),i=h.api.begin();h.fail();h.ready();await flush();h.api.publish(i);assert.equal(h.plays,0);assert.equal(h.api.hasCue(),true);assert.match(h.message,/output disconnected/);assert.equal(h.api.pending(),false);});
test('explicit replay pending resume is also cancelled by Stop',async()=>{const h=harness(),p=h.api.play();assert.equal(h.el.disabled,false);h.api.stop();h.ready();await flush();assert.equal(await p,false);assert.equal(h.plays,0);});

test('natural finish replaces playing status after current cue playback',async()=>{const h=harness(),i=h.api.begin();h.ready();await flush();h.api.publish(i);h.end();assert.match(h.message,/Playback finished/);assert.equal(h.el.disabled,true);});
test('older completion does not overwrite a newer pending listen intent',async()=>{const h=harness(),i=h.api.begin();h.ready();await flush();h.api.publish(i);const previous=h.message;h.api.begin();h.end();assert.equal(h.message,previous);assert.equal(h.el.disabled,false);});

test('reference completion is distinct from current export completion',async()=>{const h=harness();h.ready();await h.api.play();h.api.reference();h.end();assert.match(h.message,/Reference finished/);});
test('pending reference-style playback is cancelled before resume by source/edit stop',async()=>{const h=harness();const pending=h.api.play();h.api.stop();h.ready();await pending;assert.equal(h.plays,0);});
