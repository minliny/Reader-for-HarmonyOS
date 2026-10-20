// Static production-renderer and resource contracts; no browser or runtime proof.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createSourceFlow,sourceFlowFixtures} from './source-flow-model.mjs';
import {sourceFlowDrawer,sourceFlowRow,sourceFlowSwitch} from './source-flow-renderer.mjs';
import {screens} from './ui-reading.mjs';
import {createSourceFlowPointerGuard} from './source-flow-pointer.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const model=createSourceFlow(),initial=model.getSnapshot();
const candidates=sourceFlowFixtures.filter(x=>x.success);
const control=screens.find(s=>s.id==='reader-controls').render({variant:'quick',book:initial.book,choices:{},size:'phone',theme:'day'});
assert(control.includes('data-action="open:source-switch"'));
let frames=0;
for(let count=0;count<=candidates.length;count++)for(const [stage,discovery] of [['discovering','running'],['stopped','stopped'],['ready','complete']]) {
  const html=sourceFlowDrawer({...initial,stage,discovery,candidates:candidates.slice(0,count)});
  assert.equal((html.match(/data-source-key=/g)||[]).length,count);
  for(const bad of ['检测失败','待检测','超时','重试','溪流阅读','南风书库'])assert(!html.includes(bad),bad);
  assert(html.includes(`已找到 ${count} 个书源`));
  assert(html.includes('最新章节：第十二章 雨夜归人'));
  assert(html.includes('当前书源：青溪书阁'));
  assert(html.includes('aria-modal="true"'));
  frames++;
}
assert.equal(new Set(candidates.map(c=>c.key)).size,6);
assert(sourceFlowRow(candidates[5]).includes('第十一章 山路'));
for(const switchStep of ['prepare','locate','finish']) {
  const html=sourceFlowSwitch({...initial,stage:'switching',switchStep,selected:candidates[1]});
  assert(html.includes('云海阅读')&&!html.includes('undefined'));
  assert(html.includes('第三章 山路 · 保留阅读位置'));
}
const html=await readFile(path.join(here,'index.html'),'utf8');
for(const id of ['viewport','flow-reader','flow-controls','flow-modal','flow-transition','flow-toast','flow-auto','flow-reset','flow-reduced','flow-status','flow-steps'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
let resources=0;
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {await access(path.resolve(here,match[1].split(/[?#]/)[0]));resources++;}
const css=await readFile(path.join(here,'source-flow.css'),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){await access(path.resolve(here,match[1]));resources++;}
await access(path.join(here,'assets/source-flow-cover.png'));
assert(css.includes('height:50px')&&css.includes('height:calc(100% - 145px)'));
const controller=await readFile(path.join(here,'source-flow.mjs'),'utf8');
assert(controller.includes("if(button.dataset.action === 'open:source-switch'){model.open();return;}"));
assert(controller.includes('list.insertBefore(row,list.querySelector'));
assert(controller.includes('row = existing.get(candidate.key)'));
let time=0;
const guard=createSourceFlowPointerGuard({now:()=>time});
guard.down({x:10,y:10});guard.release();guard.move({x:200,y:200});
assert(guard.take(candidates[0].key),'hover after releasing the source control must not swallow a row click');
guard.down({key:candidates[0].key,x:0,y:0});guard.move({x:0,y:30});guard.release();
assert(!guard.take(candidates[0].key),'a scroll gesture must not select a row');
time=241;assert(guard.take(candidates[0].key));
guard.down({key:candidates[0].key,x:0,y:0});guard.release();
assert(!guard.take(candidates[1].key),'held row identity cannot select a different source');
guard.scroll();assert(!guard.take(candidates[0].key));
guard.reset();assert(guard.take(candidates[0].key),'replay must clear stale scroll guards');
model.destroy();
console.log(JSON.stringify({status:'pass',rendererFrames:frames,switchPhaseTemplates:3,pointerContracts:5,entry:'existing reading-control source button',resources,stableRowUpdateContract:true,browser:false,native:false},null,2));
