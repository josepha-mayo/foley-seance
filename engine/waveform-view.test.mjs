import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveformView,cueFilename} from './waveform-view.mjs';
test('waveform view uses actual stereo peaks, source boundary and leaves PCM unchanged',()=>{
 const left=new Float32Array([0,.5,0,0,0]),right=new Float32Array([0,0,0,-.25,0]);const a=left.slice(),b=right.slice();
 const view=waveformView([left,right],2,2,5);assert.equal(view.peak,.5);assert.equal(view.sourceX,120);assert.equal(view.sourceSeconds,1);assert.equal(view.tailSeconds,1.5);assert.match(view.paths[0],/L90.000 5.000/);assert.match(view.paths[1],/L210.000 65.000/);assert.deepEqual(left,a);assert.deepEqual(right,b);
 const silent=waveformView([new Float32Array(4),new Float32Array(4)],2,2);assert.equal(silent.peak,0);assert.ok(!silent.paths.join('').includes('NaN'));
});
test('cue filename identifies source and scene without path characters',()=>{
 assert.equal(cueFilename('creak','cross',false,48000),'foley-creak-cross-open-48k.wav');
 assert.equal(cueFilename('../Écho room.WAV','approach',true,48000),'foley-echo-room-approach-muffled-48k.wav');
 assert.equal(cueFilename('🎵','unknown',false,48000),'foley-source-still-open-48k.wav');
});

test('drawn and timed cues retain their route in download filenames',()=>{
 for(const route of ['still','approach','retreat','cross','drawn']) {
  const staticName=cueFilename('creak',route,true,48000);
  const eventName=cueFilename('creak',route,true,48000,{doorEvent:true});
  assert.equal(staticName,`foley-creak-${route}-muffled-48k.wav`);
  assert.equal(eventName,`foley-creak-${route}-door-event-muffled-48k.wav`);
  assert.notEqual(staticName,eventName);
 }
 assert.equal(cueFilename('../bad.wav','../../route',false,48000,{doorEvent:true}),
  'foley-bad-still-door-event-open-48k.wav');
});
