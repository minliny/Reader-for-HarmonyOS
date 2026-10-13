// Generates evidence indexes and route diagrams from current specs/captures.
// This is a file-only operation: no native, browser or rendering commands.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNativeCaptureRegistry, hostRoot, confirmedDirections } from '../../../evidence/2026-10-06-native-ui-redo/registry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(here, name), 'utf8'));
const specs = { library: read('library-spec.json'), reading: read('reading-spec.json'), settings: read('settings-spec.json') };
if(existsSync(path.join(here,'reading-preferences-spec.json')))specs['reading-preferences']=read('reading-preferences-spec.json');
const registry = readNativeCaptureRegistry();
const captures = registry.captures;
const admitted = captures.filter(capture => capture.baselineAdmission);
const fence = String.fromCharCode(96).repeat(3);
const cell = value => String(value ?? '').replaceAll('|', '／').replace(/\r?\n/g, ' ');
const quote = value => String(value ?? '').replaceAll('"', '＂').replaceAll('<', '＜').replaceAll('>', '＞').replace(/\r?\n/g, ' ');
const link = (label, relative) => '[' + cell(label) + '](' + path.resolve(hostRoot, relative) + ')';
const specLink = domain => link(domain + '-spec.json', 'docs/ui-design/app-baseline/' + domain + '-spec.json');
const category = value => ['existing-app','confirmed-demo-unimplemented','unconfirmed-demo'].includes(value) ? value : null;

// These routes are code-side navigation candidates, not visual assertions.
// Real captures and recorded operations supply the solid edges separately.
const catalog = [
  ['bookshelf', '书架', 'library', '应用主入口', '阅读 / 搜索 / 书架更多 / 书籍操作', 'entry/src/main/ets/features/bookshelf/BookshelfPage.ets'],
  ['shelf-more', '书架更多', 'library', '书架右上更多', '批量管理 / 本地导入 / 检查更新 / 书架设置', 'entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets'],
  ['book-actions', '书籍操作', 'library', '长按书架书籍或列表更多', '多选 / 书籍信息 / 编辑分组 / 移除书架', 'entry/src/main/ets/features/common/ReaderSheetActionList.ets'],
  ['multiselect', '书架多选', 'library', '书架更多或书籍操作', '选择 / 全选 / 移除确认 / 返回书架', 'entry/src/main/ets/features/bookshelf/BookshelfMultiSelectPage.ets'],
  ['book-removal', '移除书架确认', 'library', '书籍操作或多选页', '取消回来源 / 实际移除结果待观察', 'entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets'],
  ['group-select', '书架分组', 'library', '书籍操作 → 编辑分组', '选择或新建分组 / 取消返回书架', 'entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets'],
  ['local-import', '本地导入', 'library', '书架更多 → 本地导入', '文件选择 / 原页结果；实际导入回执待观察', 'entry/src/main/ets/features/bookshelf/LocalImportDialog.ets'],
  ['search', '书籍搜索', 'library', '书架搜索入口', '原位查询与过滤 / 详情 / 管理书源', 'entry/src/main/ets/features/search/SearchPage.ets'],
  ['detail', '书籍详情', 'library', '书籍操作书籍信息或搜索结果', '阅读 / 独立完整目录 / 原位书架动作', 'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets'],
  ['directory', '详情独立目录', 'library', '书籍详情 → 完整目录', '选择章节进入对应阅读 / 漫画下载操作', 'entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets'],
  ['download-management', '漫画目录下载操作', 'library', '漫画独立目录的整书或章节操作', '原位下载范围 / 取消 / 任务结果待观察', 'entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets'],
  ['reader', '小说阅读', 'reading', '书架书籍或书籍详情阅读', '正文中心点击控制栏 / 实际章节切换待观察', 'entry/src/main/ets/features/reading/ReadingSurface.ets'],
  ['reader-controls', '小说阅读控制', 'reading', '小说正文中心点击', '目录 / 朗读 / 界面 / 设置 / 搜索 / 自动翻页 / 替换', 'entry/src/main/ets/features/reading/ReaderControlPanel.ets'],
  ['reader-replace', '替换规则', 'reading', '小说阅读控制 → 替换', '快捷 / 完整 / 未保存编辑器 / 当前章节预览 / 返回', 'entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets'],
  ['reader-directory', '小说章节目录', 'reading', '小说阅读控制 → 目录', '快捷 / 完整 / 搜索与定位 / 书签标签 / 选章结果待观察', 'entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets'],
  ['reader-bookmarks', '小说书签', 'reading', '小说快捷或完整目录 → 书签', '快捷 / 完整 / 原位查询；载入终态待观察', 'entry/src/main/ets/features/reading/ReaderBookmarkList.ets'],
  ['reader-search', '内容搜索', 'reading', '小说阅读控制 → 搜索', '快捷 / 完整 / 输入焦点避让 / 实际搜索结果', 'entry/src/main/ets/features/reading/ReaderControlSearchContent.ets'],
  ['reader-autopage', '自动翻页', 'reading', '小说阅读控制 → 自动翻页', '快捷 / 完整 / 速度与计时；运行及完成待观察', 'entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets'],
  ['reader-appearance', '阅读界面', 'reading', '小说阅读控制 → 界面', '快捷 / 完整 / 主题字体排版；应用后的正文待观察', 'entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets'],
  ['reader-settings', '小说阅读设置', 'reading', '小说阅读控制 → 设置', '快捷 / 完整 / 原位设置；操作效果待观察', 'entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets'],
  ['reader-tts', '小说朗读', 'reading', '小说阅读控制 → 朗读', '快捷 / 完整 / 配置；播放及终态待观察', 'entry/src/main/ets/features/reading/ReaderControlTtsContent.ets'],
  ['reader-more', '小说更多', 'reading', '小说顶部阅读条 → 更多', '当前3项锚定菜单 / 三项执行结果待观察 / 漫画菜单风格调整方向已确认', 'entry/src/main/ets/features/reading/ReadingSurface.ets'],
  ['manga-reader', '漫画阅读', 'reading', '书架或详情漫画阅读', '正文中心点击控制 / 换源 / 更多 / 目录 / 阅读方式 / 设置', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-directory', '漫画阅读目录', 'reading', '漫画阅读控制 → 目录', '实际漫画章节sheet / 选章结果待观察', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-mode', '漫画阅读方式', 'reading', '漫画阅读控制 → 阅读方式', '原位阅读模式选择；应用结果待观察', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-settings', '漫画阅读设置', 'reading', '漫画阅读控制 → 设置', '原位设置项及返回；实际效果待观察', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-more', '漫画更多', 'reading', '漫画顶部阅读条 → 更多', '实际7项可滚动菜单 / 动作执行结果待观察；旧错名截图不能证明展开', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-downloads', '漫画下载入口', 'reading', '漫画实际可达下载动作', '实际本书下载载入中及2个动作 / 操作与任务结果待观察', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['manga-end', '漫画章节结束', 'reading', '漫画阅读到实际章节末尾', '下一章 / 返回；结束画面待观察', 'entry/src/main/ets/features/manga/MangaReadingSurface.ets'],
  ['source-switch', '更换书源', 'reading', '阅读器顶部 → 换源', '重查 / 候选选择 / 关闭；小说34无可见行与漫画0明确空反馈分别记录', 'entry/src/main/ets/features/source/SourceSwitchWindow.ets'],
  ['settings', '设置', 'settings', '书架主底栏 → 设置', '通用设置 / 书源管理 / 书架设置', 'entry/src/main/ets/features/settings/SettingsPage.ets'],
  ['settings-general', '通用设置', 'settings', '设置首页 → 通用设置', '原位主题 / 自动更新 / 减少动态效果 / 缓存 / 恢复确认', 'entry/src/main/ets/features/settings/SettingsPage.ets'],
  ['settings-bookshelf', '书架设置', 'settings', '设置首页或书架更多 → 书架设置', '原位自动检查更新 / 封面列表；返回来源', 'entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets'],
  ['source-management', '书源管理', 'settings', '设置首页或搜索来源 → 书源管理', '原位搜索筛选 / 分组 / 检测启停 / 导入 / 工具', 'entry/src/main/ets/features/source/SourceManagementPage.ets'],
  ['source-import', '导入书源', 'settings', '书源管理 → 导入或新增', '原位URL校验 / 本地选择 / 实际结果；关闭回原页', 'entry/src/main/ets/features/common/JsonImportDialog.ets'],
  ['source-tools', '书源工具', 'settings', '书源管理 → 更多或批量管理', '原页选择与检测 / JSON编辑卡 / 调试卡 / 导出删除确认', 'entry/src/main/ets/features/source/SourceToolsPage.ets'],
];
const modules = new Map(catalog.map(([id, label, domain, entry, outputs, source]) => [id, { id, label, domain, entry, outputs, source }]));
for (const screen of specs.reading.modules || []) {
  const old = modules.get(screen.id) || { id:screen.id, domain:'reading' };
  modules.set(screen.id,{...old,label:screen.label||old.label||screen.id,spec:screen,
    classification:category(screen.classification||screen.category)});
}
for (const screen of specs.settings.screens || []) {
  const old = modules.get(screen.id) || { id: screen.id, domain: 'settings' };
  modules.set(screen.id, { ...old, label: screen.label || old.label, entry: screen.sourceEntry || old.entry,
    source: screen.classificationBasis?.path || old.source, spec: screen });
}
for (const screen of [...(specs.library.pending || []), ...(specs.library.observedPages || [])]) {
  const old = modules.get(screen.id) || { id: screen.id, domain: 'library' };
  modules.set(screen.id, { ...old, label: screen.label || old.label || screen.id, entry: screen.normalRoute || old.entry, spec: screen });
}
for(const screen of specs['reading-preferences']?.screens || []){const old=modules.get(screen.id)||{id:screen.id,domain:'reading'};modules.set(screen.id,{...old,spec:screen,specDomain:'reading-preferences'});}
for (const capture of admitted) {
  if (!modules.has(capture.review.screen)) modules.set(capture.review.screen, { id: capture.review.screen, label: capture.review.screen, domain: 'reading' });
}

function moduleCaptures(id) { return admitted.filter(capture => capture.review.screen === id); }
function moduleStatus(id) {
  if(moduleCaptures(id).length)return 'existing-app（仅已观察画面）';
  const classification=modules.get(id)?.classification;
  if(classification==='confirmed-demo-unimplemented')return 'confirmed-demo-unimplemented（方向已确认，具体视觉与原生实现未验收）';
  if(classification==='unconfirmed-demo')return 'unconfirmed-demo（未确认提案，不进入开发基准）';
  return '待取证（classificationStatus:pending，candidateCategory:existing-app）';
}
function capturedStates(id) { return [...new Set(moduleCaptures(id).map(capture => capture.allowedState))]; }
function observedEdges() {
  const result = [];
  let previous = null;
  for (const capture of captures.filter(capture => capture.id.startsWith('reader-control-redo-')).sort((a, b) => a.id.localeCompare(b.id))) {
    if (!capture.baselineAdmission) continue;
    const actionable = capture.operations.some(operation => ['click', 'drag', 'swipe', 'keyEvent', 'inputText', 'typeText'].includes(operation.op));
    if (previous && actionable && capture.allowedState !== previous.allowedState && capture.route) {
      result.push({ from: previous.allowedState, to: capture.allowedState, action: capture.route,
        captureIds: [previous.id, capture.id], kind: 'captured-operation-chain' });
    }
    previous = capture;
  }
  const mangaBody = registry.byId['reader-control-nui-001-entry'], mangaControls = registry.byId['reader-control-nui-002-manga-controls'];
  if (mangaBody?.baselineAdmission && mangaControls?.baselineAdmission) result.push({
    from: mangaBody.allowedState, to: mangaControls.allowedState, action: '轻点正文显示控制',
    captureIds: [mangaBody.id, mangaControls.id], kind: 'recorded-native-operation',
  });
  return result;
}
const observed = observedEdges();
function diagram(module) {
  const lines = ['flowchart LR'];
  const ids = new Map();
  let number = 0;
  const node = (key, label, kind) => {
    if (!ids.has(key)) {
      const id = 'N' + (++number); ids.set(key, id);
      lines.push('  ' + id + '["' + quote(label) + '"]:::' + kind);
    }
    return ids.get(key);
  };
  const main = node('module', module.label + '（模块索引）', 'module');
  if(['confirmed-demo-unimplemented','unconfirmed-demo'].includes(module.classification)) {
    for(const edge of module.spec?.routeGraph?.edges || []) {
      const targetDirection=edge.evidenceKind==='user-confirmed-direction';
      const from=node('proposal-'+edge.from,edge.from+'（参照来源或提案节点）','pending');
      const to=node('proposal-'+edge.to,edge.to+'（具体视觉/动作待确认）',targetDirection?'confirmed':'pending');
      lines.push('  '+from+' -.->|'+quote((targetDirection?'确认方向：':'demo提案：')+edge.label)+'| '+to);
    }
    node('proposal-boundary','此图为调整提案关系，不是当前应用可达路线','confirmed');
  } else {
    const entry = node('source-entry', '源码入口：' + (module.entry || '待核对'), 'pending');
    const output = node('source-output', '源码后续：' + (module.outputs || '待核对'), 'pending');
    lines.push('  ' + entry + ' -.->|' + quote('待正常入口实景') + '| ' + main);
    lines.push('  ' + main + ' -.->|' + quote('后续条件与返回待逐项取证') + '| ' + output);
  }
  for (const state of capturedStates(module.id)) {
    node(state, state + '：' + (admitted.find(capture => capture.allowedState === state)?.review.label || ''), 'observed');
  }
  for (const edge of observed.filter(edge => edge.from.split('/')[0] === module.id || edge.to.split('/')[0] === module.id)) {
    const from = node(edge.from, edge.from, 'observed'), to = node(edge.to, edge.to, 'observed');
    lines.push('  ' + from + ' -->|' + quote(edge.action) + '| ' + to);
  }
  for (const direction of confirmedDirections.filter(direction => (direction.modules.includes(module.id) || direction.modules.includes('*')) && !direction.excludedNativeComponents?.some(component=>component.screen===module.id))) {
    node('confirmed-' + direction.id, '已确认调整方向：' + direction.direction + '；具体视觉未确认', 'confirmed');
  }
  lines.push('  classDef observed fill:#eaf3ee,stroke:#42695a,color:#20362d');
  lines.push('  classDef pending fill:#f7f4ec,stroke:#9d9587,color:#554f43,stroke-dasharray:5 4');
  lines.push('  classDef confirmed fill:#eef1f8,stroke:#65759a,color:#334264');
  lines.push('  classDef module fill:#fff,stroke:#aaa,color:#444');
  return fence + 'mermaid\n' + lines.join('\n') + '\n' + fence;
}

function effectiveComponentCategory(item) {
  const declared = category(item.classification || item.category);
  if (item.classificationStatus === 'pending' || item.captureStatus === 'PENDING' || item.evidence?.nativeCaptured === false) return '待取证 / category:null';
  if (declared !== 'existing-app') return declared || '待核实 / category:null';
  const id = item.captureId || item.evidence?.captureId;
  const ids = item.captureIds || item.evidence?.captureIds || (id ? [id] : []);
  return ids.some(id => registry.byId[id]?.baselineAdmission) ? 'existing-app' : '待取证 / category:null';
}
function propertySummary(properties) {
  const entries=[];
  const walk=(value,keys)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach((item,index)=>walk(item,[...keys,item?.id||String(index)]));return;}
    if(Object.hasOwn(value,'classification') || Object.hasOwn(value,'category') || value.classificationStatus==='pending'){
      const label=value.classificationStatus==='pending'?'待取证/category:null':category(value.classification||value.category)||'待核实';
      entries.push(keys.join('.')+'='+label);
    }
    for(const [key,child] of Object.entries(value))if(child&&typeof child==='object')walk(child,[...keys,key]);
  };
  walk(properties,[]);return entries.join('；');
}
function controlRows() {
  const rows = [];
  for (const screen of [...(specs.settings.screens || []),...(specs['reading-preferences']?.screens || [])]) for (const control of screen.controls || []) {
    rows.push([screen.id, control.id, effectiveComponentCategory(control),
      '逐属性：' + propertySummary(control.visualProperties || {}),
      control.basis?.path || screen.classificationBasis?.path || '待实景']);
  }
  for (const component of specs.reading.componentEvidence || []) {
    const effective = effectiveComponentCategory(component);
    rows.push(['reading', component.component, effective, JSON.stringify(component.attributes || {}),
      component.captureId || '未绑定实景']);
  }
  for(const screen of specs.library.observedPages || [])for(const component of screen.components || []){
    rows.push([screen.id+'/'+screen.variant,component.id,effectiveComponentCategory(component),
      '逐属性：'+propertySummary(component.properties || []),component.evidence?.captureId||screen.evidence?.captureId||'待取证']);
  }
  for (const contract of specs.library.sourceCheckedContracts || []) {
    rows.push(['library', contract.id, effectiveComponentCategory(contract),
      '源码语义候选；nativeCaptured=' + (contract.evidence?.nativeCaptured === true), (contract.sources || []).join('；')]);
  }
  return rows;
}

const classification = [
  '# Reader 设计依据分类账', '',
  '本账用于区分当前应用实景、用户明确确认的调整方向与未确认设计。它不把源码路线、浏览器重绘或旧稿参数当成原生视觉证据。', '',
  '生成时间：' + registry.generatedAt + '。当前读取 ' + registry.captureCount + ' 张原生图；其中准入的实际画面按状态去重为 ' + registry.observedStateCount + ' 个。图片数量不等于独立页面数量。', '',
  '| 类别 | 准入依据 | 开发边界 |', '| --- | --- | --- |',
  '| existing-app | 已查看当前原生PNG，并绑定正常入口、布局或操作记录 | 只准入已观察范围；截图对照验收、安装产物绑定仍分别开放 |',
  '| confirmed-demo-unimplemented | 用户具体指令确认的调整方向 | 不继承未经确认的颜色、尺寸、字体、动效或整张旧稿 |',
  '| unconfirmed-demo | 新demo提案中没有具体用户确认的设计细节 | 保留为未确认提案，不进入跨平台开发基准 |', '',
  '三设计类别与证据成熟度分别记账。源码存在但尚未抓到原生画面的条目使用 classificationStatus:pending、candidateCategory:existing-app、category:null；它们是待取证的现有能力候选，不能反向推定未实现，也不能归为未确认demo提案。', '',
  '分类按属性范围判断：同一组件的真实结构/内容/业务值可为existing-app，替代方向为confirmed-demo-unimplemented，而自绘的新颜色、尺寸或动效为unconfirmed-demo。组件总类不会把其全部属性自动升级；系统替代的implementationInInstalledApp:OPEN只表示逐控件实现情况未全部核实。', '',
  '模块维度计数：existing-app '+[...modules.values()].filter(module=>moduleCaptures(module.id).length).length+' 个（'+registry.observedStateCount+' 个去重原生态）；确认方向提案 '+[...modules.values()].filter(module=>!moduleCaptures(module.id).length&&module.classification==='confirmed-demo-unimplemented').length+' 个独立模块、'+confirmedDirections.length+' 条确认方向；未确认独立模块 '+[...modules.values()].filter(module=>!moduleCaptures(module.id).length&&module.classification==='unconfirmed-demo').length+' 个；现有能力候选待取证 '+[...modules.values()].filter(module=>!moduleCaptures(module.id).length&&!['confirmed-demo-unimplemented','unconfirmed-demo'].includes(module.classification)).length+' 个。未确认具体属性另列下表，不因未确认独立模块为0而清零。', '',
  '## 已确认调整方向', '',
  '| 调整 | 用户确认原文 | 未获确认的具体内容 | 当前安装应用实现 / 范围 |', '| --- | --- | --- | --- |',
  ...confirmedDirections.map(direction => '| ' + cell(direction.direction) + ' | ' + cell(direction.confirmation.quote) + ' | ' + cell(direction.excludedConfirmation.join('、')) + ' | ' + cell(direction.implementationInInstalledApp+(direction.implementationScope?'；'+direction.implementationScope:'')) + ' |'),
  '', ...confirmedDirections.filter(direction=>direction.referenceEvidence).map(direction=>'参照实景：'+direction.referenceEvidence.captureIds.map(id=>link(id,registry.byId[id].png)).join('、')+'；'+cell(direction.referenceEvidence.scope)+'。'),
  '', ...confirmedDirections.flatMap(direction=>(direction.excludedNativeComponents||[]).map(component=>'方向范围例外：'+link(component.captureId,registry.byId[component.captureId].png)+'；'+cell(component.basis)+'。')),
  '', '系统控件自定义是实现方向确认；共享组件当前每个颜色、尺寸、间距和动画仍须逐属性找实景或用户确认依据。', '',
  '## 模块索引', '',
  '| 模块 | 当前归属 | 已观察状态 | 规范来源 |', '| --- | --- | --- | --- |',
  ...[...modules.values()].map(module => '| ' + cell(module.label + ' (' + module.id + ')') + ' | ' + moduleStatus(module.id) + ' | ' + cell(capturedStates(module.id).join('；') || '未捕获') + ' | ' + specLink(module.specDomain || module.domain) + ' |'),
  '', '## 原生图片逐张记录', '',
  '所有条目的 manifestBinding 与 installedSourceBinding 均为 OPEN。安装HAP读取权限拒绝，未改变权限；包名/版本/截图哈希不能补足产物与源码绑定。', '',
  '| 原生Capture | 实际画面 / 状态 | 准入范围 | 目标 / 安装版本 | 图片SHA-256 |', '| --- | --- | --- | --- | --- |',
  ...captures.map(capture => '| ' + link(capture.id, capture.png) + ' | ' + cell(capture.review.label) + ' | ' + cell(capture.baselineAdmission ? (capture.review.frameKind === 'observed-loading' ? '仅实际载入中画面；无终态' : capture.allowedState) : '不准入稳定端点') + ' | ' + cell((capture.target || '未绑定') + ' / ' + (capture.installedMetadata?.bundle || '未绑定') + ' ' + (capture.installedMetadata?.versionName || '') + ' (' + (capture.installedMetadata?.versionCode || '') + ')') + ' | ' + capture.sha256 + ' |'),
  '', '逐张目标、元数据来源、布局SHA、操作、完整性日志与限制见 ' + link('registry.mjs', 'evidence/2026-10-06-native-ui-redo/registry.mjs') + ' 的 readNativeCaptureRegistry()。早期图没有逐图preflight，明确标为同会话既有preflight支持，不声称已有完整产物绑定。', '',
  '## 控件与属性归属索引', '',
  '下表按当前规范生成。源码-only条目即使曾声明 existing-app，也保留为分类待取证（category:null）；具体属性文本注明未核验的部分继续待确认，不能随组件整体升为已确认。', '',
  '| 模块 | 控件 / 语义契约 | 有效归属 | 属性边界 | 依据 |', '| --- | --- | --- | --- | --- |',
  ...controlRows().map(row => '| ' + row.map(cell).join(' | ') + ' |'),
  '', '## 尚未关闭的验证', '',
  '- 当前安装HAP与源码/manifest完整绑定。', '- demo同状态、同尺寸截图叠加对照。',
  '- 页面返回、输入草稿、滚动位置与业务操作结果逐项实测。', '- 夜间、横屏、iOS/Android适配细节与原生运行验收。',
  '- 持续书签载入中的最终结果；当前不能认定空列表、完成或原生缺陷。',
  '- 尚未采集或审看的模块、控件与业务操作结果；详见每个模块的取证缺口。', '',
];
writeFileSync(path.join(here, 'CLASSIFICATION.md'), classification.join('\n') + '\n');

const logic = [
  '# Reader 模块逻辑与路线', '',
  '本稿由当前模块规范和原生证据分类账生成。实线只表示已抓到起点、实际操作与落点的动作链；虚线表示当前源码候选路线仍需正常入口取证。确认调整方向独立列出，不混入当前应用路线。', '',
  '实景证明某个画面出现，不自动证明全部回调、后台结果或跨平台实现完成。图中模块索引节点用于组织路线，不代表额外应用页面。', '',
  '读取原生图 ' + registry.captureCount + ' 张；已准入状态 ' + registry.observedStateCount + ' 个；模块索引 ' + modules.size + ' 个。manifestBinding OPEN；原生视觉对照与iOS/Android验收 OPEN。', '',
  '## 路线图图例', '',
  fence + 'mermaid', 'flowchart LR',
  '  A["已抓起点"] -->|"实际操作链"| B["已抓实际落点"]',
  '  C["源码正常入口"] -.->|"待实景核验"| D["候选后续路线"]',
  '  E["用户已确认调整方向；具体视觉待确认"]', fence, '',
];
for (const module of modules.values()) {
  const refs = moduleCaptures(module.id);
  logic.push('## ' + module.label + ' · ' + module.id, '',
    '归属：' + moduleStatus(module.id) + '。规范：' + specLink(module.specDomain || module.domain) + '。',
    module.source ? '源码候选：' + link(module.source, module.source) + (existsSync(path.resolve(hostRoot, module.source)) ? '。' : '（路径待复核）。') : '源码路线待补。',
    '', diagram(module), '',
    refs.length ? '实际画面：' + refs.map(capture => link(capture.id, capture.png) + '（' + cell(capture.review.label) + '）').join('；') + '。' :
      ['confirmed-demo-unimplemented','unconfirmed-demo'].includes(module.classification) ? '提案边界：此模块没有当前应用实景；方向确认不等于具体视觉与交互验收。' : '缺口：本模块尚无当前应用正常入口实景，不绘制可见状态页。',
    '',
  );
  const limits = [...new Set(refs.flatMap(capture => capture.review.cannotProve || []))];
  if (limits.length) logic.push('仍未证明：' + limits.join('；') + '。', '');
  if(module.id==='reader-tts'){
    const issue=specs.reading.issues?.find(item=>item.id==='tts-full-detail-scroll-clipped');
    if(issue?.candidateRootCause){const candidate=issue.candidateRootCause;
      logic.push('源码候选定位（'+cell(issue.id)+'，对应总账'+cell(issue.ledgerIssueId)+'）：当前源码detail高度'+candidate.frameDetailHeightVp+'vp、contentHeight'+candidate.frameContentHeightVp+'vp；子内容'+candidate.authoredChildren.totalDetailVp+'vp，超出content extent约'+candidate.overflowPastContentVp+'vp（相对detail actor多'+candidate.actorHeightDifferenceVp+'vp）。081/082实际maxScroll约'+Number(issue.nativeObservation.maximumScrollOffsetVp).toFixed(3)+'vp。纯函数本地验证仅支持源码候选；installed/source绑定'+candidate.installedSourceBinding+'，不宣称原生根因闭合，完整最低配置继续未观察。详见'+specLink('reading')+'的问题字段与'+link('总账问题','evidence/2026-10-06-native-ui-redo/issues.json')+'。','');
    }
  }
}
logic.push('## 跨模块边界', '',
  '- 详情独立目录与阅读器快捷/完整目录分别记账；小说与漫画不凭同名组件互相补证。', 
  '- 漫画详情换源076为0来源明确空反馈，关闭077实际回漫画详情072；漫画详情Back078实际回最近阅读漫画的书架列表。返回关系按这条原生链记录。',
  '- 新增替换规则上部和下部是同一未保存编辑器的滚动视图，不是两页；取消后才查看已保存规则预览。',
  '- 替换规则080为真正Quick预览：区域内滚动，亮度和快捷导航保留，预览标题与管理标题可见重叠。重叠根因和修复设计仍未决。',
  '- 完整书签013与014是相同载入中状态的两次观察，015为快捷载入中；无空列表终态。',
  '- 内容搜索键盘捕获只准入应用避让几何，操作系统键盘/状态栏/导航条不纳入应用画布。',
  '- 书源工具046顶端、047编辑状态、048/049下部编辑与调试为同一外层Scroll；内部书源List限高420。JSON编辑不是独立页面，保存/调试结果尚未观察。',
  '- 043/046布局树仍前一页、066/074主布局树已经是后续态；按PNG实际画面准入，不由树替代像素。',
  '- 系统确认映射自定义Dialog时保留实测正文与动作；无实测内容不得生成提交成功、取消中等额外页面。', '',
  '## 未采集与未确认清单', '',
  ...[...modules.values()].filter(module => !moduleCaptures(module.id).length).map(module => '- ' + module.label + ' (' + module.id + ')：' +
    (['confirmed-demo-unimplemented','unconfirmed-demo'].includes(module.classification) ? '调整提案的具体视觉、交互与原生实现待验收。' : '正常入口和后续可见状态待取证。')),
  ...[...new Set(specs.reading.notYetObserved || [])].map(gap => '- 阅读规范保留缺口：' + cell(gap) + '。'),
  ...((specs.settings.productGatedSourceSurfaces || []).map(item => '- 源码产品门控：' + item.name + '；当前安装构建入口仍需实际确认。')),
  '', '如模块规范的缺口说明落后于新捕获，须更新规范后重新运行生成器；新PNG未经审看保持UNREVIEWED，不自动关闭缺口。',
);
writeFileSync(path.join(here, 'LOGIC.md'), logic.join('\n') + '\n');
console.log(JSON.stringify({ modules: modules.size, captures: registry.captureCount, observedStates: registry.observedStateCount,
  observedOperationChains: observed.length, manifestBinding: 'OPEN', visualAcceptance: 'OPEN',
  outputs: ['CLASSIFICATION.md', 'LOGIC.md'] }));
