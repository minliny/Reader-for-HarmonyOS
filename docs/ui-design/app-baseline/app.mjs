import { screens as library } from './ui-library.mjs';
import { screens as settings } from './ui-settings.mjs';
import { screens as reading } from './ui-reading.mjs';
import { esc } from './shared.mjs';
import baseline from './baseline.json';
import {initializeDelivery,applyProfile,applyTextPressure,renderDelivery,measureClick} from './delivery-ui.mjs';
const screens = [...library,...settings,...reading];
const byId = new Map(screens.map(s => [s.id,s]));
const el = id => document.getElementById(id);
let current = 'bookshelf';
let overlay = '';
let variants = {};
let trail = [];
let baseOverlay = '';
function backgroundChain(screen){
  let id=screen.background || 'bookshelf';
  let under='';
  const seen=new Set([screen.id]);
  while(byId.get(id)?.kind==='overlay' && !seen.has(id)){seen.add(id);under=id;id=byId.get(id).background || 'reader';}
  return {current:id,baseOverlay:under};
}
function selected(){return byId.get(overlay || current);}
function context(screen){return {variant:variants[screen.id] || screen.variants?.[0]?.id || 'default',theme:el('preview-theme').value,size:el('viewport').dataset.size||'phone'};}
function jump(id, fromNav=false){
  if(id==='book-removal'){variants[id]=current==='multiselect' ? 'batch' : variants.detail==='local' ? 'local' : 'online';}
  const screen=byId.get(id); if(!screen){hint('此入口没有独立页面稿；请查看逻辑稿中的原页面调用。');return;}
  if(!fromNav)trail.push({current,overlay,baseOverlay});
  else trail=[];
  if(screen.kind==='overlay'){
    if(fromNav || !current || byId.get(screen.background)?.kind==='overlay'){const bg=backgroundChain(screen);current=bg.current;baseOverlay=bg.baseOverlay;if(fromNav)variants[bg.current]=byId.get(bg.current).variants?.[0]?.id;if(bg.baseOverlay)variants[bg.baseOverlay]=screen.backgroundVariant || byId.get(bg.baseOverlay).variants?.[0]?.id;}
    else if(screen.id==='reader-more')baseOverlay='reader-controls';
    else baseOverlay='';
    overlay=id;
  }else{current=id;overlay='';baseOverlay='';}
  history.replaceState(null,'',`#${id}`);
  render();
}
function hint(text){el('action-note').textContent=text;}
function close(){
  if(Number(el('keyboard-height').value)>0){el('keyboard-height').value='0';render();hint('键盘先关闭，保留当前组件与输入上下文。');return;}
  const screen=selected();
  if((overlay==='source-switch' && context(screen).variant==='switching') || screen?.closeBlockedVariants?.includes(context(screen).variant)){hint('当前实际操作尚未结束，原组件阻止关闭。');return;}
  if(['reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace'].includes(overlay)){
    if(el('app-overlay').querySelector('.reading-overlay.full')){variants[overlay]='quick';render();hint('返回先把当前模块从 Full 收到 Quick。');return;}
    overlay='reader-controls';baseOverlay='';variants[overlay]='quick';history.replaceState(null,'','#reader-controls');render();hint('返回控制首页，保留原阅读页面。');return;
  }
  if(overlay==='reader-controls'){overlay='';baseOverlay='';history.replaceState(null,'','#reader');render();return;}
  if(overlay){
    const previous=trail.pop();
    if(previous){current=previous.current;overlay=previous.overlay;baseOverlay=previous.baseOverlay || '';}
    else {overlay='';baseOverlay='';}
  }else{
    const previous=trail.pop();
    if(previous){current=previous.current;overlay=previous.overlay;baseOverlay=previous.baseOverlay || '';}
    else {current='bookshelf';overlay='';baseOverlay='';}
  }
  history.replaceState(null,'',`#${overlay || current}`);render();
}
function render(){
  if(overlay==='book-removal'){current=variants[overlay]==='batch' ? 'multiselect' : 'detail';if(variants[overlay]==='local')variants.detail='local';}
  const page=byId.get(current);if(!page)return;
  applyProfile(current);
  el('viewport').dataset.page=current;el('viewport').dataset.pageVariant=context(page).variant;
  const background=byId.get(baseOverlay);
  el('app-screen').innerHTML=page.render(context(page))+(background ? background.render(context(background)) : '');
  const panel=byId.get(overlay);
  const isReadControl=panel && ['reader-controls','reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace','reader-more'].includes(panel.id);
  el('app-overlay').innerHTML=panel ? `<div class="overlay-layer ${panel.scrim==='transparent' || isReadControl ? 'transparent' : ''}" data-panel="${esc(panel.id)}">${panel.dismissable===false ? '' : '<button class="overlay-dismiss" aria-label="关闭浮层" data-action="close"></button>'}<div class="overlay-content">${panel.render(context(panel))}</div></div>` : '';
  const screen=selected();
  el('current-label').textContent=screen.label;
  el('current-note').textContent=screen.note;
  el('viewport').dataset.activeScreen=screen.id;el('viewport').dataset.activeVariant=context(screen).variant;
  hint('点击画布中的入口查看跳转；读写、检测、导入等动作在此显示真实调用行为。');
  el('variant-bar').innerHTML=(screen.variants || []).map(v=>`<button data-variant="${esc(v.id)}" class="${context(screen).variant===v.id ? 'selected' : ''}">${esc(v.label)}</button>`).join('');
  el('source-links').innerHTML=screen.source.map(s=>`<li><a href="../../../${esc(s.path)}">${esc(s.path.split('/').pop())}:${s.line}</a></li>`).join('');
  for(const node of document.querySelectorAll('[data-screen]'))node.classList.toggle('selected',node.dataset.screen===screen.id);
  const assets=new Set(baseline.media);
  for(const img of el('viewport').querySelectorAll('[data-icon]')){
    const original=img.dataset.icon;const name=el('preview-theme').value==='night' && assets.has(`${original}_theme_night.svg`) ? `${original}_theme_night` : original;
    img.src=`../../../entry/src/main/resources/base/media/${name}.svg`;
  }
  applyTextPressure();renderDelivery(screen,context(screen).variant);
}
function renderNav(){
  const query=el('find-screen').value.trim();let html='';
  for(const group of [...new Set(screens.map(s=>s.group))]){
    const members=screens.filter(s=>s.group===group && (!query || s.label.includes(query) || s.id.includes(query)));
    if(!members.length)continue;
    html+=`<h2 class="nav-group">${esc(group)}</h2>`+members.map(s=>`<button class="nav-screen" data-screen="${esc(s.id)}">${esc(s.label)}${s.kind==='overlay' ? '<span class="item-kind">组件</span>' : ''}</button>`).join('');
  }
  el('screen-nav').innerHTML=html;
  for(const node of document.querySelectorAll('[data-screen]'))node.classList.toggle('selected',node.dataset.screen===selected()?.id);
}
document.addEventListener('click',event=>{
  if(measureClick(event))return;
  const node=event.target.closest('button,[data-action]');if(!node || node.disabled)return;
  if(node.dataset.screen){jump(node.dataset.screen,true);return;}
  if(node.dataset.variant){variants[selected().id]=node.dataset.variant;render();return;}
  const action=node.dataset.action;if(!action)return;
  if(action==='back' || action==='close'){close();return;}
  if(action.startsWith('variant:')){variants[selected().id]=action.slice(8);render();return;}
  if(action.startsWith('go:') || action.startsWith('open:')){jump(action.slice(action.indexOf(':')+1));return;}
  if(action.startsWith('hint:')){hint(action.slice(5));return;}
  hint('此动作对应当前组件回调，真实保存与失败处理见逻辑稿。');
});
el('find-screen').addEventListener('input',renderNav);
el('preview-theme').addEventListener('change',()=>{el('viewport').dataset.theme=el('preview-theme').value;render();});
el('viewport-size').addEventListener('change',render);
for(const id of ['font-scale','keyboard-height','reduce-motion'])el(id).addEventListener('change',render);
window.addEventListener('delivery-render',()=>renderDelivery(selected(),context(selected()).variant));
el('reset-preview').addEventListener('click',()=>{variants={};jump('bookshelf',true);});
document.addEventListener('keydown',event=>{if(event.key==='Escape' && overlay)close();});
el('baseline-note').textContent=`Host ${baseline.host.head.slice(0,12)} · 当前工作区源码快照。${baseline.host.dirtySourceFiles.length ? '包含尚未提交的源码修改。' : ''} 本稿不代表原生视觉或设备验收。`;
initializeDelivery();renderNav();jump(byId.has(location.hash.slice(1)) ? location.hash.slice(1) : 'bookshelf',true);
