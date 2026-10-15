import { esc, icon, iconButton, button, topbar, tabs, section, row, field, fixtures } from './shared.mjs';

const source = (path, line) => ({ path: `entry/src/main/ets/${path}`, line });
const variant = ctx => ctx?.variant ?? 'default';
const variants = entries => entries.map(([id, label]) => ({ id, label }));
const hint = text => `hint:${text}`;
const chevron = () => icon('reader_chevron_right', 14);
const fixtureSources = fixtures.sources.map((item, i) => ({ ...item, sourceId:item.domain, category:'novel', enabled: i === 0, login: i === 0, group: i === 0 ? '示例分组' : '', checkState:'unchecked', checkMessage:'' }));
const togglePaint = value => `<span class="app-toggle ${value ? 'on' : ''}" aria-hidden="true"><span></span></span>`;
const settingRow = (label, name, value, action) => row(label, togglePaint(value), action, name);
const card = (title, content, cls='') => `<section class="app-card source-tool-card ${cls}"><h2>${esc(title)}</h2>${content}</section>`;
const toolButton = (label, text, disabled=false, primary=false, action='') => button(label, action || hint(text), primary ? 'primary' : 'secondary', disabled);
const targetStateButton = (label, screen, state, kind='secondary', disabled=false) =>
  button(label, `go:${screen}`, kind, disabled).replace('<button ', `<button data-target-variant="${esc(state)}" `);
const choice = (ctx, key, fallback) => ctx?.choices?.[key] ?? fallback;
export const settingsBoolean = value => value === true || value === 'true';
const boolChoice = (ctx,key,fallback=false) => settingsBoolean(choice(ctx,key,fallback));
export function settingsSourceRecords(choices={}) {
  return (Array.isArray(choices['source-records']) ? choices['source-records'] : fixtureSources).map(item=>({...item}));
}
const activeSourceId = choices => fixtureSources.some(item=>item.sourceId===choices['active-source-id']) ? choices['active-source-id'] : fixtureSources[0].sourceId;
function patchSource(choices,sourceId,patch) {
  choices['source-records']=settingsSourceRecords(choices).map(item=>item.sourceId===sourceId ? {...item,...patch} : item);
}
const sourceFrom = (choices,key,fallback=fixtureSources[0]) => settingsSourceRecords(choices).find(item=>item.sourceId===choices[key]) || fixtureSources.find(item=>item.sourceId===choices[key]) || fallback;
const batchStates = ['check-initial','check-first','check-running','check-stopping','check-complete','check-mixed','check-stopped','check-stopped-empty','check-error'];
const toolBusyStates = ['loading','check-initial','check-first','check-running','check-stopping','editor-loading','editor-switch-loading','editor-busy','editor-reread-busy','export-busy','enable-busy','disable-busy','delete-busy','debug-busy'];
const settingsRecoveryStates=[['settings-refreshing','原位读取设置'],['settings-saved-refreshing','设置已确认：读回中'],['settings-read-error','读取失败：刷新设置'],['settings-save-unknown','保存未确认：保留当前选择']];
const sourceRecoveryStates=[['read-refreshing','原位读取中：保留已有列表'],['receipt-refreshing','已确认：原位刷新中'],['receipt-refresh-failed','已确认：刷新失败'],['receipt-unknown','回执未确认：核对'],['receipt-unknown-reading','未确认回执：读取中'],['original-unknown','原操作保护：核对 / 继续'],['original-cleanup','Core已确认：继续原清理'],['original-busy','原操作核对中']];
const sourceRecoveryModel = state => ({
  'receipt-refreshing':{message:'已确认，正在刷新',busy:true},
  'read-refreshing':{message:'正在读取…',busy:true,toggleBusy:false},
  'receipt-refresh-failed':{message:`已确认，刷新失败：${draftError}`,retry:true},
  'receipt-unknown':{message:'等待核对',unknown:true,retry:true},
  'receipt-unknown-reading':{message:'等待核对',unknown:true,busy:true},
  'original-unknown':{message:'尚无原步骤精确回执；可明确继续已保留的原操作，不创建新标识',blocked:true,unknown:true,retry:true,continue:true},
  'original-cleanup':{message:'Core 原书源写入已确认；Host 登录会话清理仍待完成，可继续原清理，不会重写 Core',blocked:true,retry:true,continue:true,cleanup:true},
  'original-busy':{message:'尚无原步骤精确回执；可明确继续已保留的原操作，不创建新标识',blocked:true,unknown:true,busy:true,retry:true,continue:true},
})[state]||{};
const sourceRecoveryFor=ctx=>choice(ctx,'source-recovery-snapshot',sourceRecoveryModel(choice(ctx,'source-recovery-state',variant(ctx))));
const recoveryButton=(label,action,disabled=false)=>button(label,action,'secondary',disabled).replace('class="app-btn secondary"','class="app-btn secondary settings-recovery-action"');
function settingsFeedback(ctx) {
  const state=choice(ctx,'settings-operation-state',variant(ctx));
  const feedback={'settings-refreshing':{message:'正在读取…'},'settings-saved-refreshing':{message:'已确认，正在刷新'},'settings-read-error':{message:'设置持久化数据格式异常',read:true},'settings-save-unknown':{message:'等待核对',read:true,accepted:true}}[state]||{};
  const cacheState=choice(ctx,'settings-cache-state',variant(ctx));
  const cache={'cache-unknown':{message:'清理结果尚未确认，原操作已保留，请核对',read:true},'cache-continuable':{message:'原清理结果尚未确认，请核对；已有正文仍可使用',read:true,continue:true},'cache-reconcile-busy':{message:'正在核对原清理操作'}}[cacheState]||{};
  const reset=choice(ctx,'settings-reset-message',{'reset-success':'已恢复界面与阅读设置','reset-error':'恢复未完成，已保留恢复记录；点击恢复默认重试','reset-incomplete':'恢复未完成，请重试'}[variant(ctx)]||'');
  const message=[feedback.message||reset,cache.message].filter(Boolean).join('\n');
  return `${message?`<p class="settings-reset-message">${esc(message)}</p>`:''}${feedback.read?recoveryButton('刷新设置','variant:settings-refreshing'):''}${feedback.accepted?recoveryButton('重试保存当前设置','variant:settings-refreshing'):''}${cache.read?recoveryButton('核对清理结果','variant:cache-reconcile-busy'):''}${cache.continue?recoveryButton('继续原操作','variant:cache-reconcile-busy'):''}`;
}
/** Patch an explicitly selected fixture/result sample without replacing sibling state. */
export function applySettingsSample(screenId,v,choices={}) {
  if(['settings','general'].includes(screenId)&&v.startsWith('settings-'))choices['settings-operation-state']=v;
  if(['settings','general'].includes(screenId)&&v.startsWith('cache-'))choices['settings-cache-state']=v;
  if(screenId==='general') {
    if(v==='theme-day'||v==='theme-night')choices['settings-theme-mode']=v==='theme-day'?'day':'night';
    if(v==='reduce-motion')choices['settings-reduce-motion']=true;
    if(v==='auto-check-off')choices['settings-auto-update']=false;
    if(v.startsWith('cache-'))choices['settings-cache-state']=v;
    if(v.startsWith('reset-')) {
      choices['settings-reset-busy']=v==='reset-busy';
      choices['settings-reset-message']={'reset-success':'已恢复界面与阅读设置','reset-error':'恢复未完成，已保留恢复记录；点击恢复默认重试','reset-incomplete':'恢复未完成，请重试'}[v]||'';
      if(v==='reset-success')Object.assign(choices,{'settings-theme-mode':'system','settings-auto-update':true,'settings-reduce-motion':false,'settings-cache-state':'default','settings-operation-state':'default'});
    }
  }
  if(screenId==='sources') {
    const id=activeSourceId(choices);
    if(['empty','loading','load-error'].includes(v))choices['source-records']=[];
    else if(!Array.isArray(choices['source-records'])||['loading','load-error'].includes(choices['source-list-read-state']))choices['source-records']=fixtureSources.map(item=>({...item}));
    choices['source-list-read-state']=v;
    const states={checking:'checking','login-waiting':'checking','check-passed':'passed','check-failed':'failed'};
    if(states[v])patchSource(choices,id,{checkState:states[v],checkMessage:v==='login-waiting'?'等待登录 / 验证':v==='check-passed'?'搜索检测通过 · 120ms':v==='check-failed'?'检测失败':'检测中'});
    if(v==='source-disabled')patchSource(choices,id,{enabled:false});
    if(v==='filter-empty')choices['source-query']='未匹配的名称';
    if(v==='group-open')choices['source-group-open']=true;
  }
  if(screenId==='source-tools') {
    choices['source-tools-busy']=toolBusyStates.includes(v);
    if(batchStates.includes(v)) {
      if(v==='check-initial'||choices['source-batch-selection']===undefined)choices['source-batch-selection']=(Number(choices['source-selection']??3)&3)||3;
      if(v==='check-initial'||choices['source-batch-mode']===undefined)choices['source-batch-mode']=choices['source-check-mode']||'search';
      if(v==='check-initial'||choices['source-batch-depth']===undefined)choices['source-batch-depth']=Number(choices['source-check-depth']||2);
      choices['source-batch-state']=v;
      choices['source-debug-kind']='batch';
      choices['source-debug-state']='';
    }
    if(v.startsWith('debug-')||v==='debug') {
      if(v==='debug-busy'||choices['source-debug-result-mode']===undefined)choices['source-debug-result-mode']=choices['source-check-mode']||'search';
      if(v==='debug-busy'||choices['source-debug-result-depth']===undefined)choices['source-debug-result-depth']=Number(choices['source-check-depth']||2);
      choices['source-debug-kind']='single';
      choices['source-debug-state']=v;
    }
    if(v.startsWith('editor-')||v==='editor') {
      if(['editor','editor-switch-success'].includes(v)) {
        choices['source-editor-open']=true;
        choices['source-editor-status']=v;
        choices['source-editor-source'] ||= choices['source-editor-pending-source'] || fixtureSources[0].sourceId;
      } else if(['editor-cancelled','editor-saved','editor-reread-success'].includes(v)) {
        choices['source-editor-open']=false;
        choices['source-editor-save-unknown']=false;
        if(v!=='editor-cancelled'&&!choices['source-recovery-snapshot']?.blocked) {
          choices['source-recovery-state']='default';
          choices['source-recovery-snapshot']={};
        }
        for(const key of ['source-editor-source','source-editor-draft','source-editor-pending-source','source-editor-readback-failed'])delete choices[key];
      } else {
        choices['source-editor-status']=v;
        if(!['editor-loading','editor-load-error'].includes(v))choices['source-editor-open']=true;
        if(['editor-readback-error','editor-reread-busy','editor-reread-not-found'].includes(v))choices['source-editor-readback-failed']=true;
        if(['editor-save-unknown','editor-reread-unknown'].includes(v)) {
          choices['source-editor-save-unknown']=true;
          choices['source-recovery-state']='receipt-unknown';
          choices['source-recovery-snapshot']=sourceRecoveryModel('receipt-unknown');
        }
      }
    }
    const mask=(Number(choices['source-operation-selection']??choices['source-selection']??3)&3)||3;
    const affected=fixtureSources.filter((_item,i)=>mask&(1<<i));
    if(v==='enable-success'||v==='disable-success')for(const item of affected)patchSource(choices,item.sourceId,{enabled:v==='enable-success'});
    if(v==='update-partial')patchSource(choices,affected[0].sourceId,{enabled:choices['source-operation-enabled']!==undefined ? settingsBoolean(choices['source-operation-enabled']) : false});
    if(['delete-success','delete-cleanup-warning'].includes(v))choices['source-records']=settingsSourceRecords(choices).filter(item=>!affected.some(target=>target.sourceId===item.sourceId));
    if(v==='editor-reread-not-found')choices['source-records']=settingsSourceRecords(choices).filter(item=>item.sourceId!==choices['source-editor-source']);
  }
  if(['sources','source-tools'].includes(screenId)&&sourceRecoveryStates.some(([state])=>state===v)) {
    const previous=choices['source-recovery-snapshot'];
    choices['source-recovery-snapshot']=v==='original-busy'&&previous?.blocked?{...previous,busy:true}:sourceRecoveryModel(v);
    choices['source-recovery-state']=v;
    if(screenId==='source-tools')choices['source-tools-busy']=choices['source-recovery-snapshot'].busy===true;
  }
  if(screenId==='json-import'&&v==='empty-url')choices['source-import-validation']='请输入在线 JSON 的 HTTP/HTTPS 地址';
  return choices;
}
/** UI-only state projection. It does not execute source.update/check/login. */
export function applySettingsAction(action,choices={},payload={}) {
  const id=payload.sourceId||activeSourceId(choices);
  choices['active-source-id']=id;
  if(action==='source:check')patchSource(choices,id,{checkState:'checking',checkMessage:'检测中'});
  if(action==='source:toggle')patchSource(choices,id,{enabled:settingsBoolean(payload.enabled)});
  if(action==='source:login-cancel')patchSource(choices,id,{checkState:'unchecked',checkMessage:''});
  if(action==='source:login-complete')patchSource(choices,id,{checkState:'checking',checkMessage:'检测中'});
  return choices;
}
const draftError = 'source.list returned invalid data';
const importRefreshWarning = `Core 已导入 2 个书源，但列表刷新失败：${draftError}`;
const sourceSelectionMask = (ctx, fallback=0) => Number(choice(ctx,'source-selection',fallback)) & 3;
const sourceOperationMask = ctx => (Number(choice(ctx,'source-operation-selection',sourceSelectionMask(ctx))) & 3) || 3;
const sourceObject = (ctx,key,fallback=fixtureSources[0]) => sourceFrom(ctx?.choices||{},key,fallback);
const resultMode = ctx => choice(ctx,'source-result-mode',choice(ctx,'source-check-mode','search'));
const resultDepth = ctx => Number(choice(ctx,'source-result-depth',choice(ctx,'source-check-depth',2)));
const consumingAction = (html, mask) => html.replace('<button ', `<button data-source-operation-selection="${mask}" data-choice="source-selection" data-choice-value="0" `);
const sourceRowsFor = (v, ctx) => {
  if(Array.isArray(ctx?.choices?.['source-records']))return settingsSourceRecords(ctx.choices);
  const scope = sourceOperationMask(ctx);
  if (v === 'editor-reread-not-found') return fixtureSources.filter(item=>item.domain!==sourceObject(ctx,'source-editor-source').domain);
  if (['delete-success','delete-cleanup-warning'].includes(v)) return fixtureSources.filter((_item,i) => !(scope & (1 << i)));
  if (v === 'enable-success' || v === 'disable-success') return fixtureSources.map((item,i) => ({ ...item, enabled:scope & (1 << i) ? v === 'enable-success' : item.enabled }));
  if (v === 'update-partial') return fixtureSources.map((item,i) => ({ ...item, enabled:i === (scope & 1 ? 0 : 1) ? false : item.enabled }));
  return fixtureSources;
};

function renderSettings(ctx) {
  const content=`${topbar('设置', '', false)}<div class="app-scroll settings-scroll">${settingsFeedback(ctx)}${section('设置',
    row('通用设置', chevron(), 'go:general', 'settings_row_general') +
    row('书源管理', chevron(), 'go:sources', 'settings_row_source') +
    row('书架设置', chevron(), 'go:bookshelf-settings', 'settings_row_shelf_search'))}</div>${tabs('settings').replace('data-action="go:settings"','data-action="scroll:settings"')}`;
  const busy=boolChoice(ctx,'settings-reset-busy');
  return `<div class="app-page settings-home" ${busy?'aria-busy="true"':''}>${busy?`<fieldset class="settings-disabled" disabled>${content}</fieldset>`:content}</div>`;
}

function renderGeneral(ctx) {
  const v = variant(ctx);
  const cacheLabels = { 'cache-busy': '清理中', 'cache-success': '已清理', 'cache-error': '清理失败', 'cache-unknown':'结果未确认','cache-continuable':'结果未确认','cache-reconcile-busy':'清理中' };
  const cacheState=choice(ctx,'settings-cache-state',v.startsWith('cache-')?v:'default');
  const cacheLabel = cacheLabels[cacheState] ?? '清理文字缓存';
  const modeName=choice(ctx,'settings-theme-mode',v==='theme-day'?'day':v==='theme-night'?'night':'system');
  const mode = ['system','day','night'].indexOf(modeName);
  const autoUpdate=boolChoice(ctx,'settings-auto-update',v!=='auto-check-off');
  const reduceMotion=boolChoice(ctx,'settings-reduce-motion',v==='reduce-motion');
  const resetBusy=boolChoice(ctx,'settings-reset-busy',v==='reset-busy');
  const operationState=choice(ctx,'settings-operation-state',v);
  const toggleBlocked=['settings-saved-refreshing','settings-save-unknown'].includes(operationState);
  const themes = `<div class="segments settings-theme">${['跟随', '浅色', '深色'].map((text, i) =>
    `<button class="${mode === i ? 'selected' : ''}" aria-pressed="${mode===i}" data-choice="settings-theme-mode" data-choice-value="${['system','day','night'][i]}">${text}</button>`).join('')}</div>`;
  let content = topbar('通用设置') + `<div class="app-scroll settings-scroll">` +
    section('基础偏好', row('App主题', themes, '', 'settings_gen_theme')) +
    section('行为与反馈',
      settingRow('自动检查更新', 'settings_gen_update', autoUpdate, '').replace('<div ',`<button ${toggleBlocked?'disabled':''} role="switch" aria-checked="${autoUpdate}" data-choice="settings-auto-update" data-choice-value="${!autoUpdate}" `).replace('</div>','</button>') +
      settingRow('减少动态效果', 'settings_gen_motion', reduceMotion, '').replace('<div ',`<button ${toggleBlocked?'disabled':''} role="switch" aria-checked="${reduceMotion}" data-choice="settings-reduce-motion" data-choice-value="${!reduceMotion}" `).replace('</div>','</button>') +
      row('缓存清理', `<span class="settings-inline-action">${cacheLabel}</span>`, ['cache-busy','cache-reconcile-busy'].includes(cacheState) ? '' : ['cache-unknown','cache-continuable'].includes(cacheState)?hint('清理结果尚未确认，原操作已保留，请核对'):'variant:cache-busy', 'settings_gen_cache')) +
    `<button class="settings-danger category-row" data-action="open:restore-defaults"><span class="row-icon">${icon('settings_gen_refresh',15)}</span><span class="row-label">恢复默认</span>${chevron()}</button>` +
    settingsFeedback(ctx) + `</div>`;
  if (resetBusy) content = `<fieldset class="settings-disabled" disabled>${content}</fieldset>`;
  return `<div class="app-page settings-general" ${resetBusy ? 'aria-busy="true"' : ''}>${content}</div>`;
}

function sourceRow(item,recovery={}) {
  const check=item.checkState||'unchecked',enabled=settingsBoolean(item.enabled);
  const message=check==='unchecked'?'':item.checkMessage||'';
  const sourceId=`data-source-id="${esc(item.sourceId)}"`;
  return `<div class="source-row" ${sourceId}><span class="source-row-folder">${icon('source_group_folder',20)}</span><div class="source-row-info"><div class="source-name-line"><strong>${esc(item.name)}</strong><small>${esc(item.type)}</small></div><div class="source-domain">${esc(item.domain)}</div>${message ? `<div class="source-row-message">${esc(message)}</div>` : ''}</div>` +
    (item.login ? `<button class="source-small-button source-login-button" ${sourceId} data-action="${check === 'checking' ? esc(hint('该源检测或登录已在途，重复登录被现有 handler 忽略。')) : 'go:source-login'}">登录</button>` : '') +
    `<button class="source-small-button" ${sourceId} ${check === 'checking' ? 'disabled' : ''} data-action="source:check">${check === 'checking' ? '检测中' : '检测'}</button>` +
    `<span class="source-status-badge ${check}" aria-label="${esc(check === 'passed' ? '检测通过' : check === 'failed' ? '检测失败' : check === 'checking' ? '检测中' : '未检测')}"><i></i></span>` +
    `<button class="app-toggle ${enabled ? 'on' : ''}" ${sourceId} ${recovery.blocked||recovery.unknown||(recovery.toggleBusy??recovery.busy)?'disabled':''} role="switch" aria-label="${esc(item.name)}启用状态" aria-checked="${enabled}" data-source-enabled="${!enabled}" data-action="source:toggle"><span></span></button></div>`;
}

function renderSources(ctx) {
  const v = variant(ctx);
  const noSources = ['empty', 'loading', 'load-error'].includes(v);
  const sampleChoices={...ctx?.choices};
  if(!Array.isArray(sampleChoices['source-records']))applySettingsSample('sources',v,sampleChoices);
  const records=noSources?[]:settingsSourceRecords(sampleChoices);
  const query=String(choice(ctx,'source-query',v==='filter-empty'?'未匹配的名称':'')).trim().toLowerCase();
  const statusValue=choice(ctx,'source-status','全部'),groupValue=choice(ctx,'source-group','全部分组'),categoryValue=choice(ctx,'source-category','all');
  const sourceItems=records.filter(item=>(!query||item.name.toLowerCase().includes(query)||item.domain.toLowerCase().includes(query))&&(groupValue==='全部分组'||item.group===groupValue)&&(categoryValue==='all'||item.category===categoryValue)&&(statusValue==='全部'||statusValue==='启用'&&settingsBoolean(item.enabled)||statusValue==='异常'&&item.checkState==='failed'||statusValue==='未检测'&&(!item.checkState||item.checkState==='unchecked')));
  const groups=['全部分组',...new Set(records.map(item=>item.group?.trim()).filter(Boolean))];
  const groupOpen=boolChoice(ctx,'source-group-open',v==='group-open')&&groups.length>1;
  const messages = {
    loading: '正在读取 Core 书源数据…',
    'load-error': '书源列表读取失败：source.list returned invalid data',
    importing: '正在导入本地书源…',
    'import-online': '正在导入在线书源…',
    'import-success': '已导入 2 个书源',
    'import-warning': '已导入 1 个书源，失败 1 个书源',
    'import-error': '书源导入失败：source.import returned invalid or mismatched data',
    'import-refresh-warning': importRefreshWarning,
    'import-refresh-warning-partial': 'Core 已导入 1 个书源，但列表刷新失败：source.list returned invalid data',
    'toggle-error': '书源启停失败：source.update returned invalid data',
  };
  const error = ['load-error','import-error','toggle-error'].includes(v);
  const recovery=sourceRecoveryFor(ctx);
  const banner = recovery.blocked?`<div class="source-recovery-notice"><p>${esc(recovery.message)}</p>${recoveryButton('核对原操作回执','variant:original-busy',recovery.busy)}${recovery.continue?recoveryButton(recovery.cleanup?'继续原清理':'继续原操作','variant:original-busy',recovery.busy):''}</div>`:recovery.message||messages[v] ? `<div class="source-status-banner ${error ? 'error' : ''}"><span>${esc(recovery.message||messages[v])}</span>${error||recovery.retry ? `<button data-action="variant:${recovery.unknown?'receipt-unknown-reading':recovery.message?'receipt-refreshing':'loading'}">重试</button>` : ''}</div>` : '';
  const enabledCount=records.filter(item=>settingsBoolean(item.enabled)).length;
  const counts=`${sourceItems.length===records.length?`${records.length} 个书源`:`显示 ${sourceItems.length}/${records.length} 个书源`} · ${enabledCount} 个启用`;
  const filters = `<div class="source-status-filters">${['全部','启用','异常','未检测','自定义'].map((text,i) => `<button class="source-chip ${statusValue===text ? 'selected' : ''}" ${i === 4 ? 'disabled' : ''} aria-pressed="${statusValue===text}" data-choice="source-status" data-choice-value="${text}">${text}</button>`).join('')}</div>`;
  const group = `<div class="source-group-filter">${icon('source_group_folder',15)}<strong>分组</strong><button class="source-group-select ${groupOpen?'open':''}" data-popup-anchor="source-group" aria-expanded="${groupOpen}" data-choice="source-group-open" data-choice-value="${!groupOpen}" ${groups.length<2?'disabled':''}>${esc(groupValue)}${icon('source_group_chevron',12)}</button></div>`;
  const types=[['all','全部类型'],['novel','小说'],['comic','漫画'],['music','音乐/有声'],['download','下载/文件'],['external','视频/外部媒体'],['other','其他/混合']];
  const categories = `<div class="source-categories">${types.map(([value,text]) => `<button class="${categoryValue===value ? 'selected' : ''}" aria-pressed="${categoryValue===value}" data-choice="source-category" data-choice-value="${value}">${esc(text)}</button>`).join('')}</div>`;
  const empty = records.length===0 && v !== 'loading' ? `<div class="source-empty"><strong>暂无书源</strong><p>点击下方「＋ 新增书源」导入 Legado 书源 JSON</p></div>` : '';
  const popup=groupOpen?`<div class="source-group-layer"><button class="source-group-dismiss" aria-label="关闭分组选择" data-choice="source-group-open" data-choice-value="false"></button><div class="source-group-popover" data-anchored-popup="source-group" role="listbox" aria-label="书源分组">${[groupValue,...groups.filter(item=>item!==groupValue)].map(text=>`<button role="option" aria-selected="${text===groupValue}" data-choice="source-group" data-choice-value="${esc(text)}" data-close-choice="source-group-open">${esc(text)}${text===groupValue?icon('source_group_chevron',12):''}</button>`).join('')}</div></div>`:'';
  return `<div class="app-page sources-page" data-tablet="${ctx?.tablet===true?'true':'false'}">${topbar('书源管理', iconButton('bookshelf_more','书源工具','go:source-tools',20))}<div class="app-scroll sources-scroll"><div class="source-search-bar"><div class="source-search">${icon('search_mag',13)}${field('搜索书源名称或域名',choice(ctx,'source-query',v==='filter-empty'?'未匹配的名称':''),'sourceQuery').replace('<input ','<input data-choice="source-query" data-render-on-input="true" ')}</div><button class="source-search-import" aria-label="导入书源" data-action="open:json-import">${icon('source_add',18)}</button></div><p class="source-counts">${counts}</p>${banner}<div class="source-filters">${filters}${group}</div>${categories}${empty}${sourceItems.map(item=>sourceRow(item,recovery)).join('')}</div><div class="source-bottom-actions">${button('批量管理','go:source-tools')}<button class="app-btn primary" data-action="open:json-import">${icon('source_add',18)}<span>新增书源</span></button></div>${popup}</div>`;
}

function batchFixture(v, ctx) {
  const batchState=choice(ctx,'source-batch-state',batchStates.includes(v)?v:'');
  const mask=Number(choice(ctx,'source-batch-selection',choice(ctx,'source-selection',3)))&3;
  const records=settingsSourceRecords(ctx?.choices);
  const selection = fixtureSources.filter((_item,i) => mask & (1 << i));
  const scope = selection.length ? selection : records.length?records:fixtureSources;
  const total = scope.length;
  const mode = choice(ctx,'source-batch-mode',resultMode(ctx)) === 'explore' ? '发现' : '搜索';
  const levels = ['L1','L2','L3','L4','L5'].slice(0,Number(choice(ctx,'source-batch-depth',resultDepth(ctx)))).join('、');
  const passed = { source:scope[0], state:'passed', message:`${mode} ${levels} 通过，120ms` };
  const secondPassed = { source:scope[1] || scope[0], state:'passed', message:`${mode} ${levels} 通过，120ms` };
  const unavailable = { source:scope[0], state:'failed', message:`${mode} 无通过级别：检测失败` };
  const error = { source:scope[1] || scope[0], state:'error', message:'source.check.run returned invalid result count' };
  const states = {
    'check-initial': { phase:'running', current:0, results:[] },
    'check-first': { phase:'running', current:1, results:[] },
    'check-running': { phase:'running', current:total, results:total === 2 ? [passed] : [] },
    'check-stopping': { phase:'stopping', current:total, results:total === 2 ? [passed] : [] },
    'check-complete': { phase:'completed', current:total, results:[passed,secondPassed].slice(0,total) },
    'check-mixed': { phase:'completed', current:total, results:[unavailable,error].slice(0,total) },
    'check-stopped': { phase:'stopped', current:total, results:total === 2 ? [passed] : [] },
    'check-stopped-empty': { phase:'stopped', current:0, results:[] },
    'check-error': { phase:'failed', current:1, results:[passed] },
  };
  return states[batchState] ? { ...states[batchState], total, scope } : undefined;
}

function renderBatchProgress(v, ctx) {
  const progress = batchFixture(v, ctx);
  const { phase, current, results, total, scope } = progress;
  const done = results.length;
  const passed = results.filter(item => item.state === 'passed').length;
  const failed = results.filter(item => item.state === 'failed').length;
  const errors = results.filter(item => item.state === 'error').length;
  const percent = total > 0 ? Math.min(100,Math.max(0,Math.round(done * 100 / total))) : 0;
  const phaseText = { running:'检测中', stopping:'停止中', completed:'已完成', stopped:'已停止', failed:'已中断' }[phase];
  const resultRows = results.slice().reverse().map(item => `<div class="source-result-row ${item.state}"><div><strong>${esc(item.source.name)}</strong><small>${esc(item.message)}</small></div><strong>${{passed:'所选项通过',failed:'所选项未通过',error:'检测错误'}[item.state]}</strong></div>`).join('');
  const currentText = current > 0 && scope[current-1] ? `<p class="source-check-current">当前 ${current}/${total}：${esc(scope[current-1].name)}（检测所选能力）</p>` : '';
  const resultsContent = done ? `<strong class="source-results-heading">实时结果（最新在前）</strong><div class="source-check-results" style="height:${Math.min(320,Math.max(58,done*58))}px">${resultRows}</div>` : '<p class="source-check-empty">每个书源完成后，结果会立即出现在这里。</p>';
  return `<section class="app-card source-tool-card source-check-card"><div class="source-check-heading"><h2>检测进度 ${done}/${total}（${percent}%）</h2><span class="source-check-phase ${phase}">${phaseText}</span></div><div class="source-progress"><i style="width:${percent}%"></i></div>${currentText}<div class="source-check-counters"><span class="passed">所选项通过 ${passed}</span><span class="failed">所选项未通过 ${failed}</span><span class="error">检测错误 ${errors}</span><span class="remaining">剩余 ${total-done}</span></div>${resultsContent}</section>`;
}

function debugFixture(v, progress, ctx) {
  const kind=choice(ctx,'source-debug-kind',v.startsWith('debug-')||v==='debug'?'single':'batch');
  const debugState=choice(ctx,'source-debug-state',v.startsWith('debug-')||v==='debug'?v:'');
  const lastResult = kind==='batch'?progress?.results.at(-1):undefined;
  const active = kind==='single'&&debugState.startsWith('debug-') || Boolean(lastResult);
  const item = lastResult?.source || sourceObject(ctx,'source-debug-source');
  const object = active ? item.domain : '';
  if (!active || kind==='single'&&['debug-busy','debug-error'].includes(debugState)) return { object, logs:[] };
  if (lastResult?.state === 'error') return { object, logs:[{state:-1,message:`[应用] ${lastResult.message}`}] };
  if (debugState === 'debug-failed' || lastResult?.state === 'failed') return { object, logs:[
    {state:1,message:`[Host] source-check GET ${item.domain}/search → HTTP 503（120ms）`},
    {state:-1,message:'[Core] 检测失败'},
  ] };
  const depth=kind==='batch'?choice(ctx,'source-batch-depth',resultDepth(ctx)):choice(ctx,'source-debug-result-depth',resultDepth(ctx));
  const mode=(kind==='batch'?choice(ctx,'source-batch-mode',resultMode(ctx)):choice(ctx,'source-debug-result-mode',resultMode(ctx)))==='explore'?'explore':'search';
  const levels = ['L1','L2','L3','L4','L5'].slice(0,Number(depth)).join('、');
  return { object, logs:[
    {state:1,message:`[Host] source-check GET ${item.domain}/${mode} → HTTP 200（120ms）`},
    {state:1,message:`[Core] ${levels} 通过`},
  ] };
}

function renderTools(ctx) {
  const v = variant(ctx);
  const progress = batchFixture(v, ctx);
  const check = Boolean(progress);
  const running = check && ['running','stopping'].includes(progress.phase);
  const editor = boolChoice(ctx,'source-editor-open',v.startsWith('editor') && !['editor-loading','editor-load-error','editor-cancelled','editor-saved','editor-reread-success'].includes(v));
  const readbackFailed = boolChoice(ctx,'source-editor-readback-failed',['editor-readback-error','editor-reread-busy','editor-reread-not-found'].includes(v));
  const busy = boolChoice(ctx,'source-tools-busy',toolBusyStates.includes(v));
  const recovery=sourceRecoveryFor(ctx);
  const writeBlocked=busy||recovery.blocked||recovery.unknown||boolChoice(ctx,'source-editor-save-unknown',['editor-save-unknown','editor-reread-unknown'].includes(v));
  const cancelBlocked=busy||recovery.blocked||boolChoice(ctx,'source-editor-save-unknown',['editor-save-unknown','editor-reread-unknown'].includes(v));
  const consumed = ['selection-cleared','enable-busy','enable-success','disable-busy','disable-success','update-partial','update-error','delete-busy','delete-success','delete-cleanup-warning','delete-error','export-busy','export-success','export-cancelled','export-error'].includes(v);
  const items = sourceRowsFor(v,ctx);
  const availableMask=items.reduce((value,item)=>value | (1<<fixtureSources.findIndex(candidate=>candidate.sourceId===item.sourceId)),0);
  const mask = sourceSelectionMask(ctx, consumed ? 0 : v === 'selected' || check ? 3 : 0)&availableMask;
  const selected = (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0);
  const operationMask = sourceOperationMask(ctx);
  const operationCount = (operationMask & 1 ? 1 : 0) + (operationMask & 2 ? 1 : 0) || 2;
  const mode = choice(ctx, 'source-check-mode', 'search');
  const depth = Number(choice(ctx, 'source-check-depth', 2));
  const debugKey = choice(ctx, 'source-debug-key', '我的');
  const modeText = choice(ctx,'source-debug-result-mode',resultMode(ctx)) === 'explore' ? '发现' : '搜索';
  const levels = ['L1','L2','L3','L4','L5'].slice(0,Number(choice(ctx,'source-debug-result-depth',resultDepth(ctx)))).join('、');
  const messages = {
    default:'已读取 Core 数据', loading:'正在读取 Core 书源工具数据…',
    'load-error':'书源工具数据读取失败：source.list returned invalid data',
    selected:'已选择 2 个书源', 'selected-one':'已选择 1 个书源', 'selection-cleared':'已清空选择',
    'check-initial':'已开始逐源检测：0/2', 'check-first':`正在检测 1/2：${fixtureSources[0].name}`,
    'check-running':`正在检测 2/2：${fixtureSources[1].name}`, 'check-stopping':'正在停止检测：已完成 1/2…',
    'check-complete':'批量检测完成：所选项通过 2，未通过 0，检测错误 0',
    'check-mixed':'批量检测完成：所选项通过 0，未通过 1，检测错误 1',
    'check-stopped':'已停止检测：完成 1/2，所选项通过 1，未通过 0，检测错误 0',
    'check-stopped-empty':'已停止检测：完成 0/2，所选项通过 0，未通过 0，检测错误 0',
    'check-error':'批量检测书源失败：source.check.run returned invalid result count',
    'editor-loading':'正在读取原始 BookSource…', 'editor-load-error':'书源读取失败：source.export returned invalid data',
    'editor-switch-loading':'正在读取原始 BookSource…', 'editor-switch-error':'书源读取失败：source.export returned invalid data', 'editor-switch-success':'编辑原始 BookSource JSON',
    editor:'编辑原始 BookSource JSON', 'editor-busy':'正在由 Core 校验并保存…',
    'editor-error':'书源保存失败：书源地址是主键；编辑器不允许隐式迁移 bookSourceUrl',
    'editor-readback-error':'书源已确认，刷新失败：source.list returned invalid data；草稿保留供核对',
    'editor-save-unknown':'书源等待核对；草稿保留供核对',
    'editor-reread-unknown':'等待核对；列表读取不能确认先前保存，草稿保留',
    'editor-reread-busy':'正在读取已保存书源…',
    'editor-reread-not-found':'已确认，但当前列表未找到该书源；草稿保留供核对',
    'editor-reread-success':'已确认，当前读取结果可用', 'editor-saved':'书源已由 Core 校验并保存', 'editor-cancelled':'已取消编辑',
    'export-busy':'正在由 Core 导出书源…', 'export-success':'已导出 2 个书源：reader-book-sources-1728000000000.json',
    'export-cancelled':'已取消导出', 'export-error':'书源导出失败：source.export returned invalid data',
    'enable-busy':'正在启用 2 个书源…', 'enable-success':'已启用 2 个书源',
    'disable-busy':'正在停用 2 个书源…', 'disable-success':'已停用 2 个书源',
    'update-partial':'批量更新中断：已完成 1/2；source.update returned invalid data',
    'update-error':'批量更新书源失败（已完成 1/2）：source.update returned invalid data',
    'delete-busy':'正在删除 2 个书源…', 'delete-success':'已删除 2 个书源',
    'delete-cleanup-warning':'已删除 2 个书源；1 个 Host 登录会话清理失败',
    'delete-error':'书源删除失败：source.list returned invalid data',
    'debug-busy':'正在检测所选能力…',
    'debug-passed':`${modeText}检测 ${levels} 通过（120ms）；trace=fixture-trace，1 条同次 Host 网络证据`,
    'debug-failed':`${modeText}检测未通过（无通过级别，1 条同次 Host 网络证据）：检测失败`,
    'debug-error':'书源调试失败：当前 Core 不支持分项书源检测，请使用配套 Native；不会将发现检测降级为搜索',
  };
  if (check) {
    const {total,current,scope,results}=progress;
    const counts={ passed:results.filter(item=>item.state==='passed').length, failed:results.filter(item=>item.state==='failed').length, errors:results.filter(item=>item.state==='error').length };
    const done=results.length;
    messages['check-initial']=`已开始逐源检测：0/${total}`;
    messages['check-first']=`正在检测 1/${total}：${scope[0].name}`;
    messages['check-running']=current > 0 && scope[current-1] ? `正在检测 ${current}/${total}：${scope[current-1].name}` : `已开始逐源检测：0/${total}`;
    messages['check-stopping']=`正在停止检测：已完成 ${done}/${total}…`;
    messages['check-complete']=messages['check-mixed']=`批量检测完成：所选项通过 ${counts.passed}，未通过 ${counts.failed}，检测错误 ${counts.errors}`;
    messages['check-stopped']=messages['check-stopped-empty']=`已停止检测：完成 ${done}/${total}，所选项通过 ${counts.passed}，未通过 ${counts.failed}，检测错误 ${counts.errors}`;
  }
  if (['default','selected','selected-one','selection-cleared'].includes(v) && ctx?.choices?.['source-selection'] !== undefined) messages[v]=selected ? `已选择 ${selected} 个书源` : '已清空选择';
  messages['enable-busy']=`正在启用 ${operationCount} 个书源…`;
  messages['disable-busy']=`正在停用 ${operationCount} 个书源…`;
  messages['enable-success']=`已启用 ${operationCount} 个书源`;
  messages['disable-success']=`已停用 ${operationCount} 个书源`;
  messages['update-partial']=`批量更新中断：已完成 1/${operationCount}；source.update returned invalid data`;
  messages['update-error']=`批量更新书源失败（已完成 1/${operationCount}）：source.update returned invalid data`;
  messages['delete-busy']=`正在删除 ${operationCount} 个书源…`;
  messages['delete-success']=`已删除 ${operationCount} 个书源`;
  messages['delete-cleanup-warning']=`已删除 ${operationCount} 个书源；1 个 Host 登录会话清理失败`;
  const exportCount=choice(ctx,'source-export-scope','all')==='selected' ? operationCount : items.length;
  messages['export-success']=`已导出 ${exportCount} 个书源：reader-book-sources-1728000000000.json`;
  const status = `<div class="source-tool-status ${busy ? 'busy' : ''}">${esc(recovery.message||messages[v]||messages.default)}</div>`;
  const recoveryBusy=busy||recovery.busy===true;
  const recoveryActions=recovery.blocked?`${recoveryButton('核对原操作回执','variant:original-busy',recoveryBusy)}${recovery.continue?recoveryButton(recovery.cleanup?'继续原清理':'继续原操作','variant:original-busy',recoveryBusy):''}`:recovery.retry||v==='load-error'?recoveryButton('刷新列表',`variant:${v==='load-error'&&!recovery.message?'read-refreshing':recovery.unknown?'receipt-unknown-reading':'receipt-refreshing'}`,recoveryBusy):'';
  const exportSection = card('书源导出', `<p>Core 生成 Legado 兼容 JSON；Host 只通过系统文件选择器写入。</p>${button('导出全部书源','open:source-export','primary',busy).replace('<button ','<button data-export-scope="all" ')}`, 'source-tool-solid');
  const stopButton = running ? toolButton(progress.phase === 'stopping' ? '停止中…' : '停止检测','停止逐源检测，保留已完成结果。',progress.phase === 'stopping',false,'variant:check-stopping') : toolButton('检测所选','按当前模式与深度执行所选源。',busy || selected === 0,false,'variant:check-initial').replace('<button ','<button data-source-result-start="true" ');
  const deleteButton = consumingAction(button('删除','open:source-delete','secondary',writeBlocked || !selected).replace('<button ', '<button data-background-variant="selection-cleared" '),mask);
  const selectionButton = (label,value,disabled=false) => button(label,'','secondary',disabled).replace('<button ',`<button data-choice="source-selection" data-choice-value="${value}" `);
  const batch = card(`批量管理（已选 ${selected}/${items.length}）`, `<div class="source-tool-actions">${selectionButton('全选',availableMask,busy)}${selectionButton('清空',0,busy || !selected)}${button('导出所选','open:source-export','secondary',busy || !selected).replace('<button ','<button data-export-scope="selected" ')}</div><div class="source-tool-actions">${stopButton}${consumingAction(toolButton('启用','逐源更新，部分失败显示已完成数量。',writeBlocked || !selected,false,'variant:enable-busy'),mask).replace('<button ','<button data-source-operation-enabled="true" ')}${consumingAction(toolButton('停用','确认后清登录会话。',writeBlocked || !selected,false,'variant:disable-busy'),mask).replace('<button ','<button data-source-operation-enabled="false" ')}${deleteButton}</div><p class="source-tool-technical">批量操作复用 source.export / source.check.run / source.update / source.delete；删除由系统确认框二次确认。</p>`, 'source-tool-solid');
  const editorItem = sourceObject(ctx,'source-editor-source',v==='editor-switch-success' ? fixtureSources[1] : fixtureSources[0]);
  const rows = items.map(item => { const i=fixtureSources.findIndex(candidate=>candidate.sourceId===item.sourceId); const editButton=toolButton('编辑','',writeBlocked,false,`variant:${editor ? 'editor-switch-loading' : 'editor-loading'}`).replace('<button ',`<button data-source-id="${esc(item.sourceId)}" data-source-editor-request="${esc(item.domain)}" ${editor ? `data-source-editor-current="${esc(editorItem.domain)}" data-source-editor-readback="${readbackFailed}"` : ''} `); const debugButton=toolButton('调试','',busy,false,'variant:debug-busy').replace('<button ',`<button data-source-id="${esc(item.sourceId)}" data-choice="source-debug-source" data-choice-value="${esc(item.domain)}" data-source-result-start="true" `); return `<div class="source-tool-row" data-source-id="${esc(item.sourceId)}"><div><strong>${esc(item.name)}</strong><small>${esc(item.domain)}</small></div>${selectionButton(mask & (1<<i) ? '已选' : '选择',mask ^ (1<<i),busy)}${editButton}${debugButton}</div>`; }).join('');
  const sourceList = card(`书源编辑（${items.length}）`, `<div class="source-tool-list" style="height:${Math.min(420,Math.max(58,items.length*58))}px">${rows}</div>`);
  const raw = choice(ctx,'source-editor-draft',JSON.stringify({bookSourceUrl:editorItem.domain,bookSourceName:editorItem.name,enabled:editorItem.enabled},null,2));
  const editorCard = editor ? card(`编辑：${editorItem.domain}`, `<p>bookSourceUrl 是主键；本页不执行隐式迁移。保存时由 Core source.import 校验并持久化。</p><textarea class="source-editor-field" data-choice="source-editor-draft" ${recovery.blocked?'readonly':''} ${busy ? 'data-choice-guard="busy"' : ''}>${esc(raw)}</textarea><div class="source-tool-actions">${toolButton('取消','关闭编辑卡并清草稿。',cancelBlocked,false,'variant:editor-cancelled').replace('<button ','<button data-source-editor-clear="true" ')}${toolButton('校验并保存','校验主键与 JSON。',writeBlocked,true,'variant:editor-busy')}</div>${readbackFailed ? `<p class="source-editor-readback-note">保存已由 Core 确认；下面的操作只重新读取书源列表，不会再次执行 source.import。</p>${toolButton('重新读取已保存书源','只读列表。',busy,false,'variant:editor-reread-busy')}` : ''}`, 'source-tool-solid') : '';
  const debugState = debugFixture(v,progress,ctx);
  const options = `<div class="source-debug-options"><select aria-label="检测模式" data-choice="source-check-mode" ${busy ? 'disabled' : ''}>${[['search','搜索'],['explore','发现']].map(([value,label])=>`<option value="${value}" ${mode===value?'selected':''}>${label}</option>`).join('')}</select><select aria-label="检测深度" data-choice="source-check-depth" ${busy ? 'disabled' : ''}>${['列表','详情','目录','正文'].map((label,i)=>`<option value="${i+2}" ${depth===i+2?'selected':''}>${label}</option>`).join('')}</select></div>`;
  const debugInput = field('检测关键词（留空时使用 Core 默认“我的”）',debugKey,'debugKey').replace('<input ',`<input data-choice="source-debug-key" ${busy?'data-choice-guard="busy"':''} `);
  const debugLogs = `<div class="source-debug-logs" style="height:${Math.min(360,Math.max(32,debugState.logs.length*32))}px">${debugState.logs.map((log,i)=>`<div class="source-debug-log ${log.state===-1?'error':''}">${esc(`${i+1}. [${log.state}] ${log.message}`)}</div>`).join('')}</div>`;
  const debug = card(debugState.object ? '最近一次检测详情' : '书源调试', `${options}${debugInput}${debugState.object ? `<p class="source-debug-object">检测对象：${esc(debugState.object)}</p>` : ''}${debugLogs}`);
  return `<div class="app-page source-tools-page" ${busy?'aria-busy="true"':''}>${topbar('批量管理与书源工具')}<div class="app-scroll source-tools-scroll">${status}${recoveryActions}${exportSection}${batch}${check ? renderBatchProgress(v,ctx) : ''}${sourceList}${editorCard}${debug}</div></div>`;
}

function renderSourceLogin(ctx) {
  const v = variant(ctx);
  const item=sourceObject(ctx,'active-source-id');
  const url = v === 'starting' ? '' : `${item.domain}/login${v==='long-url'?'/verification/continuation/long-path':''}`;
  return `<div class="app-page source-login-page"><div class="source-web-surface" aria-label="Web"></div><header class="source-login-bar">${targetStateButton('取消','sources','default').replace('<button ','<button data-source-login-result="cancel" ')}<div class="source-login-heading"><strong>${esc(item.name)} · 登录 / 验证</strong>${url ? `<small>${esc(url)}</small>` : ''}</div>${targetStateButton('完成','sources','checking').replace('<button ','<button data-source-login-result="complete" ')}</header></div>`;
}

function systemDialog(title, body, actions) {
  return `<div class="app-dialog source-system-dialog"><div class="dialog-title">${esc(title)}</div><div class="dialog-body"><p>${esc(body)}</p></div><div class="dialog-actions">${actions}</div></div>`;
}

function jsonDialog(title, body, actions) {
  return `<div class="app-dialog source-json-dialog"><div class="dialog-title"><span>${esc(title)}</span><button class="source-json-close" data-action="close">关闭</button></div><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div></div>`;
}

function renderJsonImport(ctx) {
  const validation=choice(ctx,'source-import-validation',variant(ctx)==='empty-url'?'请输入在线 JSON 的 HTTP/HTTPS 地址':'');
  const input=field('https://example.com/data.json',choice(ctx,'source-import-url',''),'importUrl').replace('<input ','<input data-choice="source-import-url" data-clear-validation="json-import" data-submit-action="submit:json-import" ');
  const body=`<p class="source-import-description">支持 Legado 书源 JSON；本地文件和在线链接共用 Core 导入校验。</p>${button('选择本地 JSON 文件',hint('关闭导入框后打开系统 JSON 文件选择器；选择完成才导入，取消不伪造完成结果。'),'primary').replace('<button ','<button data-dismiss-overlay="true" ')}<label class="source-import-label">在线链接</label>${input}<small>GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。</small>${validation?`<small class="source-import-error" role="alert">${esc(validation)}</small>`:''}`;
  return jsonDialog('导入书源',body,button('从在线链接导入','submit:json-import','primary'));
}

export const screens = [
  { id:'settings', label:'设置首页', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',1883),source('features/settings/SettingsPage.ets',247),source('features/settings/SettingsPage.ets',177),source('features/shell/SettingsShell.ets',57)], note:'当前 L0 首页只有通用设置、书源管理、书架设置；发现、RSS、同步及未实现设置不准入。', variants:variants([['default','当前入口'],...settingsRecoveryStates,['cache-unknown','清理结果未确认：原位核对'],['cache-continuable','原清理可继续'],['cache-reconcile-busy','原清理核对中']]), render:renderSettings },
  { id:'general', label:'通用设置', group:'设置与书源', kind:'page', source:[source('features/settings/SettingsPage.ets',247),source('features/settings/SettingsCacheCleanupOwner.ts',90),source('features/settings/SettingsPage.ets',196),source('features/settings/SettingsPage.ets',402),source('features/settings/SettingsPage.ets',490),source('features/settings/SettingsPage.ets',652),source('features/settings/SettingsOrchestrator.ets',136)], note:'缓存与恢复结果保留在原行或原页面；保存未确认保留已接受选择并提供原位核对。状态选项在画布外选择，不代表预览执行了真实清理或保存。', variants:variants([['default','默认值'],...settingsRecoveryStates,['cache-unknown','清理结果未确认：原位核对'],['cache-continuable','原清理可继续'],['cache-reconcile-busy','原清理核对中'],['theme-day','App 浅色选择'],['theme-night','App 深色选择'],['reduce-motion','减少动态效果开启'],['auto-check-off','自动检查更新关闭'],['cache-busy','清理中：原行'],['cache-success','已清理：原行'],['cache-error','清理失败：原行'],['reset-busy','恢复时禁用原页'],['reset-success','恢复成功：原页'],['reset-error','异常保留恢复记录：原页'],['reset-incomplete','未完成可重试：原页']]), render:renderGeneral },
  { id:'sources', label:'书源管理', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',1968),source('features/source/SourceManagementPage.ets',323),source('features/source/SourceManagementPage.ets',244),source('features/source/SourceManagementPage.ets',338),source('features/source/SourceManagementPage.ets',502),source('features/source/SourceOrchestrator.ets',139)], note:'书源名、域名、数量、检测耗时和分组使用显式示例数据。搜索/筛选原位投影；状态用本页 statusBanner，原操作保护复用当前 ReaderRecoveryNotice / Action。自定义筛选实际禁用。', variants:variants([['default','未检测列表'],...sourceRecoveryStates,['loading','原页读取中'],['load-error','读取失败与重试'],['empty','没有书源'],['filter-empty','筛选后无匹配'],['group-open','实际分组下拉'],['checking','单源检测中'],['login-waiting','原行等待登录 / 验证'],['check-passed','单源检测通过'],['check-failed','单源检测失败'],['importing','原页本地导入中'],['import-online','原页在线导入中'],['import-success','原页导入结果'],['import-warning','部分导入结果'],['import-error','原页导入失败'],['import-refresh-warning','已导入但列表刷新失败'],['import-refresh-warning-partial','部分导入后列表刷新失败'],['toggle-error','启停失败：保留原值'],['source-disabled','已确认停用值']]), render:renderSources },
  { id:'source-tools', label:'批量管理与书源工具', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',1929),source('features/source/SourceToolsPage.ets',485),source('features/source/SourceToolsPage.ets',231),source('features/source/SourceToolsPage.ets',285),source('features/source/SourceToolsPage.ets',604),source('features/source/SourceToolsOrchestrator.ets',501)], note:'导出、批量检测、编辑器、调试都在同一路由。当前代码确实渲染的技术文案保留；源数量、结果、日志内容、URL、耗时和 trace 使用示例数据，不是执行回执。busy / 结果都是原页状态，不新增提交或取消页面。', variants:variants([['default','已读取列表'],...sourceRecoveryStates,['editor-save-unknown','原保存未确认：保留草稿'],['editor-reread-unknown','列表读回不能确认原保存'],['loading','读取工具数据'],['load-error','读取失败'],['selected','已选范围'],['selection-cleared','原页清空选择'],['check-initial','批检初始：无结果'],['check-first','首源检测：无结果'],['check-running','原页检测中'],['check-stopping','原按钮停止中'],['check-complete','原页检测全部通过'],['check-mixed','原页未通过 / 检测错误'],['check-stopped','原页保留已完成结果'],['check-stopped-empty','原页停止：尚无完成结果'],['check-error','原页检测中断'],['editor-loading','读取原始 JSON：原页'],['editor-load-error','原始 JSON 读取失败'],['editor-switch-loading','读取另一源中：保留旧卡草稿'],['editor-switch-error','读取另一源失败：保留旧卡草稿'],['editor-switch-success','读取另一源成功：替换原始 JSON'],['editor','本页编辑卡'],['editor-busy','原页保存中'],['editor-error','原页保存失败'],['editor-readback-error','已保存但读回失败'],['editor-reread-busy','重新读取中：保留草稿'],['editor-reread-not-found','重读未找到源：保留草稿'],['editor-reread-success','重读确认：关闭编辑卡'],['editor-saved','保存及读回成功：原页'],['editor-cancelled','取消编辑：原页'],['export-busy','原页导出中'],['export-success','原页导出数与文件名'],['export-cancelled','原页导出取消'],['export-error','原页导出失败'],['enable-busy','原页批量启用中'],['enable-success','原页批量启用结果'],['disable-busy','原页批量停用中'],['disable-success','原页批量停用结果'],['update-partial','已完成前缀：批量更新中断'],['update-error','已完成前缀：回读也失败'],['delete-busy','原页删除中'],['delete-success','原页删除计数'],['delete-cleanup-warning','已删除：会话清理失败独立计数'],['delete-error','删除后列表读取失败：原页'],['debug','调试卡配置与空日志'],['debug-busy','原调试卡检测中'],['debug-passed','原调试卡通过与日志'],['debug-failed','原调试卡未通过与日志'],['debug-error','原页调试失败']]), render:renderTools },
  { id:'source-login', label:'书源登录 / 验证', group:'设置与书源', kind:'page', source:[source('features/source/SourceOrchestrator.ets',278),source('app/ReaderRuntimeOwner.ts',613),source('app/ArkWebExecutionHost.ets',118)], note:'仅画已实现 ArkWeb Host 顶栏结构；Web 站点区域留空，未伪造网站截图。完成后仍需源检测；取消返回未检测状态。没有应用底栏。', variants:variants([['default','Host 顶栏含当前 URL'],['starting','尚无当前 URL'],['long-url','长 URL 单行省略']]), render:renderSourceLogin },
  { id:'json-import', label:'导入书源', group:'设置与书源', kind:'overlay', background:'sources', dismissable:false, source:[source('pages/Index.ets',734),source('pages/Index.ets',2527),source('features/common/JsonImportDialog.ets',49),source('features/common/JsonImportDialog.ets',130),source('features/common/ReaderSurfaceSpecs.ets',139)], note:'复用当前 JsonImportDialog / ReaderDialogSurface 的 json-import 规格。这里只校验链接是否为空；文件选择、下载、JSON 校验与写入属于实际 Host / Core 流程。', variants:variants([['default','本地与在线入口'],['empty-url','空在线链接']]), render:renderJsonImport },
  { id:'restore-defaults', label:'恢复界面与阅读设置', group:'设置与书源', kind:'overlay', background:'general', source:[source('features/settings/SettingsPage.ets',652),source('features/settings/LocalConfigurationReset.ts',73)], note:'真实调用系统 showAlertDialog；此处只画标题、正文和按钮结构，系统外观尺寸不作为自绘组件新规范。确认后的恢复留在原设置页面。', variants:variants([['default','系统确认框结构']]), render:() => systemDialog('恢复界面与阅读设置','恢复通用偏好、书架封面模式、默认日夜阅读主题、跟随系统、阅读排版与朗读偏好。保留书籍、书源、进度、书签、导入字体文件及同步和朗读服务凭据。',button('取消','close')+targetStateButton('恢复默认','general','reset-busy','danger')) },
  { id:'source-result', label:'书源导入结果', group:'设置与书源', kind:'overlay', background:'sources', source:[source('pages/Index.ets',2665),source('pages/Index.ets',2708),source('features/source/SourceOrchestrator.ets',411)], note:'结果是当前系统对话框，展示的数量使用示例。仅搜索来源且原关键词非空时有一次重新搜索动作；并非新增结果页面。', variants:variants([['default','普通导入完成'],['partial','部分导入完成'],['committed-refresh-failure','已导入但列表刷新失败'],['committed-refresh-failure-partial','部分导入后刷新失败'],['error','导入失败'],['from-search','带原关键词的搜索入口'],['from-search-refresh-failure','搜索来源：已导入但刷新失败']]), render:ctx => { const v=variant(ctx); const title=v==='error'?'书源导入失败':'书源导入完成'; const message=v==='error'?'source.import returned invalid or mismatched data':v==='partial'?'Core 已导入 1 个书源，失败 1 个书源':v==='committed-refresh-failure-partial'?'Core 已导入 1 个书源，但列表刷新失败：source.list returned invalid data，失败 1 个书源':v.includes('refresh-failure')?`${importRefreshWarning}。`:'Core 已导入 2 个书源。'; return systemDialog(title,message,v.startsWith('from-search')?button('继续管理','close')+targetStateButton(`用新书源搜索「${fixtures.query}」`,'search','loading','primary'):button('知道了','close')); } },
  { id:'source-export', label:'书源导出确认', group:'设置与书源', kind:'overlay', background:'source-tools', source:[source('features/source/SourceToolsPage.ets',732),source('features/source/SourceToolsOrchestrator.ets',259)], note:'真实系统确认先于 Core 导出及文件保存。系统文件选择器取消后只更新工具页“已取消导出”，不加独立取消页面。', variants:variants([['default','系统确认框结构']]), render:ctx => { let confirm=targetStateButton('继续导出','source-tools','export-busy','primary'); if(choice(ctx,'source-export-scope','all')==='selected') confirm=consumingAction(confirm,sourceSelectionMask(ctx)); return systemDialog('导出文件含登录凭据','导出的书源 JSON 会原样保留 Cookie、Authorization 等登录凭据，请勿转发给不可信的对象或公开渠道。是否继续导出？',confirm+button('取消','close')); } },
  { id:'source-delete', label:'删除书源确认', group:'设置与书源', kind:'overlay', background:'source-tools', source:[source('pages/Index.ets',2737),source('features/source/SourceToolsOrchestrator.ets',448),source('features/source/SourceGateway.ts',555)], note:'所选数量使用示例；实际先系统确认，再 Core 删除、Host 会话清理、原工具页回读。不新增“删除已提交”页面。', variants:variants([['default','系统确认框结构']]), render:ctx => {const mask=sourceOperationMask(ctx);const count=(mask&1?1:0)+(mask&2?1:0);return systemDialog('删除书源',`确定删除所选 ${count} 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。`,button('取消','close')+targetStateButton('删除','source-tools','delete-busy','danger'));} },
];
