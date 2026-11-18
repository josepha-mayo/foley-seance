import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
function model(){
 const nodes=new Map(),listeners=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:({x:50,y:25,route:'still'})[id]??'',textContent:''});return nodes.get(id);};
 const c=vm.createContext({$,window:{addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k);}}});
 vm.runInContext(`let sourceGeneration=1,doorClosed=false,motionPoints=null,echo=.3,event=null,lastProjectDownload=null;function echoAmount(){return echo}function doorEvent(){return event}`+app.slice(app.indexOf('function projectIdentity()'),app.indexOf('// Local project files are explicit')),c);
 return {$,run:s=>vm.runInContext(s,c),warn(){const e={prevented:false,preventDefault(){this.prevented=true;}};listeners.get('beforeunload')?.(e);return e.prevented;},listeners};
}
test('untouched state does not install a navigation warning',()=>{const m=model();assert.equal(m.warn(),false);assert.equal(m.listeners.size,0);});
test('room edits install guard and exact reversal removes it',()=>{const m=model();m.run('doorClosed=true;refreshProjectSaveState()');assert.equal(m.warn(),true);assert.match(m.$('project-save-state').textContent,/Unsaved/);m.run('doorClosed=false;refreshProjectSaveState()');assert.equal(m.warn(),false);assert.equal(m.listeners.size,0);});
test('source, echo, authored door and committed motion are editable project state',()=>{for(const change of ['sourceGeneration++','echo=.7','event={at:.65}',"$('route').value='drawn';motionPoints=[{t:0,x:0,y:0},{t:1,x:1,y:1}]"]){const m=model();m.run(change+';refreshProjectSaveState()');assert.equal(m.warn(),true);}});
test('render and playback revisions do not dirty project; unused motion is excluded',()=>{const m=model();m.run('let revision=99,current={},playing=true;motionPoints=[{t:0,x:0,y:0}];refreshProjectSaveState()');assert.equal(m.warn(),false);});
test('recording a download request clears only its snapshot, later edits remain dirty',()=>{const m=model();m.run('doorClosed=true;const requestedIdentity=projectIdentity();echo=.6;lastProjectDownload=requestedIdentity;refreshProjectSaveState()');assert.equal(m.warn(),true);m.run('lastProjectDownload=projectIdentity();refreshProjectSaveState()');assert.equal(m.warn(),false);assert.match(m.$('project-save-state').textContent,/request/);});
test('save baseline follows requested click and open baseline follows validated restoration',()=>{const save=app.slice(app.indexOf("$('save-project').addEventListener"),app.indexOf("$('project-file').addEventListener"));assert.ok(save.indexOf('lastProjectDownload=requestedIdentity')>save.indexOf('link.click()'));const open=app.slice(app.indexOf("$('project-replace').addEventListener"),app.indexOf('const sceneStarts'));assert.ok(open.indexOf('lastProjectDownload=projectIdentity()')>open.indexOf("$('echo').value="));});

test('unchanged status does not rewrite the live region',()=>{const m=model();m.run('doorClosed=true;refreshProjectSaveState()');const node=m.$('project-save-state');let text=node.textContent,writes=0;Object.defineProperty(node,'textContent',{get:()=>text,set:v=>{text=v;writes++;}});m.run('refreshProjectSaveState();refreshProjectSaveState()');assert.equal(writes,0);m.run('doorClosed=false;refreshProjectSaveState()');assert.equal(writes,1);});
