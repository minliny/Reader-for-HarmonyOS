import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
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
check('real section settings callback opens the default selector without navigating to another settings surface', () => {
  const source = read('bookshelf/BookshelfPage.ets');
  const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const tree = ts.createSourceFile('BookshelfPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const callbacks = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'this.sectionAction' && node.arguments[0]?.text === 'bookshelf_settings') callbacks.push(node.arguments[1].getText(tree));
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(callbacks.length, 1);
  const page = { groupSelectorVisible: false, onManageRequested: () => assert.fail('unexpected CRUD route'), onBookshelfSettingsRequested: () => assert.fail('unexpected More settings route') };
  const callback = new Function(stripTypeScriptTypes(`const callback = ${callbacks[0]};`) + '; return callback;').call(page);
  callback(); assert.equal(page.groupSelectorVisible, true);
  callback(); assert.equal(page.groupSelectorVisible, false);
});
const list = read('bookshelf/ShelfBookListDetails.ets').replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
check('source owns remaining row width and progress retains intrinsic width at trailing edge', () => {
  const { owner } = createReaderBuilderProbe(list, ['shelfDetails', 'statusPill'], { ShelfBookPresentation: Projection, Blank: stub('Blank') });
  owner.book = { title: '书名', author: '', sourceId: 'online', sourceName: '非常长的实际书源名称', lastChapter: '最新章节', readProgress: 8765 };
  owner.appThemeScheme = 'day'; owner.shelfDetails();
  const nodes = texts(owner), source = nodes.find(n => n.create === '非常长的实际书源名称'), progress = nodes.find(n => n.create === '已读 87%');
  assert.equal(source.layoutWeight, 1); assert.equal(progress.layoutWeight, 0);
  assert.equal(progress.flexShrink, 0); assert.equal(source.flexShrink, 1);
  assert.equal(progress.textAlign, 'TextAlign.Center'); assert.equal(source.textAlign, 'TextAlign.Start');
  assert.equal(source.maxLines, 1); assert.equal(source.textOverflow.overflow, 'TextOverflow.Ellipsis');
  assert.equal(nodes[1].constraintSize.minHeight, 15, 'empty author keeps its independent second line');
});

const detailSource = read('bookshelf/LocalBookDetail.ets');
for (const scheme of ['day', 'night']) {
  check(`${scheme}: detail metadata shares source typography, label and moving source action`, () => {
    const { owner } = createReaderBuilderProbe(detailSource, ['heroCard'], { NoCoverCover: Child, ImageFit: { Cover: 'Cover' } });
    Object.assign(owner, { appThemeScheme: scheme, book: { title: '书名', author: '作者名', sourceName: '短书源', lastChapter: '最新章节', coverUrl: 'https://example.test/cover' },
      hasCover: () => true, contentWidth: () => 326, sourceSwitchEnabled: true });
    owner.heroCard();
    const nodes = texts(owner);
    assert.ok(nodes.some(n => n.create === '作者：作者名'));
    const metadata = ['最新：最新章节', '书源：短书源', '分组：默认'].map(label => nodes.find(n => n.create === label));
    assert.ok(metadata.every(Boolean));
    for (const node of metadata) assert.deepEqual([node.fontFamily, node.fontWeight, node.fontSize, node.lineHeight, node.height], ['ReaderInter', 'FontWeight.Bold', 12, 15, 18]);
    const source = metadata[1]; assert.equal(source.width, undefined); assert.equal(source.flexShrink, 1);
    assert.equal(source.textOverflow.overflow, 'TextOverflow.Ellipsis');
    const action = nodes.find(n => n.create === '更换书源');
    assert.deepEqual([action.width, action.height, action.textAlign, action.maxLines], ['100%', '100%', 'TextAlign.Center', 1]);
    assert.equal(action.padding, undefined, 'the 52vp button must not lose 16vp to text padding');
    const hit = [...owner.nodes.values()].find(n => n.type === 'Stack' && n.width === 52);
    assert.equal(hit.flexShrink, 0); assert.equal(hit.height, 18);
    let switches = 0; owner.onSwitchSource = () => switches++;
    hit.onClick(); assert.equal(switches, 1);
    owner.sourceSwitchEnabled = false; owner.replay(); hit.onClick(); assert.equal(switches, 1, 'local action stays disabled');
    owner.book = { ...owner.book, sourceName: '非常长的实际名称'.repeat(20) }; owner.replay();
    assert.equal(texts(owner).find(n => String(n.create).startsWith('书源：')).width, undefined);
  });
}
check('PH46/47 original author typography and the entire five-line block align with the cover', () => {
  const { owner } = createReaderBuilderProbe(detailSource, ['heroCard'], { NoCoverCover: Child, ImageFit: { Cover: 'Cover' } });
  Object.assign(owner, { appThemeScheme:'day', book:{title:'Title',author:'Author',sourceName:'Source',lastChapter:'Chapter',coverUrl:'https://example.test/cover'},
    hasCover:()=>true,contentWidth:()=>326,sourceSwitchEnabled:true });
  owner.heroCard();
  const nodes=[...owner.nodes.values()];
  const cover=nodes.find(n=>n.type==='Image');
  const column=nodes.find(n=>n.type==='Column'&&n.layoutWeight===1);
  assert.equal(cover.height,122); assert.equal(column.height,cover.height);
  assert.equal(column.justifyContent,'FlexAlign.SpaceBetween');
  const title=nodes.find(n=>n.type==='Text'&&n.create==='Title');
  const author=nodes.find(n=>n.type==='Text'&&String(n.create).endsWith('Author'));
  assert.deepEqual([author.fontFamily,author.fontWeight,author.fontSize,author.lineHeight,author.height],
    ['ReaderInter','FontWeight.Regular',13,17.55,17.55]);
  assert.equal(author.fontColor,readerAppColor('TOK_MUTED','day'));
  assert.equal(author.margin,undefined);
  assert.equal(title.height,25.96);
  assert.equal(nodes.find(n=>n.type==='Row'&&n.width===326).height,152);
  const gap=(column.height-title.height-author.height-3*18)/4;
  assert.ok(gap>6&&gap<6.2,'five fixed line slots leave positive uniform space between');
});

check('missing synopsis is explained without contaminating the metadata projection', () => {
  const { owner } = createReaderBuilderProbe(detailSource, ['summaryCard', 'displayIntro'], { bookIntroText });
  Object.assign(owner, { appThemeScheme: 'day', book: Object.freeze({ intro: '' }), contentWidth: () => 326,
    summaryHeight: () => 120.313, summaryTextHeight: () => 64.313, usesWideContent: () => false });
  owner.summaryCard(); assert.ok(texts(owner).some(n => n.create === '暂无简介'));
  assert.equal(owner.displayIntro(), ''); assert.equal(owner.book.intro, '');
  owner.book = { intro: '真实简介' }; owner.replay(); assert.ok(texts(owner).some(n => n.create === '真实简介'));
});
for (const [message, reason, expected] of [['', '', '暂无章节信息'], ['正在读取本地目录…', '', '正在读取本地目录…'], ['', '目录读取失败，请重试', '目录读取失败，请重试']]) {
  check(`empty chapters expose status: ${expected}`, () => {
    const names = ['chapterSection', 'chapterRow'];
    if (detailSource.includes('private chapterEmptyMessage(')) names.push('chapterEmptyMessage');
    const { owner } = createReaderBuilderProbe(detailSource, names, { CHAPTER_SECTION_HEIGHT: 282, ButtonType: { Normal: 'Normal' } });
    Object.assign(owner, { appThemeScheme: 'day', toc: [], loadingMessage: message, readingEnabled: false, readingBlockedReason: reason,
      visibleToc: () => [], contentWidth: () => 326, readingActionsReady: () => false });
    owner.chapterSection(); assert.ok(texts(owner).some(n => n.create === expected));
    assert.equal([...owner.nodes.values()].find(n => n.width === 94 && n.height === 44).enabled, false);
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
