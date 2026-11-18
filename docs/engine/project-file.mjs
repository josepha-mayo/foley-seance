// Integrator-authored local project format. Existing Kiro DSP remains unchanged.
import { createDemoSource } from './foley-engine.mjs';
export const MAX_PROJECT_BYTES = 3_000_000;
const RATE=48000, MAX_FRAMES=RATE*8;
const INPUT_KEYS=['source','label','demoKind','x','y','route','doorClosed'];
const FILE_KEYS=['format','version','sampleRate','encoding','sourceFrames','sourceBase64','sourceSha256','label','demoKind','x','y','route','doorClosed'];
function exactData(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw new Error('Expected plain project data');
 const own=Reflect.ownKeys(value);
 if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))throw new Error('Unexpected project fields');
}
function checkedMotion(points){
 if(!Array.isArray(points)||Object.getPrototypeOf(points)!==Array.prototype||points.length<2||points.length>128)throw new Error('Motion requires 2–128 plain points');
 const keys=Reflect.ownKeys(points);
 if(keys.length!==points.length+1||keys.some(k=>k!=='length'&&(typeof k!=='string'||! /^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=points.length)))throw new Error('Motion array must be dense without extra fields');
 const owned=[];
 for(let i=0;i<points.length;i++){
  const d=Object.getOwnPropertyDescriptor(points,String(i));
  if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw new Error('Motion points must be own data');
  const p=d.value;exactData(p,['t','x','y']);
  for(const key of ['t','x','y'])if(!Object.getOwnPropertyDescriptor(p,key).enumerable||!Number.isFinite(p[key])||p[key]<0||p[key]>1)throw new Error('Motion coordinates must be finite normalized values');
  if(i&&p.t<=owned[i-1].t)throw new Error('Motion time must strictly increase');
  owned.push({t:p.t,x:p.x,y:p.y});
 }
 if(owned[0].t!==0||owned[owned.length-1].t!==1)throw new Error('Motion endpoints must be exactly 0 and 1');
 return owned;
}
function checkedDoorEvent(event){
 exactData(event,['at']);
 if(!Number.isFinite(event.at)||event.at<0.1||event.at>0.9||Math.abs(event.at*20-Math.round(event.at*20))>1e-10)throw new Error('Door event must start at 10–90 percent in 5 percent steps');
 return {at:event.at};
}
function inputKeys(value){return [...INPUT_KEYS,...(Object.hasOwn(value||{},'echoAmount')?['echoAmount']:[]),...(Object.hasOwn(value||{},'motionPoints')?['motionPoints']:[]),...(Object.hasOwn(value||{},'doorEvent')?['doorEvent']:[])];}
function fileKeys(value){return [...FILE_KEYS,...(value?.version>=2?['echoAmount']:[]),...(value?.version===3||(value?.version===4&&Object.hasOwn(value,'motionPoints'))?['motionPoints']:[]),...(value?.version===4?['doorEvent']:[])];}
function settings(value){
 const {label,demoKind,x,y,route,doorClosed}=value;
 if(typeof label!=='string'||!label.trim()||label.length>200||/[\u0000-\u001f\u007f]/.test(label))throw new Error('Project label must be 1–200 characters without control characters');
 if(demoKind!==null&&!['tap','creak','breath'].includes(demoKind))throw new Error('Invalid demo kind');
 if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<=100))throw new Error('Position must be integer percentages');
 const drawn=Object.hasOwn(value,'motionPoints');
 if((drawn ? route!=='drawn'||!Object.hasOwn(value,'echoAmount') : !['still','approach','retreat','cross'].includes(route))||typeof doorClosed!=='boolean')throw new Error('Invalid project room settings');
 const event=Object.hasOwn(value,'doorEvent')?{doorEvent:checkedDoorEvent(value.doorEvent)}:{};
 if(Object.hasOwn(event,'doorEvent')&&!Object.hasOwn(value,'echoAmount'))throw new Error('Door events require echo settings');
 const echo = Object.hasOwn(value,'echoAmount') ? {echoAmount:value.echoAmount} : {};
 if(Object.hasOwn(echo,'echoAmount') && (!Number.isFinite(echo.echoAmount)||echo.echoAmount<0||echo.echoAmount>0.6||echo.echoAmount!==Math.round(echo.echoAmount*100)/100))throw new Error('Echo amount must be 0–0.60 in 0.01 steps');
 // x/y are independent static-placement UI state; drawn rendering uses motionPoints.
 return {label,demoKind,x,y,route,doorClosed,...echo,...event,...(drawn?{motionPoints:checkedMotion(value.motionPoints)}:{})};
}
function checkedSource(value){
 if(!(value instanceof Float32Array)||!(value.buffer instanceof ArrayBuffer)||!value.length||value.length>MAX_FRAMES)throw new Error('Source must contain 1–384000 mono Float32 samples at 48 kHz');
 const owned=new Float32Array(value);
 for(const n of owned)if(!Number.isFinite(n)||n < -1||n > 1)throw new Error('Invalid project source sample');
 return owned;
}
function verifyDemo(source,kind){
 if(kind===null)return;
 const expected=createDemoSource(RATE,kind);
 if(source.length!==expected.length||source.some((n,i)=>!Object.is(n,expected[i])))throw new Error('Demo label does not match the exact built-in source');
}
function sourceBytes(source){
 const bytes=new Uint8Array(source.length*4),view=new DataView(bytes.buffer);
 for(let i=0;i<source.length;i++)view.setFloat32(i*4,source[i],true);
 return bytes;
}
function base64(bytes){
 const chunks=[];
 for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
 return btoa(chunks.join(''));
}
function fromBase64(text,frames){
 if(typeof text!=='string'||text.length!==4*Math.ceil(frames*4/3)||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw new Error('Invalid bounded source base64');
 let binary;
 try{binary=atob(text);}catch{throw new Error('Invalid source base64');}
 if(binary.length!==frames*4||btoa(binary)!==text)throw new Error('Noncanonical source base64');
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)throw new Error('WebCrypto is required for project integrity');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function encodeProject(value){
 exactData(value,inputKeys(value));
 const properties=settings(value),source=checkedSource(value.source);
 verifyDemo(source,properties.demoKind);
 // Owned snapshots are taken before the first await; caller edits cannot race save.
 const bytes=sourceBytes(source);
 const result={format:'foley-seance-project',version:Object.hasOwn(properties,'doorEvent')?4:Object.hasOwn(properties,'motionPoints')?3:Object.hasOwn(properties,'echoAmount')?2:1,sampleRate:RATE,encoding:'float32-le',sourceFrames:source.length,sourceBase64:base64(bytes),sourceSha256:await sha256(bytes),...properties};
 const text=JSON.stringify(result);
 if(new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project exceeds the 3 MB limit');
 return text;
}
export async function decodeProject(text){
 if(typeof text!=='string'||text.length>MAX_PROJECT_BYTES||new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project must be JSON text no larger than 3 MB');
 let value;try{value=JSON.parse(text);}catch{throw new Error('Invalid project JSON');}
 exactData(value,fileKeys(value));
 if(value.format!=='foley-seance-project'||![1,2,3,4].includes(value.version)||value.sampleRate!==RATE||value.encoding!=='float32-le')throw new Error('Unsupported project format/version');
 const properties=settings(value);
 if(!Number.isInteger(value.sourceFrames)||value.sourceFrames<1||value.sourceFrames>MAX_FRAMES)throw new Error('Invalid project source length');
 if(typeof value.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceSha256))throw new Error('Invalid source integrity field');
 const bytes=fromBase64(value.sourceBase64,value.sourceFrames);
 if(await sha256(bytes)!==value.sourceSha256)throw new Error('Project source integrity check failed');
 const source=new Float32Array(value.sourceFrames),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let i=0;i<source.length;i++){const n=view.getFloat32(i*4,true);if(!Number.isFinite(n)||n < -1||n > 1)throw new Error('Invalid project source sample');source[i]=n;}
 verifyDemo(source,properties.demoKind);
 // No application state is touched. Replace only after this entire promise resolves.
 return {source,...properties};
}
