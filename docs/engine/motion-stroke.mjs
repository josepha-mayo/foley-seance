// Integrator-owned pointer sampling. The committed displayed points are the rendered path.
import {normalizeMotion} from './custom-motion.mjs';
const INTERVAL=1/15, MAX_SECONDS=8, MAX_POINTS=128;
function point(p){
 if(!p || ![p.x,p.y,p.t].every(Number.isFinite) || p.x<0||p.x>1||p.y<0||p.y>1||p.t<0)throw new Error('Invalid stroke sample');
 return {x:p.x,y:p.y,t:p.t};
}
export function createMotionStroke(first){
 const start=point(first), samples=[start];let lastTime=start.t,closed=false;
 function checked(p){
  if(closed)throw new Error('Stroke is already finished');
  const next=point(p);
  if(next.t<lastTime)throw new Error('Stroke time moved backwards');
  if(next.t-start.t>MAX_SECONDS)throw new Error('Draw for no longer than 8 seconds');
  lastTime=next.t;return next;
 }
 function append(next){if(samples.length>=MAX_POINTS)throw new Error('Stroke is too detailed');samples.push(next);}
 return {
  add(p){const next=checked(p);if(next.t-samples.at(-1).t>=INTERVAL)append(next);return samples.map(p=>({...p}));},
  finish(p){const next=checked(p);closed=true;if(next.t-start.t<0.12)throw new Error('Draw a stroke rather than a short click');if(next.t>samples.at(-1).t)append(next);else samples[samples.length-1]=next;
   return {points:normalizeMotion(samples),strokeSeconds:next.t-start.t};},
  snapshot(){return samples.map(p=>({...p}));}
 };
}
