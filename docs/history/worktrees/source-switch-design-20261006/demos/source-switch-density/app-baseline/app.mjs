import { screens as library, libraryBooks, applyLibrarySample } from './ui-library.mjs';
import { screens as settings, applySettingsSample, applySettingsAction } from './ui-settings.mjs';
import { screens as reading } from './ui-reading.mjs';
import { esc } from './shared.mjs';
import baseline from './baseline.json';
import {initializeDelivery,applyProfile,applyTextPressure,renderDelivery,measureClick} from './delivery-ui.mjs';
import {readingModules,bookSurfaces,setDemoBook,bookFromNode,bookForSample,readingFormVariant,readingIsFull,localChoiceValue,sourceToolsSessionProtected} from './demo-state.mjs';
import {installControlGestures,installMangaPanelGestures} from './control-gesture.mjs';
const screens = [...library,...settings,...reading];
const byId = new Map(screens.map(s => [s.id,s]));
const el = id => document.getElementById(id);
let current = 'bookshelf';
let overlay = '';
let variants = {};
let trail = [];
let baseOverlay = '';
let temporaryTrail = [];
let openedFromCatalog = false;
let suppressClickUntil = 0;
let choices = { 'source-design': 'direct' };
const sourceDesignNames = { direct: '1 · 直达列表', confirm: '2 · 单选确认', grouped: '3 · 分组清单' };
let rendering = false;
const surfaceState=new Map(), pendingViewReset=new Set();
let focusRestore, focusedModal='', controlGestures,mangaGestures;
let appliedSettingsTheme;
const modalIds=new Set(['book-actions','group-select','local-import','book-removal','reader-tts-config','reader-tts-manager','reader-more','source-switch','reader-exit-failure','reader-refresh-failure','json-import','restore-defaults','source-result','source-export','source-delete','manga-mode','manga-settings','manga-more','manga-downloads']);
const pageParents={directory:'detail',general:'settings',sources:'settings','source-tools':'sources','source-login':'sources','bookshelf-settings':'bookshelf',detail:'bookshelf',search:'bookshelf',multiselect:'bookshelf'};
function focusKey(node){if(!node||!el('viewport').contains(node))return;return {owner:node.closest('[data-action-owner]')?.dataset.actionOwner,choice:node.dataset.choice,...(node.type==='radio'?{choiceValue:node.value}:{}),action:node.dataset.action,label:node.getAttribute('aria-label'),text:node.textContent?.trim(),name:node.getAttribute('name'),tag:node.tagName};}
function findFocus(key,root=el('viewport')){if(!key)return;return [...root.querySelectorAll('button,input,select,textarea,[tabindex]')].find(n=>!n.disabled&&(!key.owner||n.closest('[data-action-owner]')?.dataset.actionOwner===key.owner)&&(key.choice?n.dataset.choice===key.choice&&(key.choiceValue===undefined||n.type==='radio'&&n.value===key.choiceValue):key.label?n.getAttribute('aria-label')===key.label:key.name?n.getAttribute('name')===key.name:n.tagName===key.tag&&n.dataset.action===key.action&&n.textContent.trim()===key.text));}
function snapshot(){return {current,overlay,baseOverlay,openedFromCatalog,book:choices['selected-book']?{...choices['selected-book']}:null,focus:focusKey(document.activeElement),temporaryTrail:temporaryTrail.map(s=>({...s}))};}
function restore(previous){current=previous.current;overlay=previous.overlay;baseOverlay=previous.baseOverlay||'';openedFromCatalog=previous.openedFromCatalog||false;temporaryTrail=previous.temporaryTrail||[];if(previous.book)setDemoBook(choices,previous.book);focusRestore=previous.focus;}
function setVariant(id,value,initializeLibrary=false){variants[id]=value;if(initializeLibrary)applyLibrarySample(id,value,choices);applySettingsSample(id,value,choices);}
function seedSampleBook(id,value){
  if(id==='reader-replace')for(const key of Object.keys(choices))if(key.startsWith('replace-draft-')||key==='replace-editor-mode')delete choices[key];
  if(bookSurfaces.includes(id)||['source-switch','reader-exit-failure','reader-refresh-failure'].includes(id))setDemoBook(choices,bookForSample(libraryBooks,id.startsWith('manga-')?'manga-'+value:value));
  const keys={'source-switch':['source-discovery-mode','source-selected-index','source-confirmation','source-error-message'],'reader-search':['reading-search-state','reading-search-query'],'reader-autopage':['auto-status'],'reader-tts':['tts-status','tts-service-tab','tts-online-configured'],directory:['directory-node-first-expanded','directory-node-second-expanded','directory-tab'],'reader-directory':['directory-node-first-expanded','directory-node-second-expanded','directory-tab']};
  for(const key of keys[id]||[])delete choices[key];
}
function backgroundChain(screen){
  let id=screen.background || 'bookshelf';
  let under='';
  const seen=new Set([screen.id]);
  while(byId.get(id)?.kind==='overlay' && !seen.has(id)){seen.add(id);under=id;id=byId.get(id).background || 'reader';}
  return {current:id,baseOverlay:under};
}
function selected(){return byId.get(overlay || current);}
function context(screen){return {variant:variants[screen.id] || screen.variants?.[0]?.id || 'default',originVariant:temporaryTrail.findLast(s=>s.id===screen.id)?.variant,readerVariant:variants.reader||'normal',choices,book:choices['selected-book']||libraryBooks[0],theme:el('preview-theme').value,size:el('viewport').dataset.size||'phone',deviceType:el('viewport').dataset.deviceType||'phone',tablet:el('viewport').dataset.deviceType==='tablet',viewportWidth:el('viewport').clientWidth,viewportHeight:el('viewport').clientHeight};}
function renderSourceDesignPreview(screen){
  const visible=screen.id==='source-switch'&&context(screen).book.content!=='manga';
  el('source-design-preview').hidden=!visible;
  for(const button of el('source-design-preview').querySelectorAll('[data-source-design]')){
    const active=button.dataset.sourceDesign===(choices['source-design']||'direct');
    button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  }
}
function setSourceDesign(value){
  const screen=selected();
  if(!Object.hasOwn(sourceDesignNames,value)||screen.id!=='source-switch'||context(screen).book.content==='manga')return;
  choices['source-design']=value;
  for(const key of ['source-selected-index','source-discovery-mode','source-confirmation','source-error-message'])delete choices[key];
  for(const key of Object.keys(choices))if(/^source-(row-|retry-|selection-)/.test(key))delete choices[key];
  temporaryTrail=temporaryTrail.filter(state=>state.id!=='source-switch');
  setVariant('source-switch','candidates');pendingViewReset.add('source-switch');render();
  hint(`已切换至${sourceDesignNames[value]}，保留当前书籍并恢复候选列表以便比较。`);
}
function jump(id, fromNav=false, targetVariant='',book){
  const screen=byId.get(id); if(!screen){hint('此入口没有独立页面稿；请查看逻辑稿中的原页面调用。');return;}
  if(controlGestures?.active)controlGestures.cancel();
  mangaGestures?.cancel();
  if(id!=='sources'||fromNav)choices['source-group-open']=false;
  if(!fromNav&&current==='reader'&&context(selected()).book.content==='manga'&&['reader-directory','manga-mode','manga-settings','manga-more','manga-downloads'].includes(id)&&['manga-end','manga-book-end'].includes(variants.reader))setVariant('reader','manga-fragments');
  if(fromNav){const value=targetVariant||variants[id]||screen.variants?.[0]?.id;seedSampleBook(id,value);setVariant(id,value,true);pendingViewReset.add(id);}
  if(!fromNav&&current==='sources'&&id==='source-tools'&&!sourceToolsSessionProtected(choices)){
    for(const key of Object.keys(choices))if(/^source-(selection|operation-|check-(mode|depth)|debug-|batch-|editor-|tools-busy|export-scope|result-(mode|depth))/.test(key))delete choices[key];
    setVariant(id,'default');
  }
  if(targetVariant){if(!screen.variants.some(v=>v.id===targetVariant))throw new Error(`Unknown variant ${id}:${targetVariant}`);setVariant(id,targetVariant);}
  if(id==='json-import'){choices['source-import-url']='';choices['source-import-validation']='';setVariant(id,'default');pendingViewReset.add(id);}
  if(id==='reader-tts-manager'&&overlay!=='reader-tts-manager'){for(const key of Object.keys(choices))if(key.startsWith('tts-manager-'))delete choices[key];pendingViewReset.add(id);}
  if(!fromNav&&overlay==='reader-tts-config'&&id==='reader-tts-manager'){
    const previous=trail.pop();if(previous?.overlay==='reader-tts')restore(previous);else{overlay='reader-tts';baseOverlay='';}
  }
  if(!fromNav&&overlay==='source-result'&&id==='search'){
    trail.pop();const origin=trail.findLastIndex(s=>s.current==='search'&&!s.overlay);
    if(origin>=0){const previous=trail[origin];trail.splice(origin);restore(previous);}else{current=id;overlay='';baseOverlay='';openedFromCatalog=false;temporaryTrail=[];}
    history.replaceState(null,'',`#${id}`);render();return;
  }
  if(!fromNav&&current==='source-login'&&id==='sources'){
    const previous=trail.pop();if(previous?.current==='sources')restore(previous);else{current=id;overlay='';baseOverlay='';}
    history.replaceState(null,'',`#${id}`);render();return;
  }
  if(id==='book-removal'&&!targetVariant){setVariant(id,current==='multiselect'?'batch':context(selected()).book.kind==='local'?'local':'online');}
  // A dispatched book action closes its menu before opening another surface.
  // The confirmation belongs to the actual source page, not to the old menu.
  const dispatchedSheets=['book-actions','shelf-more','reader-more','manga-more','source-confirm','source-result','json-import','book-removal','source-export','source-delete','restore-defaults'];
  if(!fromNav&&overlay!==id&&dispatchedSheets.includes(overlay)){const origin=trail.pop();if(origin)restore(origin);else{overlay='';baseOverlay='';}}
  if(!fromNav&&screen.kind==='page'&&current===id&&!overlay){history.replaceState(null,'',`#${id}`);render();return;}
  if(!fromNav)trail.push(snapshot());
  else {trail=[];temporaryTrail=[];}
  if(book){
    if(setDemoBook(choices,book)){
      for(const surface of bookSurfaces)pendingViewReset.add(surface);
      for(const surface of ['reader','directory','detail',...readingModules])delete variants[surface];
    }
    if(id==='reader')setVariant(id,book.kind==='local'?'local':book.content==='manga'?'manga-fragments':'normal');
    if(targetVariant)setVariant(id,targetVariant);
    if(id==='multiselect')choices['library-selection']=1<<book.index;
  }
  if(screen.kind!=='overlay'&&['bookshelf','settings'].includes(id)){trail=[];temporaryTrail=[];}
  openedFromCatalog=fromNav;
  if(screen.kind==='overlay'){
    if(!fromNav&&screen.id==='reader-more'&&current==='reader')baseOverlay=readingModules.includes(overlay)?overlay:baseOverlay||'reader-controls';
    else if(fromNav || !current || byId.get(screen.background)?.kind==='overlay'){const bg=backgroundChain(screen),keepBackground=!fromNav&&(overlay===bg.baseOverlay||baseOverlay===bg.baseOverlay);current=bg.current;baseOverlay=bg.baseOverlay;if(fromNav)variants[bg.current]=byId.get(bg.current).variants?.[0]?.id;if(bg.baseOverlay&&!keepBackground)variants[bg.baseOverlay]=screen.backgroundVariant || byId.get(bg.baseOverlay).variants?.[0]?.id;}
    else if(screen.contextualBackground)baseOverlay=readingModules.includes(overlay)?overlay:baseOverlay;
    else baseOverlay='';
    overlay=id;
  }else{current=id;overlay='';baseOverlay='';}
  history.replaceState(null,'',`#${id}`);
  render();
}
function hint(text){el('action-note').textContent=text;}
function finishEditorSample(variant){
  if(['editor','editor-switch-success'].includes(variant)&&choices['source-editor-pending-source']){
    choices['source-editor-source']=choices['source-editor-pending-source'];
    for(const key of ['source-editor-draft','source-editor-pending-source','source-editor-readback-failed'])delete choices[key];
  }
  if(['editor-saved','editor-reread-success','editor-cancelled'].includes(variant))for(const key of ['source-editor-source','source-editor-draft','source-editor-pending-source','source-editor-readback-failed'])delete choices[key];
}
function close(systemBack=false){
  mangaGestures?.cancel();
  if(systemBack&&Number(el('keyboard-height').value)>0){el('keyboard-height').value='0';render();hint('此压力样例模拟 IME 先消费返回；各端真实顺序仍需原生验证。');return;}
  if(systemBack&&current==='sources'&&!overlay&&choices['source-group-open']){choices['source-group-open']=false;render();return;}
  const screen=selected();
  const dismissTemporaryFromSystem=systemBack&&(screen.id==='reader-tts-config'||screen.id==='reader-replace'&&screen.temporaryVariants?.includes(context(screen).variant));
  const mangaPreparation=overlay==='source-switch'&&context(screen).book.content==='manga'&&context(screen).variant==='switching';
  if(!dismissTemporaryFromSystem&&!mangaPreparation&&((overlay==='source-switch' && ['switching','manga-selection-commit'].includes(context(screen).variant)) || screen?.closeBlockedVariants?.includes(context(screen).variant))){hint('当前实际操作尚未结束，原组件阻止关闭。');return;}
  const temporary=temporaryTrail.findLastIndex(s=>s.id===screen.id);
  if(temporary>=0){variants[screen.id]=temporaryTrail[temporary].variant;temporaryTrail.splice(temporary);render();return;}
  const activeVariant=context(screen).variant;
  const parentVariant=typeof screen.closeToVariant==='function' ? screen.temporaryVariants?.includes(activeVariant)&&screen.closeToVariant(activeVariant) : screen.closeToVariant?.[activeVariant];
  if(parentVariant){variants[screen.id]=parentVariant;render();return;}
  if(['reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace'].includes(overlay)){
    if(el('app-overlay').querySelector('.reading-overlay.full')){variants[overlay]=screen.quickVariantByFull?.[context(screen).variant]||'quick';render();hint('返回先把当前模块从 Full 收到 Quick。');return;}
    overlay='reader-controls';baseOverlay='';variants[overlay]='quick';history.replaceState(null,'','#reader-controls');render();hint('返回控制首页，保留原阅读页面。');return;
  }
  if(overlay==='reader-controls'){overlay='';baseOverlay='';history.replaceState(null,'','#reader');render();return;}
  if(overlay){
    const previous=trail.pop();
    if(previous){restore(previous);}
    else {overlay=baseOverlay;baseOverlay='';}
  }else{
    const previous=trail.pop();
    if(previous){restore(previous);}
    else {current=pageParents[current]||'bookshelf';overlay='';baseOverlay='';}
  }
  history.replaceState(null,'',`#${overlay || current}`);render();
}
function renderSurface(screen){return screen.render(context(screen)).replace(/^<([a-z][a-z0-9-]*)/i,`<$1 data-action-owner="${screen.id}"`);}
function surfaceNodes(){
  const result=new Map(),counts=new Map();
  for(const node of el('viewport').querySelectorAll('*')){
    const owner=node.closest('[data-action-owner]')?.dataset.actionOwner;if(!owner)continue;
    const base=node.dataset.scrollKey||node.dataset.choice||node.id||`${node.tagName}:${node.getAttribute('name')||node.getAttribute('aria-label')||node.classList[0]||''}`;
    const scope=owner+'|'+base,index=counts.get(scope)||0;counts.set(scope,index+1);
    if(!result.has(owner))result.set(owner,[]);result.get(owner).push([`${base}:${index}`,node]);
  }
  return result;
}
function captureSurfaces(){
  const focus=focusKey(document.activeElement);
  for(const[owner,nodes]of surfaceNodes()){
    const stored={scroll:{},fields:{},focus:focus?.owner===owner?focus:null};
    for(const[key,node]of nodes){
      if(node.scrollTop||node.scrollLeft||node.scrollHeight>node.clientHeight)stored.scroll[key]=[node.scrollLeft,node.scrollTop];
      if(['INPUT','SELECT','TEXTAREA'].includes(node.tagName))stored.fields[key]={value:node.value,checked:node.checked};
    }
    surfaceState.set(owner,stored);
  }
}
function restoreSurfaces(){
  for(const[owner,nodes]of surfaceNodes()){
    const stored=surfaceState.get(owner);if(!stored)continue;
    for(const[key,node]of nodes){
      const field=stored.fields[key];if(field&&!node.dataset.choice){node.value=field.value;if(node.type==='checkbox')node.checked=field.checked;}
      if(stored.scroll[key]){node.scrollLeft=stored.scroll[key][0];node.scrollTop=stored.scroll[key][1];}
    }
  }
}
const focusables=root=>[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]')].filter(n=>n.tabIndex>=0&&!n.hidden&&!n.closest('[hidden],[inert]')&&n.getClientRects().length>0);
function applyModalFocus(){
  const modal=modalIds.has(overlay),root=el('app-overlay').querySelector('.overlay-layer');
  el('app-screen').inert=modal;if(modal)el('app-screen').setAttribute('aria-hidden','true');else el('app-screen').removeAttribute('aria-hidden');
  if(modal&&root){
    const panel=root.querySelector('[role="dialog"],[role="alertdialog"]')||root.querySelector('.overlay-content>*');
    if(!panel.hasAttribute('role')){panel.setAttribute('role',overlay.endsWith('failure')||overlay==='library-error'?'alertdialog':'dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',selected().label);panel.tabIndex=-1;}
    if(overlay.endsWith('failure')||overlay==='library-error')panel.setAttribute('role','alertdialog');
    const same=focusedModal===overlay,stored=surfaceState.get(overlay);
    const target=same?findFocus(stored?.focus,panel)||focusables(panel)[0]||panel:panel.querySelector('[autofocus]')||focusables(panel)[0]||panel;
    target?.focus({preventScroll:true});focusedModal=overlay;
  }else{
    focusedModal='';const key=focusRestore||surfaceState.get(overlay||current)?.focus;
    findFocus(key)?.focus({preventScroll:true});focusRestore=undefined;
  }
}
function render(){
  if(rendering)return;rendering=true;
  try{
  captureSurfaces();for(const id of pendingViewReset)surfaceState.delete(id);pendingViewReset.clear();
  const active=selected();
  if((openedFromCatalog||active.id==='source-switch')&&active.backgroundByVariant?.[context(active).variant]){const bg=active.backgroundByVariant[context(active).variant];current=bg.background;baseOverlay='';if(bg.backgroundVariant)variants[current]=bg.backgroundVariant;}
  if(openedFromCatalog&&overlay==='book-removal'){current=variants[overlay]==='batch' ? 'multiselect' : 'detail';if(variants[overlay]==='local')variants.detail='local';}
  const page=byId.get(current);if(!page)return;
  applyProfile(current);
  const settingsTheme=choices['settings-theme-mode'];
  if(settingsTheme&&settingsTheme!==appliedSettingsTheme){const theme=settingsTheme==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'night':'day'):settingsTheme==='night'?'night':'day';el('preview-theme').value=theme;el('viewport').dataset.theme=theme;appliedSettingsTheme=settingsTheme;}
  el('viewport').dataset.page=current;el('viewport').dataset.pageVariant=context(page).variant;
  const background=byId.get(baseOverlay);
  el('app-screen').innerHTML=renderSurface(page)+(background ? renderSurface(background) : '');
  const panel=byId.get(overlay);
  const isReadControl=panel && ['reader-controls','reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace','reader-more'].includes(panel.id);
  el('app-overlay').innerHTML=panel ? `<div class="overlay-layer ${panel.scrim==='transparent' || isReadControl ? 'transparent' : ''}" data-panel="${esc(panel.id)}" data-action-owner="${panel.id}">${panel.dismissable===false ? '' : '<button class="overlay-dismiss" aria-label="关闭浮层" tabindex="-1" aria-hidden="true" data-action="close"></button>'}<div class="overlay-content">${renderSurface(panel)}</div></div>` : '';
  restoreSurfaces();
  const screen=selected();
  el('current-label').textContent=screen.label;
  el('current-note').textContent=screen.note;
  el('viewport').dataset.activeScreen=screen.id;el('viewport').dataset.activeVariant=context(screen).variant;
  hint('点击画布中的入口查看跳转；读写、检测、导入等动作在此显示真实调用行为。');
  el('variant-bar').innerHTML=(screen.variants || []).map(v=>`<button data-variant="${esc(v.id)}" class="${context(screen).variant===v.id ? 'selected' : ''}">${esc(v.label)}</button>`).join('');
  renderSourceDesignPreview(screen);
  el('source-links').innerHTML=screen.source.map(s=>`<li><a href="../../../${esc(s.path)}">${esc(s.path.split('/').pop())}:${s.line}</a></li>`).join('');
  for(const node of document.querySelectorAll('[data-screen]'))node.classList.toggle('selected',node.dataset.screen===screen.id);
  const assets=new Set(baseline.media);
  for(const img of el('viewport').querySelectorAll('[data-icon]')){
    const original=img.dataset.icon;const name=el('preview-theme').value==='night' && assets.has(`${original}_theme_night.svg`) ? `${original}_theme_night` : original;
    img.src=`../../../entry/src/main/resources/base/media/${name}.svg`;
  }
  applyTextPressure();renderDelivery(screen,context(screen).variant);
  for(const node of el('viewport').querySelectorAll('.reading-overlay.full [data-reading-font]'))node.draggable=true;
  placeReadingSelects();
  placePopups();measureImportResult();applyModalFocus();
  }finally{rendering=false;}
}
function placeReadingSelects(){
  const viewport=el('viewport').getBoundingClientRect();
  for(const panel of el('viewport').querySelectorAll('[data-reading-select-panel]')){
    const kind=panel.dataset.readingSelectPanel,trigger=el('viewport').querySelector(`[data-reading-select="${kind}"]`);
    if(!trigger)continue;
    const anchor=trigger.getBoundingClientRect(),owner=panel.offsetParent.getBoundingClientRect(),height=panel.getBoundingClientRect().height;
    const left=Math.max(viewport.left,owner.left),right=Math.min(viewport.right,owner.right),top=Math.max(viewport.top,owner.top),bottom=Math.min(viewport.bottom,owner.bottom);
    const tts=kind.startsWith('tts-'),width=panel.getBoundingClientRect().width;
    const x=tts?right-(kind==='tts-voice'?21:13)-width:Math.max(left,Math.min(right-104,anchor.right-104));
    let y=tts?anchor.bottom+2:anchor.top+35;
    if(y+height>bottom-(tts?8:0))y=tts?anchor.bottom-54-height:anchor.top-5-height;
    y=Math.max(top+(tts?8:0),Math.min(bottom-height-(tts?8:0),y));
    panel.style.left=`${x-owner.left}px`;panel.style.top=`${y-owner.top}px`;
    panel.style.right='auto';
    panel.dataset.anchorPositioned='true';
  }
}
function placePopups(){
  const viewport=el('viewport').getBoundingClientRect();
  for(const panel of el('viewport').querySelectorAll('[data-anchored-popup]')){
    const kind=panel.dataset.anchoredPopup,trigger=el('viewport').querySelector(`[data-popup-anchor="${kind}"]`);if(!trigger)continue;
    const anchor=trigger.getBoundingClientRect(),owner=panel.offsetParent.getBoundingClientRect(),rect=panel.getBoundingClientRect();
    const left=Math.max(owner.left,viewport.left),top=Math.max(owner.top,viewport.top),right=Math.min(owner.right,viewport.right),bottom=Math.min(owner.bottom,viewport.bottom);
    let x,y,height=rect.height;
    if(kind==='shelf-more'){
      x=Math.max(left+8,Math.min(anchor.right+11-rect.width,right-rect.width-8));
      y=Math.max(top,Math.min(anchor.bottom-5,bottom-62-8));height=Math.max(0,Math.min(212,bottom-y-8));
    }else if(kind==='manga-downloads'){
      x=Math.max(left+8,Math.min(anchor.right-rect.width,right-rect.width-8));
      y=Math.max(top+8,Math.min(anchor.bottom,bottom-height-8));
    }else{
      // ReaderSelectPanel overlays the control, not a dropdown below it.
      x=anchor.left;y=anchor.top;panel.style.width=`${anchor.width}px`;
    }
    Object.assign(panel.style,{left:`${x-owner.left}px`,top:`${y-owner.top}px`,right:'auto',bottom:'auto',maxHeight:`${Math.max(0,bottom-y-8)}px`});
    if(kind==='shelf-more')panel.style.height=`${height}px`;
    if(kind==='source-group')panel.style.maxHeight='';
    panel.style.setProperty('--popup-pointer-x',`${Math.max(0,Math.min(rect.width-24,anchor.right-22-x-12))}px`);
    panel.dataset.popupSide=y<anchor.top?'above':'below';
  }
}
function measureImportResult(){
  const panel=el('viewport').querySelector('[data-import-result]');if(!panel)return;
  const bounds=el('viewport').getBoundingClientRect(),style=getComputedStyle(el('viewport'));
  const cap=Math.max(0,bounds.height-parseFloat(style.getPropertyValue('--safe-top')||0)-parseFloat(style.getPropertyValue('--safe-bottom')||0)-40-Number(el('keyboard-height').value));
  const height=sel=>panel.querySelector(sel)?.getBoundingClientRect().height||0;
  const chrome=height('[data-import-header]')+height('[data-import-summary]')+12,footer=height('[data-import-footer]'),items=height('[data-import-items]')+2;
  const compact=chrome+footer>cap;
  panel.dataset.importCompact=String(compact);
  panel.style.setProperty('--import-panel-height',`${Math.min(cap,chrome+footer+items)}px`);
  panel.style.setProperty('--import-list-height',`${Math.min(items,Math.max(0,cap-footer-(compact?0:chrome)))}px`);
  panel.style.setProperty('--import-scroll-height',`${Math.max(0,cap-footer)}px`);
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
  if(performance.now()<suppressClickUntil){event.preventDefault();return;}
  if(measureClick(event))return;
  const node=event.target.closest('button,[data-action]');if(!node || node.disabled)return;
  if(node.dataset.sourceDesign){setSourceDesign(node.dataset.sourceDesign);node.focus({preventScroll:true});return;}
  const nodeBook=bookFromNode(node,libraryBooks,choices['selected-book']);
  if(node.dataset.readerChapter!==undefined)choices['reader-chapter-index']=Number(node.dataset.readerChapter);
  if(node.dataset.sourceId)choices['active-source-id']=node.dataset.sourceId;
  if(node.dataset.sourceOperationEnabled!==undefined)choices['source-operation-enabled']=localChoiceValue(node.dataset.sourceOperationEnabled);
  if(node.dataset.sourceLoginResult)applySettingsAction(`source:login-${node.dataset.sourceLoginResult}`,choices,{sourceId:choices['active-source-id']});
  if(node.dataset.sourceOperationSelection!==undefined)choices['source-operation-selection']=node.dataset.sourceOperationSelection;
  if(node.dataset.exportScope!==undefined)choices['source-export-scope']=node.dataset.exportScope;
  if(node.dataset.sourceEditorRequest){
    if(node.dataset.sourceEditorCurrent)choices['source-editor-source']=node.dataset.sourceEditorCurrent;
    choices['source-editor-pending-source']=node.dataset.sourceEditorRequest;
    choices['source-editor-readback-failed']=node.dataset.sourceEditorReadback==='true';
  }
  if(node.dataset.sourceEditorClear==='true')for(const key of ['source-editor-source','source-editor-draft','source-editor-pending-source','source-editor-readback-failed'])delete choices[key];
  if(node.dataset.sourceResultStart==='true'){choices['source-result-mode']=choices['source-check-mode']||'search';choices['source-result-depth']=choices['source-check-depth']||'2';}
  const choiceValue=node.dataset.choiceValue??node.dataset.value;
  if(node.dataset.choice==='rule-count'&&choiceValue!==undefined){
    const rows=[...el('viewport').querySelectorAll('.reading-rule-draft')],count=rows.length;
    for(const input of rows.flatMap(row=>[...row.querySelectorAll('[data-choice]')]))choices[input.dataset.choice]=input.value;
    if(node.dataset.ruleDelete!==undefined){
      const index=Number(node.dataset.ruleDelete);
      for(let i=index;i<count-1;i++)for(const part of ['pattern','level','boundary'])choices[`rule-${part}-${i}`]=choices[`rule-${part}-${i+1}`];
      for(const part of ['pattern','level','boundary'])delete choices[`rule-${part}-${count-1}`];
    }else if(Number(choiceValue)>count){
      for(let i=count;i<Number(choiceValue);i++){choices[`rule-pattern-${i}`]='';choices[`rule-level-${i}`]='0';choices[`rule-boundary-${i}`]='已有标题';}
    }
  }
  if(node.dataset.choice&&choiceValue!==undefined){if(node.dataset.choiceGuard==='busy'){hint('当前操作尚未结束，保留已确认选项。');return;}choices[node.dataset.choice]=localChoiceValue(choiceValue);if(node.dataset.choice==='settings-theme-mode')appliedSettingsTheme=undefined;if(node.dataset.choiceClear)choices[node.dataset.choiceClear]='';if(node.dataset.closeChoice){choices[node.dataset.closeChoice]=false;focusRestore=focusKey(el('viewport').querySelector('[data-popup-anchor="source-group"]'));}render();if(!node.dataset.action){if(node.dataset.actionNote)hint(node.dataset.actionNote);return;}}
  if(node.dataset.screen){jump(node.dataset.screen,true);return;}
  if(node.dataset.variant){const screen=selected();seedSampleBook(screen.id,node.dataset.variant);pendingViewReset.add(screen.id);if(!(screen.temporaryVariants?.includes(context(screen).variant)&&screen.temporaryVariants?.includes(node.dataset.variant)))temporaryTrail=temporaryTrail.filter(s=>s.id!==screen.id);if(screen.id==='source-tools')finishEditorSample(node.dataset.variant);setVariant(screen.id,node.dataset.variant,true);render();return;}
  const action=node.dataset.action;if(!action)return;
  if(action==='manga-reset-settings'){Object.assign(choices,{'manga-direction':'vertical','manga-fit':'width','manga-page-numbers':true,'manga-brightness':78});render();return;}
  if(action==='scroll:settings'){const scroller=el('viewport').querySelector('.settings-scroll');if(scroller)scroller.scrollTop=0;return;}
  if(action==='library:clear-filters'){choices['library-reading-filter']='all';choices['library-content-filter']='all';choices['library-source-filter']='all';render();return;}
  if(action==='library:clear-search'){choices['library-search-draft']='';render();return;}
  if(action.startsWith('source:')){applySettingsAction(action,choices,{sourceId:choices['active-source-id'],enabled:localChoiceValue(node.dataset.sourceEnabled)});render();return;}
  if(action==='submit:json-import'){submitJsonImport();return;}
  if(action==='toggle-control-form'){const screen=selected();setVariant(screen.id,readingFormVariant(screen,context(screen).variant,readingIsFull(screen,context(screen).variant)?'quick':'full'));render();return;}
  if(node.dataset.requiredChoice&&!String(choices[node.dataset.requiredChoice]||'').trim()){variants[selected().id]='empty-url';render();return;}
  if(action==='back' || action==='close'){close();if(node.dataset.actionNote)hint(node.dataset.actionNote);return;}
  if(action.startsWith('temporary:')){const screen=selected(),variant=action.slice(10);if(!screen.variants.some(v=>v.id===variant))throw new Error(`Unknown temporary ${screen.id}:${variant}`);if(screen.id==='reader-replace'&&['editor','edit'].includes(variant)){for(const key of Object.keys(choices))if(key.startsWith('replace-draft-'))delete choices[key];choices['replace-editor-mode']=variant==='edit'?'edit':'new';}if(!screen.temporaryVariants?.includes(context(screen).variant))temporaryTrail.push({id:screen.id,variant:context(screen).variant});variants[screen.id]=variant;render();if(node.dataset.actionNote)hint(node.dataset.actionNote);return;}
  if(action.startsWith('variant:')){const variant=action.slice(8);if(!selected().variants.some(v=>v.id===variant))throw new Error(`Unknown variant ${selected().id}:${variant}`);if(selected().id==='source-tools')finishEditorSample(variant);setVariant(selected().id,variant);render();if(node.dataset.actionNote)hint(node.dataset.actionNote);return;}
  if(action.startsWith('go:') || action.startsWith('open:')){if(node.dataset.backgroundVariant)setVariant(current,node.dataset.backgroundVariant);if(action==='go:multiselect'&&node.dataset.bookIndex!==undefined)choices['library-selection']=1<<Number(node.dataset.bookIndex);jump(action.slice(action.indexOf(':')+1),false,node.dataset.targetVariant||'',nodeBook);if(node.dataset.actionNote)hint(node.dataset.actionNote);return;}
  if(action==='collapse'){const screen=selected();temporaryTrail=temporaryTrail.filter(s=>s.id!==screen.id);setVariant(screen.id,readingFormVariant(screen,context(screen).variant,'quick'));render();return;}
  if(action==='expand'){const screen=selected();setVariant(screen.id,readingFormVariant(screen,context(screen).variant,'full'));render();return;}
  if(action.startsWith('hint:')){if(node.dataset.dismissOverlay==='true')close();hint(action.slice(5));return;}
  hint('此动作对应当前组件回调，真实保存与失败处理见逻辑稿。');
});
function submitJsonImport(){
  const value=String(choices['source-import-url']||'').trim();
  if(!value){choices['source-import-validation']='请输入在线 JSON 的 HTTP/HTTPS 地址';variants['json-import']='empty-url';render();return;}
  choices['source-import-validation']='';close();hint('提交该链接给当前 Host 在线导入入口；预览不执行网络或 Core 导入。');
}
function captureChoice(event){
  if(rendering)return;
  const node=event.target.closest('[data-choice]');if(!node||node.disabled||node.readOnly)return;const key=node.dataset.choice;
  if(node.dataset.choiceGuard==='busy'){node.value=choices[key]??node.defaultValue;return;}
  const clearsVisibleValidation=node.dataset.clearValidation==='json-import'&&Boolean(choices['source-import-validation']||variants['json-import']==='empty-url');
  choices[key]=node.type==='checkbox'?node.checked:node.value;
  if(key==='tts-manager-api-key'&&node.value)choices['tts-manager-clear-key']=false;
  if(node.dataset.clearValidation==='json-import'){choices['source-import-validation']='';if(variants['json-import']==='empty-url')variants['json-import']='default';}
  if(node.dataset.variantOnInput){
    const variant=node.dataset.variantOnInput;if(!selected().variants.some(v=>v.id===variant))throw new Error(`Unknown input variant ${selected().id}:${variant}`);
    const start=node.selectionStart,end=node.selectionEnd,scroll=el('viewport').querySelector('.reading-book-directory-frame')?.scrollTop;
    if(key.startsWith('rule-')&&choices['rule-count']===undefined)choices['rule-count']=el('viewport').querySelectorAll('.reading-rule-draft').length;
    variants[selected().id]=variant;render();
    const replacement=[...el('viewport').querySelectorAll('[data-choice]')].find(n=>n.dataset.choice===key);
    replacement?.focus();if(replacement?.setSelectionRange&&start!==null&&start!==undefined)replacement.setSelectionRange(start,end);
    const scroller=el('viewport').querySelector('.reading-book-directory-frame');if(scroller&&scroll!==undefined)scroller.scrollTop=scroll;
  }else if(clearsVisibleValidation||(event.type==='change'&&node.tagName==='SELECT')||node.dataset.rerenderOnInput==='true'||node.dataset.renderChoice==='true'||node.dataset.renderOnInput==='true'){
    if(event.isComposing)return;
    const focus=focusKey(node),start=node.selectionStart,end=node.selectionEnd;render();const replacement=findFocus(focus);replacement?.focus({preventScroll:true});
    if(replacement?.setSelectionRange&&start!==null&&start!==undefined)replacement.setSelectionRange(start,end);
  }
}
document.addEventListener('input',captureChoice);
document.addEventListener('change',captureChoice);
let draggedFont;
el('viewport').addEventListener('dragstart',event=>{const node=event.target.closest('[data-reading-font]');if(!node||!node.closest('.reading-overlay.full'))return;draggedFont=node.dataset.readingFont;event.dataTransfer?.setData('text/plain',draggedFont);});
el('viewport').addEventListener('dragover',event=>{if(draggedFont&&event.target.closest('[data-reading-font]'))event.preventDefault();});
el('viewport').addEventListener('drop',event=>{
  const node=event.target.closest('[data-reading-font]');if(!draggedFont||!node)return;event.preventDefault();
  const order=[...el('viewport').querySelectorAll('[data-reading-font]')].map(n=>n.dataset.readingFont),from=order.indexOf(draggedFont),to=order.indexOf(node.dataset.readingFont);
  if(from>=0&&to>=0){order.splice(to,0,...order.splice(from,1));choices['reading-font-order']=order;render();hint('已调整本地字体顺序预览；应用通过原外观保存回调确认。');}draggedFont=undefined;
});
el('viewport').addEventListener('dragend',()=>{draggedFont=undefined;});
let longPress;
let longPressOrigin;
document.addEventListener('pointerdown',event=>{const node=event.target.closest('[data-long-action],[data-longpress-action]');if(!node||node.disabled)return;clearTimeout(longPress);longPressOrigin={x:event.clientX,y:event.clientY};longPress=setTimeout(()=>{longPress=null;suppressClickUntil=performance.now()+700;const action=node.dataset.longAction||node.dataset.longpressAction;if(action?.startsWith('open:'))jump(action.slice(5),false,node.dataset.bookKind==='local'?'local':'default',bookFromNode(node,libraryBooks,choices['selected-book']));else if(action?.startsWith('variant:')){setVariant(selected().id,action.slice(8));render();}},500);});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{clearTimeout(longPress);longPress=null;longPressOrigin=null;});
document.addEventListener('pointermove',event=>{if(longPressOrigin&&Math.hypot(event.clientX-longPressOrigin.x,event.clientY-longPressOrigin.y)>=8){clearTimeout(longPress);longPress=null;longPressOrigin=null;}});
el('find-screen').addEventListener('input',renderNav);
el('preview-theme').addEventListener('change',()=>{el('viewport').dataset.theme=el('preview-theme').value;render();});
el('viewport-size').addEventListener('change',render);
for(const id of ['font-scale','keyboard-height','reduce-motion'])el(id).addEventListener('change',render);
window.addEventListener('delivery-render',()=>renderDelivery(selected(),context(selected()).variant));
el('reset-preview').addEventListener('click',()=>{controlGestures?.cancel();variants={};choices={'source-design':'direct'};surfaceState.clear();jump('bookshelf',true);});
document.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&modalIds.has(overlay)&&!event.target.closest('#source-design-preview')){
    const layer=el('app-overlay'),root=layer.querySelector('[role="dialog"],[role="alertdialog"]')||layer,nodes=focusables(root);if(!nodes.length){event.preventDefault();return;}
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
  if(event.key==='Enter'&&!event.isComposing&&event.target.dataset.submitAction==='submit:json-import'){event.preventDefault();submitJsonImport();return;}
  if(event.key==='Escape'&&current==='sources'&&!overlay&&choices['source-group-open']){event.preventDefault();choices['source-group-open']=false;render();return;}
  if(event.key==='Escape' && (overlay||pageParents[current])){event.preventDefault();controlGestures?.cancel();close(true);}
});
controlGestures=installControlGestures({viewport:el('viewport'),getScreen:()=>selected().id,getReducedMotion:()=>el('reduce-motion').checked||Boolean(choices['settings-reduce-motion']),onEndpoint:(id,location)=>{
  if(selected().id!==id)return;
  if(location.level==='hidden'){overlay='';baseOverlay='';trail=trail.filter(s=>s.current!=='reader');history.replaceState(null,'','#reader');}
  else setVariant(id,readingFormVariant(byId.get(id),context(byId.get(id)).variant,location.form));
  render();
}});
mangaGestures=installMangaPanelGestures({viewport:el('viewport'),getScreen:()=>selected().id,onDismiss:()=>close()});
el('baseline-note').textContent=`Host ${baseline.host.head.slice(0,12)} · 当前工作区源码快照。${baseline.host.dirtySourceFiles.length ? '包含尚未提交的源码修改。' : ''} 本稿不代表原生视觉或设备验收。`;
initializeDelivery();renderNav();
const initialId=location.hash.slice(1)||'source-switch';
jump(initialId==='library-error'?'bookshelf':byId.has(initialId)?initialId:'bookshelf',true,initialId==='library-error'?'remove-unknown':'');
