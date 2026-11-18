import {canonicalWavDuration} from './engine/wav-additive.mjs';
import {motionTrajectory} from './engine/custom-motion.mjs';
import {createMotionStroke} from './engine/motion-stroke.mjs';
import {createMonitorPlayer} from './engine/monitor-player.mjs';
import {encodeProject,decodeProject,MAX_PROJECT_BYTES} from './engine/project-file.mjs';
import {waveformView,cueFilename} from './engine/waveform-view.mjs';
import { createAuditionController } from './engine/audition-controller.mjs';
import { createDemoSource, renderRecipe, doorClosedAmount } from './engine/foley-engine.mjs';

const $ = id => document.getElementById(id);
const RATE = 48000;
let lastProjectDownload = null;
let source, sourceLabel = '', revision = 0, current = null, url = null;
let context = null, monitor = null, player = null, playbackId = 0, busy = false, loadId = 0;
let doorClosed = false;
let referenceTake = null, referencePlayback=false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addEventListener('change',event=>{if(event.matches)updateRoom();});
let motionPoints=null, drawingArmed=false, motionDraft=null, motionTimer=null, motionSampler=null, motionPointerId=null, motionLatest=null, strokeSeconds=null;
// Integrator-authored explicit gesture intent. It never owns or changes WAV bytes.
let pendingListen = null;
function retireListen() {
  if (pendingListen) clearTimeout(pendingListen.timer);
  pendingListen = null;
}
let audition = null, auditionActive = false, auditionEpoch = 0, demoKind = null, sourceGeneration = 0;
const status = message => { $('status').textContent = message; };
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2,'0')).join('');

function stopPlayback() {
  retireListen(); playbackId++; referencePlayback=false;
  if (monitor) monitor.stop(); player = null;
  $('stop').disabled = true; document.body.classList.remove('playing'); updateRoom();
}
function refreshReference() {
  const locked=busy||drawingArmed;
  $('keep-reference').disabled=locked||!current;
  $('play-reference').disabled=locked||!referenceTake;
  $('clear-reference').disabled=locked||!referenceTake;
  $('reference-note').textContent=referenceTake?`Reference: ${referenceTake.label}. Audio only; room/export stay current. Tab only; not saved in projects.`:'Keep one rendered take, revise the scene, then compare from the start. Same monitor gain, not loudness matched.';
}
function clearReference() {
  referenceTake=null; refreshReference();
}
function keepReference() {
  if(busy||drawingArmed||!current)return;
  stopAudition(); stopPlayback();
  referenceTake={buffer:current.buffer,label:`${sourceLabel} · ${(current.buffer.duration).toFixed(2)} s · ${current.recipe.doorClosed?'starts closed':'starts open'}${current.recipe.doorEvent?' · door change at '+(current.recipe.doorEvent.at*source.length/RATE).toFixed(2)+' s':''}`};
  refreshReference();status('Reference kept. Edit and summon a new take to compare. Source replacement clears the reference.');
}
function discardCue(message = 'Settings changed. Summon again to update preview and download.') {
  revision++; stopPlayback(); current = null;
  if (url) { URL.revokeObjectURL(url); url = null; }
  $('download').removeAttribute('href'); $('download').removeAttribute('download');
  $('download').classList.add('disabled'); $('download').setAttribute('aria-disabled','true');
  $('play-wet').disabled = true;
  $('wav-hash').textContent = $('pcm-check').textContent = $('render-details').textContent = 'Not rendered';
  $('cue-meta').textContent = 'A bounded 1.50-second echo tail is included.';
  $('cue-description').textContent = 'Place your sound, then summon its new form.';
  $('wave-left').setAttribute('d',''); $('wave-right').setAttribute('d',''); $('wave-boundary').style.display='none'; $('waveform-caption').textContent='Summon a cue to see its waveform.'; $('waveform').setAttribute('aria-hidden','true');
  status(message); refreshReference();
}
function doorEvent(){return $('door-event').checked?{at:Number($('door-time').value)/100}:null;}
function echoAmount() { return Number($('echo').value)/100; }
function coordinates() { if($('route').value==='drawn' && motionPoints)return {x:motionPoints[0].x,y:motionPoints[0].y}; return { x:Number($('x').value)/100, y:Number($('y').value)/100 }; }
function pointsFor(duration) {
  const {x,y} = coordinates();
  switch ($('route').value) {
    case 'drawn': return motionTrajectory(motionPoints,duration);
    case 'approach': return [{t:0,x,y},{t:duration,x,y:0}];
    case 'retreat': return [{t:0,x,y},{t:duration,x,y:1}];
    case 'cross': return [{t:0,x,y},{t:duration,x:x<=.5?1:0,y}];
    default: return [{t:0,x,y},{t:duration,x,y}];
  }
}
function setGhost(x,y) { $('ghost').style.left = `${12+76*x}%`; $('ghost').style.top = `${69-35*y}%`; $('ghost').style.transform = `translate(-50%,-50%) scale(${1-.35*y})`; $('ghost').style.opacity = String(1-.35*y); }
function updateRoom() {
  refreshProjectSaveState();
  const {x,y} = coordinates(); setGhost(x,y);
  $('echo-value').textContent = `${Math.round(echoAmount()*100)}%`;
  $('echo').setAttribute('aria-valuetext',`${Math.round(echoAmount()*100)} percent echo contribution`);
  $('x-value').textContent = x<.4?'Left':x>.6?'Right':'Center';
  $('y-value').textContent = y<.34?'Near':y>.66?'Far':'Mid-room';
  $('door').dataset.closed = String(doorClosed);
  $('room').dataset.doorClosed = String(doorClosed);
  $('door').textContent = doorClosed?'Open door':'Close door';
  $('door').setAttribute('aria-label',doorClosed?'Open door':'Close door');
  $('door').title = doorClosed?'Open the door to hear the source clearly':'Close the door to muffle the source';
  const event=doorEvent();
  $('room').dataset.doorEventPlaying='false';
  $('door-time').disabled=busy||drawingArmed||!event;
  $('door-time-value').textContent=`${$('door-time').value}%`;
  $('door-time').setAttribute('aria-valuetext',`${$('door-time').value}% of source, ${(Number($('door-time').value)/100*(source?.length||0)/RATE).toFixed(2)} seconds`);
  $('door-event-note').textContent=event?`Starts ${doorClosed?'closed':'open'}, then ${doorClosed?'opens':'closes'} at ${(event.at*(source?.length||0)/RATE).toFixed(2)} s (${Math.round(event.at*100)}% of the source). Transition up to 0.15 s. Authored timing, not a recorded performance. Audition uses the starting state; Summon plays the event.`:'Door stays in its current state for the whole exported cue. Enable one authored open/close event to reveal or hide the sound.';
  $('room-state').textContent = event?`Starts ${doorClosed?'closed':'open'} · ${doorClosed?'opens':'closes'} at ${Math.round(event.at*100)}%`:doorClosed?'Listening door closed · muffled':'Listening door open';
  $('door-shape').style.fill = doorClosed?'#735d3c':'#070d0d';
  $('drawn-option').disabled=!motionPoints; $('room').dataset.drawing=String(drawingArmed);
  $('draw-motion').textContent=drawingArmed?'Cancel drawing':'Draw a motion path';
  if(!drawingArmed)$('motion-draft-path').setAttribute('d','');
  $('room-hint').textContent=drawingArmed?'Draw one stroke · release to use it':$('route').value==='drawn'?'Your drawn path · use Draw to replace it':'Drag to place the sound';
  $('x').disabled=$('y').disabled=busy||drawingArmed||$('route').value==='drawn';
  const points = pointsFor(source?source.length/RATE:1);
  $('route-path').setAttribute('d',(auditionActive || $('route').value==='still')?'':points.map((p,i)=>`${i?'L':'M'}${72+456*p.x} ${269.1-136.5*p.y}`).join(' '));
  if(!drawingArmed)$('motion-status').textContent=$('route').value==='drawn'&&motionPoints?`${strokeSeconds===null?'Saved path':strokeSeconds.toFixed(2)+'-second gesture'} → ${((source?.length||0)/RATE).toFixed(2)}-second sound. ${motionPoints.length} sampled points. Source changes retime this path. Summon & listen plays the movement.`:'Draw one path with a pointer. Your timing is scaled to the sound’s length. Up to 8 seconds, sampled about 15 times per second; Escape cancels. Keyboard users can choose the movement options below.';
}
function controls(disabled) {
  busy = disabled; const locked=disabled||drawingArmed; $('play-wet').disabled=locked || !current;
  for (const el of document.querySelectorAll('[data-sample], #source-file, #x, #y, #echo, #route, #door, #save-project, #project-file, #door-event, #door-time, [data-scene]')) el.disabled = locked;
  $('x').disabled=$('y').disabled=locked||$('route').value==='drawn';
  $('door-time').disabled=locked||!$('door-event').checked;
  $('render').disabled = locked || !source; $('play-dry').disabled = locked || !source; $('draw-motion').disabled=disabled||!source; refreshAudition(); refreshReference();
}
function validateSourceLabel(label) {
  if (typeof label !== 'string' || !label.trim() || label.length > 200 || /[\u0000-\u001f\u007f]/.test(label)) throw new Error('Rename the audio file to 1–200 characters without control characters, then import it again so the project can be saved');
}
function installSource(samples,label) {
  validateSourceLabel(label);
  if (!(samples instanceof Float32Array) || !samples.length || samples.length > RATE*8) throw new Error('Choose nonempty audio no longer than 8 seconds.');
  let hasSignal=false;
  for (const n of samples) {
    if(n!==0)hasSignal=true;
    if (!Number.isFinite(n)) throw new Error('The source contains invalid samples.');
    if (n < -1 || n > 1) throw new Error('The decoded mono sound exceeds the supported audio range. Lower its level in an audio editor and import again; it has not been clipped or normalized.');
  }
  referenceTake=null;
  stopAudition(); demoKind = null; source = new Float32Array(samples); sourceGeneration++; sourceLabel = label;
  $('source-notice').textContent=hasSignal?'':'This source contains only zero samples (digital silence). Choose another sound if you expected audible audio. No normalization or repair has been applied.';
  $('source-name').textContent = label; $('source-duration').textContent = `${(source.length/RATE).toFixed(2)} s`;
  discardCue('Source ready. Drag the spirit or use the sliders, then summon a cue.'); updateRoom(); controls(false);
}
function selectDemo(kind) {
  loadId++;
  try {
    const result = createDemoSource(RATE,kind);
    installSource(result,`Synthetic ${kind}`);
    for (const b of document.querySelectorAll('[data-sample]')) { const selected = b.dataset.sample===kind; b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected)); }
    $('source-file').value = ''; demoKind = kind; refreshAudition();
  } catch (error) { status(`Cannot prepare source: ${error.message}`); }
}
let pendingSample=null, sampleReturnFocus=null;
function cancelSample() {
  pendingSample=null; $('sample-confirm').close(); controls(false);
  status('Source change cancelled. Your imported sound, settings and rendered cue are retained.');
  if(sampleReturnFocus)sampleReturnFocus.focus(); sampleReturnFocus=null;
}
for (const b of document.querySelectorAll('[data-sample]')) b.addEventListener('click',()=>{
  if(busy)return;
  if(demoKind===null && source) {
    pendingSample=b.dataset.sample; sampleReturnFocus=b;
    stopPlayback();stopAudition();controls(true);
    $('sample-confirm-description').textContent=`Replace “${sourceLabel}” with synthetic ${pendingSample}?`;
    $('sample-confirm').showModal();$('sample-cancel').focus();
  } else selectDemo(b.dataset.sample);
});
$('sample-cancel').addEventListener('click',cancelSample);
$('sample-confirm').addEventListener('cancel',event=>{event.preventDefault();cancelSample();});
$('sample-replace').addEventListener('click',()=>{
  if(!pendingSample)return;
  const next=pendingSample;pendingSample=null;const focus=sampleReturnFocus;sampleReturnFocus=null;
  $('sample-confirm').close();controls(false);selectDemo(next);if(focus)focus.focus();
});
for (const id of ['x','y','route','echo']) $(id).addEventListener('input',()=>{ discardCue(); updateRoom(); if(id==='route')refreshAudition(); updateAudition(); });
$('door').addEventListener('click',()=>{ doorClosed=!doorClosed; discardCue(); updateRoom(); updateAudition(); });
for(const id of ['door-event','door-time'])$(id).addEventListener('input',()=>{discardCue();updateRoom();refreshAudition();});
let dragging = false;
function pointerPosition(event) {
  const r=$('room').getBoundingClientRect();
  return {x:Math.min(1,Math.max(0,((event.clientX-r.left)/r.width-.12)/.76)),y:Math.min(1,Math.max(0,(.69-(event.clientY-r.top)/r.height)/.35)),t:performance.now()/1000};
}
function drawCursor(p){$('motion-cursor').setAttribute('cx',72+456*p.x);$('motion-cursor').setAttribute('cy',269.1-136.5*p.y);}
function drawPath(points){$('motion-draft-path').setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${72+456*p.x} ${269.1-136.5*p.y}`).join(' '));}
function finishDrawingMode(){clearTimeout(motionTimer);clearInterval(motionSampler);motionTimer=null;motionSampler=null;motionDraft=null;motionLatest=null;drawingArmed=false;dragging=false;const id=motionPointerId;motionPointerId=null;if(id!==null&&$('room').hasPointerCapture?.(id))$('room').releasePointerCapture(id);controls(false);updateRoom();}
function cancelDrawing(reason='Drawing cancelled. Previous path and rendered cue retained.') {
  if(!drawingArmed)return;finishDrawingMode();$('motion-status').textContent=reason;$('draw-motion').focus();
}
$('draw-motion').addEventListener('click',()=>{
  if(busy)return;if(drawingArmed){cancelDrawing();return;}
  stopPlayback();stopAudition();drawingArmed=true;dragging=false;controls(false);updateRoom();
  $('motion-status').textContent='Draw in the authoring overlay; release to use it. The door’s sound setting stays unchanged. Your timing is scaled to the sound’s length. Up to 8 seconds, sampled about 15 times per second. Escape cancels and keeps your previous cue.';
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawingArmed){event.preventDefault();cancelDrawing();}});
function moveSpirit(event) {
  if(drawingArmed && motionDraft){
    if(event.pointerId!==motionPointerId)return;
    motionLatest=pointerPosition(event);drawCursor(motionLatest);return;
  }
  if (!dragging || busy || $('route').value==='drawn') return;
  const r = $('room').getBoundingClientRect();
  const x = Math.min(1,Math.max(0,((event.clientX-r.left)/r.width-.12)/.76));
  const y = Math.min(1,Math.max(0,(.69-(event.clientY-r.top)/r.height)/.35));
  $('x').value = Math.round(x*100); $('y').value = Math.round(y*100);
  discardCue(); updateRoom(); updateAudition();
}
$('room').addEventListener('pointerdown',e=>{
  if(busy || e.target.closest('#door'))return;
  if(drawingArmed){
    if(motionDraft)return;
    const first=pointerPosition(e);motionPointerId=e.pointerId;motionLatest=first;motionDraft=createMotionStroke(first);$('room').setPointerCapture(e.pointerId);drawCursor(first);drawPath([first]);
    // Timer samples include stationary holds; pointer events only update latest position.
    motionSampler=setInterval(()=>{
      if(!motionDraft||!motionLatest)return;
      try {const p={x:motionLatest.x,y:motionLatest.y,t:performance.now()/1000},points=motionDraft.add(p);drawPath(points);$('motion-status').textContent=`Drawing overlay ${(p.t-points[0].t).toFixed(1)} / 8 seconds · ${points.length} sampled points. Release to use this path; Escape keeps the previous cue.`;}
      catch(error){cancelDrawing(`${error.message}. Previous path and rendered cue retained.`);}
    },67);
    motionTimer=setTimeout(()=>cancelDrawing('Drawing exceeded 8 seconds. Previous path and rendered cue retained.'),8000);return;
  }
  if($('route').value==='drawn'){$('motion-status').textContent='Choose Draw a motion path to replace this path, or choose another movement to use position sliders.';return;}
  dragging=true;$('room').setPointerCapture(e.pointerId);moveSpirit(e);
});
$('room').addEventListener('pointermove',moveSpirit);
$('room').addEventListener('pointerup',event=>{
  if(drawingArmed&&motionDraft){
    if(event.pointerId!==motionPointerId)return;
    try {const result=motionDraft.finish(pointerPosition(event));motionPoints=result.points;strokeSeconds=result.strokeSeconds;
      $('x').value=Math.round(motionPoints[0].x*100);$('y').value=Math.round(motionPoints[0].y*100);$('drawn-option').disabled=false;$('route').value='drawn';
      finishDrawingMode();discardCue('Drawn path ready. Summon & listen to hear its movement.');updateRoom();
      $('motion-status').textContent=`${strokeSeconds.toFixed(2)}-second gesture → ${(source.length/RATE).toFixed(2)}-second sound. ${motionPoints.length} sampled points; relative timing and pauses retained. Source changes scale the path to the new clip. Summon & listen plays the movement.`;
    }catch(error){cancelDrawing(`${error.message}. Previous path and rendered cue retained.`);}return;
  }dragging=false;
});
for(const type of ['pointercancel','lostpointercapture'])$('room').addEventListener(type,event=>{if(drawingArmed&&motionDraft){if(event.pointerId===motionPointerId)cancelDrawing('Pointer drawing interrupted. Previous path and rendered cue retained.');return;}dragging=false;});

$('source-file').addEventListener('change',async()=>{
  if(busy||drawingArmed) { $('source-file').value=''; return; }
  const file = $('source-file').files[0]; if (!file) return;
  const id = ++loadId; stopAudition(); stopPlayback(); controls(true); status('Reading audio locally… Your current source and rendered cue are kept until the new sound is valid.');
  try {
    if (file.size>12*1024*1024) throw new Error('This proof accepts files up to 12 MB.');
    validateSourceLabel(file.name);
    const data = await file.arrayBuffer();
    // Additive early rejection for a known canonical subset only; unknown formats retain native decoding.
    if (canonicalWavDuration(data)?.exceedsEightSeconds) throw new Error('This proof accepts up to 8 seconds. Trim the file first; it has not been silently truncated.');
    const decoder = new OfflineAudioContext(1,1,RATE);
    const buffer = await decoder.decodeAudioData(data);
    if (id!==loadId) return;
    if (buffer.length>RATE*8) throw new Error('This proof accepts up to 8 seconds. Trim the file first; it has not been silently truncated.');
    const mono = new Float32Array(buffer.length);
    let channelHasSignal=false;
    for (let channel=0;channel<buffer.numberOfChannels;channel++) { const input=buffer.getChannelData(channel); for(let i=0;i<mono.length;i++) { if(input[i]!==0)channelHasSignal=true; mono[i]+=input[i]/buffer.numberOfChannels; } }
    installSource(mono,file.name);
    if(channelHasSignal && mono.every(sample=>sample===0)) $('source-notice').textContent='Averaging your channels to mono produced digital silence. Channel cancellation can cause this. Choose a mono mix or export one channel in your audio editor, then import again. No normalization or repair has been applied.';
    for (const b of document.querySelectorAll('[data-sample]')) { b.classList.remove('selected'); b.setAttribute('aria-pressed','false'); }
  } catch (error) { if(id===loadId) status(`Audio not loaded: ${error.message}. Previous source, room settings and rendered cue retained.`); }
  finally { if(id===loadId) { $('source-file').value=''; controls(false); } }
});

async function audioContext() { if(!context) context=new AudioContext({sampleRate:RATE}); await context.resume(); return context; }
function startPrepared(buffer,recipe,ctx,id) {
  if(id!==playbackId || ctx.state!=='running') return false;
  if(!monitor) monitor=createMonitorPlayer(ctx,{onEnded:()=>{player=null;$('stop').disabled=!pendingListen;document.body.classList.remove('playing');updateRoom();if(!pendingListen) status(referencePlayback?'Reference finished. Room settings and current export are unchanged.':current?'Playback finished. Replay or download your rendered WAV.':'Source playback finished. Shape the scene, then Summon & listen.');}});
  player=monitor.play(buffer);
  const started=player.startedAt; $('stop').disabled=false; document.body.classList.add('playing');
  if(recipe && !reducedMotion.matches) {
    function animate() {
      if(id!==playbackId || !player) return;
      if(reducedMotion.matches) { updateRoom(); return; }
      const time=Math.max(0,ctx.currentTime-started), points=recipe.trajectory;
      let i=0; while(i<points.length-2 && time>points[i+1].t) i++;
      const a=points[i],b=points[i+1],f=Math.min(1,Math.max(0,(time-a.t)/(b.t-a.t)));
      setGhost(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);
      if(recipe.version===3){
        const amount=doorClosedAmount(recipe,time,points.at(-1).t);
        $('room').dataset.doorEventPlaying='true';
        $('room').style.setProperty('--door-open',String(1-amount));
        $('room-state').textContent=`Rendered door: ${amount>=1?'closed':amount<=0?'open':recipe.doorClosed?'opening':'closing'}`;
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
  return true;
}
async function play(buffer,recipe=null) {
  stopPlayback();
  const id=playbackId; $('stop').disabled=false;
  try {
    const ctx=await audioContext();
    if(id!==playbackId) return false;
    if(!startPrepared(buffer,recipe,ctx,id)) throw new Error('Browser audio is not running');
    return true;
  } catch(error) { if(id!==playbackId)return false; $('stop').disabled=true; throw error; }
}
function maybeListen(intent) {
  if(pendingListen!==intent || intent.id!==playbackId || intent.version!==revision || !intent.cue) return;
  if(current!==intent.cue) { retireListen(); return; }
  if(!intent.error && !intent.ctx) return;
  retireListen();
  if(intent.error) { $('stop').disabled=true; status(`Cue ready; ${intent.error}. Listen again or download the validated WAV.`); return; }
  try {
    if(!startPrepared(intent.cue.buffer,intent.cue.recipe,intent.ctx,intent.id)) throw new Error('browser audio is not running');
    status('Playing the exact decoded WAV at 35% monitor gain. Downloaded audio keeps its rendered level.');
  } catch(error) { $('stop').disabled=true;status(`Cue ready; playback unavailable: ${error.message}. Listen again or download the validated WAV.`); }
}
function beginListen(version) {
  const intent={version,id:playbackId,ctx:null,error:null,cue:null,timer:null};
  pendingListen=intent; $('stop').disabled=false;
  intent.timer=setTimeout(()=>{
    if(pendingListen!==intent)return;
    intent.error='browser audio was not ready within 3 seconds';
    $('stop').disabled=true; maybeListen(intent);
  },3000);
  // Called synchronously in the user's click handler, before rendering yields.
  // Both handlers attach immediately; rejection never leaks or rejects rendering.
  audioContext().then(ctx=>{
    if(pendingListen!==intent || intent.error)return;
    intent.ctx=ctx; clearTimeout(intent.timer); maybeListen(intent);
  },error=>{
    if(pendingListen!==intent)return;
    clearTimeout(intent.timer); intent.error=`playback unavailable: ${error.message || error}`;
    $('stop').disabled=true; maybeListen(intent);
  });
  return intent;
}
$('stop').addEventListener('click',()=>{stopPlayback();stopAudition();status(busy?'Listening cancelled. Pending work will not start playback.':current?'Playback stopped. Your rendered WAV is still ready to replay or download.':'Playback stopped. Your source and settings are unchanged.');});
$('play-dry').addEventListener('click',async()=>{
  if(!source)return;
  stopAudition(); stopPlayback(); const request=playbackId, samples=source; $('stop').disabled=false;
  try { const ctx=await audioContext(); if(request!==playbackId)return; const buffer=ctx.createBuffer(1,samples.length,RATE); buffer.copyToChannel(samples,0); if(!startPrepared(buffer,null,ctx,request)) throw new Error('Browser audio is not running'); status('Playing the mono dry source at the same 35% monitor gain as audition. Start at a low listening volume.'); }
  catch(error){if(request===playbackId){$('stop').disabled=true;status(`Playback unavailable: ${error.message}`);}}
});
$('keep-reference').addEventListener('click',()=>{
  if(busy||drawingArmed||!current)return;
  if(referenceTake){$('reference-confirm').showModal();$('reference-cancel').focus();}else keepReference();
});
$('reference-cancel').addEventListener('click',()=>{$('reference-confirm').close();$('keep-reference').focus();});
$('reference-confirm').addEventListener('cancel',()=>{setTimeout(()=>$('keep-reference').focus(),0);});
$('reference-replace').addEventListener('click',()=>{$('reference-confirm').close();keepReference();$('keep-reference').focus();});
$('clear-reference').addEventListener('click',()=>{if(busy||drawingArmed)return;stopPlayback();clearReference();status('Reference cleared. Current source, settings and export are unchanged.');});
$('play-reference').addEventListener('click',async()=>{
  if(busy||drawingArmed||!referenceTake)return;
  const take=referenceTake;stopAudition();
  try{if(await play(take.buffer)){referencePlayback=true;status('Playing kept reference from the start at 35% monitor gain. Audio only; room shows current settings.');}}
  catch(error){status(`Reference playback unavailable: ${error.message}`);}
});
$('play-wet').addEventListener('click',async()=>{
  if(!current)return;
  stopAudition();
  try{if(await play(current.buffer,current.recipe))status('Playing the decoded WAV at 35% monitor gain. Downloaded audio is not attenuated by this listening gain.');}
  catch(error){status(`Playback unavailable: ${error.message}`);}
});
$('render').addEventListener('click',async()=>{
  if(!source||busy||drawingArmed)return;
  stopAudition();
  discardCue('Summoning locally…'); controls(true); const version=revision;
  const intent=beginListen(version); const samples=new Float32Array(source);
  try {
    const event=doorEvent();
    const recipe={version:event?3:2,echoAmount:echoAmount(),doorClosed,trajectory:pointsFor(source.length/RATE),...(event?{doorEvent:event}:{})};
    await new Promise(resolve=>setTimeout(resolve,20));
    const result=await renderRecipe(samples,RATE,recipe);
    const bytes=new Uint8Array(result.wavBytes);
    const decoder=new OfflineAudioContext(2,1,RATE);
    const buffer=await decoder.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    if(buffer.numberOfChannels!==2 || buffer.sampleRate!==RATE)throw new Error('The browser did not decode the expected stereo PCM format.');
    let differences=0,peak=0,firstDifference=null,maxDifference=0;
    if(!result.previewChannels||result.previewChannels.length!==2)throw new Error('The renderer did not return its decoded stereo preview.');
    for(let channel=0;channel<2;channel++) {
      const actual=buffer.getChannelData(channel),expected=result.previewChannels[channel];
      if(actual.length!==expected.length)throw new Error('Preview and exported WAV lengths differ.');
      for(let i=0;i<actual.length;i++){if(actual[i]!==expected[i]){differences++;maxDifference=Math.max(maxDifference,Math.abs(actual[i]-expected[i]));if(!firstDifference)firstDifference={channel,frame:i,browser:actual[i],expected:expected[i]};}if(!Number.isFinite(actual[i]))throw new Error('Non-finite audio sample.');peak=Math.max(peak,Math.abs(actual[i]));}
    }
    if(differences)throw new Error(`Browser WAV decoder differs at ${differences} samples (max ${maxDifference}; first ${JSON.stringify(firstDifference)}); export withheld.`);
    if(peak>1)throw new Error('Rendered samples exceed the PCM range.');
    const digest=await hash(bytes);
    if(version!==revision)return;
    current={buffer,recipe,bytes};
    url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
    $('download').href=url; $('download').download=cueFilename(demoKind || sourceLabel,$('route').value,doorClosed,RATE,{doorEvent:!!event});
    const view=waveformView([buffer.getChannelData(0),buffer.getChannelData(1)],source.length,RATE);
    $('wave-left').setAttribute('d',view.paths[0]); $('wave-right').setAttribute('d',view.paths[1]); $('wave-boundary').setAttribute('x1',view.sourceX); $('wave-boundary').setAttribute('x2',view.sourceX); $('wave-boundary').style.display=''; $('waveform').setAttribute('aria-hidden','false');
    $('waveform-caption').textContent=`${view.sourceSeconds.toFixed(2)} s source + ${view.tailSeconds.toFixed(2)} s tail. Waveform height scaled for visibility, not loudness.`;
     $('download').classList.remove('disabled');$('download').setAttribute('aria-disabled','false');
    $('play-wet').disabled=false;
    $('wav-hash').textContent=digest;
    $('pcm-check').textContent=`${buffer.length*2} channel samples compared with the browser WAV decoder; ${differences} differences.`;
    $('render-details').textContent=`Stereo PCM16 · ${RATE} Hz · ${buffer.length} frames · peak ${peak.toFixed(6)} · ${bytes.length} bytes. Source: ${sourceLabel}.`;
    $('cue-meta').textContent=`${buffer.duration.toFixed(2)} seconds, including ${(result.tailFrames/RATE).toFixed(2)} seconds of bounded tail. Stereo WAV · ${(bytes.length/1024).toFixed(0)} KB.`;
    $('cue-description').textContent=`${$('route').selectedOptions[0].textContent}. ${doorClosed?'Behind a closed, muffling door.':'Listening door open.'} Echo contribution ${Math.round(recipe.echoAmount*100)}%.${event?` Door ${doorClosed?'opens':'closes'} at ${(event.at*source.length/RATE).toFixed(2)} s.`:''}`;
    status('Cue ready. Preview uses the exact decoded export bytes.');
    intent.cue=current; maybeListen(intent);
  } catch(error) {
    if(pendingListen===intent) { retireListen(); $('stop').disabled=true; }
    if(version===revision) status(`Cue not created: ${error.message}`);
  }
  finally { if(version===revision) controls(false); }
});
$('download').addEventListener('click',event=>{ if(!current){event.preventDefault();return;}status('WAV download requested. Check your browser downloads before closing this tab.'); });
function auditionEligible() { return !!source && (demoKind === null || demoKind === 'creak' || demoKind === 'breath'); }
function refreshAudition() {
  const eligible = auditionEligible();
  const imported = demoKind === null && !!source;
  const drawn=$('route').value==='drawn';
  $('audition-title').textContent='Spatial audition';
  $('audition-start').textContent = drawn ? 'Listen at path start' : imported ? 'Repeat my whole clip' : 'Start spatial audition';
  $('audition-description').textContent = imported
    ? 'Repeat your whole imported clip and its bounded tail, at a quieter monitor level. Position and door update the sketch; quiet intervals are preserved. No trimming. This is not a recording or the isolated exported cue.'
    : 'A repeating spatial sketch for synthetic creak or breath, with ambience from earlier cycles. Position and door update the sound; movement paths belong to Summon. This is not the isolated exported cue or a recording.';
  if(drawn)$('audition-description').textContent='Static listening at the first point of your drawn path. Door and echo update this sketch, but the path does not move here. Summon & listen renders and plays the complete movement.';
  if(doorEvent())$('audition-description').textContent+=' Timed door events are heard only in Summon; this sketch uses the starting door state.';
  $('audition-start').disabled = busy || drawingArmed || auditionActive || !eligible;
  $('audition-stop').disabled = !auditionActive;
  $('route').disabled = busy || drawingArmed || auditionActive;
  $('audition-start').closest('.audition-box').dataset.active = String(auditionActive);
  updateRoom();
  if (!auditionActive) $('audition-status').textContent = eligible
    ? drawn ? 'Static path-start sketch only. Summon & listen plays your drawn movement.' : 'Ready for a looping spatial sketch. Movement paths are rendered separately with Summon.'
    : 'Choose synthetic creak, breath, or import your own clip. Tap uses Summon.';
}
function stopAudition() {
  auditionEpoch++; auditionActive = false;
  if (audition) audition.stop();
  refreshAudition();
}
function auditionSettings() { return {kind:demoKind === null ? 'import' : demoKind,sampleRate:RATE,...coordinates(),doorClosed,echoAmount:echoAmount(),...(demoKind === null ? {sourceId:`local-${sourceGeneration}`,source} : {})}; }
function updateAudition() {
  if (auditionActive && audition) { try { audition.update(auditionSettings()); } catch(error) { stopAudition(); $('audition-status').textContent = `Audition stopped: ${error.message}`; } }
}
$('audition-stop').addEventListener('click',stopAudition);
$('audition-start').addEventListener('click',async()=>{
  if (busy || drawingArmed || auditionActive || !auditionEligible()) return;
  stopPlayback(); auditionActive = true; const epoch = ++auditionEpoch; refreshAudition();
  $('audition-status').textContent = 'Preparing spatial audition…';
  try {
    const ctx = await audioContext();
    if (epoch !== auditionEpoch || !auditionActive) return;
    if (!audition) {
      const worker = new Worker(new URL('./engine/audition-worker.mjs',import.meta.url),{type:'module'});
      audition = createAuditionController({context:ctx,worker,
        decode:async bytes=>{
          const decoder = new OfflineAudioContext(2,1,RATE);
          const data = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) : bytes;
          return decoder.decodeAudioData(data);
        },
        now:()=>performance.now(),
        onState:state=>{
          if (!auditionActive) return;
          $('audition-status').textContent = state.state === 'pending'
            ? 'Updating spatial sketch… previous sound continues until ready.'
            : state.state === 'playing'
              ? `Auditioning static placement and door. ${Number.isFinite(state.latencyMs)?`Last update ${Math.round(state.latencyMs)} ms. `:''}This loop is not a recording.`
              : 'Audition stopped.';
        },
        onError:error=>{stopAudition();$('audition-status').textContent=`Audition unavailable: ${error.message || error}. Use Summon for a rendered cue.`;}
      });
    }
    audition.start(auditionSettings());
  } catch(error) {
    if (epoch !== auditionEpoch) return;
    stopAudition(); $('audition-status').textContent = `Audition unavailable: ${error.message}. Use Summon for a rendered cue.`;
  }
});
window.addEventListener('pagehide',()=>{if(drawingArmed)cancelDrawing();stopPlayback();stopAudition();if(audition){audition.dispose();audition=null;}});

selectDemo('creak');

// Compare editable project state, not render/playback revisions. No audio is copied here.
function projectIdentity() {
  return JSON.stringify({sourceGeneration,x:Number($('x').value),y:Number($('y').value),route:$('route').value,
    doorClosed,echoAmount:echoAmount(),doorEvent:doorEvent(),
    motionPoints:$('route').value==='drawn'?motionPoints:null});
}
function warnProjectExit(event){
  if(projectIdentity()===lastProjectDownload)return;
  event.preventDefault(); event.returnValue='';
}
function refreshProjectSaveState(){
  if(lastProjectDownload===null)return;
  const changed=projectIdentity()!==lastProjectDownload;
  const message=changed?'Unsaved project changes · save a project file to keep editing later.':'No changes since opening or the last project-download request. Check that download before closing.';
  if($('project-save-state').textContent!==message)$('project-save-state').textContent=message;
  if(changed)window.addEventListener('beforeunload',warnProjectExit);
  else window.removeEventListener('beforeunload',warnProjectExit);
}
lastProjectDownload=projectIdentity();
// The untouched synthetic starting scene needs no recovery warning.
$('project-save-state').textContent='Edits stay in this tab. Save a project file to keep editing later.';
// Local project files are explicit user downloads, never automatic persistence.
let pendingProject = null, projectRead = 0;
const projectStatus = message => { $('project-status').textContent=message; };
$('save-project').addEventListener('click',async()=>{
  if(busy || !source) return;
  const snapshot={source:new Float32Array(source),label:sourceLabel,demoKind,x:Number($('x').value),y:Number($('y').value),route:$('route').value,doorClosed,echoAmount:echoAmount(),...(doorEvent()?{doorEvent:doorEvent()}:{}),...($('route').value==='drawn'?{motionPoints:motionPoints.map(p=>({...p}))}:{})};
  const requestedIdentity=projectIdentity();
  controls(true);
  try {
    const text=await encodeProject(snapshot);
    const fileURL=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const link=document.createElement('a');link.href=fileURL;link.download=cueFilename(sourceLabel,'project',doorClosed,RATE).replace(/\.wav$/,'.foley.json');
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(fileURL),60000);
    lastProjectDownload=requestedIdentity;refreshProjectSaveState();
    projectStatus('Project download requested. Check your browser downloads before closing this tab. It contains your source audio and room settings; keep the file to reopen later.');
  } catch(error){projectStatus(`Project not saved: ${error.message}`);}
  finally {controls(false);}
});
$('project-file').addEventListener('change',async()=>{
  const file=$('project-file').files[0];if(!file || busy)return;
  const id=++projectRead;stopPlayback();stopAudition();controls(true);
  try {
    if(file.size>MAX_PROJECT_BYTES)throw new Error('Project files must be no larger than 3 MB.');
    const decoded=await decodeProject(await file.text());if(id!==projectRead)return;
    pendingProject=decoded;
    $('project-confirm-description').textContent=`Open “${decoded.label}” (${(decoded.source.length/RATE).toFixed(2)} seconds)?`;
    $('project-confirm').showModal();$('project-cancel').focus();
  } catch(error){pendingProject=null;projectStatus(`Project not opened: ${error.message}. Current project retained.`);controls(false);}
  finally {$('project-file').value='';}
});
function cancelProject(){pendingProject=null;projectRead++;$('project-confirm').close();controls(false);projectStatus('Open cancelled. Current project retained.');}
$('project-cancel').addEventListener('click',cancelProject);
$('project-confirm').addEventListener('cancel',event=>{event.preventDefault();cancelProject();});
$('project-replace').addEventListener('click',()=>{
  if(!pendingProject)return;
  const next=pendingProject;pendingProject=null;loadId++;projectRead++;
  // Parsing and all validation finished before this single replacement boundary.
  motionPoints=next.motionPoints?next.motionPoints.map(p=>({...p})):null;strokeSeconds=null; $('route').value='still';
  installSource(next.source,next.label);demoKind=next.demoKind;
  $('door-event').checked=!!next.doorEvent;$('door-time').value=Math.round((next.doorEvent?.at??0.5)*100);
  $('x').value=next.x;$('y').value=next.y;$('route').value=next.route;doorClosed=next.doorClosed;$('echo').value=Math.round((next.echoAmount??0.3)*100);
  for(const button of document.querySelectorAll('[data-sample]')){const selected=button.dataset.sample===demoKind;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
  $('source-file').value='';updateRoom();refreshAudition();$('project-confirm').close();controls(false);
  $('motion-status').textContent=motionPoints?`Saved drawn path: ${motionPoints.length} points, scaled to ${(source.length/RATE).toFixed(2)} seconds. Summon & listen plays the movement.`:'Draw one path. Your timing is scaled to the sound’s length. Pointer drawing, up to 8 seconds; Escape cancels.';
  lastProjectDownload=projectIdentity();refreshProjectSaveState();
  projectStatus('Project reopened locally. Source and room settings restored. Summon to recreate the WAV; audio has not started.');
});

const sceneStarts={reveal:{x:50,y:70,route:'approach',closed:true,eventAt:.5,name:'Hidden presence'},behind:{x:50,y:30,route:'still',closed:true,name:'Behind the door'},crossing:{x:15,y:35,route:'cross',closed:false,name:'Crossing hall'},retreating:{x:65,y:10,route:'retreat',closed:false,name:'Retreating presence'}};
let pendingScene=null,sceneReturnFocus=null;
function applyScene(scene){
  $('door-event').checked=scene.eventAt!==undefined;
  if(scene.eventAt!==undefined)$('door-time').value=scene.eventAt*100;
  stopAudition();stopPlayback();$('x').value=scene.x;$('y').value=scene.y;$('route').value=scene.route;doorClosed=scene.closed;
  discardCue(`${scene.name} applied to your current sound. Summon to render it.`);updateRoom();refreshAudition();$('render').focus();
}
for(const button of document.querySelectorAll('[data-scene]'))button.addEventListener('click',()=>{
  if(busy||drawingArmed)return;const scene=sceneStarts[button.dataset.scene];
  if((demoKind===null && source)||scene.eventAt!==undefined){pendingScene=scene;sceneReturnFocus=button;stopAudition();stopPlayback();controls(true);$('scene-confirm-description').textContent=`Apply “${scene.name}” to “${sourceLabel}”? ${scene.eventAt!==undefined?`Starts far away and closed, approaches, then opens at ${(scene.eventAt*source.length/RATE).toFixed(2)} s (50% of your source).`:"This preset uses a static door and turns off the timed door event."}`;$('scene-confirm').showModal();$('scene-cancel').focus();}
  else applyScene(scene);
});
function cancelScene(){pendingScene=null;$('scene-confirm').close();controls(false);status('Scene change cancelled. Your current sound and settings are retained.');if(sceneReturnFocus)sceneReturnFocus.focus();sceneReturnFocus=null;}
$('scene-cancel').addEventListener('click',cancelScene);
$('scene-confirm').addEventListener('cancel',event=>{event.preventDefault();cancelScene();});
$('scene-apply').addEventListener('click',()=>{if(!pendingScene)return;const next=pendingScene;pendingScene=null;sceneReturnFocus=null;$('scene-confirm').close();controls(false);applyScene(next);});
