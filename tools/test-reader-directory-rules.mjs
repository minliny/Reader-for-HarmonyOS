import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const calls = [];
let reply = { status:'ready', rules:[{pattern:'^第一部$',level:1,boundary:'title'},{pattern:'^第一卷$',level:2,boundary:'head'}] };
let wait;
const Editor = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets', import.meta.url)),
  ['loadRules','changed','edit','run'], {
    DirectoryRuleDraft: class {constructor(id,pattern='',level='1',boundary='title') {Object.assign(this,{id,pattern,level,boundary});}},
    ReaderRuntimeOwner:{current:()=>({request:async(method,params,options)=>{calls.push({method,params,options}); if(wait) return await wait; return {data:reply};}})},
  });
const editor = Object.assign(new Editor(), {bookId:'local:book',mounted:true,generation:0,nextRuleId:0,rules:[],preview:[],previewReady:false,busy:false,loaded:false,onApplied(){}});
editor.loadRules(); await new Promise(resolve=>setImmediate(resolve));
assert.equal(editor.loaded,true);
assert.equal(editor.rules.length,2, 'all persisted hierarchy rules are loaded');
editor.edit(editor.rules[1].id,'level','3');
reply = {status:'ready',nodeCount:3,readableChapterCount:2,unmappedCount:0,nodes:[{title:'第一部',depth:1}]};
await editor.run(false);
assert.deepEqual(calls.at(-1).params.rules,[{pattern:'^第一部$',level:1,boundary:'title'},{pattern:'^第一卷$',level:3,boundary:'head'}]);
assert.equal(editor.previewReady,true);
editor.edit(editor.rules[0].id,'pattern','^第二部$');
assert.equal(editor.previewReady,false, 'editing revokes previous preview admission');
let applied=0;editor.onApplied=()=>applied++;
await editor.run(false);await editor.run(true);
assert.equal(applied,1);
assert.equal(calls.at(-1).method,'reading.directory.rules.apply.v2');
let resolve;wait=new Promise(r=>resolve=r);
const pending=editor.run(false);editor.changed();resolve({data:reply});await pending;wait=undefined;
assert.equal(editor.previewReady,false, 'late preview cannot replace an edited draft');
editor.loaded=false;const before=calls.length;await editor.run(true);
assert.equal(calls.length,before, 'failed loading cannot overwrite existing rules');
editor.loaded=true;editor.rules=[];await editor.run(false);
assert.deepEqual(calls.at(-1).params.rules,[], 'default navigation rules do not invoke chapter splitting');
reply = {status:'unavailable',reason:'unsupportedFormat'};
editor.loadRules(); await new Promise(resolve=>setImmediate(resolve));
assert.equal(editor.loaded,false, 'non-TXT rules cannot be edited or overwritten');
assert.match(editor.message,/TXT/);
console.log('directory rules editor: full persisted list, preview fencing, default rules and failed-read preservation PASS');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const rulesSource = readFileSync(fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets', import.meta.url)), 'utf8');
const rendered = createReaderBuilderProbe(rulesSource, ['build'], {
  readerAppColor: token => token,
  DirectoryRuleDraft: class {constructor(id){Object.assign(this,{id,pattern:'',level:'1',boundary:'title'});}},
});
Object.assign(rendered.owner, { rules:[], preview:[], loaded:true, busy:false, previewReady:false,
  scheme:'day',message:'默认卷规则',nextRuleId:0,changed(){},run(){} });
rendered.owner.initialRender();
console.log('directory hierarchy editor actual SDK Builder syntax PASS');
