import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDemoSource,renderRecipe} from './foley-engine.mjs';
const rate=24000;
const recipe=(a,x=.5,y=.25,doorClosed=false)=>({version:1,doorClosed,trajectory:[{t:0,x,y},{t:a.length/rate,x,y}]});
const energy=a=>a.reduce((sum,x)=>sum+x*x,0);
test('preview exactly matches signed PCM16 integers for all three authored sources',()=>{
 const hashes=[];
 for(const kind of ['tap','creak','breath']){
  const a=createDemoSource(rate,kind),r=recipe(a),out=renderRecipe(a,rate,r);
  const view=new DataView(out.wavBytes.buffer,out.wavBytes.byteOffset,out.wavBytes.byteLength);
  assert.equal(view.getUint16(20,true),1);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint16(34,true),16);
  assert.equal(out.outputFrames,a.length+rate*1.5);
  for(let i=0;i<out.outputFrames;i++)for(let c=0;c<2;c++)assert.equal(out.previewChannels[c][i],Math.fround(view.getInt16(44+4*i+2*c,true) * (view.getInt16(44+4*i+2*c,true)<0?1/32768:Math.fround(1/32767))));
  assert.deepEqual(out.wavBytes,renderRecipe(a,rate,r).wavBytes);
  hashes.push(createHash('sha256').update(out.wavBytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,3);
});
test('room controls have measurable effects rather than decorative state',()=>{
 const a=createDemoSource(rate,'creak');
 const near=renderRecipe(a,rate,recipe(a,.5,0)),far=renderRecipe(a,rate,recipe(a,.5,1));
 const closed=renderRecipe(a,rate,recipe(a,.5,0,true));
 assert.ok(energy(near.previewChannels[0])>energy(far.previewChannels[0])*10);
 assert.ok(energy(closed.previewChannels[0])<energy(near.previewChannels[0])*.5);
 const left=renderRecipe(a,rate,recipe(a,0,0));
 assert.ok(energy(left.previewChannels[0])>0);assert.equal(energy(left.previewChannels[1]),0);
 const r={version:1,doorClosed:false,trajectory:[{t:0,x:0,y:0},{t:a.length/rate,x:1,y:0}]};
 const moving=renderRecipe(a,rate,r),mid=Math.floor(a.length/2);
 assert.ok(energy(moving.previewChannels[0].slice(0,mid))>energy(moving.previewChannels[1].slice(0,mid)));
 assert.ok(energy(moving.previewChannels[1].slice(mid,a.length))>energy(moving.previewChannels[0].slice(mid,a.length)));
});
