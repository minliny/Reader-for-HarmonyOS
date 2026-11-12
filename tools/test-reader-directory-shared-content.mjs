import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({toolbar:{description:'Actual retained toolbar state and action callbacks',resources:[]},'row-actions':{description:'Actual chapter row selection, marker, download and hierarchy admission',resources:[]},'control-forwarding':{description:'Actual control wrapper forwards live callbacks and row identity',resources:[]}});
async function run(id){
const { resolveEtsLoaderRoot }=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { createRequire }=await import('node:module');
const { createReaderBuilderProbe }=await import('./lib/reader-control-builder-probe.mjs');
const { readerDirectoryBookmarkMarkerState }=await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts');
const { readerAppColor }=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { readerDirectoryAccessibilityText, readerDirectoryIndentVp }=await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const {readerFoundationTokens}=await import('./lib/reader-tokens-probe.mjs');
const {TOK_SPACE_CONTROL_INLINE}=readerFoundationTokens;

const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/ui/${name}.ets`, import.meta.url), 'utf8');
const toolbarSource = read('ReaderDirectoryToolbar');
const toolbarMembers=['build','searchRow','tool','toolLabel','iconSize'];
const toolbarDeps={ReaderSearchField:Child,TOK_SPACE_CONTROL_INLINE,
  READER_DIRECTORY_TOOLBAR_HEIGHT:Number(/export const READER_DIRECTORY_TOOLBAR_HEIGHT\s*=\s*(\d+)/.exec(toolbarSource)[1])};
const rowSource = read('ReaderDirectoryChapterRow');
const controlSource = read('ReaderControlDirectoryContent');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
for (const [name, props] of [
  ['ReaderSearchField', ['variant', 'mode', 'text', 'placeholder', 'accessibilityLabel']],
  ['ReaderDirectoryToolbar', ['text', 'placeholder', 'ascending', 'showChapterTools']],
  ['ReaderDirectoryChapterRow', ['entry', 'rowHeight', 'currentChapterIndex', 'chapterDownloadEnabled', 'chapterStartBookmarkCreationEnabled']],
]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(props));
}
function Child(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
const nodes = owner => [...owner.nodes.values()];
const action = (owner, label) => nodes(owner).find(node => node.accessibilityText === label);
const entry = { index: 21, title: '第二十二章', navigable: true, downloadState: 'missing', bookmarks: [] };

if(id==='toolbar'){
// Real SDK-emitted toolbar nodes and callbacks, including the shared search field boundary.
for (const scheme of ['day', 'night']) for (const showChapterTools of [true, false]) {
  const calls = [];
  const owner = createReaderBuilderProbe(toolbarSource, toolbarMembers, toolbarDeps).owner;
  Object.assign(owner, { appThemeScheme: scheme, text: '章节', placeholder: showChapterTools ? '搜索章节名称' : '搜索书签内容',
    variant:'standard', ascending: true, showChapterTools, onTextChange: value => calls.push(['text', value]),
    onSearch: () => calls.push(['search']), onTop: () => calls.push(['top']), onBottom: () => calls.push(['bottom']),
    onToggleSort: () => calls.push(['sort']) });
  owner.initialRender();
  const field = [...owner.children.values()][0];
  assert.equal(field.params.variant, 'readerDirectory');
  assert.equal(field.params.mode, 'submit');
  assert.equal(field.params.text, '章节');
  assert.equal(field.params.placeholder, owner.placeholder);
  field.params.onTextChange('新查询'); field.params.onSubmit();
  const labels = nodes(owner).filter(node => node.onClick).map(node => node.accessibilityText);
  assert.deepEqual(labels, showChapterTools ? ['搜索', '到顶部', '到底部', '切换排序'] : ['搜索']);
  for (const label of labels) {
    const button = action(owner, label);
    assert.equal(button.type,'Button');
    assert.deepEqual([button.width, button.height, button.borderRadius], [32, 32, 8]);
    assert.equal(button.backgroundColor, readerAppColor('TOK_SURFACE_PANEL_SOFT', scheme));
    button.onClick();
  }
  assert.deepEqual(calls, [['text', '新查询'], ['search'], ['search'], ...(showChapterTools ? [['top'], ['bottom'], ['sort']] : [])]);
  owner.text = '更新后的查询'; owner.ascending = false; owner.replay();
  assert.equal(field.params.text, '更新后的查询', 'existing search field receives new owner state');
  if(showChapterTools){
    // This finite probe retains existing branches; a new owner checks the alternate
    // native image branch without pretending to model ArkUI branch removal.
    const descending=createReaderBuilderProbe(toolbarSource,toolbarMembers,toolbarDeps).owner;
    Object.assign(descending,{appThemeScheme:scheme,text:'',placeholder:'搜索章节名称',ascending:false,showChapterTools:true,
      variant:'standard',
      onTextChange(){},onSearch(){},onTop(){},onBottom(){},onToggleSort(){}});descending.initialRender();
    assert.ok(nodes(descending).some(node=>node.type==='Image'&&node.create===`app.media.reader_directory_sort_descending${scheme==='night'?'_theme_night':''}`));
  }
  const root = nodes(owner).find(node => node.type === 'Row' && node.height === 50);
  assert.deepEqual(root.padding, { left: 10, right: 10, top: 9 });
}


}else if(id==='row-actions'){
function row(overrides = {}, scheme = 'day') {
  const calls = [];
  const owner = createReaderBuilderProbe(rowSource, ['build', 'chapterTitle', 'marker', 'bookmarkActionEnabled', 'bookmarkActionLabel',
    'downloadActionEnabled', 'downloadActionLabel'],
    { readerDirectoryBookmarkMarkerState, readerDirectoryAccessibilityText, readerDirectoryIndentVp }).owner;
  Object.assign(owner, { appThemeScheme: scheme, entry: { ...entry }, rowHeight: 40, currentChapterIndex: -1,
    chapterDownloadEnabled: true, chapterStartBookmarkCreationEnabled: true,
    onSelectChapter: index => calls.push(['select', index]), onDownloadChapter: index => calls.push(['download', index]),
    onDeleteBookmarks: times => calls.push(['delete', times]), onCreateChapterStartBookmark: request => calls.push(['create', request]),
    ...overrides });
  owner.initialRender(); return { owner, calls };
}
for (const scheme of ['day', 'night']) {
  const { owner, calls } = row({}, scheme);
  assert.equal(action(owner, '下载章节').type,'Button');
  assert.equal(action(owner, '添加本章章首书签').type,'Button');
  action(owner, '打开章节：第二十二章').onClick(); action(owner, '下载章节').onClick();
  action(owner, '添加本章章首书签').onClick();
  assert.deepEqual(calls, [['select', 21], ['download', 21], ['create', { chapterIndex: 21, chapterTitle: '第二十二章' }]]);
  const text = nodes(owner).find(node => node.type === 'Text');
  assert.deepEqual([text.fontFamily, text.fontSize, text.fontWeight], [readerTypographyRoles.TYPE_READER_DIRECTORY_TITLE.fontFamily, readerTypographyRoles.TYPE_READER_DIRECTORY_TITLE.fontSizeFp, readerTypographyRoles.TYPE_READER_DIRECTORY_TITLE.fontWeight]);
  assert.equal(text.fontColor, readerAppColor('TOK_READ_INK', scheme));
  assert.ok(nodes(owner).some(node => node.type === 'Image' && node.create ===
    `app.media.reader_directory_marker_download${scheme === 'night' ? '_theme_night' : ''}`));
  owner.entry = { ...entry, index: 33, title: '另一个章节' }; owner.rowHeight = 32; owner.replay();
  action(owner, '打开章节：另一个章节').onClick();
  assert.deepEqual(calls.at(-1), ['select', 33], 'retained row callback uses the current chapter');
  assert.ok(nodes(owner).filter(node => node.height !== undefined).every(node => [32, 15].includes(node.height)));
}
{
  const nested = row({ entry: { ...entry, level: 3 } });
  assert.ok(action(nested.owner, '第3级，打开章节：第二十二章'));
  assert.equal(nodes(nested.owner).find(node => node.type === 'Text').padding.left, 33);
  const deep = row({ entry: { ...entry, level: 9, navigable: false } });
  assert.ok(action(deep.owner, '第9级，卷标题：第二十二章'));
  assert.equal(nodes(deep.owner).find(node => node.type === 'Text').padding.left, 45,
    'visual indentation is capped in the compact reader control');
}
for (const [state, label, enabled] of [
  ['missing', '下载章节', true], ['cached', '正文已缓存，补齐离线资源', true],
  ['failed', '下载失败，点按重试', true], ['cancelled', '下载已取消，点按重试', true],
  ['queued', '等待下载', false], ['paused', '下载已暂停', false],
  ['inProgress', '下载中', false], ['completed', '已下载', false],
]) {
  const { owner, calls } = row({ entry: { ...entry, downloadState: state } });
  const button = action(owner, label);
  assert.equal(button.enabled, enabled);
  button.onClick();
  assert.deepEqual(calls, enabled ? [['download', entry.index]] : []);
}
{
  const { owner, calls } = row();
  const previousDownload = action(owner, '下载章节').onClick;
  owner.entry = { ...entry, downloadState: 'queued' };
  previousDownload();
  assert.deepEqual(calls, [], 'a retained marker cannot repeat a now-queued download');
  const unknown = row({ entry: { ...entry, downloadState: 'unknown' } });
  assert.equal(action(unknown.owner, '下载章节'), undefined);
}
{
  const { owner, calls } = row({ entry: { ...entry, navigable: false } });
  assert.equal(action(owner, '卷标题：第二十二章').enabled, false);
  action(owner, '卷标题：第二十二章').onClick();
  assert.deepEqual(calls, []); assert.equal(action(owner, '下载章节'), undefined);
  assert.equal(action(owner, '添加本章章首书签'), undefined);
}
{
  const unknown = row({ entry: { ...entry, bookmarks: undefined }, chapterDownloadEnabled: false });
  assert.equal(action(unknown.owner, '添加本章章首书签'), undefined); assert.equal(action(unknown.owner, '下载章节'), undefined);
  const disabled = row({ chapterStartBookmarkCreationEnabled: false });
  const marker = action(disabled.owner, '当前章节不支持添加书签');
  assert.equal(marker.enabled, false);
  marker.onClick(); assert.deepEqual(disabled.calls, []);
  const marked = row({ entry: { ...entry, bookmarks: [{ time: 17 }, { time: 42 }] }, chapterStartBookmarkCreationEnabled: false,
    currentChapterIndex: entry.index });
  action(marked.owner, '删除本章已有书签').onClick(); assert.deepEqual(marked.calls, [['delete', [17, 42]]]);
  assert.ok(nodes(marked.owner).some(node => node.backgroundColor === readerAppColor('TOK_READ_ACTIVE_SOFT', 'day')));
}


}else{
// Execute the actual control wrappers. Motion wrappers and the native List stay owned by the control.
{
  const calls = [];
  const owner = createReaderBuilderProbe(controlSource, ['directoryToolbar', 'chapterRow'],
    { ReaderDirectoryToolbar: Child, ReaderDirectoryChapterRow: Child, Edge: { Top: 'top', Bottom: 'bottom' } }).owner;
  Object.assign(owner, { appThemeScheme: 'day', draft: '已有搜索', ascending: true, tab: 'directory', availableWidth: 338,
    progress: 1, placeholder: () => '搜索章节名称', value: (quick, full) => full,
    search: () => calls.push('search'), sort: () => calls.push('sort'), userScroll: () => calls.push('user'),
    scrollCatalogEdge: bottom => { calls.push('user', bottom ? 'bottom' : 'top'); },
    scroller: { scrollEdge: edge => calls.push(edge) }, rowHeight: () => 40, currentChapterIndex: 21,
    chapterDownloadEnabled: true, chapterStartBookmarkCreationEnabled: true,
    onSelectChapter: index => calls.push(['select', index]), onDownloadChapter: index => calls.push(['download', index]),
    onDeleteBookmarks: times => calls.push(['delete', times]), onCreateChapterStartBookmark: request => calls.push(['create', request]) });
  owner.directoryToolbar(); owner.chapterRow(entry);
  const [toolbar, chapter] = [...owner.children.values()].map(child => child.params);
  toolbar.onTextChange('新搜索'); assert.equal(owner.draft, '新搜索'); toolbar.onSearch(); toolbar.onTop(); toolbar.onBottom(); toolbar.onToggleSort();
  assert.deepEqual(calls, ['search', 'user', 'top', 'user', 'bottom', 'sort']);
  chapter.onSelectChapter(21); chapter.onDownloadChapter(21); chapter.onDeleteBookmarks([17]);
  chapter.onCreateChapterStartBookmark({ chapterIndex: 21, chapterTitle: entry.title });
  assert.deepEqual(calls.slice(6), [['select', 21], ['download', 21], ['delete', [17]], ['create', { chapterIndex: 21, chapterTitle: entry.title }]]);
  assert.equal(chapter.entry, entry); assert.equal(chapter.rowHeight, 40);
  const divider = nodes(owner).find(node => node.height === 1);
  assert.deepEqual(divider.position, { x: 0, y: 51 }); assert.equal(divider.opacity, 1);
}

}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
