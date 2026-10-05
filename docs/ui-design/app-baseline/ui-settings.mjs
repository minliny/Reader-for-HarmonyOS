import { esc, icon, iconButton, button, topbar, tabs, section, row, field, fixtures } from './shared.mjs';

const source = (path, line) => ({ path: `entry/src/main/ets/${path}`, line });
const variant = ctx => ctx?.variant ?? 'default';
const variants = entries => entries.map(([id, label]) => ({ id, label }));
const hint = text => `hint:${text}`;
const chevron = () => icon('reader_chevron_right', 14);
const fixtureSources = fixtures.sources.map((item, i) => ({ ...item, enabled: i === 0, login: i === 0, group: i === 0 ? '示例分组' : '' }));
const togglePaint = value => `<span class="app-toggle ${value ? 'on' : ''}" aria-hidden="true"><span></span></span>`;
const settingRow = (label, name, value, action) => row(label, togglePaint(value), hint(action), name);
const card = (title, content, cls='') => `<section class="app-card source-tool-card ${cls}"><h2>${esc(title)}</h2>${content}</section>`;
const toolButton = (label, text, disabled=false, primary=false) => button(label, hint(text), primary ? 'primary' : 'secondary', disabled);

function renderSettings() {
  return `<div class="app-page settings-home">${topbar('设置', '', false)}<div class="app-scroll settings-scroll">${section('设置',
    row('通用设置', chevron(), 'go:general', 'settings_row_general') +
    row('书源管理', chevron(), 'go:sources', 'settings_row_source') +
    row('书架设置', chevron(), 'go:bookshelf-settings', 'settings_row_shelf_search'))}</div>${tabs('settings')}</div>`;
}

function renderGeneral(ctx) {
  const v = variant(ctx);
  const cacheLabels = { 'cache-busy': '清理中', 'cache-success': '已清理', 'cache-error': '清理失败' };
  const resetMessages = {
    'reset-success': '已恢复界面与阅读设置',
    'reset-error': '恢复未完成，已保留恢复记录；点击恢复默认重试',
  };
  const cacheLabel = cacheLabels[v] ?? '清理文字缓存';
  const mode = v === 'theme-day' ? 1 : v === 'theme-night' ? 2 : 0;
  const themes = `<div class="segments settings-theme">${['跟随', '浅色', '深色'].map((text, i) =>
    `<button class="${mode === i ? 'selected' : ''}" data-action="${esc(hint(`ReaderThemeHost.selectApp 保存${text}主题；保存失败恢复原配置并显示系统 toast。`))}">${text}</button>`).join('')}</div>`;
  let content = topbar('通用设置') + `<div class="app-scroll settings-scroll">` +
    section('基础偏好', row('App主题', themes, '', 'settings_gen_theme')) +
    section('行为与反馈',
      settingRow('自动检查更新', 'settings_gen_update', true, '开关先更新本页，再保存 autoCheckUpdate；写入失败回读实际值。') +
      settingRow('减少动态效果', 'settings_gen_motion', v === 'reduce-motion', '开关先更新本页，再保存 reduceMotion；写入失败回读实际值。') +
      row('缓存清理', `<span class="settings-inline-action">${cacheLabel}</span>`, hint('调用 cache.clear，scope 为 cache；按钮原位显示清理中、已清理或清理失败，不打开结果页面。'), 'settings_gen_cache')) +
    `<button class="settings-danger category-row" data-action="open:restore-defaults"><span class="row-icon">${icon('settings_gen_refresh',15)}</span><span class="row-label">恢复默认</span>${chevron()}</button>` +
    (resetMessages[v] ? `<p class="settings-reset-message">${resetMessages[v]}</p>` : '') + `</div>`;
  if (v === 'reset-busy') content = `<fieldset class="settings-disabled" disabled>${content}</fieldset>`;
  return `<div class="app-page settings-general" ${v === 'reset-busy' ? 'aria-busy="true"' : ''}>${content}</div>`;
}

function sourceRow(item, index, v) {
  const check = index === 0 ? ({ checking: 'checking', 'check-passed': 'passed', 'check-failed': 'failed' }[v] ?? 'unchecked') : 'unchecked';
  const message = check === 'checking' ? '检测中' : check === 'passed' ? '搜索检测通过 · 120ms' : check === 'failed' ? '检测失败' : '';
  return `<div class="source-row"><div class="source-row-info"><div class="source-name-line"><strong>${esc(item.name)}</strong><small>${esc(item.type)}</small></div><div class="source-domain">${esc(item.domain)}</div>${message ? `<div class="source-row-message">${esc(message)}</div>` : ''}</div>` +
    (item.login ? `<button class="source-small-button source-login-button" data-action="go:source-login">登录</button>` : '') +
    `<button class="source-small-button" ${check === 'checking' ? 'disabled' : ''} data-action="${esc(hint('对该书源调用 source.check.run，默认搜索 L1、L2；同一源在途检测去重，结果更新原行。'))}">${check === 'checking' ? '检测中' : '检测'}</button>` +
    `<span class="source-status-badge ${check}" aria-label="${esc(check === 'passed' ? '检测通过' : check === 'failed' ? '检测失败' : check === 'checking' ? '检测中' : '未检测')}"><i></i></span>` +
    `<button class="app-toggle ${item.enabled ? 'on' : ''}" role="switch" aria-checked="${item.enabled}" data-action="${esc(hint('source.update 确认后才改变启停值；失败保持原值；停用后清理该源登录会话。'))}"><span></span></button></div>`;
}

function renderSources(ctx) {
  const v = variant(ctx);
  const noSources = ['empty', 'loading', 'load-error'].includes(v);
  const noMatches = v === 'filter-empty';
  const sourceItems = noSources || noMatches ? [] : fixtureSources;
  const messages = {
    loading: '正在读取 Core 书源数据…',
    'load-error': '书源列表读取失败：source.list returned invalid data',
    importing: '正在导入本地书源…',
    'import-success': '已导入 2 个书源',
    'import-warning': '已导入 1 个书源，失败 1 个书源',
    'import-error': '书源导入失败：source.import returned invalid or mismatched data',
  };
  const error = v === 'load-error' || v === 'import-error';
  const banner = messages[v] ? `<div class="source-status-banner ${error ? 'error' : ''}"><span>${esc(messages[v])}</span>${error ? `<button data-action="${esc(hint('原页面重试动作重新读取书源列表，不重发导入。'))}">重试</button>` : ''}</div>` : '';
  const counts = noSources ? '0 个书源 · 0 个启用' : noMatches ? '显示 0/2 个书源 · 1 个启用' : '2 个书源 · 1 个启用';
  const filters = `<div class="source-status-filters">${['全部','启用','异常','未检测','自定义'].map((text,i) => `<button class="source-chip ${i === 0 ? 'selected' : ''}" ${i === 4 ? 'disabled' : ''} data-action="${esc(hint('在当前已读书源列表中按启用、异常或未检测状态筛选；自定义没有业务定义，当前禁用。'))}">${text}</button>`).join('')}</div>`;
  const group = `<div class="source-group-filter">${icon('source_group_folder',15)}<strong>分组</strong><button class="source-group-select" data-action="${esc(hint('展开 ReaderSelectPanel；选项来自书源真实 group，选择后原位筛选。'))}">全部分组${icon('source_group_chevron',14)}</button></div>`;
  const types = ['全部类型','小说','漫画','音乐/有声','下载/文件','视频/外部媒体','其他/混合'];
  const categories = `<div class="source-categories">${types.map((text,i) => `<button class="${i === 0 ? 'selected' : ''}" data-action="${esc(hint('仅筛选当前源的类别；非文本源可以管理，当前不进入小说阅读管线。'))}">${esc(text)}</button>`).join('')}</div>`;
  const empty = noSources && v !== 'loading' ? `<div class="source-empty"><strong>暂无书源</strong><p>点击下方「＋ 新增书源」导入 Legado 书源 JSON</p></div>` : '';
  return `<div class="app-page sources-page">${topbar('书源管理', iconButton('bookshelf_more','书源工具','go:source-tools',20))}<div class="app-scroll sources-scroll"><div class="source-search">${icon('search_mag',13)}${field('搜索书源名称或域名', noMatches ? '未匹配的名称' : '')}</div><p class="source-counts">${counts}</p>${banner}<div class="source-filters">${filters}${group}</div>${categories}${empty}${sourceItems.map((item,i)=>sourceRow(item,i,v)).join('')}</div><div class="source-bottom-actions">${button('批量管理','go:source-tools')}<button class="app-btn primary" data-action="open:json-import">${icon('source_add',18)}<span>新增书源</span></button></div>${v === 'group-open' ? `<div class="source-group-popover"><button data-action="${esc(hint('选择全部分组，关闭面板并重建当前列表。'))}">全部分组${icon('source_group_chevron',12)}</button><button data-action="${esc(hint('选择示例数据中的分组，关闭面板并重建当前列表。'))}">示例分组</button></div>` : ''}</div>`;
}

function renderBatchProgress(v) {
  const stopping = v === 'check-stopping';
  const completed = v === 'check-complete';
  const stopped = v === 'check-stopped';
  const failed = v === 'check-error';
  const done = completed ? 2 : 1;
  const current = v === 'check-running' || stopping || completed || stopped ? 2 : 1;
  const phase = stopping ? '停止中' : completed ? '已完成' : stopped ? '已停止' : failed ? '已中断' : '检测中';
  const results = fixtureSources.slice(0,done).reverse().map(item => `<div class="source-result-row"><div><strong>${esc(item.name)}</strong><small>搜索 L1、L2 通过，120ms</small></div><strong>所选项通过</strong></div>`).join('');
  return card('检测进度 ' + `${done}/2（${done * 50}%）`, `<span class="source-check-phase">${phase}</span><div class="source-progress"><i style="width:${done * 50}%"></i></div><p>当前 ${current}/2：${esc(fixtureSources[current-1].name)}（检测所选能力）</p><div class="source-check-counters"><span>所选项通过 ${done}</span><span>所选项未通过 0</span><span>检测错误 0</span><span>剩余 ${2-done}</span></div><strong class="source-results-heading">实时结果（最新在前）</strong>${results}`, 'source-check-card');
}

function renderTools(ctx) {
  const v = variant(ctx);
  const check = v.startsWith('check-');
  const running = v === 'check-running' || v === 'check-stopping';
  const editor = v.startsWith('editor');
  const busy = v === 'loading' || running || v === 'editor-busy';
  const selected = v === 'selected' || check ? 2 : 0;
  const messages = {
    default: '已读取 Core 数据',
    loading: '正在读取 Core 书源工具数据…',
    'load-error': '书源工具数据读取失败：source.list returned invalid data',
    selected: '已选择 2 个书源',
    'check-running': `正在检测 2/2：${fixtureSources[1].name}`,
    'check-stopping': '正在停止检测：已完成 1/2…',
    'check-complete': '批量检测完成：所选项通过 2，未通过 0，检测错误 0',
    'check-stopped': '已停止检测：完成 1/2，所选项通过 1，未通过 0，检测错误 0',
    'check-error': '批量检测书源失败：source.check.run returned invalid result count',
    editor: '编辑原始 BookSource JSON',
    'editor-busy': '正在由 Core 校验并保存…',
    'editor-error': '书源保存失败：书源地址是主键；编辑器不允许隐式迁移 bookSourceUrl',
    'editor-readback-error': '书源已确认，刷新失败：source.list returned invalid data；草稿保留供核对',
    'export-cancelled': '已取消导出',
    'export-error': '书源导出失败：source.export returned invalid data',
    'debug-error': '书源调试失败：当前 Core 不支持分项书源检测，请使用配套 Native；不会将发现检测降级为搜索',
  };
  const status = `<div class="source-tool-status ${busy ? 'busy' : ''}">${esc(messages[v] ?? messages.default)}</div>`;
  const exportSection = card('书源导出', `<p>Core 生成 Legado 兼容 JSON；Host 只通过系统文件选择器写入。</p>${button('导出全部书源','open:source-export','primary',busy)}`, 'source-tool-solid');
  const stopButton = running ? toolButton(v === 'check-stopping' ? '停止中…' : '停止检测','停止逐源检测，保留已完成结果；只在原按钮显示停止中。',v === 'check-stopping') : toolButton('检测所选','按当前搜索/发现模式及检测深度执行所选源；结果原位更新。',busy || selected === 0);
  const batch = card(`批量管理（已选 ${selected}/2）`, `<div class="source-tool-actions">${toolButton('全选','选择当前工具列表中的全部书源。',busy)}${toolButton('清空','清空当前工具选择。',busy || !selected)}${button('导出所选','open:source-export','secondary',busy || !selected)}</div><div class="source-tool-actions">${stopButton}${toolButton('启用','逐源 source.update；部分失败显示已完成数量并回读持久状态。',busy || !selected)}${toolButton('停用','逐源 source.update，确认后清登录会话；部分失败回读持久状态。',busy || !selected)}${button('删除','open:source-delete','secondary',busy || !selected)}</div><p class="source-tool-technical">批量操作复用 source.export / source.check.run / source.update / source.delete；删除由系统确认框二次确认。</p>`, 'source-tool-solid');
  const rows = fixtureSources.map((item,i) => `<div class="source-tool-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.domain)}</small></div>${toolButton(selected ? '已选' : '选择','切换这一源的选择；在途操作不允许修改范围。',busy)}${toolButton('编辑','读取原始 BookSource JSON，打开本页编辑卡；不会进入一个新路由。',busy)}${toolButton('调试','按当前检测关键词、模式、深度调用 source.check.run，日志在本页展示。',busy)}</div>`).join('');
  const sourceList = card('书源编辑（2）', `<div class="source-tool-list">${rows}</div>`);
  const raw = JSON.stringify({ bookSourceUrl: fixtures.sources[0].domain, bookSourceName: fixtures.sources[0].name, enabled: true }, null, 2);
  const editorCard = editor ? card(`编辑：${fixtures.sources[0].domain}`, `<p>bookSourceUrl 是主键；本页不执行隐式迁移。保存时由 Core source.import 校验并持久化。</p><textarea class="source-editor-field">${esc(raw)}</textarea><div class="source-tool-actions">${toolButton('取消','关闭本页编辑卡并清草稿，忙碌时不能取消编辑。',busy)}${toolButton('校验并保存','校验 JSON 及主键，再 source.import；保存成功且回读成功才关闭编辑卡。',busy,true)}</div>${v === 'editor-readback-error' ? `<p>保存已由 Core 确认；下面的操作只重新读取书源列表，不会再次执行 source.import。</p>${toolButton('重新读取已保存书源','仅 source.list 读回确认；不重新提交 source.import。')}` : ''}`, 'source-tool-solid') : '';
  const debugActive = v === 'debug-error' || check;
  const debug = card(debugActive ? '最近一次检测详情' : '书源调试', `<div class="source-debug-options"><select aria-label="检测模式" ${busy ? 'disabled' : ''}><option>搜索</option><option>发现</option></select><select aria-label="检测深度" ${busy ? 'disabled' : ''}><option>列表</option><option>详情</option><option>目录</option><option>正文</option></select></div>${field('检测关键词（留空时使用 Core 默认“我的”）','我的','debugKey')}${debugActive ? `<p>检测对象：${esc(fixtures.sources[0].domain)}</p>` : ''}`);
  return `<div class="app-page source-tools-page">${topbar('批量管理与书源工具')}<div class="app-scroll source-tools-scroll">${status}${exportSection}${batch}${check ? renderBatchProgress(v) : ''}${sourceList}${editorCard}${debug}</div></div>`;
}

function systemDialog(title, body, actions) {
  return `<div class="app-dialog source-system-dialog"><div class="dialog-title">${esc(title)}</div><div class="dialog-body"><p>${esc(body)}</p></div><div class="dialog-actions">${actions}</div></div>`;
}

function jsonDialog(title, body, actions) {
  return `<div class="app-dialog source-json-dialog"><div class="dialog-title"><span>${esc(title)}</span><button class="source-json-close" data-action="close">关闭</button></div><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div></div>`;
}

export const screens = [
  { id:'settings', label:'设置首页', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',997),source('features/settings/SettingsPage.ets',134),source('features/shell/SettingsShell.ets',55)], note:'当前 L0 首页只有通用设置、书源管理、书架设置；发现、RSS、同步及未实现设置不准入。', variants:variants([['default','当前入口']]), render:renderSettings },
  { id:'general', label:'通用设置', group:'设置与书源', kind:'page', source:[source('features/settings/SettingsPage.ets',152),source('features/settings/SettingsPage.ets',309),source('features/settings/SettingsPage.ets',376),source('features/settings/SettingsPage.ets',504),source('features/settings/SettingsOrchestrator.ets',68)], note:'缓存与恢复结果保留在原行或原页面；开关保存失败回读。状态选项在画布外选择，不代表预览执行了真实清理或保存。', variants:variants([['default','默认值'],['theme-day','App 浅色选择'],['theme-night','App 深色选择'],['reduce-motion','减少动态效果开启'],['cache-busy','清理中：原行'],['cache-success','已清理：原行'],['cache-error','清理失败：原行'],['reset-busy','恢复时禁用原页'],['reset-success','恢复成功：原页'],['reset-error','恢复未完成：原页']]), render:renderGeneral },
  { id:'sources', label:'书源管理', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',1036),source('features/source/SourceManagementPage.ets',181),source('features/source/SourceManagementPage.ets',232),source('features/source/SourceManagementPage.ets',425),source('features/source/SourceOrchestrator.ets',84)], note:'书源名、域名、数量、检测耗时和分组使用显式示例数据。搜索/筛选原位投影；状态反馈用本页 statusBanner，非统一全局 error 组件。自定义筛选实际禁用。', variants:variants([['default','未检测列表'],['loading','原页读取中'],['load-error','读取失败与重试'],['empty','没有书源'],['filter-empty','筛选后无匹配'],['group-open','实际分组下拉'],['checking','单源检测中'],['check-passed','单源检测通过'],['check-failed','单源检测失败'],['importing','原页导入中'],['import-success','原页导入结果'],['import-warning','部分导入结果'],['import-error','原页导入失败']]), render:renderSources },
  { id:'source-tools', label:'批量管理与书源工具', group:'设置与书源', kind:'page', source:[source('pages/Index.ets',1051),source('features/source/SourceToolsPage.ets',200),source('features/source/SourceToolsPage.ets',253),source('features/source/SourceToolsPage.ets',529),source('features/source/SourceToolsOrchestrator.ets',466)], note:'导出、批量检测、编辑器、调试都在实际同一路由。当前代码确实渲染的技术文案保留；在途/结果只是原页外部样本，不新增提交或取消页面。', variants:variants([['default','已读取列表'],['loading','读取工具数据'],['load-error','读取失败'],['selected','已选范围'],['check-running','原页检测中'],['check-stopping','原按钮停止中'],['check-complete','原页检测完成'],['check-stopped','原页保留已完成结果'],['check-error','原页检测中断'],['editor','本页编辑卡'],['editor-busy','原页保存中'],['editor-error','原页保存失败'],['editor-readback-error','已保存但读回失败'],['export-cancelled','原页导出取消'],['export-error','原页导出失败'],['debug-error','原页调试失败']]), render:renderTools },
  { id:'source-login', label:'书源登录 / 验证', group:'设置与书源', kind:'page', source:[source('features/source/SourceOrchestrator.ets',170),source('app/ReaderRuntimeOwner.ts',354),source('app/ArkWebExecutionHost.ets',118)], note:'仅画已实现 ArkWeb Host 顶栏结构；Web 站点区域留空，未伪造网站截图。完成后仍需源检测；取消返回未检测状态。没有应用底栏。', variants:variants([['default','交互 Web 宿主']]), render:() => `<div class="app-page source-login-page"><div class="source-web-surface" aria-label="Web"></div><header class="source-login-bar"><button data-action="${esc(hint('取消当前 ArkWeb 交互任务；回到原源列表，标为未检测并记录登录 / 验证已取消。'))}">取消</button><strong>${esc(fixtures.source)} · 登录 / 验证</strong><button data-action="${esc(hint('完成当前 ArkWeb 交互；返回源列表后执行源检测，不能先宣称登录成功。'))}">完成</button></header></div>` },
  { id:'json-import', label:'导入书源', group:'设置与书源', kind:'overlay', background:'sources', dismissable:false, source:[source('pages/Index.ets',1240),source('features/common/JsonImportDialog.ets',46),source('features/common/JsonImportDialog.ets',152),source('features/common/ReaderSurfaceSpecs.ets',133)], note:'复用当前 JsonImportDialog / ReaderDialogSurface 的 json-import 规格。这里只校验链接是否为空；文件选择、下载、JSON 校验与写入属于实际 Host / Core 流程。', variants:variants([['default','本地与在线入口'],['empty-url','空在线链接']]), render:ctx => jsonDialog('导入书源', `<p>支持 Legado 书源 JSON；本地文件和在线链接共用 Core 导入校验。</p>${button('选择本地 JSON 文件',hint('关闭导入框后打开系统 JSON 文件选择器；选择完成才导入，取消不伪造完成结果。'),'primary')}<label class="source-import-label">在线链接</label>${field('https://example.com/data.json','','importUrl')}<small>GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。</small>${variant(ctx) === 'empty-url' ? '<small class="source-import-error">请输入在线 JSON 的 HTTP/HTTPS 地址</small>' : ''}`,button('从在线链接导入',hint('非空链接关闭此框后交给 Host 下载，再由 Core 导入校验；不在预览中宣称已导入。'),'primary')) },
  { id:'restore-defaults', label:'恢复界面与阅读设置', group:'设置与书源', kind:'overlay', background:'general', source:[source('features/settings/SettingsPage.ets',504),source('features/settings/LocalConfigurationReset.ts',66)], note:'真实调用系统 showAlertDialog；此处只画标题、正文和按钮结构，系统外观尺寸不作为自绘组件新规范。确认后的恢复留在原设置页面。', variants:variants([['default','系统确认框结构']]), render:() => systemDialog('恢复界面与阅读设置','恢复通用偏好、书架封面模式、默认日夜阅读主题、跟随系统、阅读排版与朗读偏好。保留书籍、书源、进度、书签、导入字体文件及同步和朗读服务凭据。',button('取消','close')+button('恢复默认',hint('调用 LocalConfigurationReset；原页禁用，在持久化完成前不显示成功；失败保留恢复记录。'),'danger')) },
  { id:'source-result', label:'书源导入结果', group:'设置与书源', kind:'overlay', background:'sources', source:[source('pages/Index.ets',1871),source('pages/Index.ets',1891),source('features/source/SourceOrchestrator.ets',300)], note:'结果是当前系统对话框，展示的数量使用示例。仅搜索来源且原关键词非空时有一次重新搜索动作；并非新增结果页面。', variants:variants([['default','普通导入完成'],['partial','部分导入完成'],['error','导入失败'],['from-search','带原关键词的搜索入口']]), render:ctx => { const v=variant(ctx); const title=v==='error'?'书源导入失败':'书源导入完成'; const message=v==='error'?'source.import returned invalid or mismatched data':v==='partial'?'Core 已导入 1 个书源，失败 1 个书源':'Core 已导入 2 个书源。'; return systemDialog(title,message,v==='from-search'?button('继续管理','close')+button(`用新书源搜索「${fixtures.query}」`,hint('返回搜索后读取最新启用源，用原关键词重新搜索一次；失败仍由实际搜索页面反馈。'),'primary'):button('知道了','close')); } },
  { id:'source-export', label:'书源导出确认', group:'设置与书源', kind:'overlay', background:'source-tools', source:[source('features/source/SourceToolsPage.ets',719),source('features/source/SourceToolsOrchestrator.ets',188)], note:'真实系统确认先于 Core 导出及文件保存。系统文件选择器取消后只更新工具页“已取消导出”，不加独立取消页面。', variants:variants([['default','系统确认框结构']]), render:() => systemDialog('导出文件含登录凭据','导出的书源 JSON 会原样保留 Cookie、Authorization 等登录凭据，请勿转发给不可信的对象或公开渠道。是否继续导出？',button('继续导出',hint('确认后由 Core 生成导出 JSON，再打开系统文件保存；收到保存结果才更新工具页。'),'primary')+button('取消','close')) },
  { id:'source-delete', label:'删除书源确认', group:'设置与书源', kind:'overlay', background:'source-tools', source:[source('pages/Index.ets',1919),source('features/source/SourceToolsOrchestrator.ets',404),source('features/source/SourceGateway.ts',442)], note:'所选数量使用示例；实际先系统确认，再 Core 删除、Host 会话清理、原工具页回读。不新增“删除已提交”页面。', variants:variants([['default','系统确认框结构']]), render:() => systemDialog('删除书源','确定删除所选 2 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。',button('取消','close')+button('删除',hint('source.delete 确认后清除 Host 会话并回读列表，结果保持在原工具页。'),'danger')) },
];
