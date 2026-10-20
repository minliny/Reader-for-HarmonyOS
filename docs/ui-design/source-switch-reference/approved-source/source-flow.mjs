import { screens } from './ui-reading.mjs';
import { esc } from './shared.mjs';
import { createSourceFlow } from './source-flow-model.mjs';
import { createSourceFlowPointerGuard } from './source-flow-pointer.mjs';
import { drawerStages, sourceFlowDrawer, sourceFlowRow, sourceFlowStatus, sourceFlowDiscoveryPhase, sourceFlowSwitch } from './source-flow-renderer.mjs';

const el = id => document.getElementById(id);
const entryHash = window.location.hash;
const reader = screens.find(screen => screen.id === 'reader');
const controls = screens.find(screen => screen.id === 'reader-controls');
let model, snapshot, previousStage = '', readerSource = '', auto = false, autoTimer, toastTimer;
let activeAnimations = [];
const pointerGuard = createSourceFlowPointerGuard();
const reduced = () => el('flow-reduced').checked;
const cancelAuto = () => {auto = false;clearTimeout(autoTimer);autoTimer = undefined;};
const cancelAnimations = () => {for(const animation of activeAnimations)animation.cancel();activeAnimations = [];};
function animate(node, frames, duration, options = {}) {
  if(!node || reduced() || !node.animate)return;
  const animation = node.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.2,1)',...options});
  activeAnimations.push(animation);animation.finished.catch(()=>{});
}
function context(state) {return {variant:'normal',readerVariant:'normal',book:state.book,choices:{'reader-chapter-index':2},theme:'day',size:'phone',viewportWidth:el('viewport').clientWidth,viewportHeight:el('viewport').clientHeight};}
function updateDrawer(state) {
  const host = el('flow-modal');
  if(!host.firstElementChild) {
    host.innerHTML = sourceFlowDrawer(state);
    animate(host.querySelector('.source-flow-drawer'),[{transform:'translateY(100%)'},{transform:'translateY(0)'}],320);
    animate(host.querySelector('.source-flow-backdrop'),[{opacity:0},{opacity:1}],320);
    host.querySelector('.source-flow-heading button').focus({preventScroll:true});
  }
  const modal = host.firstElementChild, list = modal.querySelector('[data-source-results]');
  modal.dataset.phase = state.stage;
  modal.querySelector('[data-current-source]').textContent = '当前书源：'+state.book.source;
  const running = state.discovery === 'running' || state.stage === 'opening';
  const toolbar = modal.querySelector('.source-flow-discovery');
  toolbar.dataset.running = String(running);
  toolbar.querySelector('[data-discovery-status]').setAttribute('aria-label',sourceFlowStatus(state));
  toolbar.querySelector('[data-discovery-number]').textContent = String(state.candidates.length);
  toolbar.querySelector('[data-discovery-phase]').textContent = sourceFlowDiscoveryPhase(state);
  toolbar.querySelector('[data-discovery-action-label]').textContent = running ? '停止' : '重新查找';
  toolbar.querySelector('button').disabled = state.stage === 'opening';
  const existing = new Map([...list.querySelectorAll('[data-source-key]')].map(node=>[node.dataset.sourceKey,node]));
  const keep = new Set(state.candidates.map(candidate=>candidate.key));
  for(const [key,node] of existing)if(!keep.has(key))node.remove();
  for(const candidate of state.candidates) {
    let row = existing.get(candidate.key);
    if(!row) {
      const template = document.createElement('template');template.innerHTML = sourceFlowRow(candidate);row = template.content.firstElementChild;
      list.insertBefore(row,list.querySelector('[data-empty-state]'));animate(row,[{opacity:0},{opacity:1}],180);
    } else {
      row.querySelector('.source-flow-row-info strong').textContent = candidate.sourceName;
      const chapter = row.querySelector('.source-flow-row-info small');chapter.textContent = candidate.latestChapter;chapter.title = candidate.latestChapter;
      row.querySelector('.source-flow-time').innerHTML = esc(candidate.searchLatencyMs)+'<small> ms</small>';
    }
  }
  const empty = list.querySelector('[data-empty-state]');empty.hidden = state.candidates.length > 0;
  empty.textContent = running ? '正在查找其他书源…' : '未找到其他书源';
}
function render(state) {
  snapshot = state;
  if(state.book.source !== readerSource || !el('flow-reader').firstElementChild) {el('flow-reader').innerHTML = reader.render(context(state));readerSource = state.book.source;}
  const modal = drawerStages.has(state.stage) || state.stage === 'switching';
  el('flow-reader').inert = modal;el('flow-reader').setAttribute('aria-hidden',String(modal));
  if(state.stage === 'controls' && previousStage !== 'controls')el('flow-controls').innerHTML = controls.render({...context(state),variant:'quick'});
  if(state.stage !== 'controls')el('flow-controls').innerHTML = '';
  if(drawerStages.has(state.stage))updateDrawer(state);
  else if(state.stage === 'switching') {
    if(previousStage !== 'switching') {
      const panel = el('flow-modal').querySelector('.source-flow-drawer');
      const chosen = [...el('flow-modal').querySelectorAll('[data-source-key]')].find(node=>node.dataset.sourceKey === state.selected.key);chosen?.classList.add('selected');
      for(const button of el('flow-modal').querySelectorAll('button'))button.disabled = true;
      el('flow-modal').inert = true;
      animate(panel,[{transform:'translateY(0)'},{transform:'translateY(100%)'}],280,{fill:'forwards'});
      el('flow-transition').innerHTML = sourceFlowSwitch(state);animate(el('flow-transition').firstElementChild,[{opacity:0},{opacity:1}],280);
      el('flow-transition').firstElementChild.tabIndex = -1;el('flow-transition').firstElementChild.focus({preventScroll:true});
      if(reduced())el('flow-modal').innerHTML = '';
    } else el('flow-transition').querySelector('[data-switch-step]').textContent = {prepare:'准备目标书源',locate:'定位当前章节',finish:'恢复阅读'}[state.switchStep];
  } else {el('flow-modal').innerHTML = '';el('flow-modal').inert = false;el('flow-transition').innerHTML = '';}
  if(state.stage === 'completed' && previousStage !== 'completed') {
    cancelAuto();clearTimeout(toastTimer);el('flow-toast').innerHTML = `<div class="source-flow-toast" role="status">已切换至 ${esc(state.book.source)}</div>`;
    animate(el('flow-reader'),[{opacity:.45},{opacity:1}],320);toastTimer = setTimeout(()=>{el('flow-toast').innerHTML = '';},2200);
    el('flow-reader').querySelector('.reading-paper-control-hit')?.focus({preventScroll:true});
  }
  if(state.stage === 'controls') {clearTimeout(toastTimer);el('flow-toast').innerHTML = '';}
  const index = state.stage === 'controls' || state.stage === 'reader' ? 0 : state.stage === 'opening' ? 1 : ['discovering','ready','stopped'].includes(state.stage) ? 2 : state.stage === 'switching' ? 3 : 4;
  for(const [i,node] of [...el('flow-steps').children].entries()) {node.classList.toggle('active',i===index);if(i===index)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');}
  const labels = {controls:'点击阅读控制栏右上角的“换源”。',reader:'点击正文打开控制栏，可继续演示换源。',opening:'换源抽屉正在弹出。',discovering:`查找进行中，已加入 ${state.candidates.length} 个检查成功的书源。`,stopped:`已停止查找，保留 ${state.candidates.length} 个成功结果。`,ready:`查找结束，${state.candidates.length} 个成功书源可选。`,switching:`已选择 ${state.selected?.sourceName || ''}，正在播放换源动画。`,completed:`已切换至 ${state.book.source}，仍在${state.book.chapter}的原阅读位置。`};
  el('flow-status').textContent = labels[state.stage];el('viewport').dataset.flowStage = state.stage;
  history.replaceState(null,'',state.stage === 'controls' ? '#reader-controls' : drawerStages.has(state.stage) ? '#source-switch' : state.stage === 'switching' ? '#source-switching' : '#reader');
  if(auto && state.stage === 'ready' && previousStage !== 'ready')autoTimer = setTimeout(()=>{if(auto && snapshot.stage === 'ready')model.choose(snapshot.candidates[1]?.key || snapshot.candidates[0]?.key);},900);
  previousStage = state.stage;
}
function initialize() {
  cancelAuto();cancelAnimations();clearTimeout(toastTimer);model?.destroy();previousStage = '';readerSource = '';pointerGuard.reset();
  el('flow-modal').innerHTML = '';el('flow-modal').inert = false;el('flow-transition').innerHTML = '';el('flow-toast').innerHTML = '';
  document.body.dataset.reduced = String(reduced());model = createSourceFlow({onChange:render,reduceMotion:reduced()});render(model.getSnapshot());
}
function dismiss() {if(model.dismiss())el('flow-reader').querySelector('.reading-paper-control-hit')?.focus({preventScroll:true});}
el('flow-auto').addEventListener('click',()=>{initialize();auto = true;autoTimer = setTimeout(()=>{if(auto)model.open();},700);});
el('flow-reset').addEventListener('click',initialize);
el('flow-reduced').checked = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
el('flow-reduced').addEventListener('change',initialize);
el('viewport').addEventListener('click',event=>{
  const button = event.target.closest('button');if(!button || button.disabled)return;
  const key = button.dataset.sourceKey;
  if(key) {if(!pointerGuard.take(key))return;cancelAuto();model.choose(key);return;}
  cancelAuto();
  if(button.dataset.flowAction === 'dismiss'){dismiss();return;}
  if(button.dataset.flowAction === 'discovery'){snapshot.discovery === 'running' ? model.stop() : model.restart();return;}
  if(button.dataset.action === 'open:source-switch'){model.open();return;}
  if(button.dataset.action === 'open:reader-controls' || button.dataset.controlGrabber !== undefined){snapshot.stage === 'controls' ? model.hideControls() : model.showControls();return;}
  el('flow-status').textContent = '本次 demo 聚焦换源流程；请使用控制栏的“换源”入口。';
});
el('viewport').addEventListener('pointerdown',event=>{const row=event.target.closest('[data-source-key]');pointerGuard.down({key:row?.dataset.sourceKey??null,x:event.clientX,y:event.clientY});});
el('viewport').addEventListener('pointermove',event=>pointerGuard.move({x:event.clientX,y:event.clientY}));
document.addEventListener('pointerup',()=>pointerGuard.release());
document.addEventListener('pointercancel',()=>pointerGuard.cancel());
el('viewport').addEventListener('scroll',()=>pointerGuard.scroll(),{capture:true});
document.addEventListener('keydown',event=>{
  if(event.key === 'Escape'){event.preventDefault();cancelAuto();if(drawerStages.has(snapshot.stage))dismiss();else if(snapshot.stage === 'controls')model.hideControls();}
  if(event.key === 'Tab' && (drawerStages.has(snapshot.stage) || snapshot.stage === 'switching')) {
    const root = snapshot.stage === 'switching' ? el('flow-transition') : el('flow-modal');
    const nodes = [...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length && node.tabIndex>=0);
    if(!nodes.length){event.preventDefault();return;}
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey && (document.activeElement===first || !root.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey && (document.activeElement===last || !root.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
});
function measure() {const box = el('viewport').getBoundingClientRect();el('viewport').style.setProperty('--window-w',box.width+'px');el('viewport').style.setProperty('--window-h',box.height+'px');}
window.addEventListener('resize',measure);
window.addEventListener('pagehide',()=>{cancelAuto();cancelAnimations();clearTimeout(toastTimer);model.destroy();});
window.addEventListener('pageshow',event=>{if(event.persisted){initialize();measure();}});
initialize();measure();
if(entryHash === '#source-switch')model.open();
