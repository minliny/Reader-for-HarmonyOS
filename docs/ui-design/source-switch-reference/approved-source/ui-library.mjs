import { esc, icon, button, iconButton, topbar, tabs, fixtures as f } from './shared.mjs';

const group = '书架与搜索';
const src = (name, line) => ({ path: `entry/src/main/ets/${name}`, line });
const variants = (...items) => items.map(([id, label]) => ({ id, label }));
const hint = text => `hint:${text}`;
const noteAction = (label, text, kind = 'secondary', disabled = false) => button(label, hint(text), kind, disabled);
const withAttrs = (html, attributes) => html.replace('<button', `<button ${Object.entries(attributes).map(([key, value]) => `${key}="${esc(value)}"`).join(' ')}`);
const sampleAction = (label, variant, text, kind = 'secondary', disabled = false) =>
  withAttrs(button(label, `variant:${variant}`, kind, disabled), { 'data-action-note': text });
const destination = (html, variant, bookKind = '') => withAttrs(html, {
  'data-target-variant': variant, ...(bookKind ? { 'data-book-kind': bookKind } : {}),
});
// Stable preview identities are kept across every route; SVG artwork is a fixture,
// not a declaration of the Core's supported cover formats.
const sampleCover = (title, ink, paper) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="${paper}"/><path d="M0 330L82 174l65 96 68-143 85 203v120H0Z" fill="${ink}" opacity=".82"/><circle cx="216" cy="83" r="30" fill="${ink}" opacity=".25"/><path d="M30 357h240M30 370h240" stroke="${paper}" opacity=".35"/><text x="150" y="95" text-anchor="middle" font-family="serif" font-size="29" fill="${ink}">${title}</text></svg>`)}`;
export const libraryBooks = [
  { id: 'sample-online-novel', index: 0, kind: 'online', content: 'novel', title: f.title, author: f.author, source: f.source, chapter: f.chapter, progress: 24, unread: 2, intro: '沿着山路走进远村，听见林间的风声，也记录下清晨与灯火之间的日常。', cover: sampleCover(f.title, '#284c40', '#e9ddbd') },
  { id: 'sample-local-novel', index: 1, kind: 'local', content: 'novel', title: '林间手记', author: f.author, source: '本地书籍', chapter: f.chapter, format: 'txt', progress: 0, unread: 0, intro: '', cover: '' },
  { id: 'sample-online-manga', index: 2, kind: 'online', content: 'manga', title: '山海纪行', author: '江木', source: f.sources[1].name, chapter: '第3话 山路', mangaPosition: { chapterIndex: 3, chapterTitle: '第3话 山路', pageOrdinal: 2, totalPages: 12 }, progress: 62, unread: 0, intro: '旅人沿着山海之间的旧路前行，寻找远村留下的故事。', cover: sampleCover('山海纪行', '#345575', '#e6d7c4') },
];
const b = libraryBooks;
const attributes = values => Object.entries(values).map(([key, value]) => `${key}="${esc(value)}"`).join(' ');
const bookAttrs = book => attributes({ 'data-book-id': book.id, 'data-book-kind': book.kind, 'data-book-content': book.content, 'data-book-index': book.index, 'data-book-title': book.title, 'data-book-author': book.author, 'data-book-source': book.source, 'data-book-chapter': book.chapter, 'data-book-format': book.format ?? '', ...(book.content === 'manga' ? { 'data-book-position': book.mangaPosition ? 'known' : 'none' } : {}) });
const forBook = (html, book) => html.replace('<button', `<button ${bookAttrs(book)}`);
function currentBook(ctx) {
  const fallback = ctx.variant === 'local' ? b[1] : ctx.variant?.startsWith('manga') ? b[2] : b[0];
  const selected = b.find(book => book.id === ctx.book?.id) ?? fallback;
  return { ...selected, ...(ctx.book ?? {}), index: selected.index };
}
function readFilter(book, value) { return value === 'all' || value === 'unread' && book.progress <= 0 || value === 'reading' && book.progress > 0 && book.progress < 100 || value === 'finished' && book.progress >= 100; }
function visibleBooks(choices = {}) { return b.filter(book => (choices['library-content-filter'] === undefined || choices['library-content-filter'] === 'all' || choices['library-content-filter'] === book.content) && (choices['library-source-filter'] === undefined || choices['library-source-filter'] === 'all' || choices['library-source-filter'] === book.kind)); }
export function applyLibrarySample(screenId, variantId, choices) {
  if (['bookshelf', 'shelf-filter'].includes(screenId)) {
    choices['library-view'] = variantId === 'list' || variantId.endsWith('-list') ? 'list' : 'cover';
    const active = ['active', 'active-list', 'filtered-cover', 'filtered-list'].includes(variantId);
    choices['library-reading-filter'] = 'all';
    choices['library-content-filter'] = variantId === 'no-match' ? 'manga' : active ? 'novel' : 'all';
    choices['library-source-filter'] = variantId === 'no-match' ? 'local' : active ? 'online' : 'all';
  } else if (screenId === 'search') {
    choices['library-search-draft'] = ['initial', 'history-loading', 'idle', 'history-error', 'history-clear-error', 'no-source', 'all-disabled', 'source-error'].includes(variantId) ? '' : f.query;
    choices['library-search-category'] = variantId === 'filtered-empty' ? 'local' : 'all';
    choices['library-search-content'] = variantId === 'filtered-empty' ? 'manga' : 'all';
  } else if (screenId === 'bookshelf-settings') {
    choices['library-view'] = variantId === 'list' ? 'list' : 'cover';
    choices['library-auto-update'] = variantId !== 'auto-off';
  } else if (screenId === 'multiselect') {
    choices['library-selection'] = variantId === 'none' || variantId === 'loading' ? 0 : variantId === 'all' ? 7 : 1;
    if (variantId === 'list') choices['library-view'] = 'list';
  }
}
export function coverImage(book, width = 96.656, height = 145.443, radius = 8, shadow = false) {
  return book.cover ? `<img class="lib-book-cover ${shadow ? 'has-shadow' : ''}" src="${esc(book.cover)}" alt="${esc(book.title)}封面" style="--cover-w:${width}px;--cover-h:${height}px;--cover-radius:${radius}px" width="${width}" height="${height}">` : noCover(width, height);
}
function choiceChip(label, key, value, selected, disabled = false) {
  return `<button class="lib-chip ${selected ? 'selected' : ''}" data-choice="${esc(key)}" data-choice-value="${esc(value)}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
}

function noCover(width = 96.656, height = 145.443) {
  return `<div class="lib-no-cover" style="--cover-w:${width}px;--cover-h:${height}px" aria-label="暂无封面"><i></i><span>暂无封面</span><i></i></div>`;
}
function spinner(size = 24) { return `<span class="lib-spinner" style="width:${size}px;height:${size}px" aria-label="正在加载"></span>`; }
function chip(label, selected, text, disabled = false, action = hint(text)) {
  return `<button class="lib-chip ${selected ? 'selected' : ''}" data-action="${esc(action)}" data-action-note="${esc(text)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
}
function shelfHeader(choices = {}, disabled = false, expanded = false, hasContinue = true) {
  const list = choices['library-view'] === 'list';
  const conditions = (choices['library-content-filter'] ?? 'all') !== 'all' || (choices['library-source-filter'] ?? 'all') !== 'all';
  const action = (asset, label, attrs, selected) => disabled ? `<span class="lib-disabled-icon">${icon(asset, 20)}</span>` : `<button class="icon-btn ${selected ? 'lib-section-active' : ''}" aria-label="${esc(label)}" aria-pressed="${selected}" ${attrs}>${icon(asset, 20)}</button>`;
  const target = expanded ? list ? conditions ? 'filtered-list' : 'list' : conditions ? 'filtered-cover' : hasContinue ? 'cover' : 'no-continue' : list ? conditions ? 'active-list' : 'default-list' : conditions ? 'active' : 'default';
  const filterSelected = expanded || conditions;
  return `<div class="lib-shelf-heading"><strong>我的书架</strong><div>${action(list ? 'bookshelf_grid_outline' : 'bookshelf_grid', '封面显示', 'data-choice="library-view" data-choice-value="cover"', !list)}${action(list ? 'bookshelf_list_active' : 'bookshelf_list', '列表显示', 'data-choice="library-view" data-choice-value="list"', list)}${action(filterSelected ? 'bookshelf_filter_active' : 'bookshelf_filter', '筛选书架', `data-action="go:${expanded ? 'bookshelf' : 'shelf-filter'}" data-target-variant="${target}"`, filterSelected)}</div></div>`;
}
function shelfTop() {
  return `<header class="app-topbar lib-shelf-floating">${iconButton('bookshelf_search', '搜索', 'go:search', 24)}<h1>书架</h1>${withAttrs(iconButton('rc_dots', '更多', 'open:shelf-more', 24), { 'data-popup-anchor': 'shelf-more' })}</header>`;
}
function recoveryNotice(message, label = '刷新列表', canRetry = true, continuation = '') {
  return `<div class="lib-recovery-notice"><p>${esc(message)}</p>${canRetry ? `<button class="lib-recovery-action" data-action="${esc(hint('原生恢复回调读取实际事实；本预览不提交 Core 或伪造确认结果。'))}">${esc(label)}</button>` : ''}${continuation ? `<button class="lib-recovery-action" data-action="${esc(hint('仅在原操作允许继续且身份/generation仍有效时执行对应原删除，不发起新的无关操作。'))}">${esc(continuation)}</button>` : ''}</div>`;
}
const shelfFeedback = {
  'remove-unknown': { message: '原书架操作尚待核对，已保留原内容', retry: true, continuation: '继续原删除操作' },
  'remove-confirmed-cleanup': { message: '原删除已确认，清理尚未完成', retry: true, continuation: '完成原删除清理' },
  'shelf-refresh-pending': { message: '操作结果已确认，书架列表暂未刷新：连接失败', retry: true },
  'local-cleanup-warning': { message: '书籍已移出书架；应用内 EPUB 文件清理未完成：文件读取失败', retry: false },
};
function continueCard(book = b[0]) {
  return `<section class="lib-continue-group"><small>继续阅读</small><button class="lib-continue" data-action="go:reader" ${bookAttrs(book)}>${coverImage(book, 48, 72)}<div class="lib-continue-metadata"><h2>${esc(book.title)}</h2><p>${esc(book.author)}</p><p>${esc(book.chapter)}</p></div><span class="lib-read-pill">阅读</span></button></section>`;
}
function shelfRail() {
  return `<nav class="lib-shelf-rail"><button class="active" aria-current="page">${icon('bookshelf_library_active', 24)}<span>书架</span></button><button data-action="go:settings">${icon('bookshelf_settings_outline', 24)}<span>设置</span></button></nav>`;
}
function shelfListDetails(book) {
  const position = book.content === 'manga' ? book.mangaPosition ? `${book.mangaPosition.chapterTitle} · 第 ${book.mangaPosition.pageOrdinal + 1} 页` : '尚未开始阅读' : book.progress > 0 ? book.chapter : '尚未阅读';
  return `<div class="lib-list-details"><div class="lib-list-title-row"><h3>${esc(book.title)}</h3><span>${book.content === 'manga' ? '漫画' : '小说'}</span><span>${book.kind === 'local' ? '本地' : '在线'}</span></div><p>${esc(book.author)}</p><small>${esc(position)}</small><div class="lib-list-latest"><small>最新：${esc(book.chapter || '暂无最新章节')}</small><span>${book.progress > 0 ? `已读 ${book.progress}%` : book.content === 'manga' ? '已读 0%' : '未读'}</span></div><div class="lib-list-progress" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${book.progress}"><i style="width:${book.progress}%"></i></div></div>`;
}
function bookGrid(selection = false, disabled = false, books = b, wide = false, selectedMask = 0) {
  return `<div class="lib-book-grid ${selection ? 'selection' : ''}">${books.map(book => {
    const picked = (selectedMask & (1 << book.index)) !== 0;
    const attrs = selection ? `data-choice="library-selection" data-choice-value="${selectedMask ^ (1 << book.index)}" aria-pressed="${picked}"` : 'data-action="go:reader" data-long-action="open:book-actions"';
    return `<button class="lib-grid-book" ${disabled ? 'disabled' : ''} ${attrs} ${bookAttrs(book)}><div class="lib-cover-slot">${wide ? coverImage(book, 186.672, 280, 8, true) : coverImage(book, selection ? 97 : 96.656, selection ? 145.44 : 145.443, 8, true)}${selection ? `<span class="lib-selection-badge ${picked ? 'selected' : ''}">${picked ? '✓' : ''}</span>` : book.unread ? `<span class="lib-update-pill">更新 ${book.unread} 章</span>` : ''}</div><h3>${esc(book.title)}</h3><p>${esc(book.author)}</p>${book.progress && !selection ? `<small>已读 ${book.progress}%</small>` : ''}</button>`;
  }).join('')}</div>`;
}
function bookList(selection = false, wide = false, books = b, selectedMask = 0, disabled = false) {
  return `<div class="lib-book-list">${books.map(book => {
    const picked = (selectedMask & (1 << book.index)) !== 0;
    const attrs = selection ? `data-choice="library-selection" data-choice-value="${selectedMask ^ (1 << book.index)}" aria-pressed="${picked}"` : 'data-action="go:reader" data-long-action="open:book-actions"';
    return `<div class="lib-list-book"><button class="lib-list-entry" ${disabled ? 'disabled' : ''} ${attrs} ${bookAttrs(book)}>${selection ? `<div class="lib-select-list-cover">${coverImage(book, 48, 80, 6, true)}<span class="lib-selection-badge ${picked ? 'selected' : ''}">${picked ? '✓' : ''}</span></div>` : wide ? coverImage(book, 64, 104, 6) : coverImage(book, 48, 72, 6)}${shelfListDetails(book)}</button>${selection ? '' : forBook(destination(iconButton('bookshelf_more', `${book.title}更多操作`, 'open:book-actions', 44), book.kind === 'local' ? 'local' : 'default'), book)}</div>`;
  }).join('')}</div>`;
}
function filterContent(choices) {
  const content = choices['library-content-filter'] ?? 'all', source = choices['library-source-filter'] ?? 'all';
  return `<section class="lib-filter"><div><span>筛选</span>${button('清除', 'library:clear-filters', 'text', content === 'all' && source === 'all')}</div><p>内容类型</p><div class="lib-chip-row">${[['all', '全部'], ['novel', '小说'], ['manga', '漫画']].map(([value, label]) => choiceChip(label, 'library-content-filter', value, content === value)).join('')}</div><p>来源</p><div class="lib-chip-row">${[['all', '全部'], ['local', '本地'], ['online', '在线']].map(([value, label]) => choiceChip(label, 'library-source-filter', value, source === value)).join('')}</div></section>`;
}
function emptyShelf() {
  return `<div class="lib-empty-card"><div class="lib-empty-illustration"><i></i><i></i><span>${icon('bookshelf_empty_library', 32)}</span></div><h2>书架还是空的</h2><p>导入本地书籍或通过搜索加入书架。</p>${button('导入本地书籍', 'open:local-import', 'primary')}${button('搜索并加入书架', 'go:search')}</div>`;
}
function shelfPage(ctx, filter = false) {
  const { variant: v = 'cover', size = 'phone', choices = {} } = ctx;
  const populated = !['empty', 'loading', 'error'].includes(v), wide = populated && size === 'wide';
  const hasContinue = !v.startsWith('no-continue'), list = (choices['library-view'] ?? (v === 'list' || v.endsWith('-list') ? 'list' : 'cover')) === 'list';
  const books = visibleBooks(choices);
  const viewFailure = { 'view-read-error': '显示方式读取失败，点击重试', 'view-save-error': '显示方式保存失败，点击重试', 'view-restore-pending': '请先在同步设置中重试未完成的恢复' }[v];
  let content;
  if (v === 'loading' || v === 'error') content = `<div class="status-content lib-shelf-state">${v === 'loading' ? `${spinner()}<p>正在加载书架…</p>` : `<h2>书架加载失败</h2><p>无法读取书架内容，请重试。</p>${noteAction('重试', '重新读取 Core 书架；旧加载回调不能覆盖新一轮结果。', 'primary')}`}</div>`;
  else if (v === 'empty') content = shelfHeader(choices, true) + emptyShelf();
  else content = (hasContinue ? continueCard() : '') + shelfHeader({ ...choices, 'library-view': list ? 'list' : 'cover' }, false, filter, hasContinue) + (filter ? filterContent(choices) : '') + (viewFailure ? recoveryNotice(viewFailure, '刷新显示方式') : '') + (!books.length ? `<div class="lib-no-match"><p>没有符合条件的书籍</p>${button('清除全部条件', 'library:clear-filters', 'text')}</div>` : list ? bookList(false, wide, books) : bookGrid(false, false, books, wide));
  const feedback = shelfFeedback[v];
  return `<div class="app-page lib-shelf-page ${populated ? 'populated' : ''} ${hasContinue ? '' : 'without-continue'} ${feedback ? 'with-recovery' : ''}">${shelfTop()}${feedback ? recoveryNotice(feedback.message, '刷新列表', feedback.retry, feedback.continuation) : ''}<div class="app-scroll lib-shelf-scroll">${content}</div>${wide ? shelfRail() : tabs('bookshelf')}</div>`;
}

function searchBar(sweeping, draft, hasResults = false) {
  const action = sweeping ? `variant:${hasResults ? 'stopped-results' : 'stopped'}` : hint('提交当前非空草稿；本地和已启用在线书源并行检索，结果由真实回调确定。');
  return `<header class="lib-search-bar">${iconButton('search_back', '返回书架', 'go:bookshelf', 20)}<div class="lib-search-field">${icon('search_mag', 14)}<input placeholder="搜索书名、作者..." aria-label="搜索书名或作者" value="${esc(draft)}" data-choice="library-search-draft" data-render-choice="true">${draft ? `<button aria-label="清空搜索内容" data-action="library:clear-search">${icon('search_clear', 14)}</button>` : ''}</div><button class="lib-search-pill ${!draft.trim() && !sweeping ? 'empty-draft' : ''}" data-action="${esc(action)}" ${!draft.trim() && !sweeping ? 'disabled' : ''}>${sweeping ? spinner(13) : ''}${sweeping ? '停止' : '搜索'}</button></header>`;
}
function searchPill(label, action, primary = false) { return `<button class="lib-search-state-pill ${primary ? 'primary' : 'secondary'}" data-action="${esc(action)}">${esc(label)}</button>`; }

function history(status = 'ready') {
  const failed = status === 'load-failed' || status === 'clear-failed';
  const retained = status === 'ready' || status === 'clear-failed';
  return `<section class="lib-history">${status === 'loading' ? '<p>正在读取搜索历史</p>' : ''}${failed ? `<p>${status === 'clear-failed' ? '搜索历史清空失败' : '搜索历史读取失败'}</p>${searchPill(status === 'clear-failed' ? '重试清空' : '重试读取', hint(status === 'clear-failed' ? '只重试清空历史；保留未确认清除的原历史。' : '只重试历史读取，不重置书源与当前查询。'))}` : ''}${retained ? `<div class="lib-history-heading"><strong>最近搜索</strong>${noteAction('清空记录', '请求清空 Core 搜索历史，失败仍保留原历史并原位提示。', 'text')}</div><div class="lib-chip-row">${chip(f.query, false, '将此历史关键词提交为新的搜索。')}</div>` : ''}</section>`;
}
function searchCategories(choices) {
  const scope = choices['library-search-category'] ?? 'all', content = choices['library-search-content'] ?? 'all';
  return `<div class="lib-search-categories"><div><span>来源</span><div>${[['all', '全部'], ['local', '本地'], ['online', '在线']].map(([value, label]) => choiceChip(label, 'library-search-category', value, scope === value)).join('')}</div></div><div><span>内容类型</span><div>${[['all', '全部类型'], ['novel', '小说'], ['manga', '漫画']].map(([value, label]) => choiceChip(label, 'library-search-content', value, content === value)).join('')}</div></div></div>`;
}
function resultCard(book, size) {
  const local = book.kind === 'local', width = size === 'wide' ? 96 : 88, height = size === 'wide' ? 129.88235 : 120.2667;
  return `<button class="lib-search-result" data-action="go:detail" data-target-variant="${local ? 'local' : 'preview'}" ${bookAttrs(book)}>${book.cover ? coverImage(book, width, height, 6) : `<div class="lib-search-cover"><span>${esc(book.title)}</span></div>`}<div class="lib-search-metadata"><h3>${esc(book.title)}</h3><p>${esc(book.author)}</p>${local ? '' : `<small>${esc(book.chapter)}</small>`}${book.intro ? `<p class="lib-result-intro">${esc(book.intro)}</p>` : ''}<div class="lib-result-tags"><span>${local ? '本地导入' : esc(book.source)}</span><span>${local ? '本地书籍' : '已发现 2 个书源'}</span>${local ? '<span>已在书架</span>' : ''}</div></div></button>`;
}

function searchEmpty(stopped = false, partial = false) {
  return `<div class="lib-search-empty">${icon('search_empty', 128)}<h2>没有找到相关书籍</h2><p>${stopped ? '已停止搜索' : '已搜索 2 个书源'},未找到「${esc(f.query)}」的相关结果</p>${partial ? `<button class="lib-search-partial" data-action="${esc(hint('仅补偿失败或未完成书源；其他分支无结果时仍留在搜索页。'))}">1 个书源请求失败，可重试或检查书源状态</button>` : ''}<section class="lib-search-suggestions"><strong>搜索建议</strong><p>· 检查书名拼写是否正确</p><p>· 尝试更短的关键词或作者名</p><p>· 前往书源管理添加或启用更多书源</p></section><div class="lib-actions">${searchPill('添加更多书源', 'go:sources', true)}${searchPill('重新搜索', hint('重试失败或未完成分支；全部成功但无结果时重新搜索。'))}</div></div>`;
}
function searchUnavailable(allDisabled = false, loadFailed = false) {
  return `<section class="lib-search-unavailable">${icon(loadFailed ? 'search_error' : 'search_empty', loadFailed ? 80 : 128)}<h2>${loadFailed ? '书源列表加载失败' : allDisabled ? '没有可搜索书籍的书源' : '还没有可用书源'}</h2><p>${loadFailed ? '在线书源暂不可用；本地导入的书仍可在上方搜索' : allDisabled ? '启用可搜索书籍的书源；本地导入的书仍可在上方搜索' : '添加书源后可搜索在线书籍；本地导入的书仍可在上方搜索'}</p><div class="lib-actions">${loadFailed ? searchPill('重试加载', hint('只重新加载在线书源列表，本地检索仍可使用。'), true) : searchPill(allDisabled ? '管理书源' : '添加书源', 'go:sources', true)}${searchPill('返回书架', 'go:bookshelf')}</div></section>`;
}
function searchPage({ variant: v, size = 'phone', choices = {} }) {
  const sweeping = v === 'loading' || v === 'searching';
  const results = ['results', 'searching', 'partial-error', 'stopped-results', 'failed-sources', 'skipped-sources', 'local-partial-error', 'filtered-empty'].includes(v);
  const initial = ['initial', 'history-loading', 'idle', 'history-error', 'history-clear-error'].includes(v);
  const empty = ['empty', 'stopped', 'empty-partial-error'].includes(v);
  let content = '', statistics = '';
  if (initial) content = history({ 'history-loading': 'loading', idle: 'empty', 'history-error': 'load-failed', 'history-clear-error': 'clear-failed' }[v] ?? 'ready');
  else if (v === 'loading') content = '';
  else if (results) {
    const localFailure = v === 'local-partial-error';
    const sourceListFailure = v === 'partial-error';
    const partialMessage = localFailure ? '本地检索：读取未完成，请重试' : sourceListFailure ? '书源列表：读取未完成，请重试' : '';
    const returned = [...(localFailure ? [] : [b[1]]), ...(sourceListFailure ? [] : [b[0], b[2]])];
    const category = choices['library-search-category'] ?? 'all';
    const contentType = choices['library-search-content'] ?? 'all';
    const shown = returned.filter(book => (category === 'all' || category === book.kind) && (contentType === 'all' || contentType === book.content));
    const selection = `${{ all: '全部', local: '本地', online: '在线' }[category]} · ${{ all: '全部类型', novel: '小说', manga: '漫画' }[contentType]}`;
    const emptyMessage = v === 'searching' ? `当前筛选（${selection}）下暂无结果，搜索仍在继续。` : v === 'stopped-results' ? `搜索已停止，已返回的结果中没有符合当前筛选（${selection}）的书籍。可切换范围或内容类型。` : `已返回的结果中没有符合当前筛选（${selection}）的书籍，可切换范围或内容类型。`;
    const cards = shown.length ? shown.map(book => resultCard(book, size)).join('') : `<p class="lib-search-category-empty">${esc(emptyMessage)}</p>`;
    const count = shown.length;
    statistics = `<div class="lib-result-summary"><span>找到 <strong>${count}</strong> 本相关书籍</span>${partialMessage ? `<button class="lib-search-partial" data-action="${esc(hint(localFailure ? '只补偿失败的本地检索；保留已返回在线结果。' : '只重试书源列表读取与未开始的在线分支；保留已返回本地结果。'))}">${partialMessage}</button>` : ''}${v === 'stopped-results' ? '<small> · 已停止,已搜索 1/2 个书源</small>' : v === 'searching' ? '<small> · 正在搜索 1/2 个书源,已返回 3 个</small>' : ''}${v === 'failed-sources' ? `<button class="lib-search-stat" data-action="${esc(hint('只补偿失败或未完成的书源，不重复成功分支；保留当前结果。'))}"> · 失败 1 个书源，重试</button>` : ''}${v === 'skipped-sources' ? `<button class="lib-search-stat" data-action="${esc(hint('以补偿重试纳入近期不可用而跳过的书源；保留已成功结果。'))}"> · 跳过 1 个近期不可用书源，重试</button>` : ''}</div>`;
    content = cards;
  }
  else if (empty) content = searchEmpty(v === 'stopped', v === 'empty-partial-error');
  else if (v === 'error' || v === 'local-error') content = `<div class="lib-search-failure">${icon('search_error', 80)}<h2>${v === 'local-error' ? '本地检索未完成' : '书源搜索失败'}</h2><p>${v === 'local-error' ? '本地检索：读取未完成，请重试' : '2 个书源请求失败，可重试或检查书源状态'}</p>${noteAction('重新搜索', v === 'local-error' ? '只补偿失败的本地检索；书源管理不是本地读取故障的成功处理步骤。' : '重试失败书源，保留已经成功的分支。', 'primary')}${button('检查书源', 'go:sources', 'text')}</div>`;
  else content = searchUnavailable(v === 'all-disabled', v === 'source-error') + history();
  return `<div class="app-page lib-search-page ${size === 'wide' ? 'lib-tablet-search' : ''}">${searchBar(sweeping, choices['library-search-draft'] ?? (initial || ['no-source', 'all-disabled', 'source-error'].includes(v) ? '' : f.query), results)}${results || empty ? searchCategories(choices) : ''}${statistics}<div class="app-scroll lib-search-scroll ${results || empty ? 'has-categories' : ''}">${content}</div>${sweeping ? `<div class="lib-search-actor">${spinner(36)}<p class="${v === 'loading' ? '' : 'quiet'}">正在搜索本地与在线书籍…</p></div>` : ''}</div>`;
}
function detailPage(ctx) {
  const { variant: v, choices = {} } = ctx, book = { ...currentBook(ctx), ...(v === 'manga-unread' ? { mangaPosition: undefined } : {}) }, local = book.kind === 'local', manga = book.content === 'manga';
  const preview = ['preview', 'catalog-loading', 'catalog-empty', 'catalog-error', 'catalog-blocked', 'adding', 'cancelling', 'add-error'].includes(v);
  const adding = v === 'adding', cancelling = v === 'cancelling', removing = v === 'removing';
  const canSwitch = !local && !adding && !cancelling && !removing;
  const shelfLabel = cancelling ? '正在取消…' : adding ? '取消加入' : removing ? '正在移除…' : preview ? '加入书架' : '移除书架';
  const noToc = ['catalog-loading', 'catalog-empty', 'catalog-error', 'catalog-blocked'].includes(v);
  const emptyMessage = { 'catalog-loading': '正在获取在线目录…', 'catalog-empty': '暂无章节信息', 'catalog-error': '目录读取未完成：连接失败', 'catalog-blocked': '当前目录没有可阅读章节' }[v];
  const grouped = v === 'catalog-nonnavigable' || manga;
  const foldKey = `library-detail-fold:${book.id}`, folded = Boolean(choices[foldKey]);
  const introKey = `library-detail-intro:${book.id}`, expanded = Boolean(choices[introKey]);
  const entries = noToc ? [] : [ ...(grouped ? [{ index: 0, title: '第一卷', group: true }] : []), ...(manga ? ['第1话 清晨', '第2话 林间', '第3话 山路', '第4话 远村', '第5话 灯火'] : f.chapters).map((title, i) => ({ index: i + (grouped ? 1 : 0), title, group: false })) ];
  const shown = entries.filter(entry => entry.group || !folded);
  const position = v === 'manga-unread' ? undefined : book.mangaPosition;
  const groupRow = entry => `<button class="lib-detail-chapter lib-detail-group" data-choice="${esc(foldKey)}" data-choice-value="${!folded}" aria-expanded="${!folded}" ${removing ? 'disabled' : ''}><span>${esc(entry.title)}</span><i>${folded ? '›' : '⌄'}</i></button>`;
  const chapterRow = entry => {
    const active = manga && position?.chapterIndex === entry.index;
    return `<button class="lib-detail-chapter ${active ? 'current' : ''}" style="--chapter-indent:${grouped ? 26 : 10}px" data-action="go:reader" data-reader-chapter="${entry.index}" ${bookAttrs(book)} ${removing ? 'disabled' : ''}><span>${esc(entry.title)}</span>${active ? '<small>正在读</small>' : ''}</button>`;
  };
  const sourceRow = `<div class="lib-detail-source"><span>当前来源：${esc(book.source)}</span>${canSwitch ? forBook('<button data-action="open:source-switch">换源</button>', book) : ''}</div>`;
  const tags = `<div class="lib-detail-tags"><span>${manga ? '漫画' : '小说'}</span><span>${local ? '本地' : '在线'}</span></div>`;
  const facts = manga ? `<section class="lib-detail-position"><small>上次读到</small><div><span>${esc(position?.chapterTitle || '尚未开始阅读')}</span><span>${position ? `${position.pageOrdinal + 1}${position.totalPages === undefined ? '' : ` / ${position.totalPages}`} 页` : '—'}</span></div></section>` : `<section class="lib-detail-facts">${sourceRow}<p>最新：${esc(book.chapter || '暂无最新章节')}</p></section>`;
  const mutation = cancelling || removing ? button(shelfLabel, '', 'secondary', true) : adding ? sampleAction(shelfLabel, 'cancelling', '演示取消请求发出后的原位状态；真实 Core 读回才能判断加入是否已经提交，不假定已加入书会被删除。') : preview ? sampleAction(shelfLabel, 'adding', '演示加入请求执行中的原位按钮；持久化是否完成由真实回调决定，不显示虚构成功。') : forBook(destination(button(shelfLabel, 'open:book-removal'), local ? 'local' : 'online'), book);
  return `<div class="app-page lib-detail-page ${manga ? 'manga' : 'novel'}"><header class="app-topbar subpage lib-detail-floating">${iconButton('book_detail_back', '返回', 'back', 24)}<h1>书籍详情</h1><span class="lib-detail-back-spacer"></span></header><div class="app-scroll lib-detail-scroll"><div class="lib-detail-content"><section class="lib-detail-hero">${coverImage(book, manga ? 104 : 84, manga ? 150 : 122, manga ? 10 : 8)}<div>${manga ? tags : ''}<h2>${esc(book.title)}</h2><p>${esc(book.author)}</p>${manga ? `${sourceRow}<small>最新：${esc(book.chapter || '暂无最新章节')}</small>` : tags}</div></section>${facts}<section class="lib-detail-summary"><h3>简介</h3><p class="${expanded ? 'expanded' : ''}">${esc(book.intro || '暂无简介')}</p>${book.intro ? `<button data-choice="${esc(introKey)}" data-choice-value="${!expanded}">${expanded ? '收起' : '展开'}</button>` : ''}</section><section class="lib-detail-directory"><header><h3>${manga ? '章节目录' : '目录'}</h3><span>${entries.filter(entry => !entry.group).length} 个可读条目${manga && grouped ? ' · 1 个卷组' : ''}</span>${forBook(`<button data-action="go:directory" ${removing ? 'disabled' : ''}>${icon('book_detail_directory', 20)}完整目录</button>`, book)}</header>${noToc ? `<p class="lib-detail-empty">${esc(emptyMessage)}</p>` : shown.map(entry => entry.group ? groupRow(entry) : chapterRow(entry)).join('')}</section>${v === 'add-error' ? '<p class="lib-detail-error">加入书架未完成：连接失败</p>' : ''}</div></div><footer class="lib-detail-actions">${forBook(button(manga ? position ? '继续阅读' : '开始阅读' : preview ? '开始阅读' : '继续阅读', 'go:reader', 'primary', removing), book)}${mutation}</footer></div>`;
}
function multiselectPage({ variant: v, size = 'phone', choices = {} }) {
  const loading = v === 'loading', busy = v === 'removing', books = b.filter(book => readFilter(book, choices['library-reading-filter'] ?? 'all') && ((choices['library-source-filter'] ?? 'all') === 'all' || choices['library-source-filter'] === book.kind));
  const visibleMask = books.reduce((mask, book) => mask | (1 << book.index), 0);
  const seed = v === 'none' || loading ? 0 : v === 'all' ? visibleMask : 1;
  const selectedMask = Number(choices['library-selection'] ?? seed) & visibleMask;
  const count = b.filter(book => selectedMask & (1 << book.index)).length;
  const allVisibleSelected = visibleMask !== 0 && (selectedMask & visibleMask) === visibleMask;
  choices['library-selected-count'] = count;
  return `<div class="app-page lib-multiselect-page"><header class="lib-multiselect-top"><button data-action="go:bookshelf" ${loading || busy ? 'disabled' : ''}>取消</button><h1>已选择 ${count} 本</h1><button data-choice="library-selection" data-choice-value="${allVisibleSelected ? selectedMask & ~visibleMask : selectedMask | visibleMask}" ${loading || busy || !books.length ? 'disabled' : ''}>${allVisibleSelected ? '取消全选' : '全选'}</button></header><div class="app-scroll lib-multiselect-scroll">${(choices['library-view'] ?? (v === 'list' ? 'list' : 'cover')) === 'list' ? bookList(true, false, books, selectedMask, loading || busy) : bookGrid(true, loading || busy, books, size === 'wide', selectedMask)}</div><footer class="lib-remove-bar"><button data-action="open:book-removal" data-target-variant="batch" ${count === 0 || loading || busy ? 'disabled' : ''}>${icon('bookshelf_multiselect_trash', 22)}<span>${loading ? '正在读取书架' : busy ? '正在移除' : '移除书架'}</span></button></footer></div>`;
}
function bookshelfSettings({ variant: v, choices = {} }) {
  const autoUpdate = choices['library-auto-update'] ?? v !== 'auto-off', list = (choices['library-view'] ?? (v === 'list' ? 'list' : 'cover')) === 'list';
  const switchControl = `<button class="app-toggle ${autoUpdate ? 'on' : ''}" role="switch" aria-label="自动检查更新" aria-checked="${autoUpdate}" data-choice="library-auto-update" data-choice-value="${!autoUpdate}"><span></span></button>`;
  return `<div class="app-page lib-bookshelf-settings">${topbar('书架设置')}<div class="app-scroll"><section class="lib-settings-card"><div><span>自动检查更新</span>${switchControl}</div><p>自动检查书架中书籍的最新章节</p><div><span>显示方式</span>${choiceChip('封面', 'library-view', 'cover', !list)}${choiceChip('列表', 'library-view', 'list', list)}</div>${v === 'save-error' ? recoveryNotice('显示方式保存失败，点击重试', '刷新显示方式') : ''}</section></div></div>`;
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
  return `<div class="lib-shelf-more" data-anchored-popup="shelf-more"><svg class="lib-shelf-more-pointer" width="24" height="12" viewBox="0 0 24 12" aria-hidden="true"><polygon points="0,12 12,0 24,12"/></svg><div class="lib-shelf-more-body">${items.map(([asset, label, action], i) => `<button data-action="${esc(action)}" ${i === 0 ? 'data-target-variant="none"' : i === 1 ? 'data-target-variant="selection"' : ''} ${i === 2 ? 'data-dismiss-overlay="true"' : ''} ${i === 2 && (updating || v === 'no-online') ? 'disabled' : ''}>${icon(asset, 24)}<span>${esc(label)}</span></button>`).join('')}</div></div>`;
}
function bookActions(ctx) {
  const book = currentBook(ctx), local = book.kind === 'local';
  const items = [['多选', 'go:multiselect', 'selected'], ['书籍信息', 'go:detail', local ? 'local' : 'saved'], ['编辑分组', 'open:group-select', 'default'], ['移除书架', 'open:book-removal', local ? 'local' : 'online']];
  return `<section class="lib-book-actions" role="dialog" aria-modal="true" aria-labelledby="book-actions-title"><div class="lib-book-action-handle-zone" aria-hidden="true"><div class="lib-handle"></div></div><header><h2 id="book-actions-title">书籍操作</h2><button class="lib-book-action-close" aria-label="关闭书籍操作" data-action="close">${icon('import_cancel', 18)}</button></header><div class="lib-book-action-content">${items.map(([label, action, target]) => forBook(destination(`<button class="lib-book-action-row" data-action="${esc(action)}"><span>${esc(label)}</span>${icon('rc_chevron_right', 17)}</button>`, target), book)).join('')}</div></section>`;
}
function groupSelect(v) {
  return simpleDialog('编辑分组', `<div class="lib-group-select"><div><span>分组</span>${button('清除', '', 'text', true)}</div>${chip('默认', true, '仅演示保存原默认分组的忙碌状态；Core confirmedCurrent才关闭弹窗，未确认保留原窗按receipt核对。', v === 'busy' || v === 'recovery' || v === 'continue', 'variant:busy')}${v === 'recovery' || v === 'continue' ? recoveryNotice('原分组操作尚待核对，已保留原内容', '核对分组', true, v === 'continue' ? '继续原分组操作' : '') : ''}</div>`, '', 'lib-group-dialog');
}
function importSelection(v) {
  const picking = v === 'picker';
  const information = v === 'selection-error' ? '导入未完成，请重试；已成功保存的书籍会保留' : '支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。';
  const pickerNote = '演示系统文件选择器打开期间的原选择窗；预览不打开真实文件，取消选择回同窗，异常回带未完成说明的选择窗。';
  return simpleDialog('导入本地书籍', `<button class="lib-import-select" data-action="variant:picker" data-action-note="${esc(pickerNote)}" ${picking ? 'disabled' : ''}><span>${icon('import_select_system', 20)}</span><strong>从系统文件中选择</strong><small>支持多选 TXT、EPUB、MOBI、AZW3</small><div class="lib-format-tags">${['TXT', 'EPUB', 'MOBI', 'AZW3'].map(x => `<i>${x}</i>`).join('')}</div></button><p class="lib-import-note">${icon('import_info', 13)}<span>${information}</span></p>`, `<button class="app-btn primary" data-action="variant:picker" data-action-note="${esc(pickerNote)}" ${picking ? 'disabled' : ''}>${icon('import_choose_file', 15)}${picking ? '正在选择…' : '选择文件'}</button><button class="app-btn lib-import-cancel" data-action="close">${icon('import_cancel', 13)}取消</button>`, 'lib-import-dialog selection');
}
function importResult(v) {
  const failed = v === 'failed', partial = v === 'partial' || v === 'recovery', long = v === 'long-result';
  const rows = long ? Array.from({ length: 20 }, (_, i) => ({ file: `${f.title} ${i + 1}.txt`, result: '新增成功', ok: true })) : [{ file: `${f.title}.txt`, result: failed ? '失败' : '新增成功', ok: !failed }, { file: `${f.title}.epub`, result: failed ? '失败' : partial ? (v === 'recovery' ? '待确认' : '失败') : '已在书架', ok: !failed && !partial }];
  const title = failed ? '导入未完成' : v === 'recovery' ? '部分结果待确认' : partial ? '部分导入完成' : '导入完成';
  const count = long ? '20 本新增' : failed ? '2 本失败' : v === 'recovery' ? '1 本新增 · 1 本待确认' : partial ? '1 本新增 · 1 本失败' : '1 本新增 · 1 本已在书架';
  const summary = `<div class="lib-import-summary"><span class="lib-import-summary-icon ${failed || partial ? 'has-failure' : 'all-success'}">${icon(failed || partial ? 'import_summary' : 'import_success', 18)}</span><div><strong>${title}</strong><p>${count}</p></div>${icon('import_refresh', 18)}</div>`;
  const items = rows.map(x => `<div><span class="lib-import-doc-icon">${icon('import_doc', 16)}</span><section><strong>${esc(x.file)}</strong><small class="${x.ok ? 'ok' : ''}">${x.result}</small>${x.ok ? '' : `<p>${x.result === '待确认' ? '结果未确认，请重启后检查书架' : '文件读取失败，请重新选择'}</p>`}</section>${icon(x.ok ? 'import_success' : 'import_failure', 17)}</div>`).join('');
  return `<section class="app-dialog lib-import-dialog result" data-import-result><div class="lib-import-result-scroll" data-import-result-scroll><header class="dialog-title" data-import-header>导入结果</header><div class="lib-import-summary-slot" data-import-summary>${summary}</div><div class="lib-import-list-slot" data-import-list-slot><div class="lib-import-results" data-import-items>${items}</div></div></div><footer class="dialog-actions" data-import-footer>${v === 'recovery' ? recoveryNotice('导入结果尚待核对，已保留已确认的书籍', '刷新列表') : ''}<button class="app-btn primary" data-action="close">${icon('import_done', 14)}完成</button></footer></section>`;
}

function localImport(v) {
  if (v === 'selection' || v === 'selection-error' || v === 'picker') return importSelection(v);
  if (v === 'importing') return `<section class="app-dialog lib-importing"><div class="lib-import-spinner">${icon('importing_halo', 56)}${icon('importing_spinner_track', 32)}${icon('importing_spinner_arc', 32)}</div><h2>正在导入</h2><p>请稍候</p></section>`;
  return importResult(v);
}
function removal({ variant: v, choices = {}, ...ctx }) {
  const book = currentBook({ ...ctx, variant: v });
  const message = v === 'batch' ? `确定将已选择的 ${Number(choices['library-selected-count'] ?? 3)} 本书移出书架吗？本地原始文件不受影响。` : v === 'local' ? `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` : `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
  return simpleDialog('移除书架', `<p class="lib-removal-message">${esc(message)}</p>`, button('取消', 'close') + withAttrs(noteAction('移除', '原确认先关闭并只消费一次，再调用 Core；本预览不执行移除，真实失败先读回实际书架，已移除事实不能被刷新失败改写。', 'danger'), { 'data-dismiss-overlay': 'true' }), 'lib-removal-dialog');
}

export const screens = [
  { id: 'bookshelf', label: '书架', group, kind: 'page', source: [src('features/bookshelf/BookshelfShell.ets', 116), src('features/bookshelf/BookshelfShell.ets', 127), src('features/bookshelf/BookshelfShell.ets', 218), src('features/common/AppTopBar.ets', 37), src('features/bookshelf/BookshelfPage.ets', 389), src('features/bookshelf/BookshelfPage.ets', 900), src('features/bookshelf/BookshelfPage.ets', 854), src('features/bookshelf/BookshelfPage.ets', 1097), src('features/bookshelf/BookshelfEmptyCard.ets', 34), src('features/bookshelf/BookshelfEmptyPage.ets', 47), src('features/bookshelf/NoCoverCover.ets', 20), src('features/bookshelf/ShelfBookListDetails.ets', 18), src('pages/Index.ets', 4435), src('features/common/ReaderRecoveryNotice.ets', 14), src('features/common/ReaderRecoveryAction.ets', 14)], note: '当前 l0 书架。继续阅读卡只在已有可确认阅读记录时出现；显示方式读取/保存/恢复和移除receipt反馈复用原位恢复组件。封面/列表按钮演示同页投影，预览不写偏好。有书籍的宽屏书架使用已有侧栏；空/加载/失败保留底部导航。', variants: variants(['cover', '封面'], ['list', '列表'], ['filtered-cover', '小说 · 在线 · 筛选已收起'], ['filtered-list', '小说 · 在线 · 列表 · 筛选已收起'], ['no-continue', '有书 · 无阅读记录 · 封面'], ['no-continue-list', '有书 · 无阅读记录 · 列表'], ['empty', '空书架'], ['loading', '加载中'], ['error', '加载失败'], ['no-match', '筛选无匹配'], ['view-read-error', '显示方式读取失败'], ['view-save-error', '显示方式保存失败'], ['view-restore-pending', '恢复尚未完成'], ['remove-unknown', '原删除待核对'], ['remove-confirmed-cleanup', '原删除清理未完成'], ['shelf-refresh-pending', '确认结果后刷新未完成'], ['local-cleanup-warning', '本地EPUB文件清理未完成']), render: ctx => shelfPage(ctx, false) },
  { id: 'shelf-filter', label: '书架 · 筛选展开', group, kind: 'page', source: [src('features/bookshelf/BookshelfPage.ets', 636), src('features/bookshelf/BookshelfPage.ets', 660), src('features/bookshelf/BookshelfPage.ets', 686), src('features/bookshelf/BookshelfPage.ets', 761), src('features/bookshelf/BookshelfPage.ets', 1259)], note: '同一书架内展开 ListItem；不使用弹窗。内容类型与本地/在线来源条件独立，清除不改分组，切换封面/列表保留展开模块与当前条件。', variants: variants(['default', '全部 · 封面'], ['active', '小说 · 在线 · 封面'], ['default-list', '全部 · 列表'], ['active-list', '小说 · 在线 · 列表']), render: ctx => shelfPage(ctx, true) },
  { id: 'search', label: '搜索', group, kind: 'page', source: [src('features/search/SearchPage.ets', 416), src('features/search/SearchPage.ets', 555), src('features/search/SearchPage.ets', 713), src('features/search/SearchPage.ets', 753), src('features/search/SearchPage.ets', 535), src('features/search/SearchPage.ets', 543), src('features/search/SearchPage.ets', 852), src('features/search/SearchPage.ets', 976), src('features/search/SearchPage.ets', 1147), src('features/search/SearchPage.ets', 1227), src('features/search/SearchPage.ets', 1303), src('features/search/SearchPage.ets', 1391), src('features/common/ReaderControlSpecs.ets', 117), src('features/common/ReaderControlSpecs.ets', 247)], note: '本地与在线并行，结果流式呈现。停止及各分支失败留在原页；失败源与近期不可用而跳过的源分别可补偿重试。历史读取中/为空不伪造历史项。点击样本按本地已入架/在线未入架进入相应详情；预览不执行检索。当前 dirty 搜索源码包含于基线。', variants: variants(['initial', '最近搜索'], ['history-loading', '历史读取中'], ['idle', '无草稿 · 无搜索历史'], ['loading', '搜索中'], ['results', '搜索结果'], ['searching', '结果继续返回'], ['stopped-results', '停止后保留结果'], ['filtered-empty', '已返回结果 · 当前筛选无匹配'], ['partial-error', '书源列表失败 · 保留本地结果'], ['local-partial-error', '本地检索失败 · 保留在线结果'], ['failed-sources', '结果 · 部分书源失败'], ['skipped-sources', '结果 · 跳过近期不可用书源'], ['no-source', '未添加书源'], ['all-disabled', '无可搜索书源'], ['source-error', '书源读取失败'], ['empty', '无结果'], ['empty-partial-error', '无结果 · 部分书源失败'], ['stopped', '停止后无结果'], ['error', '书源搜索失败'], ['local-error', '本地检索未完成'], ['history-error', '历史读取失败'], ['history-clear-error', '历史清空失败']), render: searchPage },
  { id: 'detail', label: '书籍详情', group, kind: 'page', source: [src('features/bookshelf/LocalBookDetail.ets', 92), src('features/bookshelf/LocalBookDetail.ets', 132), src('features/bookshelf/LocalBookDetail.ets', 195), src('features/bookshelf/LocalBookDetail.ets', 237), src('features/bookshelf/LocalBookDetail.ets', 255), src('features/bookshelf/LocalBookDetail.ets', 293), src('features/bookshelf/LocalBookDetail.ets', 328), src('features/bookshelf/LocalBookDetail.ets', 397), src('features/common/PageBackBar.ets', 32), src('pages/Index.ets', 1482), src('pages/Index.ets', 1525), src('pages/Index.ets', 4405)], note: '搜索点书或书架书籍信息进入，返回原入口。加入/取消期间禁用换源；移除期间读/目录/章节/书架按钮受保护。换源预览成功回目标详情，已入架成功进阅读；采集失败关窗转原阅读，提交失败留原窗。忙碌样本不代表 Core 已完成。', variants: variants(['saved', '在线 · 已在书架'], ['local', '本地书籍'], ['manga', '漫画 · 已有阅读位置'], ['manga-unread', '漫画 · 尚未开始'], ['preview', '在线 · 未在书架'], ['catalog-loading', '目录读取中'], ['catalog-empty', '空目录'], ['catalog-error', '目录未完成'], ['catalog-blocked', '目录无可读条目'], ['catalog-nonnavigable', '目录含不可读卷标题'], ['adding', '正在加入'], ['cancelling', '正在取消加入'], ['removing', '正在移除'], ['add-error', '加入未完成']), render: detailPage },
  { id: 'bookshelf-settings', label: '书架设置', group, kind: 'page', source: [src('features/bookshelf/BookshelfSettingsPage.ets', 88), src('features/bookshelf/BookshelfSettingsPage.ets', 75), src('features/bookshelf/BookshelfSettingsPage.ets', 143), src('features/common/PageBackBar.ets', 32), src('features/common/ReaderRecoveryNotice.ets', 14), src('features/common/ReaderRecoveryAction.ets', 14)], note: '从书架或设置进入，返回对应来源。显示方式乐观切换，保存失败回到已确认方式；错误原位可重试。', variants: variants(['cover', '封面'], ['list', '列表'], ['save-error', '显示方式保存失败'], ['auto-off', '自动检查关闭']), render: bookshelfSettings },
  { id: 'multiselect', closeBlockedVariants: ['removing'], label: '批量管理', group, kind: 'page', source: [src('features/bookshelf/BookshelfMultiSelectPage.ets', 55), src('features/bookshelf/BookshelfMultiSelectPage.ets', 48), src('features/bookshelf/BookshelfMultiSelectPage.ets', 250), src('features/bookshelf/BookshelfMultiSelectPage.ets', 298), src('features/bookshelf/ShelfBookListDetails.ets', 18), src('pages/Index.ets', 4353), src('pages/Index.ets', 4369)], note: '完整书架读入后才能选择及移除。原位正在移除；有效移除outcome返回书架，receipt未确认、刷新或清理未完成在原书架恢复组件承接。', variants: variants(['selected', '已选一本'], ['none', '未选择'], ['all', '全选'], ['list', '列表'], ['loading', '读取中'], ['removing', '移除中']), render: multiselectPage },
  { id: 'shelf-more', label: '书架更多', group, kind: 'overlay', background: 'bookshelf', scrim: 'transparent', source: [src('features/bookshelf/BookshelfMoreMenu.ets', 75), src('features/bookshelf/BookshelfMoreMenu.ets', 186), src('features/bookshelf/BookshelfMoreMenu.ets', 191), src('features/bookshelf/BookshelfMoreMenu.ets', 200), src('features/bookshelf/BookshelfShell.ets', 218)], note: '右上角更多按钮的锚定菜单，透明背景点击关闭。更新进度只改变同一菜单项，不新建更新状态页。', variants: variants(['default', '菜单'], ['updating', '手动检查中'], ['background', '自动检查中'], ['no-online', '没有在线书籍']), render: ({ variant }) => shelfMore(variant) },
  { id: 'book-actions', label: '书籍操作', group, kind: 'overlay', background: 'bookshelf', source: [src('features/bookshelf/BookshelfPage.ets', 327), src('features/bookshelf/BookshelfBookActionSheet.ets', 25), src('features/common/ReaderSheetActionList.ets', 41), src('features/common/ReaderSurfaceSpecs.ets', 311)], note: '样式按用户指定的旧漫画 demo 调整：底部面板、关闭按钮、平铺操作行与箭头；这是当前设计修改，原生应用尚未同步。保留实际四项操作，选择后先关闭，再进入目标；返回/取消不重开。在线/本地仅改变目标详情和移除说明。', variants: variants(['default', '在线书籍操作'], ['local', '本地书籍操作']), render: bookActions },
  { id: 'group-select', closeBlockedVariants: ['busy'], label: '编辑分组', group, kind: 'overlay', background: 'bookshelf', source: [src('features/bookshelf/BookshelfGroupSelector.ets', 16), src('pages/Index.ets', 1742), src('pages/Index.ets', 1760), src('pages/Index.ets', 1775), src('pages/Index.ets', 1824), src('features/common/ReaderRecoveryNotice.ets', 14), src('features/common/ReaderRecoveryAction.ets', 14)], note: '当前只有“默认”。清除禁用；保存成功关闭并刷新书架，confirmedCurrent才关闭；未确认留原窗核对分组，只有允许继续的原操作才提供继续原分组操作。', variants: variants(['default', '默认分组'], ['busy', '保存中'], ['recovery', '原分组待核对'], ['continue', '原分组允许继续']), render: ({ variant }) => groupSelect(variant) },
  { id: 'local-import', dismissable: false, label: '导入本地书籍', group, kind: 'overlay', background: 'bookshelf', source: [src('features/bookshelf/LocalImportDialog.ets', 100), src('features/bookshelf/LocalImportDialog.ets', 140), src('features/bookshelf/LocalImportDialog.ets', 267), src('features/bookshelf/LocalImportDialog.ets', 277), src('features/bookshelf/LocalImportDialog.ets', 291), src('features/bookshelf/LocalImportDialog.ets', 305), src('features/bookshelf/LocalImportDialog.ets', 315), src('features/bookshelf/LocalImportDialog.ets', 371), src('features/bookshelf/LocalImportDialog.ets', 518), src('features/bookshelf/LocalImportLayout.ts', 13)], note: '原居中弹窗承接选择、导入与逐文件结果。选择/批次异常回原选择窗的信息行，已保存书保留；逐文件全部失败则仍是结果窗口。结果由外部样本切换，refresh 图标无动作；文件多时使用实测列表预算，compact共享内容滚动但完成动作独立。预览不打开真实 picker 或导入文件。', variants: variants(['selection', '选择文件'], ['selection-error', '异常后返回选择窗'], ['picker', '系统选择中'], ['importing', '正在导入'], ['result', '全部完成'], ['partial', '部分完成'], ['failed', '全部未完成'], ['recovery', '待确认'], ['long-result', '20个文件结果']), render: ({ variant }) => localImport(variant) },
  { id: 'book-removal', label: '移除书架确认', group, kind: 'overlay', background: 'detail', source: [src('features/bookshelf/BookRemovalDialog.ets', 24), src('features/bookshelf/BookRemovalDialog.ets', 46), src('pages/Index.ets', 4324), src('pages/Index.ets', 4353), src('pages/Index.ets', 4369), src('pages/Index.ets', 4435), src('features/common/ReaderRecoveryNotice.ets', 14), src('features/common/ReaderRecoveryAction.ets', 14)], note: '复用 ReaderDialogSurface 的 book-removal 规格。取消及移除两项，没有独立关闭图标或移除成功页；确认只消费一次。', variants: variants(['online', '在线书籍'], ['local', '本地书籍'], ['batch', '批量']), render: removal },
];
