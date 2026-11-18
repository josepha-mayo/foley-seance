import {mkdir,copyFile,lstat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const files=['index.html','style.css','app.mjs',...['wav-additive.mjs','foley-engine.mjs','audition-core.mjs','audition-worker.mjs','audition-controller.mjs','waveform-view.mjs','project-file.mjs','monitor-player.mjs','custom-motion.mjs','motion-stroke.mjs','door-envelope.mjs'].map(file=>`engine/${file}`)];
const expected=new Set(files);
// Refuse stale or redirected output rather than deleting files we do not own.
async function checkOutput(relative=''){
 const target=path.join(root,'dist',relative);
 let stat;
 try{stat=await lstat(target);}catch(error){if(error.code==='ENOENT')return;throw error;}
 const directory=relative===''||relative==='engine';
 if(stat.isSymbolicLink()||(directory?!stat.isDirectory():!expected.has(relative)||!stat.isFile()||stat.nlink!==1)){
  throw new Error(`Unsafe or unexpected build output: dist/${relative}. Build in a fresh isolated checkout; no files were deleted.`);
 }
 if(directory)for(const name of await readdir(target))await checkOutput(relative?`${relative}/${name}`:name);
}
await checkOutput();
await mkdir(path.join(root,'dist','engine'),{recursive:true});
for(const file of files)await copyFile(path.join(root,file),path.join(root,'dist',file));
console.log('Built local-only static preview. No deployment.');
