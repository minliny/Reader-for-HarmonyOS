import delivery from './delivery.json';
import {esc} from './shared.mjs';
import {mountMotionPreview} from './motion-preview.mjs';
export const profiles=delivery.profiles;
let tab='current';
let motionCleanup;
const el=id=>document.getElementById(id);
const tabs=[['current','当前界面'],['shared','布局 / 平台'],['type','文字 / 换行'],['motion','动效 / 手势'],['assets','颜色 / 资产'],['acceptance','验收 / 参考图']];
const list=items=>`<ul>${items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
const table=rows=>`<table><tbody>${rows.map(row=>`<tr>${row.map((s,i)=>`<${i?'td':'th'}>${esc(String(s))}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table>`;
const sources=items=>`<p class="spec-sources">${items.map(s=>`<a href="../../../${esc(s.path)}">${esc(s.path.split('/').pop())}:${s.line}</a>`).join(' · ')}</p>`;
export function initializeDelivery(){
  el('viewport-size').innerHTML=profiles.map(p=>`<option value="${p.id}">${p.label}</option>`).join('');
  el('spec-tabs').innerHTML=tabs.map(([id,label])=>`<button data-spec-tab="${id}">${label}</button>`).join('');
  document.addEventListener('click',e=>{const n=e.target.closest('[data-spec-tab]');if(n){tab=n.dataset.specTab;window.dispatchEvent(new Event('delivery-render'));}});
  el('export-parameters').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(delivery,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='reader-ui-delivery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}
export function applyProfile(current){
  const p=profiles.find(p=>p.id===el('viewport-size').value)||profiles[0];const viewport=el('viewport');
  const [top,right,bottom,left]=p.insets;const keyboard=Number(el('keyboard-height').value);
  for(const [key,value]of Object.entries({'--window-w':p.width+'px','--window-h':p.height+'px','--safe-top':top+'px','--safe-right':right+'px','--safe-bottom':bottom+'px','--safe-left':left+'px','--keyboard-height':keyboard+'px'}))viewport.style.setProperty(key,value);
  viewport.dataset.size=p.width>=600?'wide':'phone';viewport.dataset.profile=p.id;viewport.dataset.platform=p.platform;
  viewport.dataset.deviceType=p.deviceType||'phone';
  viewport.dataset.keyboard=keyboard?'open':'closed';viewport.dataset.fontScale=el('font-scale').value;
  viewport.dataset.reading=current==='reader'||current==='directory'?'true':'false';
  el('profile-note').textContent=`${p.width} × ${p.height} 逻辑单位 · 安全区 上/右/下/左 ${p.insets.join('/')} · 键盘 ${keyboard}。${p.platform==='content'?'内容窗基准，无系统区域。':'适配样本，原生必须读取实时窗口与安全区。'}`;
  el('measurement-box').hidden=true;
}
export function applyTextPressure(){
  const factor=Number(el('font-scale').value);if(factor===1)return;
  const snapshots=[...el('viewport').querySelectorAll('*')].filter(n=>!['IMG','SVG','PATH','INPUT'].includes(n.tagName)||n.tagName==='INPUT'&&n.type!=='range').filter(n=>n.childNodes.length&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())||['INPUT','TEXTAREA','SELECT'].includes(n.tagName)).map(n=>{const c=getComputedStyle(n);return[n,parseFloat(c.fontSize),c.lineHeight];});
  for(const[n,size,line]of snapshots){if(n.closest('.reading-prose'))continue;n.style.fontSize=`${size*factor}px`;if(line!=='normal')n.style.lineHeight=`${parseFloat(line)*factor}px`;}
}
export function renderDelivery(screen,variant){
  motionCleanup?.();motionCleanup=undefined;
  for(const n of document.querySelectorAll('[data-spec-tab]'))n.classList.toggle('selected',n.dataset.specTab===tab);
  let html='';
  if(tab==='current'){
    const s=delivery.screens.find(s=>s.id===screen.id);html=`<p class="spec-origin">源码事实与移植适配分别列示。当前状态：${esc(screen.variants.find(v=>v.id===variant)?.label||variant)}；各状态共用同一组件。</p><div class="spec-columns">`;
    for(const[key,label]of [['layout','尺寸与约束'],['typography','排版'],['behavior','行为与状态'],['adaptation','移植适配']])html+=`<section><h3>${label}</h3>${list(s.spec[key])}</section>`;
    html+=`</div>${sources(s.spec.sources)}`;
  }else if(tab==='shared')html=`<div class="spec-columns"><section><h3>公共组件 · 源码事实</h3>${table(delivery.sharedGeometry)}</section><section><h3>跨平台适配决定</h3>${table(delivery.platformRules)}</section></div><p>${delivery.platformSources.map(s=>`<a href="${s.url}">${s.label}</a>`).join(' · ')}</p>`;
  else if(tab==='type')html=`${table(delivery.typographyRules)}<div class="type-role-list">${delivery.typography.map(t=>`<details><summary>${t.role} · ${t.fontSize??'继承'}/${t.lineHeight??'AUTO'} · ${t.weight??'继承'} · ${t.scalePolicy}</summary>${delivery.fontProbes.map(p=>`<div class="type-probe" style="font-family:${t.family??'inherit'};font-size:${t.fontSize===null?'inherit':t.fontSize+'px'};line-height:${t.lineHeight? t.lineHeight+'px':'normal'};font-weight:${t.weight??'inherit'}">${esc(p)}</div>`).join('')}<p>字族 ${t.family??'继承'} · 字距 ${t.letterSpacing??'默认'} · 源码行 ${t.line}</p></details>`).join('')}</div>`;
  else if(tab==='motion')html=`<p>以下是阶段参数与打断规则；异步阶段结束由真实回执决定。没有新增等待页。浏览器参考图只包含稳定画面。</p><div id="motion-sampler"></div>${delivery.motion.map(m=>`<details><summary>${esc(m.label)} · ${esc(m.duration)}</summary>${table([['来源',m.origin],['触发',m.trigger],['属性 / 几何',m.properties],['曲线',m.curve],['中断',m.interruption],['减少动态效果',m.reducedMotion]])}${sources(m.sources)}</details>`).join('')}`;
  else if(tab==='assets')html=`<details open><summary>字体与许可 · ${delivery.assets.fonts.length} 个文件</summary>${table(delivery.assets.fonts.map(a=>[a.name,a.sha256.slice(0,16),a.license]))}</details><details><summary>主题角色 · ${Object.keys(delivery.theme.appRoles).length} 个</summary>${table(Object.entries(delivery.theme.appRoles).map(([role,v])=>[role,JSON.stringify(v.day),JSON.stringify(v.night)]))}</details><details><summary>SVG · ${delivery.assets.icons.length} 个</summary><div class="asset-grid">${delivery.assets.icons.map(a=>`<a href="../../../${a.path}"><img src="../../../${a.path}" alt="">${a.name}</a>`).join('')}</div></details><p>全部文件SHA-256和原始role key包含在导出JSON中；CSS变量将点号换成短横线，禁止改动原始注册表。</p>`;
  else {
    const refs=delivery.verification.references,current=refs?.status==='CURRENT';
    html=`<p>登记 ${delivery.screens.length} 个界面/组件、${delivery.screens.reduce((a,s)=>a+s.variants.length,0)} 个状态样本。iOS / Android 原生视觉与业务尚未验收。</p>${table(delivery.acceptance)}<p>${current?'参考图已绑定当前源码与设计指纹。':'现存参考图对应旧版源码或设计，保留作历史证据。本版尚未重新生成浏览器参考图。'} <a href="references/manifest.json">${current?'参考图片及度量清单':'历史图片清单'}</a>${current?` · <a href="references/${screen.id}--${variant}--day--phone.png">当前状态浅色参考</a> · <a href="references/${screen.id}--${variant}--night--phone.png">深色参考</a>`:''}</p>`;
  }
  el('spec-content').innerHTML=html;
  if(tab==='motion')motionCleanup=mountMotionPreview(el('motion-sampler'),{reduceMotion:el('reduce-motion').checked});
}
export function measureClick(event){
  if(!el('measure-mode').checked||!event.target.closest('#viewport'))return false;
  event.preventDefault();event.stopImmediatePropagation();
  const n=event.target;const r=n.getBoundingClientRect(),v=el('viewport').getBoundingClientRect(),c=getComputedStyle(n);const x=r.left-v.left,y=r.top-v.top;
  const box=el('measurement-box');box.hidden=false;Object.assign(box.style,{left:x+'px',top:y+'px',width:r.width+'px',height:r.height+'px'});
  const values=[['控件',n.tagName+'.'+String(n.className)],['边界',`x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${r.width.toFixed(2)}, h=${r.height.toFixed(2)}`],['字体',`${c.fontFamily} / ${c.fontSize} / weight ${c.fontWeight} / line ${c.lineHeight}`],['形态',`radius ${c.borderRadius} / padding ${c.padding} / border ${c.borderWidth}`],['颜色',`${c.color} / ${c.backgroundColor}`]];
  el('measurement-note').innerHTML=table(values);return true;
}
