import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderRecipe} from './foley-engine.mjs';
// Golden WAV digests from the pre-cursor renderer, not from the candidate.
function fixture(rate,frames,mode,version){
 const duration=frames/rate;
 const times=mode==='dense'?Array.from({length:128},(_,i)=>duration*i/127):mode==='aligned'?[0,duration/4,duration/2,duration*3/4,duration]:[0,duration/1000,duration/999,duration/3,duration];
 const source=Float32Array.from({length:frames},(_,i)=>((i*73)%251-125)/180);
 const recipe={version,doorClosed:true,trajectory:times.map((t,i)=>({t,x:i%2,y:(i%3)/2})),...(version>=2?{echoAmount:.6}:{}),...(version===3?{doorEvent:{at:.5}}:{})};
 return {source,recipe};
}
const cases=[
  {
    "rate": 24000,
    "frames": 1,
    "mode": "dense",
    "version": 1,
    "hash": "8ee9c93e592e7af09ea7449670a1701f9078ace9962f698780253a646dfd256c"
  },
  {
    "rate": 24000,
    "frames": 1,
    "mode": "dense",
    "version": 2,
    "hash": "ec906c13f8b211accb3fd806efecaf6453d56c09b0030e347c07265c75f83735"
  },
  {
    "rate": 24000,
    "frames": 1,
    "mode": "dense",
    "version": 3,
    "hash": "2dc8044886418df58a4f2f7a215b87e37a066317fae8baf2688f89e9cc3efb61"
  },
  {
    "rate": 24000,
    "frames": 128,
    "mode": "aligned",
    "version": 1,
    "hash": "944974ec0ffc66fee5b11332dcc522c642d8947e93b86a55f8c27200933df5d3"
  },
  {
    "rate": 24000,
    "frames": 128,
    "mode": "aligned",
    "version": 2,
    "hash": "080dbd442f7b15f19aefb081c47296eac778b9347b9562ea0b597fb07745d550"
  },
  {
    "rate": 24000,
    "frames": 128,
    "mode": "aligned",
    "version": 3,
    "hash": "1d2d7186481d18dcf2c79dff2a1acf64deac182cd3cb46226fc0f86c6beeef1f"
  },
  {
    "rate": 24000,
    "frames": 127,
    "mode": "irregular",
    "version": 1,
    "hash": "b007c4af3c957c0300e31dc9cfc2f5548e4fb25b1c918783f62f81e91569181f"
  },
  {
    "rate": 24000,
    "frames": 127,
    "mode": "irregular",
    "version": 2,
    "hash": "e489e789f214e959f196f1a43fa49fb62e2c67adc7208459e50532734678af30"
  },
  {
    "rate": 24000,
    "frames": 127,
    "mode": "irregular",
    "version": 3,
    "hash": "bc8891d8304d022a220f6ae103c619cbd1a20226f3ec562c3650b647db8d24e7"
  },
  {
    "rate": 24000,
    "frames": 192000,
    "mode": "dense",
    "version": 1,
    "hash": "c071b6601d50823190c705e524637e3a5449935d88ceacbc0c0e99c7e4a27dd5"
  },
  {
    "rate": 24000,
    "frames": 192000,
    "mode": "dense",
    "version": 2,
    "hash": "5f379a72b64ee2f3b03da0710956e18e5402368c0c30a49b346898d167bba151"
  },
  {
    "rate": 24000,
    "frames": 192000,
    "mode": "dense",
    "version": 3,
    "hash": "93e98ad02065204cf6d6c3f42f6831238ea8700074c82cba6a1dacd77c50859a"
  },
  {
    "rate": 48000,
    "frames": 1,
    "mode": "dense",
    "version": 1,
    "hash": "d50fd567ad94dfee8ecf0f827b1f6a9e5c5a709e5dad861e8be3d6fb64d9f8f2"
  },
  {
    "rate": 48000,
    "frames": 1,
    "mode": "dense",
    "version": 2,
    "hash": "1dea2b684b51ea47c4f59cc9ff373190129bb6759f682f17eb6df992b6cb75e6"
  },
  {
    "rate": 48000,
    "frames": 1,
    "mode": "dense",
    "version": 3,
    "hash": "fb9b9ff1f0249739ec8638851b1f4f08594bad85331d00dce855f00991e7c2cc"
  },
  {
    "rate": 48000,
    "frames": 128,
    "mode": "aligned",
    "version": 1,
    "hash": "78cd163667f5536985d169309792d03060c931675afb3bef05bd9545624d4df8"
  },
  {
    "rate": 48000,
    "frames": 128,
    "mode": "aligned",
    "version": 2,
    "hash": "ed26502006394d040d0bbffdd985fdc5b5b274bc2fb4d22bc9a216facf01ce85"
  },
  {
    "rate": 48000,
    "frames": 128,
    "mode": "aligned",
    "version": 3,
    "hash": "45f5e61ce86028fc033c661dc2b858b88ef37501f921c596041f93622a05686f"
  },
  {
    "rate": 48000,
    "frames": 127,
    "mode": "irregular",
    "version": 1,
    "hash": "ccf2928b45f92b4a4058ea9199d5bd44cbc222b58f77b23a8367181fe347d537"
  },
  {
    "rate": 48000,
    "frames": 127,
    "mode": "irregular",
    "version": 2,
    "hash": "1b5b79e477ea8894f431c9ad51cc3d92f49a421e9b7326f278767b564bd65d93"
  },
  {
    "rate": 48000,
    "frames": 127,
    "mode": "irregular",
    "version": 3,
    "hash": "d1ed0e7dbf4a0845e491d8833fb5321ce9ce956589132fa102a60d805a7ca419"
  },
  {
    "rate": 48000,
    "frames": 384000,
    "mode": "dense",
    "version": 1,
    "hash": "3e6724d1bf427b680d770d43b05e2967657dd240bfd66b90bf6f92a6b32d79ae"
  },
  {
    "rate": 48000,
    "frames": 384000,
    "mode": "dense",
    "version": 2,
    "hash": "944f3801aa40f34f5ec14c8d0229e97b8ae01eefd1f5c5252b7fe82ec58db784"
  },
  {
    "rate": 48000,
    "frames": 384000,
    "mode": "dense",
    "version": 3,
    "hash": "218fb2c189f88a6723d85de90eb4e06eee8566e175ccf1f0c360011347d16fa2"
  }
];
test('forward trajectory cursor preserves legacy PCM at boundaries, dense paths and tails',()=>{
 for(const c of cases){const {source,recipe}=fixture(c.rate,c.frames,c.mode,c.version);const digest=()=>createHash('sha256').update(renderRecipe(source,c.rate,recipe).wavBytes).digest('hex');assert.equal(digest(),c.hash,JSON.stringify(c));assert.equal(digest(),c.hash,'separate renders must not share cursor state');}
});
