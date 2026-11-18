// Actual playback preparation; no browser/system-preference qualification claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const start=app.slice(app.indexOf('function startPrepared('),app.indexOf('async function play('));
function harness(reduced){
 const state={plays:0,moves:[],updates:0,queue:[]},media={matches:reduced};
 const context={state:'running',currentTime:.25},buffer={duration:1};
 const sandbox={reducedMotion:media,createMonitorPlayer(){return {play(b){assert.equal(b,buffer);state.plays++;return {startedAt:0};}};},$:()=>({disabled:true}),document:{body:{classList:{add(){}}}},updateRoom(){state.updates++;},setGhost(x,y){state.moves.push([x,y]);},requestAnimationFrame(fn){state.queue.push(fn);}};
 vm.createContext(sandbox);vm.runInContext('let playbackId=1,player=null,monitor=null;'+start,sandbox);
 const recipe={trajectory:[{t:0,x:0,y:0},{t:1,x:1,y:1}]};
 return {state,media,start(){return sandbox.startPrepared(buffer,recipe,context,1);},tick(){state.queue.shift()?.();}};
}
test('reduced motion keeps real audio playback but schedules no ghost flight',()=>{const h=harness(true);assert.equal(h.start(),true);assert.equal(h.state.plays,1);assert.equal(h.state.queue.length,0);assert.equal(h.state.moves.length,0);});
test('normal preference keeps existing clock-aligned ghost animation',()=>{const h=harness(false);h.start();h.tick();assert.deepEqual(h.state.moves,[[.25,.25]]);assert.equal(h.state.queue.length,1);});
test('enabling reduced motion during playback stops visual loop without stopping audio',()=>{const h=harness(false);h.start();h.tick();h.media.matches=true;h.tick();assert.equal(h.state.queue.length,0);assert.equal(h.state.moves.length,1);assert.equal(h.state.updates,1);assert.equal(h.state.plays,1);});
