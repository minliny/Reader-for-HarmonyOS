import { libraryScreens, libraryPending as libraryPendingScreens } from './library.mjs';
import { readingScreens, readingPendingScreens } from './reading.mjs';
import { settingsScreens, settingsPendingScreens } from './settings.mjs';
import { readingPreferenceScreens } from './reading-preferences.mjs';
import { esc } from './shared.mjs';

const build = window.__READER_DEMO_BUILD__ || { captures:{}, specs:[], generatedAt:null };
const registered = [...libraryScreens, ...readingScreens, ...readingPreferenceScreens, ...settingsScreens];
const captureFor = id => build.captures?.[id] || null;
const isConfirmedTarget = (screen,variant) => screen.id==='reader-more-target'&&variant.id==='comic-style'&&(variant.category||screen.category)==='confirmed-demo-unimplemented'&&variant.referenceCaptureId&&captureFor(variant.referenceCaptureId)?.baselineAdmission===true&&captureFor(variant.referenceCaptureId)?.review?.screen==='manga-more';
const isNativeAllowed = (screen,variant) => (variant.category||screen.category||'existing-app')==='existing-app'&&captureFor(variant.captureId)?.baselineAdmission===true&&captureFor(variant.captureId)?.review?.screen===screen.id;
const allowedVariants = screen => (screen.variants || []).filter(v => isNativeAllowed(screen,v)||isConfirmedTarget(screen,v));
const screens = registered.map(s => ({...s, variants:allowedVariants(s)})).filter(s => s.variants.length);
const byId = new Map(screens.map(s => [s.id,s]));
const unseenRegistered = registered.filter(s => !byId.has(s.id)).map(s => ({id:s.id,label:s.label,group:s.group}));
const pendingMap = new Map([...libraryPendingScreens,...readingPendingScreens,...settingsPendingScreens,...unseenRegistered].filter(s=>!byId.has(s.id)).map(s => [s.id,s]));
const profiles = [
  {id:'native',label:'VM · 365.714 × 809.143',width:365.714,height:809.143},
  {id:'ios',label:'iOS · 390 × 844',width:390,height:844},
  {id:'android',label:'Android · 412 × 915',width:412,height:915},
];
const root = document.getElementById('demo-root');
let state = {};
let active = null;
let history = [];
let profile = profiles[0];
let theme = 'day';
let message = '';
let messageTone = '';
let blockedTarget = '';
let evidenceExpanded = false;
const scrollMemory = new Map();
let renderedRoute = '';

function rememberScroll() {
  for(const element of root.querySelectorAll?.('[data-scroll-key]') || []){
    scrollMemory.set(`${renderedRoute}|${element.dataset.scrollKey}`,{top:element.scrollTop,left:element.scrollLeft});
  }
}
function restoreScroll() {
  renderedRoute=routeKey(active);
  for(const element of root.querySelectorAll?.('[data-scroll-key]') || []){
    const position=scrollMemory.get(`${renderedRoute}|${element.dataset.scrollKey}`);
    const initial=Number(element.dataset.initialScroll||0);
    element.scrollTop=position?.top ?? (Number.isFinite(initial)?initial:0);
    element.scrollLeft=position?.left ?? 0;
  }
}

const routeKey = route => route ? `${route.screen}/${route.variant}` : '';
function announce(text,tone='') { message=text;messageTone=tone; }
function resolveTarget(screenId,variantId) {
  const screen = byId.get(screenId);
  if(!screen) return {error:pendingMap.has(screenId)?`「${pendingMap.get(screenId).label}」尚未完成实景采集，已列在待取证清单。`:`未注册页面「${screenId}」，没有跳转。`};
  const variant = variantId===undefined ? screen.variants[0] : screen.variants.find(v=>v.id===variantId);
  if(!variant) return {error:`「${screen.label}」没有已取证的「${variantId}」状态，没有使用其他状态替代。`};
  return {screen,variant};
}
function navigate(screenId,variantId,{push=true,hash=true}={}) {
  const target=resolveTarget(screenId,variantId);
  if(target.error) { blockedTarget=screenId;announce(target.error,'error');render();return false; }
  const next={screen:target.screen.id,variant:target.variant.id};
  if(push && active && routeKey(next)!==routeKey(active)) history.push({...active});
  active=next;blockedTarget='';announce('');
  if(hash) window.history.replaceState(null,'',`#${encodeURIComponent(active.screen)}/${encodeURIComponent(active.variant)}`);
  render();return true;
}
function back() {
  if(!history.length) { announce('当前为直接打开的页面，没有已演示的返回路线。');render();return false; }
  const prior=history.pop();return navigate(prior.screen,prior.variant,{push:false});
}
function currentContext() {
  if(!active) return null;
  const screen=byId.get(active.screen);const variant=screen?.variants.find(v=>v.id===active.variant);
  if(!screen||!variant)return null;
  return {screen,variant,state,theme,profile,evidence:captureFor(variant.captureId||variant.referenceCaptureId)};
}
function applyAction(action) {
  const ctx=currentContext();if(!ctx)return;
  let result;
  try { result=ctx.screen.onAction?.(action,ctx); }
  catch(error) { announce(`演示动作执行失败：${error.message}`,'error');render();return; }
  if(!result) { announce(`「${action}」尚未绑定已观察的后续效果。`);render();return; }
  if(result.statePatch) state={...state,...result.statePatch};
  if(result.back) return history.length?back():result.go?navigate(result.go.screen,result.go.variant,{push:false}):back();
  if(result.go) return navigate(result.go.screen,result.go.variant,{push:result.go.push!==false});
  const unresolved=Object.entries(result.statePatch||{}).find(([key])=>/unverified|unobserved/.test(key));
  if(unresolved)announce(`已记录本地演示操作「${unresolved[1]}」；后续原生效果尚未取证。`);
  render();
  if(result.focusField)root.querySelector(`#viewport [data-field="${CSS.escape(result.focusField)}"]`)?.focus();
}
function setValue(key,value,{redraw=true}={}) {state={...state,[key]:value};if(redraw)render();}
function groupedNav() {
  const groups=new Map();for(const screen of screens){const group=screen.group||'应用';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(screen);}
  return [...groups].map(([group,items])=>`<section class="demo-nav-group"><h2>${esc(group)}</h2>${items.map(screen=>`<div class="demo-nav-screen"><button data-shell-go="${esc(screen.id)}" class="${active?.screen===screen.id?'selected':''}">${esc(screen.label)}</button>${active?.screen===screen.id?`<div class="demo-variant-nav">${screen.variants.map(v=>`<button data-shell-go="${esc(screen.id)}" data-shell-variant="${esc(v.id)}" class="${active.variant===v.id?'selected':''}">${esc(v.label)}</button>`).join('')}</div>`:''}</div>`).join('')}</section>`).join('');
}
function classificationPanel() {
  return `<section class="demo-category"><h2>三类设计依据</h2><strong>① 当前应用已有设计</strong><p>已取证页面依据当前 VM 截图和正常入口操作重建。源码确认、浏览器可渲染不等于原生视觉验收。</p><strong>② demo 已确认、应用未实现</strong><ul><li>系统控件改为自定义组件，用于效果检验与 iOS／Android 开发；原生实现情况逐控件核实。</li><li>书籍操作参考此前漫画 demo 的样式方向。</li><li>小说更多菜单参照漫画更多菜单重绘。</li></ul><p>以上是方向确认。具体尺寸、颜色、动效与最终渲染仍需分别验收；目标稿独立标记，不作为当前应用实景。</p><strong>③ demo 未确认</strong><p>新稿或旧稿中自行提出的外观、尺寸适配与动效细节，分别保留为待确认属性，不作为已批准开发基准。同一组件的现有业务结构、已确认调整方向和未确认新外观可分别归类。</p><strong>证据成熟度另行记录</strong><p>源码已有但当前 VM 尚未抓取的页面属于待取证，分类暂不判定；这不表示应用未实现，也不表示它是新的 demo 提案。</p></section>`;
}
function canvasClassification(ctx) {
  if(!ctx)return '';
  const target=!!isConfirmedTarget(ctx.screen,ctx.variant);
  const tags=[target?'② 已确认方向稿 · 应用尚未实现此样式':'① 当前应用设计依据 · 重绘待对照'];
  if(target||ctx.variant.unconfirmedControlVisuals?.length)tags.push('③ 具体新外观待确认');
  if(profile.id!=='native')tags.push(`③ ${profile.id==='ios'?'iOS':'Android'} 尺寸适配待确认`);
  if(theme==='night')tags.push('③ 夜间外观待确认');
  return `<div class="demo-canvas-classification" aria-label="当前画布的设计分类">${tags.map((label,index)=>`<span class="demo-tag ${index?'pending':''}">${esc(label)}</span>`).join('')}</div>`;
}
function evidencePanel(ctx) {
  if(!ctx)return '<h2>原生证据</h2><p>尚无可展示的已采集页面。</p>'+classificationPanel();
  const evidence=ctx.evidence;const target=!!isConfirmedTarget(ctx.screen,ctx.variant);const pendingVariants=(registered.find(s=>s.id===ctx.screen.id)?.variants||[]).filter(v=>!ctx.screen.variants.some(x=>x.id===v.id));
  return `<h2>${target?'目标稿与漫画实景参考':'原生证据对照'}</h2><span class="demo-tag">${target?'② 小说目标稿':'① 当前应用实景'}</span><span class="demo-tag pending">${target?'方向已确认 · 具体视觉待确认':'重绘待对照验收'}</span>${target?'<p>这是参照漫画更多菜单绘制的小说目标稿。下面 PNG 是漫画实景参考，不能证明小说应用已经实现此样式。</p>':''}<dl><dt>画面</dt><dd>${esc(ctx.variant.label)}</dd><dt>${target?'Reference Capture ID':'Capture ID'}</dt><dd>${esc(evidence.id)}</dd><dt>原图尺寸</dt><dd>${evidence.width} × ${evidence.height} px</dd><dt>原生包</dt><dd>${esc(evidence.bundle||'未记录')}</dd><dt>图片 SHA-256</dt><dd>${esc(evidence.sha256)}</dd></dl><details data-evidence-image ${evidenceExpanded?'open':''}><summary>${target?'展开漫画实景参考':'展开实际 VM 截图'}</summary><a href="${esc(evidence.png)}" target="_blank" rel="noopener">打开原图</a><img class="demo-native-image" src="${esc(evidence.png)}" alt="${target?'漫画更多菜单的实际原生参考':esc(ctx.screen.label)+'的实际原生截图'}"></details><p>原图只用于外部对照，不作为交互页面背景。</p>${ctx.variant.unconfirmedControlVisuals?.length?`<h3>③ 未确认控件外观</h3><ul>${ctx.variant.unconfirmedControlVisuals.map(value=>`<li>${esc(value)}</li>`).join('')}</ul><p>业务内容和动作依据实景；自定义替代组件的具体外观仍待确认。</p>`:''}${pendingVariants.length?`<h3>本页尚未采集的状态</h3><ul>${pendingVariants.map(v=>`<li>${esc(v.label)}</li>`).join('')}</ul>`:''}${classificationPanel()}<div class="demo-build-info">生成：${esc(build.generatedAt||'未知')}<br>共有 ${Object.keys(build.captures||{}).length} 张证据PNG，其中 ${build.registry?.admittedCaptureCount??0} 张经视觉查看准入；${build.registry?.observedStateCount??0} 个原生状态。<br>安装产物与源码的完整绑定以采集记录为准；画面相似不替代绑定。</div>`;
}
function render() {
  rememberScroll();
  const ctx=currentContext();const category=ctx?.variant.category||ctx?.screen.category||'existing-app';
  const title=ctx?`${ctx.screen.label} · ${ctx.variant.label}`:'待采集应用页面';
  let canvas='';if(ctx){try{canvas=ctx.screen.render(ctx)||'';}catch(error){announce(`重绘页面执行失败：${error.message}`,'error');}}
  const visualNote=category==='confirmed-demo-unimplemented'?'小说目标稿：方向已确认，具体视觉待确认；漫画 PNG 仅作参考。':profile.id==='native'?'同尺寸重绘，仍需与原生截图对照。':'跨平台尺寸适配预览，尚未作为 iOS／Android 原生验收。';
  root.innerHTML=`<div class="demo-shell"><aside class="demo-sidebar"><h1 class="demo-brand">Reader UI</h1><p class="demo-purpose">实景重建 · 效果检验<br>iOS／Android 开发基准</p><nav aria-label="已取证页面">${groupedNav()}</nav><section class="demo-pending"><details ${blockedTarget?'open':''}><summary>待取证页面 · ${pendingMap.size}</summary><ul>${[...pendingMap.values()].map(s=>`<li class="${s.id===blockedTarget?'highlight':''}">${esc(s.label)}</li>`).join('')}</ul></details></section></aside><main class="demo-main"><div class="demo-toolbar"><button data-shell-back ${history.length?'':'disabled'}>返回</button><label>画布<select data-shell-profile>${profiles.map(p=>`<option value="${p.id}" ${profile.id===p.id?'selected':''}>${esc(p.label)}</option>`).join('')}</select></label><label>主题<select data-shell-theme><option value="day" ${theme==='day'?'selected':''}>日间</option><option value="night" ${theme==='night'?'selected':''}>夜间 · 适配待验</option></select></label></div><h2 class="demo-heading">${esc(title)}</h2>${canvasClassification(ctx)}<p class="demo-caption">${esc(visualNote)} ${theme==='night'?'当前采集基准为日间，夜间调整不代表已确认。':''}</p><div class="demo-status" role="status" aria-live="polite" data-tone="${esc(messageTone)}">${esc(message)}</div>${ctx&&canvas?`<div class="demo-stage-wrap"><div class="demo-stage-frame" style="width:${profile.width}px;height:${profile.height}px"><div id="viewport" class="app-viewport" data-theme="${theme}" data-profile="${profile.id}" data-category="${esc(category)}">${canvas}</div></div></div>`:'<p class="demo-caption">此位置仅展示具有实景依据的已重建页面。</p>'}</main><aside class="demo-evidence">${evidencePanel(ctx)}</aside></div>`;
  restoreScroll();
}

root.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-go],[data-action],[data-back],[data-set],[data-toggle],[data-variant]');if(!target||!root.contains(target)||target.disabled)return;
  if(target.hasAttribute('data-shell-go'))return navigate(target.dataset.shellGo,target.dataset.shellVariant);
  if(target.hasAttribute('data-shell-back'))return back();
  if(target.hasAttribute('data-go'))return navigate(target.dataset.go,target.dataset.variant);
  if(target.hasAttribute('data-back'))return back();
  if(target.hasAttribute('data-action'))return applyAction(target.dataset.action);
  if(target.hasAttribute('data-toggle')){
    const key=target.dataset.toggle;
    const current=Object.hasOwn(state,key)?!!state[key]:target.getAttribute('aria-checked')==='true';
    return setValue(key,!current);
  }
  if(target.hasAttribute('data-set'))return setValue(target.dataset.set,target.dataset.value);
  if(target.hasAttribute('data-variant')&&active)return navigate(active.screen,target.dataset.variant);
});
root.addEventListener('input',event=>{
  const input=event.target;if(!input.dataset?.field)return;
  const value=input.type==='range'||input.type==='number'?Number(input.value):input.value;
  setValue(input.dataset.field,value,{redraw:false});
  if(input.dataset.field==='reading-search-query') {
    // Keep the active editor and its selection mounted while reflecting the
    // native nonblank-query affordance. Replacing the tree here eats the first
    // search click and interrupts IME composition.
    const submit=root.querySelector('#viewport [data-action="search-submit"]');
    if(submit)submit.disabled=String(value).trim().length===0;
  }
  if(input.dataset.field==='library-search-query'){
    const clear=root.querySelector('#viewport [data-action="search-clear"]');
    if(clear)clear.hidden=String(value).length===0;
  }
  if(input.type==='range'){
    input.style.setProperty('--range',`${100*(Number(input.value)-Number(input.min||0))/(Number(input.max||100)-Number(input.min||0))}%`);
    const output=input.closest('.ui-slider')?.querySelector('output');if(output)output.textContent=input.value;
  }
});
root.addEventListener('change',event=>{
  const input=event.target;
  if(input.hasAttribute('data-shell-profile')){profile=profiles.find(p=>p.id===input.value)||profiles[0];render();return;}
  if(input.hasAttribute('data-shell-theme')){theme=input.value==='night'?'night':'day';render();return;}
  if(input.dataset?.field){const value=input.type==='range'||input.type==='number'?Number(input.value):input.value;setValue(input.dataset.field,value,{redraw:!['reading-search-query','library-search-query'].includes(input.dataset.field)});}
});
root.addEventListener('toggle',event=>{if(event.target.hasAttribute('data-evidence-image'))evidenceExpanded=event.target.open;},true);
function openHash() {
  const raw=window.location.hash.slice(1);if(!raw)return screens.length?navigate(screens[0].id,undefined,{push:false}):render();
  let screenId,variantId;
  try{[screenId,variantId]=raw.split('/').map(x=>decodeURIComponent(x));}
  catch{announce('页面地址编码不合法，没有切换页面。','error');render();return;}
  navigate(screenId,variantId,{push:false});
}
window.addEventListener('hashchange',openHash);
window.readerDemo={navigate,back,action:applyAction,setValue,snapshot:()=>({active:active?{...active}:null,state:{...state},history:history.map(r=>({...r})),profile:{...profile},theme,message,pending:[...pendingMap.keys()],screens:screens.map(s=>({id:s.id,variants:s.variants.map(v=>v.id)}))})};
openHash();
