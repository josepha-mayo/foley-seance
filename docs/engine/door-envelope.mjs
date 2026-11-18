// Integrator-authored bounded door event. Prior Kiro DSP provenance is separate.
// The attempted Kiro generation for this module failed authentication; no output used.
export const DOOR_RAMP_SECONDS = 0.15;
function plain(value,label) {
  if(value===null || typeof value!=='object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(`${label} must be a plain data object`);
}
function own(value,key,label) {
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d || !d.enumerable || !Object.hasOwn(d,'value'))throw new Error(`${label}.${key} must be own enumerable data`);
  return d.value;
}
function durationCheck(duration) {
  if(!Number.isFinite(duration) || duration<=0 || duration>8)throw new Error('Source duration must be finite, positive and at most 8 seconds');
}
export function checkedDoorEvent(event) {
  plain(event,'doorEvent');
  const keys=Reflect.ownKeys(event);
  if(keys.length!==1 || keys[0]!=='at')throw new Error('doorEvent must contain only at');
  const at=own(event,'at','doorEvent');
  if(!Number.isFinite(at) || at<0 || at>=1)throw new Error('doorEvent.at must be finite and in [0,1)');
  return {at};
}
export function createDoorEnvelope(initialClosed,event,duration) {
  if(typeof initialClosed!=='boolean')throw new Error('Initial door state must be boolean');
  durationCheck(duration);
  const initial=initialClosed?1:0,final=1-initial;
  let start=0,end=0;
  if(event!==null) {
    const {at}=checkedDoorEvent(event);
    start=duration*at;end=Math.min(duration,start+DOOR_RAMP_SECONDS);
    if(!(end>start))throw new Error('Door transition timing collapses at numerical precision');
  }
  const timed=event!==null;
  return time=>{
    if(!Number.isFinite(time)||time<0)throw new Error('Door time must be finite and nonnegative');
    if(!timed || time<=start)return initial;
    if(time>=end)return final;
    const fraction=(time-start)/(end-start);
    return initial+(final-initial)*fraction;
  };
}
// Convenience for visual sync. Full recipe schema is validated by the renderer.
export function doorClosedAmount(recipe,time,duration) {
  plain(recipe,'recipe');
  const version=own(recipe,'version','recipe'),closed=own(recipe,'doorClosed','recipe');
  if(version!==1&&version!==2&&version!==3)throw new Error('Unsupported door recipe version');
  const event=version===3?own(recipe,'doorEvent','recipe'):null;
  if(version===3&&event===null)throw new Error('Version 3 requires a door event');
  return createDoorEnvelope(closed,event,duration)(time);
}
