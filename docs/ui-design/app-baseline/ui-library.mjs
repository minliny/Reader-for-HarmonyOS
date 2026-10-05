import { esc, icon, button, iconButton, topbar, tabs, toggle, fixtures as f } from './shared.mjs';

const group = '书架与搜索';
const src = (name, line) => ({ path: `entry/src/main/ets/${name}`, line });
const variants = (...items) => items.map(([id, label]) => ({ id, label }));
const hint = text => `hint:${text}`;
const noteAction = (label, text, kind = 'secondary', disabled = false) => button(label, hint(text), kind, disabled);
const b = [{ title: f.title, author: f.author, source: f.source, local: false, progress: 24, unread: 2 },
  { title: f.title, author: f.author, local: true, progress: 0, unread: 0 },
  { title: f.title, author: f.author, source: f.sources[1].name, local: false, progress: 62, unread: 0 }];

function noCover(width = 96.656, height = 145.443) {
  return `<div class="lib-no-cover" style="--cover-w:${width}px;--cover-h:${height}px" aria-label="暂无封面"><i></i><span>暂无封面</span><i></i></div>`;
}
function spinner(size = 24) { return `<span class="lib-spinner" style="width:${size}px;height:${size}px" aria-label="正在加载"></span>`; }
function chip(label, selected, text, disabled = false) {
  return `<button class="lib-chip ${selected ? 'selected' : ''}" data-action="${esc(hint(text))}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
}
function shelfHeader(activeFilter = false, list = false, disabled = false) {
  const action = (asset, label, act) => disabled ? `<span class="lib-disabled-icon">${icon(asset, 20)}</span>` : iconButton(asset, label, act, 20);
  return `<div class="lib-shelf-heading"><strong>我的书架</strong><div>${action(list ? 'bookshelf_grid_outline' : 'bookshelf_grid', '封面显示', hint('切换封面显示；保存失败回到已确认显示方式。'))}${action(list ? 'bookshelf_list_active' : 'bookshelf_list', '列表显示', hint('切换列表显示；保存失败原位重试。'))}${action(activeFilter ? 'bookshelf_filter_active' : 'bookshelf_filter', '筛选书架', 'go:shelf-filter')}</div></div>`;
}
function shelfTop() {
  return topbar('书架', iconButton('bookshelf_search', '搜索', 'go:search', 24) + iconButton('bookshelf_more', '更多', 'open:shelf-more', 44), false);
}
function continueCard() {
  return `<button class="lib-continue" data-action="go:reader">${noCover(62, 93)}<div><small>继续阅读</small><h2>${esc(f.title)}</h2><p>${esc(f.author)}</p></div><span class="lib-read-pill">阅读</span></button>`;
}
function shelfRail() {
  return `<nav class="lib-shelf-rail"><button class="active" aria-current="page">${icon('bookshelf_library', 24)}<span>书架</span></button><button data-action="go:settings">${icon('bookshelf_settings', 24)}<span>设置</span></button></nav>`;
}
function shelfListDetails(book) {
  return `<div class="lib-list-details"><h3>${esc(book.title)}</h3><p>${esc(book.author)}</p><small>${esc(f.chapter)}</small><div class="lib-status-pills"><span style="--read-progress:${book.progress}%">${book.progress > 0 ? `已读 ${book.progress}%` : '未读'}</span><span>${book.local ? '本地 TXT' : esc(book.source)}</span></div></div>`;
}
function bookGrid(selection = false, selected = false, firstSelected = true, disabled = false, books = b, wide = false) {
  return `<div class="lib-book-grid ${selection ? 'selection' : ''}">${books.map((book, i) => `<button class="lib-grid-book" ${disabled ? 'disabled' : ''} data-action="${selection ? esc(hint('切换这本书的多选状态；只选择当前完整书架中仍存在的身份。')) : 'go:reader'}"><div class="lib-cover-slot">${wide ? noCover(186.672, 280) : noCover()}${selection ? `<span class="lib-selection-badge ${selected || (firstSelected && i === 0) ? 'selected' : ''}">${selected || (firstSelected && i === 0) ? '✓' : ''}</span>` : book.unread ? `<span class="lib-update-pill">更新 ${book.unread} 章</span>` : ''}</div><h3>${esc(book.title)}</h3><p>${esc(book.author)}</p>${book.progress && !selection ? `<small>已读 ${book.progress}%</small>` : ''}</button>`).join('')}</div>`;
}
function bookList(selection = false, wide = false) {
  return `<div class="lib-book-list">${b.map((book, i) => `<div class="lib-list-book"><button class="lib-list-entry" data-action="${selection ? esc(hint('切换这本书的多选状态。')) : 'go:reader'}">${selection ? `<div class="lib-select-list-cover">${noCover(48, 80)}<span class="lib-selection-badge ${i === 0 ? 'selected' : ''}">${i === 0 ? '✓' : ''}</span></div>` : wide ? noCover(64, 104) : noCover(48, 80)}${shelfListDetails(book)}</button>${selection ? '' : iconButton('bookshelf_more', `${book.title}更多操作`, 'open:book-actions', 44)}</div>`).join('')}</div>`;
}
function filterContent(active = false) {
  return `<section class="lib-filter"><div><span>筛选</span>${noteAction('清除', '清除阅读状态和书籍类型筛选。', 'text', !active)}</div><p>阅读状态</p><div class="lib-chip-row">${['全部', '未读', '在读', '已读'].map((x, i) => chip(x, active ? i === 2 : i === 0, `按阅读状态“${x}”筛选当前书架。`)).join('')}</div><p>书籍类型</p><div class="lib-chip-row">${['全部', '本地', '在线'].map((x, i) => chip(x, active ? i === 2 : i === 0, `按书籍类型“${x}”筛选当前书架。`)).join('')}</div></section>`;
}
function emptyShelf() {
  return `<div class="lib-empty-card"><div class="lib-empty-illustration"><i></i><i></i><span>${icon('bookshelf_empty_library', 32)}</span></div><h2>书架还是空的</h2><p>导入本地书籍或通过搜索加入书架。</p>${button('导入本地书籍', 'open:local-import', 'primary')}${button('搜索并加入书架', 'go:search')}</div>`;
}
function shelfPage(v = 'cover', filter = false, size = 'phone') {
  const populated = !['empty', 'loading', 'error'].includes(v);
  const wide = populated && size === 'wide';
  let content;
  if (v === 'loading' || v === 'error') content = `<div class="status-content lib-shelf-state">${v === 'loading' ? `${spinner()}<p>正在加载书架…</p>` : `<h2>书架加载失败</h2><p>无法读取书架内容，请重试。</p>${noteAction('重试', '重新读取 Core 书架；旧加载回调不能覆盖新一轮结果。', 'primary')}`}</div>`;
  else if (v === 'empty') content = shelfHeader(false, false, true) + emptyShelf();
  else content = continueCard() + shelfHeader(filter || v === 'no-match', v === 'list') + (filter ? filterContent(v === 'active') : '') + (v === 'no-match' ? `<div class="lib-no-match"><p>没有符合条件的书籍</p>${noteAction('清除全部条件', '清除两类筛选条件并重读书架。', 'text')}</div>` : v === 'list' ? bookList(false, wide) : bookGrid(false, false, true, false, filter && v === 'active' ? b.filter(book => !book.local) : b, wide));
  return `<div class="app-page lib-shelf-page ${populated ? 'populated' : ''}">${shelfTop()}<div class="app-scroll lib-shelf-scroll">${content}</div>${wide ? shelfRail() : tabs('bookshelf')}</div>`;
}

function searchBar(sweeping, draft = false) {
  return `<header class="lib-search-bar">${iconButton('search_back', '返回书架', 'go:bookshelf', 20)}<div class="lib-search-field">${icon('search_mag', 14)}<input placeholder="搜索书名、作者..." aria-label="搜索书名或作者" value="${draft ? '' : esc(f.query)}">${draft ? '' : `<button aria-label="清空搜索内容" data-action="${esc(hint('清除输入框草稿；不伪造已经执行的新搜索。'))}">${icon('search_clear', 14)}</button>`}</div><button class="lib-search-pill" data-action="${esc(hint(sweeping ? '停止当前搜索；已返回的结果保留，不再派发新书源请求。' : '提交当前关键词；本地和已启用在线书源并行检索。'))}">${sweeping ? spinner(13) : ''}${sweeping ? '停止' : '搜索'}</button></header>`;
}
function history(status = 'ready') {
  const failed = status === 'load-failed' || status === 'clear-failed';
  const retained = status !== 'load-failed';
  return `<section class="lib-history">${failed ? `<p>${status === 'clear-failed' ? '搜索历史清空失败' : '搜索历史读取失败'}</p>${noteAction(status === 'clear-failed' ? '重试清空' : '重试读取', status === 'clear-failed' ? '只重试清空历史；保留未确认清除的原历史。' : '只重试历史读取，不重置书源与当前查询。', 'text')}` : ''}${retained ? `<div class="lib-history-heading"><strong>最近搜索</strong>${noteAction('清空记录', '请求清空 Core 搜索历史，失败仍保留原历史并原位提示。', 'text')}</div><div class="lib-chip-row">${chip(f.query, false, '将此历史关键词提交为新的搜索。')}</div>` : ''}</section>`;
}
function searchCategories() { return `<div class="lib-search-categories">${['全部', '本地', '在线'].map((x, i) => chip(x, i === 0, `筛选已返回的${x}结果；不改变本次检索书源范围。`)).join('')}</div>`; }
function resultCard(local = false) {
  return `<button class="lib-search-result" data-action="go:detail"><div class="lib-search-cover"><span>${esc(f.title)}</span></div><div class="lib-search-metadata"><h3>${esc(f.title)}</h3><p>${esc(f.author)}</p>${local ? '' : `<small>${esc(f.chapter)}</small>`}<div class="lib-result-tags"><span>${local ? '本地导入' : esc(f.source)}</span><span>${local ? '本地书籍' : '已发现 2 个书源'}</span>${local ? '<span>已在书架</span>' : ''}</div></div></button>`;
}
function searchEmpty(stopped = false) {
  return `<div class="lib-search-empty">${icon('search_empty', 128)}<h2>没有找到相关书籍</h2><p>${stopped ? '已停止搜索' : '已搜索 2 个书源'}，未找到「${esc(f.query)}」的相关结果</p><section class="lib-search-suggestions"><strong>搜索建议</strong><p>· 检查书名拼写是否正确</p><p>· 尝试更短的关键词或作者名</p><p>· 前往书源管理添加或启用更多书源</p></section><div class="lib-actions">${button('添加更多书源', 'go:sources', 'primary')}${noteAction('重新搜索', '重试失败或未完成分支；全部成功但无结果时重新搜索。')}</div></div>`;
}
function searchUnavailable(allDisabled = false, loadFailed = false) {
  return `<section class="lib-search-unavailable">${icon(loadFailed ? 'search_error' : 'search_empty', loadFailed ? 80 : 128)}<h2>${loadFailed ? '书源列表加载失败' : allDisabled ? '没有可搜索书籍的书源' : '还没有可用书源'}</h2><p>${loadFailed ? '在线书源暂不可用；本地导入的书仍可在上方搜索' : allDisabled ? '启用可搜索书籍的书源；本地导入的书仍可在上方搜索' : '添加书源后可搜索在线书籍；本地导入的书仍可在上方搜索'}</p><div class="lib-actions">${loadFailed ? noteAction('重试加载', '只重新加载在线书源列表，本地检索仍可使用。', 'primary') : button(allDisabled ? '管理书源' : '添加书源', 'go:sources', 'primary')}${button('返回书架', 'go:bookshelf')}</div></section>`;
}
function searchPage(v, size = 'phone') {
  const sweeping = v === 'loading' || v === 'searching';
  const results = ['results', 'searching', 'partial-error'].includes(v);
  let content = '';
  if (v === 'initial' || v === 'history-error' || v === 'history-clear-error') content = history(v === 'history-error' ? 'load-failed' : v === 'history-clear-error' ? 'clear-failed' : 'ready');
  else if (v === 'loading') content = `<div class="lib-search-loading">${spinner(36)}<p>正在搜索本地与在线书籍…</p></div>`;
  else if (results) content = `<div class="lib-result-summary">找到 <strong>2</strong> 本相关书籍${v === 'searching' ? '<small> · 正在搜索 1/2 个书源，已返回 2 个</small>' : ''}${v === 'partial-error' ? `<button data-action="${esc(hint('补偿重试失败分支，保留成功结果。'))}">书源列表：读取未完成，请重试</button>` : ''}</div>${resultCard(true)}${resultCard(false)}${v === 'searching' ? `<div class="lib-stream-spinner">${spinner(36)}</div>` : ''}`;
  else if (v === 'empty' || v === 'stopped') content = searchEmpty(v === 'stopped');
  else if (v === 'error') content = `<div class="lib-search-failure">${icon('search_error', 80)}<h2>书源搜索失败</h2><p>2 个书源请求失败，可重试或检查书源状态</p>${noteAction('重新搜索', '重试失败书源，保留已经成功的分支。', 'primary')}${button('检查书源', 'go:sources', 'text')}</div>`;
  else content = searchUnavailable(v === 'all-disabled', v === 'source-error') + history();
  return `<div class="app-page lib-search-page ${size === 'wide' ? 'lib-tablet-search' : ''}">${searchBar(sweeping, ['initial', 'no-source', 'history-error', 'history-clear-error', 'all-disabled', 'source-error'].includes(v))}${results || v === 'empty' || v === 'stopped' ? searchCategories() : ''}<div class="app-scroll lib-search-scroll ${results || v === 'empty' || v === 'stopped' ? 'has-categories' : ''}">${content}</div></div>`;
}
function detailPage(v) {
  const local = v === 'local';
  const preview = ['preview', 'catalog-loading', 'adding', 'cancelling', 'add-error'].includes(v);
  const adding = v === 'adding', cancelling = v === 'cancelling';
  const shelfLabel = cancelling ? '正在取消…' : adding ? '取消加入' : preview ? '加入书架' : '移除书架';
  const chapters = v === 'catalog-loading' ? `<p class="lib-detail-empty">正在获取在线目录…</p>` : f.chapters.map(x => `<button class="lib-detail-chapter" data-action="go:reader">${esc(x)}</button>`).join('');
  return `<div class="app-page lib-detail-page"><header class="app-topbar subpage">${iconButton('book_detail_back', '返回', 'back', 24)}<h1>书籍详情</h1></header><div class="app-scroll lib-detail-scroll"><section class="lib-detail-hero">${noCover(86, 122)}<div><h2>${esc(f.title)}</h2><p>作者：${esc(f.author)}</p><small>最新：${esc(f.chapter)}</small><div class="lib-source-line"><strong>书源：${local ? '本地书籍' : esc(f.source)}</strong><button ${local ? 'disabled' : 'data-action="open:source-switch"'}>更换书源</button></div><small>分组：默认</small></div></section><section class="lib-detail-summary"><h3>简介</h3><p>暂无简介</p></section><section class="lib-detail-directory"><header><h3>章节信息</h3><button data-action="go:directory">${icon('book_detail_directory', 20)}完整目录</button></header>${chapters}</section>${v === 'add-error' ? '<p class="lib-detail-error">加入书架未完成：连接失败</p>' : ''}</div><footer class="lib-detail-actions">${button(preview ? '开始阅读' : '继续阅读', 'go:reader', 'primary')}${cancelling ? button(shelfLabel, '', 'secondary', true) : adding ? noteAction(shelfLabel, '取消加入；读回 Core 核对竞态结果，不删除已提交书籍。') : preview ? noteAction(shelfLabel, '请求加入书架；Core 确认首个可读入口持久化后才更新归属。') : button(shelfLabel, 'open:book-removal', 'danger')}</footer></div>`;
}
function multiselectPage(v, size = 'phone') {
  const loading = v === 'loading', busy = v === 'removing', count = v === 'none' || loading ? 0 : v === 'all' ? 3 : 1;
  return `<div class="app-page lib-multiselect-page"><header class="lib-multiselect-top"><button data-action="go:bookshelf" ${loading || busy ? 'disabled' : ''}>取消</button><h1>已选择 ${count} 本</h1><button data-action="${esc(hint('选择当前列表中全部可见书籍；已全选时清空选择。'))}" ${loading || busy ? 'disabled' : ''}>${v === 'all' ? '取消全选' : '全选'}</button></header><div class="app-scroll lib-multiselect-scroll">${v === 'list' ? bookList(true) : bookGrid(true, v === 'all', count > 0, loading || busy, b, size === 'wide')}</div><footer class="lib-remove-bar"><button data-action="open:book-removal" ${count === 0 || loading || busy ? 'disabled' : ''}>${icon('bookshelf_multiselect_trash', 22)}<span>${loading ? '正在读取书架' : busy ? '正在移除' : '移除书架'}</span></button></footer></div>`;
}
function bookshelfSettings(v) {
  return `<div class="app-page lib-bookshelf-settings">${topbar('书架设置')}<div class="app-scroll"><section class="lib-settings-card"><div><span>自动检查更新</span>${toggle(true, hint('保存自动检查更新偏好；应用当前只在书架前台且未阅读时自动检查在线章节。'))}</div><p>自动检查书架中书籍的最新章节</p><div><span>显示方式</span>${chip('封面', v !== 'list', '持久化封面显示方式；失败回读已确认值。')}${chip('列表', v === 'list', '持久化列表显示方式；失败回读已确认值。')}</div>${v === 'save-error' ? `<button class="lib-settings-error" data-action="${esc(hint('重试保存上次请求的显示方式。'))}">显示方式保存失败，点击重试</button>` : ''}</section></div></div>`;
}
function simpleDialog(title, body, actions, cls = '') {
  return `<section class="app-dialog ${cls}"><header class="dialog-title">${esc(title)}</header><div class="dialog-body">${body}</div>${actions ? `<footer class="dialog-actions">${actions}</footer>` : ''}</section>`;
}
function shelfMore(v) {
  const updating = v === 'updating' || v === 'background';
  const items = [
    ['bookshelf_more_batch', '批量管理', 'go:multiselect'],
    ['bookshelf_more_import', '本地导入', 'open:local-import'],
    ['settings_gen_refresh', v === 'updating' ? '检查中 1/2' : v === 'background' ? '正在自动检查' : '检查更新', hint('按当前完整书架检查在线书籍目录；在原菜单项显示进度，更新后重新投影书架。')],
    ['bookshelf_more_settings', '书架设置', 'go:bookshelf-settings'],
  ];
  return `<div class="lib-shelf-more">${items.map(([asset, label, action], i) => `<button data-action="${esc(action)}" ${i === 2 && (updating || v === 'no-online') ? 'disabled' : ''}>${icon(asset, 24)}<span>${esc(label)}</span></button>`).join('')}</div>`;
}
function bookActions() {
  return `<section class="lib-book-actions"><div class="lib-handle"></div><h2>书籍操作</h2>${[['多选', 'go:multiselect'], ['书籍信息', 'go:detail'], ['编辑分组', 'open:group-select'], ['移除书架', 'open:book-removal']].map(([label, action], i) => button(label, action, i === 3 ? 'danger' : 'secondary')).join('')}</section>`;
}
function groupSelect(v) {
  return simpleDialog('编辑分组', `<div class="lib-group-select"><div><span>分组</span>${button('清除', '', 'text', true)}</div>${chip('默认', true, '将当前书籍分组保存为空值；成功关闭弹窗并刷新书架，失败保留弹窗且toast提示重试。', v === 'busy')}</div>`, '', 'lib-group-dialog');
}
function importSelection(v) {
  const picking = v === 'picker';
  return simpleDialog('导入本地书籍', `<button class="lib-import-select" data-action="${esc(hint('打开系统文件选择器；支持多选真实准入格式，取消选择回到当前弹窗。'))}" ${picking ? 'disabled' : ''}><span>${icon('import_select_system', 20)}</span><strong>从系统文件中选择</strong><small>支持多选 TXT、EPUB、MOBI、AZW3</small><div class="lib-format-tags">${['TXT', 'EPUB', 'MOBI', 'AZW3'].map(x => `<i>${x}</i>`).join('')}</div></button><p class="lib-import-note">${icon('import_info', 13)}<span>支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。</span></p>`, `<button class="app-btn primary" data-action="${esc(hint('调用系统文件选择器；此稿不执行真实文件导入。'))}" ${picking ? 'disabled' : ''}>${icon('import_choose_file', 15)}${picking ? '正在选择…' : '选择文件'}</button><button class="app-btn lib-import-cancel" data-action="close">${icon('import_cancel', 13)}取消</button>`, 'lib-import-dialog selection');
}
function importResult(v) {
  const failed = v === 'failed', partial = v === 'partial' || v === 'recovery';
  const rows = [{ file: `${f.title}.txt`, result: failed ? '失败' : '新增成功', ok: !failed },
    { file: `${f.title}.epub`, result: failed ? '失败' : partial ? (v === 'recovery' ? '待确认' : '失败') : '已在书架', ok: !failed && !partial }];
  const title = failed ? '导入未完成' : v === 'recovery' ? '部分结果待确认' : partial ? '部分导入完成' : '导入完成';
  const count = failed ? '2 本失败' : v === 'recovery' ? '1 本新增 · 1 本待确认' : partial ? '1 本新增 · 1 本失败' : '1 本新增 · 1 本已在书架';
  const body = `<div class="lib-import-summary"><span class="lib-import-summary-icon ${failed || partial ? 'has-failure' : 'all-success'}">${icon(failed || partial ? 'import_summary' : 'import_success', 18)}</span><div><strong>${title}</strong><p>${count}</p></div>${icon('import_refresh', 18)}</div><div class="lib-import-results">${rows.map(x => `<div><span class="lib-import-doc-icon">${icon('import_doc', 16)}</span><section><strong>${esc(x.file)}</strong><small class="${x.ok ? 'ok' : ''}">${x.result}</small>${x.ok ? '' : `<p>${x.result === '待确认' ? '结果未确认，请重启后检查书架' : '文件读取失败，请重新选择'}</p>`}</section>${icon(x.ok ? 'import_success' : 'import_failure', 17)}</div>`).join('')}</div>`;
  return simpleDialog('导入结果', body, `<button class="app-btn primary" data-action="close">${icon('import_done', 14)}完成</button>`, 'lib-import-dialog result');
}
function localImport(v) {
  if (v === 'selection' || v === 'picker') return importSelection(v);
  if (v === 'importing') return `<section class="app-dialog lib-importing"><div class="lib-import-spinner">${icon('importing_halo', 56)}${icon('importing_spinner_track', 32)}${icon('importing_spinner_arc', 32)}</div><h2>正在导入</h2><p>请稍候</p></section>`;
  return importResult(v);
}
function removal(v) {
  const message = v === 'batch' ? '确定将已选择的 3 本书移出书架吗？本地原始文件不受影响。' : v === 'local' ? `确定将“${f.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` : `确定将“${f.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
  return simpleDialog('移除书架', `<p class="lib-removal-message">${esc(message)}</p>`, button('取消', 'close') + noteAction('移除', '消费一次移除确认后调用 Core；失败读回实际书架，已移除事实不能被刷新失败改写。', 'danger'), 'lib-removal-dialog');
}

export const screens = [
  { id: 'bookshelf', label: '书架', group, kind: 'page', source: [src('pages/Index.ets', 781), src('features/bookshelf/BookshelfPage.ets', 406), src('features/bookshelf/BookshelfPage.ets', 906), src('features/bookshelf/BookshelfPage.ets', 1056), src('features/bookshelf/NoCoverCover.ets', 22)], note: '当前 l0 书架。点书直接阅读；封面与列表只改变同一书架投影。加载与错误由原内容区承接。有书籍的宽屏书架使用已有侧栏与三列大封面；空/加载/失败保留底部导航。', variants: variants(['cover', '封面'], ['list', '列表'], ['empty', '空书架'], ['loading', '加载中'], ['error', '加载失败'], ['no-match', '筛选无匹配']), render: ({ variant, size }) => shelfPage(variant, false, size) },
  { id: 'shelf-filter', label: '书架 · 筛选展开', group, kind: 'page', source: [src('features/bookshelf/BookshelfPage.ets', 447), src('features/bookshelf/BookshelfPage.ets', 565)], note: '同一书架内展开 ListItem；不使用弹窗。阅读状态与书籍类型条件独立，清除不改书籍分组。', variants: variants(['default', '全部'], ['active', '在读 · 在线']), render: ({ variant, size }) => shelfPage(variant, true, size) },
  { id: 'search', label: '搜索', group, kind: 'page', source: [src('pages/Index.ets', 894), src('features/search/SearchPage.ets', 398), src('features/search/SearchOrchestrator.ets', 615)], note: '本地与在线并行，结果流式呈现。停止保留已返回结果；部分失败保留成功分支；全部/本地/在线是结果类别。搜索当前 dirty 源码已包含于基线。', variants: variants(['initial', '最近搜索'], ['loading', '搜索中'], ['results', '搜索结果'], ['searching', '结果继续返回'], ['partial-error', '部分失败'], ['no-source', '未添加书源'], ['all-disabled', '无可搜索书源'], ['source-error', '书源读取失败'], ['empty', '无结果'], ['stopped', '停止后无结果'], ['error', '搜索失败'], ['history-error', '历史读取失败'], ['history-clear-error', '历史清空失败']), render: ({ variant, size }) => searchPage(variant, size) },
  { id: 'detail', label: '书籍详情', group, kind: 'page', source: [src('pages/Index.ets', 1269), src('features/bookshelf/LocalBookDetail.ets', 99), src('features/bookshelf/LocalBookDetail.ets', 433)], note: '搜索点书或书架“书籍信息”进入。返回原入口。开始/继续阅读无需等待详情检查；正文错误由 reader 承接。加入、取消与消息均在原位。', variants: variants(['saved', '在线 · 已在书架'], ['local', '本地书籍'], ['preview', '在线 · 未在书架'], ['catalog-loading', '目录读取中'], ['adding', '正在加入'], ['cancelling', '正在取消加入'], ['add-error', '加入未完成']), render: ({ variant }) => detailPage(variant) },
  { id: 'bookshelf-settings', label: '书架设置', group, kind: 'page', source: [src('pages/Index.ets', 1427), src('features/bookshelf/BookshelfSettingsPage.ets', 40)], note: '从书架或设置进入，返回对应来源。显示方式乐观切换，保存失败回到已确认方式；错误原位可重试。', variants: variants(['cover', '封面'], ['list', '列表'], ['save-error', '显示方式保存失败']), render: ({ variant }) => bookshelfSettings(variant) },
  { id: 'multiselect', label: '批量管理', group, kind: 'page', source: [src('pages/Index.ets', 1460), src('pages/Index.ets', 3892), src('features/bookshelf/BookshelfMultiSelectPage.ets', 54)], note: '完整书架读入后才能选择及移除。原位正在移除；成功返回书架，失败先读回真实书架结果。', variants: variants(['selected', '已选一本'], ['none', '未选择'], ['all', '全选'], ['list', '列表'], ['loading', '读取中'], ['removing', '移除中']), render: ({ variant, size }) => multiselectPage(variant, size) },
  { id: 'shelf-more', label: '书架更多', group, kind: 'overlay', background: 'bookshelf', scrim: 'transparent', source: [src('features/bookshelf/BookshelfShell.ets', 71), src('features/bookshelf/BookshelfMoreMenu.ets', 101)], note: '右上角更多按钮的锚定菜单，透明背景点击关闭。更新进度只改变同一菜单项，不新建更新状态页。', variants: variants(['default', '菜单'], ['updating', '手动检查中'], ['background', '自动检查中'], ['no-online', '没有在线书籍']), render: ({ variant }) => shelfMore(variant) },
  { id: 'book-actions', label: '书籍操作', group, kind: 'overlay', background: 'bookshelf', source: [src('features/bookshelf/BookshelfPage.ets', 280), src('features/bookshelf/BookshelfBookActionSheet.ets', 59)], note: '长按书架书籍或点击列表更多呈现当前书籍操作。此处不包含不可达的完整分组管理页。', variants: variants(['default', '操作面板']), render: () => bookActions() },
  { id: 'group-select', closeBlockedVariants: ['busy'], label: '编辑分组', group, kind: 'overlay', background: 'bookshelf', source: [src('pages/Index.ets', 1211), src('features/bookshelf/BookshelfGroupSelector.ets', 16)], note: '当前只有“默认”。清除禁用；保存成功关闭并刷新书架，失败保留弹窗并通过原 toast 提示。', variants: variants(['default', '默认分组'], ['busy', '保存中']), render: ({ variant }) => groupSelect(variant) },
  { id: 'local-import', dismissable: false, label: '导入本地书籍', group, kind: 'overlay', background: 'bookshelf', source: [src('pages/Index.ets', 6799), src('features/bookshelf/LocalImportDialog.ets', 134), src('features/bookshelf/BookshelfFlowGateway.ts', 204)], note: '原居中弹窗承接选文件、导入、逐文件结果。结果由外部样本切换；图标 refresh 不具有点击动作。成功文件保留，书架读回失败与导入事实分别处理。', variants: variants(['selection', '选择文件'], ['picker', '系统选择中'], ['importing', '正在导入'], ['result', '全部完成'], ['partial', '部分完成'], ['failed', '全部未完成'], ['recovery', '待确认']), render: ({ variant }) => localImport(variant) },
  { id: 'book-removal', label: '移除书架确认', group, kind: 'overlay', background: 'detail', source: [src('features/bookshelf/BookRemovalDialog.ets', 23), src('pages/Index.ets', 3862)], note: '复用 ReaderDialogSurface 的 book-removal 规格。取消及移除两项，没有独立关闭图标或移除成功页；确认只消费一次。', variants: variants(['online', '在线书籍'], ['local', '本地书籍'], ['batch', '批量']), render: ({ variant }) => removal(variant) },
];
