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
class HeaderChild extends Child {}
class IconButtonChild extends Child {}
const shelfTypography = {
  TYPE_SHELF_LIST_TITLE: { fontFamily: 'ReaderNotoSerifSCBold', fontWeight: 700, fontSizeFp: 15, lineHeightFp: 18.3, letterSpacingFp: 0 },
  TYPE_SHELF_LIST_AUTHOR: { fontFamily: 'ReaderNotoSansSCUIRegular', fontWeight: 400, fontSizeFp: 12, lineHeightFp: 15, letterSpacingFp: 0 },
  TYPE_SHELF_LIST_CHAPTER: { fontFamily: 'ReaderNotoSansSCUIRegular', fontWeight: 400, fontSizeFp: 11, lineHeightFp: 13.75, letterSpacingFp: 0 },
  TYPE_SHELF_LIST_STATUS: { fontFamily: 'ReaderNotoSansSCUIRegular', fontWeight: 400, fontSizeFp: 10, lineHeightFp: 12, letterSpacingFp: 0 },
};
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const [name, path, slot] of [
  ['AppTopBar', 'common/AppTopBar.ets', 'trailing'],
  ['ReaderIconButton', 'common/ReaderIconButton.ets'],
  ['MainTabShell', 'shell/MainTabShell.ets', 'content'],
  ['BookshelfEmptyCard', 'bookshelf/BookshelfEmptyCard.ets'],
  ['BookshelfMoreMenu', 'bookshelf/BookshelfMoreMenu.ets'],
]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...read(path).matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
  if (slot) syntax.builderParamObjectCollection.set(name, new Set([slot]));
}
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
for (const page of ['BookshelfShell']) {
  check(`${page}: actual shared text header keeps search and More hit targets live`, () => {
    const { owner } = createReaderBuilderProbe(read(`bookshelf/${page}.ets`), ['topBar'], {
      AppTopBar: HeaderChild, ReaderIconButton: IconButtonChild,
      ImageFit: { Contain: 'ImageFit.Contain' },
    });
    let searches = 0;
    Object.assign(owner, { appThemeScheme: 'day', moreMenuVisible: false,
      topBarLeftInset: () => 20, topBarRightInset: () => 20,
      onSearchRequested: () => { searches++; } });
    owner.topBar();
    const headers = [...owner.children.values()].filter(child => child instanceof HeaderChild);
    assert.equal(headers.length, 1, 'the persistent shelf shell mounts the real AppTopBar instead of a title bitmap');
    assert.equal(headers[0].params.title, '书架');
    assert.equal(headers[0].params.divider ?? false, false);
    assert.equal(typeof headers[0].params.trailing, 'function');
    const { owner: header } = createReaderBuilderProbe(read('common/AppTopBar.ets'), ['trailing', 'build'], {
      TYPE_APP_HOME_TITLE: { fontFamily: 'title-role', fontWeight: 700, fontSizeFp: 29, lineHeightFp: 38 },
    });
    Object.assign(header, headers[0].params, { appThemeScheme: 'day', leftInset: () => 20, rightInset: () => 20 });
    header.initialRender();
    const titles = texts(header).filter(node => node.create === '书架');
    assert.equal(titles.length, 1, 'one native text actor renders the shared title');
    assert.equal(titles[0].layoutWeight, 1);
    assert.equal(titles[0].fontFamily, 'title-role');
    const row = [...header.nodes.values()].find(node => node.type === 'Row');
    assert.deepEqual(row.padding, { left: 20, right: 20, top: 6 });
    assert.equal(row.height, 58);
    assert.equal(row.border.width.bottom, 0);
    for (const scheme of ['night', 'day']) {
      header.appThemeScheme = scheme; header.replay();
      assert.equal(texts(header).find(node => node.create === '书架'), titles[0], 'theme update retains the title actor');
      assert.equal(titles[0].fontColor, readerAppColor('TOK_INK', scheme));
      assert.equal(row.backgroundColor, 'Color.Transparent');
    }
    assert.ok(![...owner.nodes.values(), ...header.nodes.values()]
      .some(node => node.type === 'Image' && node.create === 'app.media.bookshelf_title'));

    const buttons = [...owner.children.values()].filter(child => child instanceof IconButtonChild);
    assert.equal(buttons.length, 2);
    for (const [index, button] of buttons.entries()) {
      assert.equal(button.params.icon, `app.media.bookshelf_${index === 0 ? 'search' : 'more'}`);
      const { owner: hitOwner } = createReaderBuilderProbe(read('common/ReaderIconButton.ets'), ['build']);
      Object.assign(hitOwner, button.params, { appThemeScheme: 'day' });
      hitOwner.initialRender();
      const hit = [...hitOwner.nodes.values()].find(node => node.type === 'Stack');
      assert.deepEqual([hit.width, hit.height], [44, 44]);
      hit.onClick();
      assert.equal(searches, 1, 'only the search target dispatches search');
      assert.equal(owner.moreMenuVisible, index === 1, 'only the More target opens the menu');
    }
  });
}
check('empty shelf actual Scroll pins short contents to the viewport top', () => {
  const source = read('bookshelf/BookshelfEmptyPage.ets');
  for (const m of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(m[1]);
  const { owner } = createReaderBuilderProbe(source, ['build'], {
    BookshelfEmptyCard: Child, TOK_SPACE_XS: 8, TOK_SPACE_MD: 16, READER_FLOATING_TOP_BAR_HEIGHT: 58,
  });
  Object.assign(owner, { appThemeScheme: 'day', moreMenuVisible: false,
    contentFrame: () => ({ width: 327, left: 19, right: 19 }), bottomContentInset: () => 99, topBar() {}, sectionHeader() {} });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.ok(scroll);
  assert.ok(['Alignment.Top', 'Alignment.TopStart'].includes(scroll.align),
    'native Scroll must explicitly avoid vertical centering when the empty card is shorter than its viewport');
  assert.equal(scroll.height, '100%', 'content extends behind the shared floating bars');
  assert.equal(nodes.find(node => node.type === 'Column' && node.width === 327).padding.bottom, 99,
    'scroll content clears the floating navigation without reducing its viewport');
  assert.equal(nodes.find(node => node.type === 'Column' && node.width === 327).padding.top, 66,
    'the actual empty content keeps its 8vp gap after clearing the floating 58vp header');
});
const list = read('bookshelf/ShelfBookListDetails.ets').replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
check('PH61 progress/source retain equal left/right slots and live progress after row reuse', () => {
  const { owner } = createReaderBuilderProbe(list, ['shelfDetails', 'statusPill'], { ShelfBookPresentation: Projection, Blank: stub('Blank'), ...shelfTypography });
  owner.book = { title: '书名', author: '', sourceId: 'online', sourceName: '非常长的实际书源名称', lastChapter: '最新章节', readProgress: 8765 };
  owner.appThemeScheme = 'day'; owner.shelfDetails();
  const nodes = texts(owner), source = nodes.find(n => n.create === '非常长的实际书源名称'), progress = nodes.find(n => n.create === '已读 87%');
  assert.ok(nodes.indexOf(progress) < nodes.indexOf(source));
  assert.equal(progress.textAlign, 'TextAlign.Start'); assert.equal(source.textAlign, 'TextAlign.Start');
  assert.equal(source.maxLines, 1); assert.equal(source.textOverflow.overflow, 'TextOverflow.Ellipsis');
  assert.equal(nodes[1].constraintSize.minHeight, 15, 'empty author keeps its independent second line');
  const slots = [...owner.nodes.values()].filter(n => n.type === 'Stack' && n.layoutWeight === 1);
  assert.equal(slots.length, 2);
  for (const slot of slots) {
    assert.equal(slot.constraintSize.minWidth, 0); assert.equal(slot.height, 18);
    assert.equal(slot.borderRadius, 9); assert.equal(slot.clip, true);
    assert.equal(slot.create.alignContent, 'Alignment.Start');
  }
  const bar = [...owner.nodes.values()].find(n => n.type === 'Progress');
  assert.equal(bar.create.value, 87.65); assert.equal(bar.create.total, 100);
  assert.equal(bar.style.enableSmoothEffect, false, 'list recycling must not restart a progress animation');
  for (const [input, percent, label] of [[0, 0, '未读'], [1, .01, '已读 <1%'], [10000, 100, '已读 100%'], [12000, 100, '已读 100%'], [-1, 0, '未读'], [NaN, 0, '未读']]) {
    owner.book = { ...owner.book, sourceName: `源${input}`, readProgress: input }; owner.replay();
    assert.equal(bar.create.value, percent);
    assert.ok(texts(owner).some(n => n.create === label));
    assert.ok(texts(owner).some(n => n.create === `源${input}`));
  }
});

const detailSource = read('bookshelf/LocalBookDetail.ets');
check('PH116 detail preview expands up to 20 rows in the outer detail scroll', () => {
  for (const count of [0, 3, 20, 40]) {
    const { owner } = createReaderBuilderProbe(detailSource,
      ['chapterSection', 'chapterRow', 'visibleToc', 'chapterEmptyMessage', 'chapterSectionHeight'], {
        CHAPTER_SECTION_HEIGHT: 282, CHAPTER_ROW_HEIGHT: 58, CHAPTER_PREVIEW_LIMIT: 20,
        ButtonType: { Normal: 'Normal' },
      });
    const toc = Array.from({ length: count }, (_, offset) => ({ index: 7 + offset * 3,
      title: `第${offset + 1}章`, navigable: offset !== 1 }));
    const selected = [];
    let directories = 0;
    Object.assign(owner, { appThemeScheme: 'day', book: { sourceId: 'source', bookId: 'book' },
      toc, loadingMessage: '', readingBlockedReason: '', contentWidth: () => 326,
      onSelectChapter: index => selected.push(index),
      onOpenDirectory: () => { directories += 1; } });
    owner.chapterSection();
    const nodes = [...owner.nodes.values()];
    const chapterTexts = texts(owner).filter(node => /^第\d+章$/.test(node.create));
    assert.equal(chapterTexts.length, Math.min(count, 20));
    assert.deepEqual(owner.visibleToc(), toc.slice(0, 20), 'preview retains exact chapter identity/order');
    for (const node of chapterTexts) assert.deepEqual([node.fontSize, node.fontWeight], [14, 'FontWeight.Regular']);
    assert.equal(nodes.filter(node => node.type === 'Scroll').length, 0,
      'chapter list must not hide its twenty rows behind a four-row inner scroll');
    assert.ok(nodes.some(node => node.type === 'Stack' &&
      node.height === (count > 0 ? 50 + 58 * Math.min(count, 20) : 282)));
    const directory = nodes.find(node => node.width === 94 && node.height === 44);
    assert.equal(directory.enabled, true);
    directory.onClick();
    assert.equal(directories, 1,
      'actual full-directory hit target forwards only the directory intent');
    assert.deepEqual(selected, []);
    const rows = nodes.filter(node => node.type === 'Row' && node.height === 58 && node.onClick);
    assert.equal(rows.length, Math.min(count, 20));
    if (rows.length) {
      rows.at(-1).onClick();
      assert.deepEqual(selected, [toc[Math.min(count, 20) - 1].index],
        'preview keeps sparse Core indices instead of reindexing display rows');
      rows[1].onClick();
      assert.equal(selected.length,1,'volume heading remains visible without a chapter jump');
    }
    owner.removing=true;owner.replay();directory.onClick();
    assert.equal(directory.enabled,false);assert.equal(directories,1);
    if(rows.length){rows[0].onClick();assert.equal(selected.length,1);}
  }
});
for (const scheme of ['day', 'night']) {
  check(`${scheme}: detail metadata shares source typography, label and moving source action`, () => {
    const { owner } = createReaderBuilderProbe(detailSource, ['heroCard'], { bookAuthorLabel, NoCoverCover: Child, ImageFit: { Cover: 'Cover' } });
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
    assert.deepEqual([action.width, action.height, action.lineHeight, action.textAlign, action.maxLines], [52, 12, 12, 'TextAlign.Center', 1]);
    assert.equal(action.padding, undefined, 'the 52vp button must not lose 16vp to text padding');
    const hit = [...owner.nodes.values()].find(n => n.type === 'Stack' && n.width === 52);
    assert.equal(hit.flexShrink, 0); assert.equal(hit.height, 18);
    assert.equal(hit.create.alignContent, 'Alignment.Center');
    assert.equal((hit.height - action.height) / 2, 3, 'fixed 12vp line box leaves symmetric vertical space');
    let switches = 0; owner.onSwitchSource = () => switches++;
    hit.onClick(); assert.equal(switches, 1);
    owner.sourceSwitchEnabled = false; owner.replay(); hit.onClick(); assert.equal(switches, 1, 'local action stays disabled');
    owner.book = { ...owner.book, sourceName: '非常长的实际名称'.repeat(20) }; owner.replay();
    assert.equal(texts(owner).find(n => String(n.create).startsWith('书源：')).width, undefined);
    for (const author of ['作者：关关公子', '浅草茉莉\n进入作者主页 →']) {
      const raw = { ...owner.book, author }; owner.book = raw; owner.replay();
      assert.ok(texts(owner).some(n => n.create === `作者：${bookAuthorLabel(author)}`));
      assert.equal(raw.author, author, 'detail presentation must preserve source metadata');
    }
  });
}
check('PH46/47 original author typography and the entire five-line block align with the cover', () => {
  const { owner } = createReaderBuilderProbe(detailSource, ['heroCard'], { bookAuthorLabel, NoCoverCover: Child, ImageFit: { Cover: 'Cover' } });
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
    const names = ['chapterSection', 'chapterRow', 'chapterSectionHeight'];
    if (detailSource.includes('private chapterEmptyMessage(')) names.push('chapterEmptyMessage');
    const { owner } = createReaderBuilderProbe(detailSource, names, { CHAPTER_SECTION_HEIGHT: 282, ButtonType: { Normal: 'Normal' } });
    Object.assign(owner, { appThemeScheme: 'day', toc: [], loadingMessage: message, readingEnabled: false, readingBlockedReason: reason,
      visibleToc: () => [], contentWidth: () => 326 });
    owner.chapterSection(); assert.ok(texts(owner).some(n => n.create === expected));
    assert.equal([...owner.nodes.values()].find(n => n.width === 94 && n.height === 44).enabled, true,
      'empty or failed catalog can still enter the directory recovery surface');
  });
}
const sourcePage = read('source/SourceManagementPage.ets');
for (const loginUrl of [undefined, 'https://example.test/login']) {
  check(`source name/category/URL remain distinct and login precedes detect (${loginUrl ? 'login' : 'no login'})`, () => {
    const names = ['sourceRow', 'detectButton', 'loginButton', 'statusBadge', 'sourceSwitch'];
    if (sourcePage.includes('private sourceMeta(')) names.push('sourceMeta');
    const { owner } = createReaderBuilderProbe(sourcePage, names, {
      readerSourceCategoryLabel,
      TYPE_SOURCE_MANAGEMENT_META: {
        fontFamily: 'ReaderNotoSansSC', fontWeight: 400, fontSizeFp: 10, lineHeightFp: 12.5,
      },
      StatusBadge: Child, ReaderToggle: Child,
    });
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
  assert.match(shelf, /radius: \{ topLeft: this\.bookActionSheetSpec\(\)\.borderRadius, topRight: this\.bookActionSheetSpec\(\)\.borderRadius, bottomLeft: 0, bottomRight: 0 \}/);
  assert.match(sheet, /borderRadius\(\{ topLeft: this\.surfaceSpec\(\)\.borderRadius, topRight: this\.surfaceSpec\(\)\.borderRadius, bottomLeft: 0, bottomRight: 0 \}\)/);
  const surfaceSpecs = read('common/ReaderSurfaceSpecs.ets');
  assert.match(surfaceSpecs, /bookshelf-book-action[\s\S]*borderRadius: 24/);
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
