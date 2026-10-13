import { esc, icon, button } from './shared.mjs';
import { novelControlShell } from './reading.mjs';

const themes = [
  ['day','日间','#f7f3ea'],['warm','暖白','#f2e8d3'],['night','夜间','#2b2823'],['warm-night','暖夜','#413020'],
  ['paper','纸纹','#eee4d0'],['green','青叶纹','#e3ebdd'],['indigo','靛夜','#26313f'],['forest','林夜纹','#24382c'],
];
const fonts = [['system','系统'],['song','宋体'],['hei','黑体'],['kai','楷体'],['fangsong','仿宋'],['mono','等宽'],['noto-serif','思源宋体'],['wenkai','霞鹜文楷']];
const current = (ctx,key,fallback) => ctx.state[`reading-${key}`] ?? fallback;

function appearance(ctx) {
  const full = ctx.variant.id !== 'quick';
  const activeTheme = current(ctx,'appearance-theme','day');
  const activeFont = current(ctx,'appearance-font','song');
  const inner = `<section class="reading-pref reading-appearance-pref ${full?'full':'quick'}" aria-label="阅读界面">
    <div class="reading-pref-scroll" data-scroll-key="reading-appearance-scroll" data-initial-scroll="${ctx.variant.id==='layout'?88.571:0}">
    <div class="reading-appearance-content">
      <header class="reading-appearance-theme-header"><strong>主题库</strong><span>日间：日间 · 夜间：夜间</span></header>
      <div class="reading-appearance-themes">${themes.map(([id,label,color],index)=>`<button class="reading-theme-choice ${activeTheme===id?'selected':''}" data-action="appearance-theme:${id}" style="--theme-color:${color};--theme-column:${index%4};--theme-row:${Math.floor(index/4)}" aria-label="${esc(label)}主题" aria-pressed="${activeTheme===id}"><i><b></b></i>${full?`<span>${esc(label)}</span>`:''}</button>`).join('')}</div>
      ${full?`<div class="reading-appearance-day-night">${button('已设为日间',{action:'appearance-day',kind:'text'})}${button('设为夜间主题',{action:'appearance-night',kind:'text'})}</div>`:''}
      <header class="reading-appearance-font-header"><strong>字体库</strong>${full?'<span>可拖动调整位置</span>':''}</header>
      <div class="reading-appearance-fonts">${fonts.map(([id,label])=>`<button class="reading-font-choice font-${id} ${activeFont===id?'selected':''}" data-action="appearance-font:${id}" aria-pressed="${activeFont===id}">${esc(label)}</button>`).join('')}${full?'<button class="reading-font-choice import" data-action="appearance-import">导入</button>':''}</div>
      ${full?`<section class="reading-appearance-layout"><header><strong>排版库</strong><span>即时应用</span></header><div class="reading-layout-rows">
        <div class="reading-layout-row"><span>缩进</span>${button('2字符',{action:'appearance-indent',kind:'text',className:'reading-layout-select'})}${icon('rc_chevron_right',10)}</div>
        <div class="reading-layout-row"><span>简繁</span>${button('原文',{action:'appearance-language',kind:'text',className:'reading-layout-select'})}${icon('rc_chevron_right',10)}</div>
        ${[['font-size','字号',18,'px'],['line-height','行距',1.96,''],['paragraph-spacing','段距',16,'px'],['letter-spacing','字距',0,'px']].map(([id,label,value,unit])=>`<div class="reading-layout-row"><span>${label}</span><div class="reading-layout-stepper"><button data-action="appearance-step:${id}:-1" aria-label="${label}减小">−</button><output>${esc(id==='line-height'?Number(current(ctx,`appearance-${id}`,value)).toFixed(2):current(ctx,`appearance-${id}`,value))}${unit}</output><button data-action="appearance-step:${id}:1" aria-label="${label}增大">+</button></div></div>`).join('')}
      </div></section>`:''}
    </div></div>
  </section>`;
  return novelControlShell(inner,{full,title:'界面',titleIcon:'rc_palette',active:'appearance',screen:'reader-appearance'});
}

const settingsChoices = [
  {id:'direction',label:'屏幕方向',value:'system',options:[['system','跟随系统'],['portrait','竖屏'],['landscape','横屏']]},
  {id:'page-style',label:'翻页样式',value:'slide',options:[['cover','覆盖'],['slide','滑动'],['simulation','仿真'],['scroll','滚动'],['none','无动画']]},
  {id:'timeout',label:'屏幕超时',value:'system',options:[['system','跟随系统'],['one-minute','1 分钟'],['five-minutes','5 分钟'],['ten-minutes','10 分钟'],['always','始终开启']]},
];
const settingGroups = [
  ['status','导航状态栏',[['hide-navigation','隐藏导航栏',false],['extend-cutout','拓展到刘海（灵动岛）',false]]],
  ['typography','排版',[['justify','文字两端对齐',true],['align-bottom','底部对齐',false]]],
  ['control','控制',[['volume-turn','音量键翻页',false],['stop-tts-screen-off','息屏终止朗读',false],['long-press-selection','长按选择文本',true]]],
];

function readerSettings(ctx) {
  const full = ctx.variant.id !== 'quick';
  const inner = `<section class="reading-pref reading-settings-pref ${full?'full':'quick'}" aria-label="阅读设置"><div class="reading-pref-scroll" data-scroll-key="reading-settings-scroll" data-initial-scroll="${ctx.variant.id==='controls'?93.714:0}"><div class="reading-settings-content">
    <section class="reading-screen-style">${full?'<h2>屏幕样式</h2>':''}${settingsChoices.map((group,index)=>`<div class="reading-setting-choice-group" style="--choice-row:${index}"><label>${group.label}</label><div class="reading-setting-segments">${group.options.map(([id,label])=>`<button class="${current(ctx,`settings-${group.id}`,group.value)===id?'selected':''}" data-action="setting-choice:${group.id}:${id}" aria-pressed="${current(ctx,`settings-${group.id}`,group.value)===id}">${esc(label)}</button>`).join('')}</div></div>`).join('')}</section>
    ${full?settingGroups.map(([id,label,options])=>`<section class="reading-setting-added group-${id}"><h2>${label}</h2>${options.map(([key,label,fallback])=>{const value=!!current(ctx,`settings-${key}`,fallback);return `<div class="reading-setting-toggle-row"><span>${label}</span><button class="reading-setting-switch ${value?'on':''}" role="switch" aria-checked="${value}" aria-label="${label}" data-action="setting-toggle:${key}"><i></i></button></div>`;}).join('')}</section>`).join(''):''}
  </div></div></section>`;
  return novelControlShell(inner,{full,title:'设置',titleIcon:'rc_settings',active:'settings',screen:'reader-settings'});
}

const settingsDefaults = Object.fromEntries(settingGroups.flatMap(([, ,options])=>options.map(([key,,value])=>[key,value])));
const metricDefaults = {'font-size':18,'line-height':1.96,'paragraph-spacing':16,'letter-spacing':0};
const metricRanges = {'font-size':[12,40,2],'line-height':[1.2,2.8,0.08],'paragraph-spacing':[0,32,2],'letter-spacing':[-2,4,0.5]};
function preferenceAction(action,ctx) {
  if(action==='expand')return {go:{screen:ctx.screen.id,variant:'full'}};
  if(action==='collapse')return {go:{screen:ctx.screen.id,variant:'quick'}};
  const parts=action.split(':');
  const patch={'reading-unverified-action':action};
  if(parts[0]==='appearance-theme')patch['reading-appearance-theme']=parts[1];
  else if(parts[0]==='appearance-font')patch['reading-appearance-font']=parts[1];
  else if(parts[0]==='setting-choice')patch[`reading-settings-${parts[1]}`]=parts[2];
  else if(parts[0]==='setting-toggle')patch[`reading-settings-${parts[1]}`]=!current(ctx,`settings-${parts[1]}`,settingsDefaults[parts[1]]);
  else if(parts[0]==='appearance-step' && metricRanges[parts[1]]) {
    const [min,max,step]=metricRanges[parts[1]];
    patch[`reading-appearance-${parts[1]}`]=Math.min(max,Math.max(min,Number((Number(current(ctx,`appearance-${parts[1]}`,metricDefaults[parts[1]]))+Number(parts[2])*step).toFixed(2))));
  }
  // This local input draft does not assert observed persistence or reading effects.
  // Uncaptured dropdowns, font pickers and business results remain unrendered.
  return {statePatch:patch};
}

export const readingPreferenceScreens = [
  {id:'reader-appearance',label:'阅读界面',group:'小说阅读',classification:'existing-app',variants:[
    {id:'quick',label:'快捷主题与字体',captureId:'reader-control-redo-022-appearance-quick'},
    {id:'full',label:'完整主题、字体与排版',captureId:'reader-control-redo-023-appearance-full'},
    {id:'layout',label:'同页滚动至排版',captureId:'reader-control-redo-024-appearance-layout'},
  ],render:appearance,onAction:preferenceAction},
  {id:'reader-settings',label:'阅读设置',group:'小说阅读',classification:'existing-app',variants:[
    {id:'quick',label:'快捷屏幕设置',captureId:'reader-control-redo-025-reader-settings-quick'},
    {id:'full',label:'完整阅读设置',captureId:'reader-control-redo-026-reader-settings-full'},
    {id:'controls',label:'同页滚动至控制设置',captureId:'reader-control-redo-027-reader-settings-controls'},
  ],render:readerSettings,onAction:preferenceAction},
];
