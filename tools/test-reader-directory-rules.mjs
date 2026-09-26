import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const rulesPath = fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets', import.meta.url));
const rulesSource = readFileSync(rulesPath, 'utf8');
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const rulesAst = ts.createSourceFile(rulesPath, rulesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS,
  createRequire(import.meta.url)(`${sdk}/lib/ets_checker.js`).compilerOptions);
const draftClass = rulesAst.statements.find(node => node.name?.getText(rulesAst) === 'DirectoryRuleDraft');
const Draft = new Function(`${stripTypeScriptTypes(draftClass.getText(rulesAst))}; return DirectoryRuleDraft;`)();
const calls = [];
let reply = { status:'ready', rules:[{pattern:'^第一部$',level:1,boundary:'title'},{pattern:'^第一卷$',level:2,boundary:'head'}] };
let wait;
const Editor = productionMotionMethods(rulesPath,
  ['loadRules','changed','edit','run'], {
    DirectoryRuleDraft: Draft,
    ReaderRuntimeOwner:{current:()=>({request:async(method,params,options)=>{calls.push({method,params,options}); if(wait) return await wait; return {data:reply};}})},
  });

// Exercise the production admission, serialization and load path at Core's
// inclusive limits. The fake transport returns saved payloads without coercion.
{
  const originalReply = reply;
  for (const [level, accepted] of [['0', true], ['31', true], ['32', false], ['-1', false], ['', false], [' ', false], ['1.5', false]]) {
    const isolated = Object.assign(new Editor(), { bookId:'level-boundary', mounted:true, generation:0, nextRuleId:1,
      loaded:true, busy:false, previewReady:false, rules:[new Draft(1, '第一卷.*', level, 'title')], preview:[], onApplied(){} });
    reply = {status:'ready', nodeCount:2, readableChapterCount:2, nodes:[]};
    const before = calls.length;
    await isolated.run(false);
    assert.equal(calls.length - before, accepted ? 1 : 0, `Core level ${JSON.stringify(level)} admission`);
    assert.equal(isolated.previewReady, accepted);
    if (!accepted) continue;
    assert.equal(calls.at(-1).params.rules[0].level, Number(level), 'preview retains the persisted zero-based value');
    await isolated.run(true);
    const saved = structuredClone(calls.at(-1).params.rules);
    assert.equal(saved[0].level, Number(level), 'apply performs no implicit level shift');
    reply = {status:'ready', rules:saved};
    isolated.loadRules(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(isolated.rules[0].level, level, 'reloading a saved rule retains its exact level');
    reply = {status:'ready', nodeCount:2, readableChapterCount:2, nodes:[]};
    await isolated.run(false);
    assert.deepEqual(calls.at(-1).params.rules, saved, 'reloaded rules preview without migration');
  }
  reply = originalReply;
}
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
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const rendered = createReaderBuilderProbe(rulesSource, ['build'], {
  readerAppColor: token => token,
  DirectoryRuleDraft: Draft,
});
Object.assign(rendered.owner, { rules:[], preview:[], loaded:true, busy:false, previewReady:false,
  scheme:'day',message:'默认卷规则',nextRuleId:0,changed(){},run(){} });
rendered.owner.initialRender();
console.log('directory hierarchy editor actual SDK Builder syntax PASS');

// Compile the non-empty editor branch and invoke the actual native-control
// callbacks. This covers the controls omitted by the empty-list syntax probe.
{
  const selects=[];
  const Select={name:'Select',create(options){selects.push({options});},selected(value){selects.at(-1).selected=value;},
    onSelect(callback){selects.at(-1).onSelect=callback;},pop(){}};
  const {owner}=createReaderBuilderProbe(rulesSource,['build'],{readerAppColor:token=>token,DirectoryRuleDraft:Draft,Select});
  const edits=[],runs=[];
  Object.assign(owner,{rules:[new Draft(1,'^第一部$','1','title'),new Draft(2,'^第一卷$','2','head')],
    preview:['第一部','  第一卷'],loaded:true,busy:false,previewReady:true,scheme:'day',message:'已预览',nextRuleId:2,
    edit:(...args)=>edits.push(args),changed(){this.previewReady=false;this.preview=[];},run:apply=>runs.push(apply)});
  owner.initialRender();
  const nodes=[...owner.nodes.values()];
  const fields=nodes.filter(node=>node.type==='TextInput');
  assert.equal(fields.length,4);
  fields[0].onChange('^第二部$');fields[1].onChange('3');
  const selectors=selects;
  assert.equal(selectors.length,2);assert.deepEqual(selectors.map(node=>node.selected),[0,1]);
  selectors[1].onSelect(3);
  assert.deepEqual(edits,[[1,'pattern','^第二部$'],[1,'level','3'],[2,'boundary','any']]);
  const buttons=nodes.filter(node=>node.type==='Button');
  buttons.find(node=>node.createWithLabel==='预览').onClick();buttons.find(node=>node.createWithLabel==='应用').onClick();
  assert.deepEqual(runs,[false,true]);
  buttons.find(node=>node.createWithLabel==='删除').onClick();
  assert.deepEqual(owner.rules.map(rule=>rule.id),[2]);assert.equal(owner.previewReady,false);
  buttons.find(node=>node.createWithLabel==='添加规则').onClick();
  assert.deepEqual(owner.rules.map(rule=>rule.id),[2,3]);assert.equal(owner.rules[1].boundary,'title');
  assert.equal(owner.rules[1].level,'0','the actual add-rule callback starts at Core default outer level');
  assert.ok(nodes.some(node=>typeof node.create==='string' && node.create.includes('完整标题') && node.create.includes('第一卷.*')),
    'the actual UI explains full-line matching with an executable prefix example');
}
console.log('PASS directory TXT non-empty actual SDK Builder: pattern/level/boundary editing, preview/apply callbacks, delete and add');

{
  const isolated=Object.assign(new Editor(),{bookId:'txt-owner',mounted:true,generation:0,nextRuleId:0,
    loaded:true,busy:false,previewReady:false,rules:[{id:1,pattern:'^卷$',level:'33',boundary:'title'}],preview:[],onApplied(){applied++;}});
  const count=calls.length;
  await isolated.run(false);assert.equal(calls.length,count,'invalid depth does not reach Core');
  isolated.rules[0].level='1';isolated.rules[0].pattern=' ';await isolated.run(false);
  assert.equal(calls.length,count,'empty pattern does not reach Core');
  isolated.rules[0].pattern='^卷$';await isolated.run(true);
  assert.equal(calls.length,count,'apply requires a successful current preview');
  reply={status:'unavailable',reason:'unprovenBoundary'};
  await isolated.run(false);assert.equal(isolated.previewReady,false);
  const rejectedCount=calls.length;await isolated.run(true);assert.equal(calls.length,rejectedCount);
  isolated.previewReady=true;
  let finish;wait=new Promise(resolve=>{finish=resolve;});
  const appliedBefore=applied,pending=isolated.run(true);
  isolated.bookId='another-txt';isolated.changed();
  assert.equal(calls.at(-1).options.shouldCancel(),true,'changing books cancels the old apply owner');
  finish({data:{status:'ready',nodeCount:1,readableChapterCount:1,nodes:[]}});await pending;wait=undefined;
  assert.equal(applied,appliedBefore,'late apply completion cannot refresh another book directory');
  assert.equal(isolated.previewReady,false);
}
console.log('PASS TXT rule admission: invalid rules, absent/rejected preview and late cross-book apply are fenced');
