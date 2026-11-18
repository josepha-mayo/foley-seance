import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,readFile,readdir,rm,symlink,link,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=['index.html','style.css','app.mjs',...['wav-additive','foley-engine','audition-core','audition-worker','audition-controller','waveform-view','project-file','monitor-player','custom-motion','motion-stroke','door-envelope'].map(name=>`engine/${name}.mjs`)];
async function fixture(t){
 const dir=await mkdtemp(path.join(tmpdir(),'foley-build-test-'));
 // Cleanup is limited to this test's newly-created, unique fixture directory.
 t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(path.join(dir,'engine'));
 for(const file of ['build.mjs',...assets])await cp(path.join(root,file),path.join(dir,file));
 return dir;
}
const build=dir=>spawnSync(process.execPath,['build.mjs'],{cwd:dir,encoding:'utf8'});
async function inventory(dir,prefix=''){
 const result={};
 for(const entry of await readdir(path.join(dir,prefix),{withFileTypes:true})){
  const relative=prefix?`${prefix}/${entry.name}`:entry.name;
  if(entry.isDirectory())Object.assign(result,await inventory(dir,relative));
  else result[relative]=await readFile(path.join(dir,relative),'hex');
 }
 return result;
}
async function clean(t){const dir=await fixture(t);assert.equal(build(dir).status,0);return dir;}
async function rejectsWithoutWrites(dir){
 // The first copy would now alter output, making premature writes observable.
 await writeFile(path.join(dir,'index.html'),'SYNTHETIC CHANGED INPUT');
 const before=await inventory(path.join(dir,'dist'));
 const result=build(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/Unsafe or unexpected build output/);
 assert.deepEqual(await inventory(path.join(dir,'dist')),before);
}
test('build creates exactly 14 byte-identical assets and is repeatable',async t=>{
 const dir=await clean(t);const before=await inventory(path.join(dir,'dist'));
 assert.deepEqual(Object.keys(before).sort(),[...assets].sort());
 for(const file of assets)assert.deepEqual(await readFile(path.join(dir,'dist',file)),await readFile(path.join(dir,file)));
 assert.equal(build(dir).status,0);assert.deepEqual(await inventory(path.join(dir,'dist')),before);
});
for(const file of ['private-note.txt','engine/obsolete.mjs'])test(`build rejects stale ${file} without modifying any output`,async t=>{
 const dir=await clean(t);await writeFile(path.join(dir,'dist',file),'SYNTHETIC KEEP');await rejectsWithoutWrites(dir);
});
test('build rejects unexpected directory and preserves its contents',async t=>{
 const dir=await clean(t);await mkdir(path.join(dir,'dist/archive'));await writeFile(path.join(dir,'dist/archive/keep.txt'),'SYNTHETIC KEEP');await rejectsWithoutWrites(dir);
});
for(const kind of ['symlink','hardlink'])test(`build rejects ${kind} asset without changing its target`,async t=>{
 const dir=await clean(t);const outside=path.join(dir,'unrelated.txt');await writeFile(outside,'SYNTHETIC UNRELATED');
 await rename(path.join(dir,'dist/app.mjs'),path.join(dir,'original-app.mjs'));
 if(kind==='symlink'){
  try{await symlink(outside,path.join(dir,'dist/app.mjs'));}catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Windows symlink permission unavailable');return;}throw error;}
 }else await link(outside,path.join(dir,'dist/app.mjs'));
 await rejectsWithoutWrites(dir);assert.equal(await readFile(outside,'utf8'),'SYNTHETIC UNRELATED');
});
for(const location of ['dist','dist/engine'])test(`build rejects redirected ${location} directory`,async t=>{
 const dir=await clean(t);const outside=path.join(dir,'unrelated-folder');await mkdir(outside);await writeFile(path.join(outside,'keep.txt'),'SYNTHETIC KEEP');
 await rename(path.join(dir,location),path.join(dir,'original-output'));
 await symlink(outside,path.join(dir,location),process.platform==='win32'?'junction':'dir');
 const indexBefore=location==='dist/engine'?await readFile(path.join(dir,'dist/index.html'),'hex'):null;
 await writeFile(path.join(dir,'index.html'),'SYNTHETIC CHANGED INPUT');
 const result=build(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/Unsafe or unexpected build output/);
 if(indexBefore!==null)assert.equal(await readFile(path.join(dir,'dist/index.html'),'hex'),indexBefore);
 assert.deepEqual(await inventory(outside),{'keep.txt':Buffer.from('SYNTHETIC KEEP').toString('hex')});
});
test('build rejects file in place of output directory without overwriting it',async t=>{
 const dir=await fixture(t);await writeFile(path.join(dir,'dist'),'SYNTHETIC KEEP');const result=build(dir);
 assert.notEqual(result.status,0);assert.match(result.stderr,/Unsafe or unexpected build output/);assert.equal(await readFile(path.join(dir,'dist'),'utf8'),'SYNTHETIC KEEP');
});
