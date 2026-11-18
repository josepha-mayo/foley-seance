import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderRecipe,createDemoSource,validateRecipe} from './foley-engine.mjs';
import {encodeProject,decodeProject} from './project-file.mjs';
import {buildAudition,copyAuditionSettings} from './audition-core.mjs';
const p=()=>({source:new Float32Array([0,-0,.9,-.8]),label:'Synthetic',demoKind:null,x:20,y:70,route:'cross',doorClosed:true});
test('v1 stays legacy-shaped; v2 projects preserve every percent including boundaries',async()=>{
 const old=p();assert.deepEqual(await decodeProject(await encodeProject(old)),old);
 assert.equal(JSON.parse(await encodeProject(old)).version,1);
 for(let i=0;i<=60;i++){const input={...p(),echoAmount:i/100};const text=await encodeProject(input);assert.equal(JSON.parse(text).version,2);assert.deepEqual(await decodeProject(text),input);}
});
test('project rejects off-grid, malformed, missing and accessor echo without invocation',async()=>{
 for(const echoAmount of [.235,-.01,.61,NaN,Infinity,'0.3',null,undefined]) await assert.rejects(encodeProject({...p(),echoAmount}));
 const raw=JSON.parse(await encodeProject({...p(),echoAmount:.3}));delete raw.echoAmount;await assert.rejects(decodeProject(JSON.stringify(raw)));
 raw.echoAmount=.235;await assert.rejects(decodeProject(JSON.stringify(raw)));
 const input=p();Object.defineProperty(input,'echoAmount',{enumerable:true,get(){throw new Error('CALLED');}});await assert.rejects(encodeProject(input),/Unexpected project fields/);
});
test('audition default preserves exact bytes; echo is forwarded for builtins and imports',()=>{
 for(const kind of ['creak','breath','import']){const input={kind,sampleRate:48000,x:.2,y:.7,doorClosed:false,...(kind==='import'?{sourceId:'synthetic',source:createDemoSource(48000,'tap')}:{})};
 const legacy=buildAudition(input);assert.deepEqual(buildAudition({...input,echoAmount:.3}).wavBytes,legacy.wavBytes);
 assert.notDeepEqual(buildAudition({...input,echoAmount:0}).wavBytes,buildAudition({...input,echoAmount:.6}).wavBytes);
 assert.deepEqual(copyAuditionSettings(input),input);
 for(const echoAmount of [undefined,NaN,-1,.61,'0.3'])assert.throws(()=>copyAuditionSettings({...input,echoAmount}));}
});
test('engine continuous echo remains supported; accessors rejected; high energy normalizes down',()=>{
 const trajectory=[{t:0,x:0,y:0},{t:1,x:0,y:0}],recipe={version:2,doorClosed:false,trajectory,echoAmount:.235};
 assert.equal(validateRecipe(recipe,1).echoAmount,.235);
 const accessor={...recipe};Object.defineProperty(accessor,'echoAmount',{enumerable:true,get(){throw new Error('CALLED');}});assert.throws(()=>validateRecipe(accessor,1),/non-data/);
 const source=new Float32Array(48000).fill(1),copy=source.slice();const result=renderRecipe(source,48000,{...recipe,echoAmount:.6});
 assert.ok(result.normalizationGain>0&&result.normalizationGain<1);assert.deepEqual(source,copy);assert.equal(result.tailFrames,72000);
 for(const channel of result.previewChannels)for(const v of channel)assert.ok(Number.isFinite(v)&&Math.abs(v)<=.951);
});
