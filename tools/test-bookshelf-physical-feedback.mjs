import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { readerSourceCategoryLabel } from '../entry/src/main/ets/features/source/ReaderSourceCategory.ts';

const baseline = process.argv.includes('--baseline');
const read = name => readFileSync(new URL(baseline
  ? `../evidence/2026-09-14-physical-review/${name.split('/').at(-1)}.before`
  : `../entry/src/main/ets/features/${name}`, import.meta.url), 'utf8');
const results = [];
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
for (const name of ['NoCoverCover', 'StatusBadge', 'ReaderToggle']) syntax.componentCollection.customComponents.add(name);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const check = (name, action) => {
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, message: error.message }); }
};
const texts = owner => [...owner.nodes.values()].filter(node => node.type === 'Text');
const stub = name => new Proxy({ name }, { get: (target, key) => key === 'name' ? target.name : () => {} });
const projectionSource = stripTypeScriptTypes(read('bookshelf/ShelfBookPresentation.ts'))
  .replace(/^import .*$/mg, '').replace('export class ', 'class ');
const Projection = new Function(`${projectionSource}; return ShelfBookPresentation;`)();
check('TXT uses format identity without changing Core metadata', () => {
  for (const kind of ['local', 'txt', 'TXT']) {
    const book = Object.freeze({ sourceId: 'local', kind });
    assert.equal(Projection.source(book), '本地 TXT'); assert.equal(book.kind, kind);
  }
  assert.equal(Projection.source({ sourceId: 'local', kind: 'EPUB' }), '本地 EPUB');
  assert.equal(Projection.source({ sourceId: 'local' }), '本地书');
});
check('default group retains empty and explicit default identities without mutating legacy groups', () => {
  const rows = [undefined, '', '默认', '历史分组'].map((group, i) => Object.freeze({ sourceId: 'local', bookId: `b${i}`, group }));
  assert.deepEqual(Projection.visible(rows, '默认'), rows.slice(0, 3));
  assert.deepEqual(Projection.visible(rows, '历史分组'), rows.slice(3));
  assert.deepEqual(Projection.visible(rows, ''), rows);
  assert.equal(rows[3].group, '历史分组');
});
check('three remaining section actions preserve the filter toggle without entering settings or groups', () => {
  const source = read('bookshelf/BookshelfPage.ets');
  const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const tree = ts.createSourceFile('BookshelfPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const callbacks = new Map();
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'this.sectionAction') callbacks.set(node.arguments[0]?.text,node.arguments[1].getText(tree));
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.deepEqual([...callbacks.keys()],['bookshelf_grid','bookshelf_list','bookshelf_filter']);
  const page = { filterRowVisible: false, onManageRequested: () => assert.fail('unexpected CRUD route'), onBookshelfSettingsRequested: () => assert.fail('unexpected More settings route') };
  const callback = new Function(stripTypeScriptTypes(`const callback = ${callbacks.get('bookshelf_filter')};`) + '; return callback;').call(page);
  callback(); assert.equal(page.filterRowVisible, true);
  callback(); assert.equal(page.filterRowVisible, false);
});
check('empty shelf uses the same right-aligned three-action header', () => {
  const source = read('bookshelf/BookshelfEmptyPage.ets');
  const { owner } = createReaderBuilderProbe(source, ['sectionHeader','headerAction','headerActionAsset']);
  Object.assign(owner,{appThemeScheme:'day',contentFrame:()=>({width:352})});
  owner.sectionHeader();
  const nodes=[...owner.nodes.values()];
  assert.deepEqual(nodes.filter(node=>node.type==='Image').map(node=>node.create),
    ['app.media.bookshelf_grid_outline','app.media.bookshelf_list','app.media.bookshelf_filter']);
  assert.equal(texts(owner).find(node=>node.create==='我的书架').layoutWeight,1,
    'the title consumes free space and keeps the remaining actions against the right edge');
  const actions=nodes.filter(node=>node.type==='Stack');
  assert.deepEqual(actions.map(node=>[node.width,node.height]),[[34,34],[34,34],[34,34]]);
  assert.equal(nodes.find(node=>node.type==='Row'&&node.height===34).width,undefined,
    'the tools shrink to their content without reserving the removed gear slot');
});
const list = read('bookshelf/ShelfBookListDetails.ets').replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
check('compact shelf keeps two tags and live independent progress after row reuse', () => {
  const { owner } = createReaderBuilderProbe(list, ['shelfDetails', 'metadataTag', 'positionLabel'], { ShelfBookPresentation: Projection, Blank: stub('Blank') });
  owner.book = { title: '书名', author: '', sourceId: 'online', sourceName: '非常长的实际书源名称', lastChapter: '最新章节', readProgress: 8765 };
  owner.appThemeScheme = 'day'; owner.mangaRevision=0; owner.shelfDetails();
  const nodes = texts(owner), progress = nodes.find(n => n.create === '已读 87%');
  assert.ok(progress); assert.equal(progress.fontSize,11);assert.equal(progress.lineHeight,14);
  const author=nodes.find(n=>n.create==='');assert.equal(author.constraintSize.minHeight,14,'empty author retains its own compact line');
  assert.deepEqual(nodes.filter(n=>n.height===16).map(n=>n.create),['小说','在线']);
  const bar = [...owner.nodes.values()].find(n => n.type === 'Progress');
  assert.equal(bar.create.value, 87.65); assert.equal(bar.create.total, 100);assert.equal(bar.height,3);
  assert.equal(bar.style.enableSmoothEffect, false, 'list recycling must not restart a progress animation');
  for (const [input, percent, label] of [[0, 0, '未读'], [1, .01, '已读 <1%'], [10000, 100, '已读 100%'], [12000, 100, '已读 100%'], [-1, 0, '未读'], [NaN, 0, '未读']]) {
    owner.book = { ...owner.book, sourceName: `源${input}`, readProgress: input }; owner.replay();
    assert.equal(bar.create.value, percent);
    assert.ok(texts(owner).some(n => n.create === label));
    assert.deepEqual(texts(owner).filter(n=>n.height===16).map(n=>n.create),['小说','在线'],'changing source name does not create a third metadata tag');
  }
});

const detailSource = read('bookshelf/LocalBookDetail.ets');
check('detail preview retains at most 20 Core identities in the outer scroll and volume rows only fold', () => {
  for (const count of [0, 3, 20, 40]) {
    const { owner } = createReaderBuilderProbe(detailSource,
      ['catalog', 'chapterRow', 'visibleToc', 'chapterEmptyMessage', 'chapterIndent','isCurrentChapter'], { CHAPTER_PREVIEW_LIMIT:20 });
    const toc = Array.from({ length: count }, (_, offset) => ({ index: 7 + offset * 3,
      title: `第${offset + 1}章`, navigable: offset !== 1 }));
    const selected = [];let directories = 0;
    Object.assign(owner, { appThemeScheme: 'day', book: { sourceId: 'source', bookId: 'book' },removing:false,collapsedGroups:[],
      toc, loadingMessage: '', readingBlockedReason: '',onSelectChapter: index => selected.push(index),onOpenDirectory:()=>directories++ });
    owner.catalog();
    const nodes = [...owner.nodes.values()], chapterTexts = texts(owner).filter(node => /^第\d+章$/.test(node.create));
    assert.equal(chapterTexts.length, Math.min(count, 20));assert.deepEqual(owner.visibleToc(), toc.slice(0,20));
    chapterTexts.forEach((node,index)=>assert.deepEqual([node.fontSize,node.fontWeight],[14,toc[index].navigable===false?'FontWeight.Medium':'FontWeight.Regular']));
    assert.equal(nodes.filter(node=>node.type==='Scroll').length,0,'preview remains in the outer page scroll');
    const directory=texts(owner).find(node=>node.create==='完整目录');
    const directoryTarget=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width===94&&node.height===44);
    assert.equal(directoryTarget.enabled,true);
    directoryTarget.onClick();assert.equal(directories,1);assert.deepEqual(selected,[]);
    const rows=nodes.filter(node=>node.type==='Row'&&node.onClick&&node.constraintSize?.minHeight);
    assert.equal(rows.length,Math.min(count,20));
    if(rows.length) {
      rows.at(-1).onClick();assert.deepEqual(selected,[toc[Math.min(count,20)-1].index],'display retains sparse Core indices');
      rows[1].onClick();assert.equal(selected.length,1,'volume row folds without navigating');assert.deepEqual(owner.collapsedGroups,[toc[1].index]);
    }
    owner.removing=true;owner.replay();
    const disabledDirectory=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width===94&&node.height===44);
    disabledDirectory.onClick();assert.equal(disabledDirectory.enabled,false);assert.equal(directories,1);
    if(rows.length){rows[0].onClick();assert.equal(selected.length,1);}
  }
});
for(const scheme of ['day','night']) {
  check(`${scheme}: current source and author facts remain exact while the source action follows permission`,()=>{
    const {owner}=createReaderBuilderProbe(detailSource,['hero','metadataTag','readingFacts'],{bookAuthorLabel,NoCoverCover:Child,ImageFit:{Cover:'Cover'}});
    Object.assign(owner,{appThemeScheme:scheme,book:{sourceId:'source',title:'书名',author:'作者名',sourceName:'短书源',lastChapter:'最新章节',coverUrl:'https://example.test/cover'},hasCover:()=>true,sourceSwitchEnabled:true});
    owner.hero();owner.readingFacts();
    assert.ok(texts(owner).some(n=>n.create==='作者名'));
    const source=texts(owner).find(n=>n.create==='当前来源：短书源');assert.equal(source.layoutWeight,1);assert.equal(source.constraintSize.minWidth,0);
    assert.equal(source.maxLines,1);assert.equal(source.textOverflow.overflow,'TextOverflow.Ellipsis');
    const action=texts(owner).find(n=>n.create==='换源');assert.equal(action.height,32);
    let switches=0;owner.onSwitchSource=()=>switches++;action.onClick();assert.equal(switches,1);
    owner.sourceSwitchEnabled=false;action.onClick();assert.equal(switches,1,'a retained source callback cannot bypass revoked permission');
    owner.book={...owner.book,sourceName:'非常长的实际名称'.repeat(20)};owner.replay();
    assert.equal(texts(owner).find(n=>String(n.create).startsWith('当前来源：')).layoutWeight,1);
    for(const author of ['作者：关关公子','浅草茉莉\n进入作者主页 →']) {
      const raw={...owner.book,author};owner.book=raw;owner.replay();
      assert.ok(texts(owner).some(n=>n.create===bookAuthorLabel(author)));assert.equal(raw.author,author,'presentation cannot rewrite source metadata');
    }
  });
}
check('detail cover and two-line title use the approved natural hero instead of a fixed five-line block',()=>{
  const {owner}=createReaderBuilderProbe(detailSource,['hero','metadataTag'],{bookAuthorLabel,NoCoverCover:Child,ImageFit:{Cover:'Cover'}});
  Object.assign(owner,{appThemeScheme:'day',book:{title:'Title',author:'Author',sourceName:'Source',lastChapter:'Chapter',coverUrl:'https://example.test/cover'},hasCover:()=>true});owner.hero();
  const nodes=[...owner.nodes.values()],cover=nodes.find(n=>n.type==='Image'),title=texts(owner).find(n=>n.create==='Title'),author=texts(owner).find(n=>n.create==='Author');
  assert.equal(cover.width,84);assert.equal(cover.height,122);
  assert.deepEqual([title.fontSize,title.lineHeight,title.maxLines],[24,34,2]);
  assert.deepEqual([author.fontFamily,author.fontSize,author.lineHeight],['ReaderNotoSansSC',13,20]);assert.equal(author.fontColor,readerAppColor('TOK_MUTED','day'));
  const hero=nodes.find(n=>n.type==='Row'&&n.constraintSize?.minHeight===122);assert.ok(hero);assert.equal(hero.height,undefined,'long titles can grow the hero instead of clipping');
});
check('missing synopsis is explained without contaminating metadata and expansion preserves content',()=>{
  const {owner}=createReaderBuilderProbe(detailSource,['summary','displayIntro'],{bookIntroText},{allowEmptyBranchAdmission:true});
  Object.assign(owner,{appThemeScheme:'day',book:Object.freeze({intro:''}),introExpanded:false});owner.summary();
  assert.ok(texts(owner).some(n=>n.create==='暂无简介'));assert.equal(owner.displayIntro(),'');assert.equal(owner.book.intro,'');
  owner.book={intro:'真实简介'};owner.replay();const intro=texts(owner).find(n=>n.create==='真实简介');assert.equal(intro.maxLines,3);
  const expand=texts(owner).find(n=>n.create==='展开');expand.onClick();owner.replay();assert.equal(owner.introExpanded,true);assert.equal(intro.maxLines,10000);assert.equal(owner.book.intro,'真实简介');
});
for(const [message,reason,expected] of [['','','暂无章节信息'],['正在读取本地目录…','','正在读取本地目录…'],['','目录读取失败，请重试','目录读取失败，请重试']]) {
  check(`empty chapters expose status: ${expected}`,()=>{
    const {owner}=createReaderBuilderProbe(detailSource,['catalog','chapterRow','chapterEmptyMessage'],{});
    Object.assign(owner,{appThemeScheme:'day',toc:[],loadingMessage:message,readingEnabled:false,readingBlockedReason:reason,visibleToc:()=>[],removing:false});owner.catalog();
    assert.ok(texts(owner).some(n=>n.create===expected));
    assert.equal([...owner.nodes.values()].find(n=>n.type==='Stack'&&n.width===94&&n.height===44).enabled,true,'directory recovery remains reachable');
  });
}
const sourcePage = read('source/SourceManagementPage.ets');
for (const loginUrl of [undefined, 'https://example.test/login']) {
  check(`source name/category/URL remain distinct and login precedes detect (${loginUrl ? 'login' : 'no login'})`, () => {
    const names = ['sourceRow', 'detectButton', 'loginButton', 'statusBadge', 'sourceSwitch'];
    if (sourcePage.includes('private sourceMeta(')) names.push('sourceMeta');
    const { owner } = createReaderBuilderProbe(sourcePage, names, { readerSourceCategoryLabel, StatusBadge: Child, ReaderToggle: Child });
    Object.assign(owner, { appThemeScheme: 'day', contentFrame: () => ({ width: 326 }), statusBadgeBackground() {}, statusBadgeDot() {} });
    const source = { sourceId: 'source', name: '实际书源名称', baseUrl: 'https://example.test/very/long/path', category: 'novel', enabled: true, loginUrl, checkState: 'failed', checkMessage: '检测失败，请重试' };
    let logins = 0, detects = 0;
    owner.onLoginSource = id => { assert.equal(id, source.sourceId); logins++; };
    owner.onDetectSource = id => { assert.equal(id, source.sourceId); detects++; };
    owner.sourceRow(source);
    const nodes = texts(owner), labels = nodes.map(n => n.create);
    assert.ok(labels.includes(source.baseUrl)); assert.ok(labels.includes(readerSourceCategoryLabel('novel')));
    assert.ok(labels.includes(source.checkMessage));
    assert.ok(labels.indexOf(readerSourceCategoryLabel('novel')) < labels.indexOf(source.baseUrl));
    const name = nodes.find(n => n.create === source.name), category = nodes.find(n => n.create === readerSourceCategoryLabel('novel'));
    assert.equal(name.flexShrink, 1); assert.equal(category.flexShrink, 0);
    assert.equal(name.maxLines, 1); assert.equal(name.textOverflow.overflow, 'TextOverflow.Ellipsis');
    const buttons = [...owner.nodes.values()].filter(n => n.type === 'Stack' && n.onClick);
    if (loginUrl) { assert.ok(labels.indexOf('登录') < labels.indexOf('检测')); buttons[0].onClick(); buttons[1].onClick(); assert.deepEqual([logins, detects], [1, 1]); }
    else { assert.ok(!labels.includes('登录')); buttons[0].onClick(); assert.deepEqual([logins, detects], [0, 1]); }
  });
}
check('single-book sheet matches cover frame and both layers have straight lower corners', () => {
  const shelf = read('bookshelf/BookshelfPage.ets'), sheet = read('bookshelf/BookshelfBookActionSheet.ets');
  const method = shelf.match(/private bookActionWidth\(\): number \{([\s\S]*?)\n  \}/)[1];
  const width = new Function('ReaderWindowCoordinator', 'readerVisualSafeLeft', 'readerVisualSafeRight', method);
  for (const available of [240, 326, 352, 630]) assert.equal(width.call({ shelfContentWidth: () => available, isWideViewport: () => available > 500,
    effectiveViewportWidth: () => available + 38 }, { metrics: () => ({}) }, () => 19, () => 19), available);
  assert.match(shelf, /radius: \{ topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 \}/);
  assert.match(sheet, /borderRadius\(\{ topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 \}\)/);
});
check('44vp source SVG stays 44vp in the single-book more action', () => {
  const shelf = read('bookshelf/BookshelfPage.ets');
  const body = shelf.slice(shelf.indexOf('private projectionListDetails('), shelf.indexOf('private presentBookActionSheet('));
  assert.match(body, /Image\([\s\S]*?\)\.width\(44\)\.height\(44\)/);
  assert.match(body, /\.width\(44\)\s*\.height\(44\)/);
});
const result = { source: baseline ? 'current-before-repair (9509 differences archived)' : 'current-after-repair', layer: 'SDK emitted builder attributes and production callbacks; no native layout pixels', results };
if (process.argv.includes('--record')) writeFileSync(process.argv[process.argv.indexOf('--record') + 1], JSON.stringify(result, null, 2) + '\n');
for (const row of results) console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.name}${row.message ? ': ' + row.message.split('\n')[0] : ''}`);
assert.equal(results.filter(row => !row.passed).length, 0, `${results.length} physical-feedback checks`);
