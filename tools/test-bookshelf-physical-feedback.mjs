import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { readerSourceCategoryLabel } from '../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
import {sourceSharedActionFixture} from './lib/source-shared-action-probe.mjs';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { localBookDetailSdk } from './lib/local-book-detail-sdk-probe.mjs';

const baseline = process.argv.includes('--baseline');
const read = name => readFileSync(new URL(baseline
  ? `../evidence/2026-09-14-physical-review/${name.split('/').at(-1)}.before`
  : `../entry/src/main/ets/features/${name}`, import.meta.url), 'utf8');
const results = [];
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
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
const checkAsync = async (name, action) => {
  try { await action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, message: error.message }); }
};
const texts = owner => [...owner.nodes.values()].filter(node => node.type === 'Text');
// Native FontWeight enums and public roles both denote physical numeric weights.
const physicalWeight = weight => ({ 'FontWeight.Regular': 400, 'FontWeight.Medium': 500, 'FontWeight.Bold': 700 })[weight] ?? weight;
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
    const { owner } = createReaderBuilderProbe(read(`bookshelf/${page}.ets`), ['mounted','temporaryBackIdentity','temporaryBackGeneration','moreSelectionId','onTemporaryBackBridge','navigationGeneration','onNavigationGenerationChanged','registerTemporaryBackGeneration','consumeTemporaryBack','dismissMoreMenu','moreOpenAction','aboutToAppear','topBar'], {
      ...createArkUIPropertyRuntimeProbe().sdk,bookshelfTemporaryGeneration:0,registerReaderShelfFonts(){},AppTopBar: HeaderChild, ReaderIconButton: IconButtonChild,
      ImageFit: { Contain: 'ImageFit.Contain' },
    },{initialParams:{navigationGeneration:1}});
    owner.aboutToAppear();
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
      READER_FONT_NOTO_SANS_SC_UI_BOLD, TYPE_APP_HOME_TITLE: { fontFamily: 'title-role', fontWeight: 700, fontSizeFp: 29, lineHeightFp: 38 },
    });
    Object.assign(header, headers[0].params, { appThemeScheme: 'day', leftInset: () => 20, rightInset: () => 20 });
    header.initialRender();
    const titles = texts(header).filter(node => node.create === '书架');
    assert.equal(titles.length, 1, 'one native text actor renders the shared title');
    assert.equal(titles[0].layoutWeight, 1);
    assert.equal(titles[0].fontFamily, READER_FONT_NOTO_SANS_SC_UI_BOLD);
    assert.equal(titles[0].fontSize, 19);assert.equal(titles[0].lineHeight, 28);
    const row = [...header.nodes.values()].find(node => node.type === 'Row');
    assert.deepEqual(row.padding, { left: 4, right: 4, top: 0 });
    assert.equal(row.height, 52);assert.equal(row.borderRadius,18);assert.equal(row.clip,true);
    assert.equal(row.border.width, 1);
    for (const scheme of ['night', 'day']) {
      header.appThemeScheme = scheme; header.replay();
      assert.equal(texts(header).find(node => node.create === '书架'), titles[0], 'theme update retains the title actor');
      assert.equal(titles[0].fontColor, readerAppColor('TOK_INK', scheme));
      assert.equal(row.backgroundColor, readerAppColor('TOK_SURFACE_SOLID', scheme));
    }
    assert.ok(![...owner.nodes.values(), ...header.nodes.values()]
      .some(node => node.type === 'Image' && node.create === 'app.media.bookshelf_title'));

    const searchHit=[...header.nodes.values()].find(node=>node.type==='Stack'&&node.width===44&&node.onClick);
    assert.ok(searchHit);assert.equal(searchHit.height,44);searchHit.onClick();assert.equal(searches,1);
    const buttons = [...owner.children.values()].filter(child => child instanceof IconButtonChild);
    assert.equal(buttons.length,1,'the leading search is owned by the centered AppTopBar; only More occupies its trailing slot');
    const button=buttons[0];assert.equal(button.params.icon,'app.media.rc_dots');
    const actual = iconButtonControls({ source: read('common/ReaderIconButton.ets') });
    const hitOwner = new actual.icon.Component(undefined, button.params);
    hitOwner.appThemeScheme = 'day';hitOwner.aboutToAppear();hitOwner.initialRender();
    const hit = [...hitOwner.nodes.values()].find(node => node.type === 'Stack');
    assert.deepEqual([hit.width, hit.height], [44,44]);hit.onClick();
    assert.equal(searches,1);assert.equal(owner.moreMenuVisible,true);
    owner.navigationGeneration=2;owner.onNavigationGenerationChanged();
    searchHit.onClick();assert.equal(searches,1,'an old leading header actor cannot publish into the new navigation');
    hit.onClick();assert.equal(owner.moreMenuVisible,false,'an old More actor cannot reopen the retired menu');

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
// The current detail delegates its novel and manga branches to production
// Builders. Mount the complete SDK-emitted component and shared children;
// keep the archived pre-repair probe intact for its baseline comparison.
const detailProbe = (names, dependencies = {}, hooks = {}) => {
  if (baseline) {
    const probe = createReaderBuilderProbe(detailSource, names, dependencies, hooks);
    // The archived partial probe used this cover-fact seam. The current
    // component executes its actual hasCover method against the supplied URL.
    if (names.includes('hero')) probe.owner.hasCover = () => true;
    return probe;
  }
  const { NoCoverCover: _legacyCoverStub, ...facts } = dependencies;
  return localBookDetailSdk(facts, { ...hooks, source: hooks.source ?? detailSource });
};
check('detail preview retains at most 20 Core identities in the outer scroll and volume rows only fold', () => {
  for (const count of [0, 3, 20, 40]) {
    const { owner } = detailProbe(
      ['catalog', 'chapterRow', 'visibleToc', 'chapterEmptyMessage', 'chapterIndent','isCurrentChapter'], { CHAPTER_PREVIEW_LIMIT:20, TEXT_CHAPTER_PREVIEW_LIMIT:20 });
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
      rows[1].onClick();assert.equal(selected.length,1,'volume row folds without navigating');
      // Actual SDK @State exposes a branded ObservedObject proxy. Compare
      // the complete canonical values rather than its platform prototype.
      assert.deepEqual(Array.from(owner.collapsedGroups),[toc[1].index]);
    }
    owner.removing=true;owner.replay();
    const disabledDirectory=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width===94&&node.height===44);
    disabledDirectory.onClick();assert.equal(disabledDirectory.enabled,false);assert.equal(directories,1);
    if(rows.length){rows[0].onClick();assert.equal(selected.length,1);}
  }
});
for(const scheme of ['day','night']) {
  check(`${scheme}: current source and author facts remain exact while the source action follows permission`,()=>{
    const {owner}=detailProbe(['hero','metadataTag','readingFacts'],{bookAuthorLabel,NoCoverCover:Child,ImageFit:{Cover:'Cover'}});
    Object.assign(owner,{appThemeScheme:scheme,book:{sourceId:'source',title:'书名',author:'作者名',sourceName:'短书源',lastChapter:'最新章节',coverUrl:'https://example.test/cover'},sourceSwitchEnabled:true});
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
function checkNaturalHero(candidate = detailSource) {
  const {owner}=detailProbe(['hero','metadataTag'],{bookAuthorLabel,NoCoverCover:Child,ImageFit:{Cover:'Cover'}},{source:candidate});
  Object.assign(owner,{appThemeScheme:'day',book:{title:'Title',author:'Author',sourceName:'Source',lastChapter:'Chapter',coverUrl:'https://example.test/cover'}});owner.hero();
  const nodes=[...owner.nodes.values()],cover=nodes.find(n=>n.type==='Image'),title=texts(owner).find(n=>n.create==='Title'),author=texts(owner).find(n=>n.create==='Author');
  assert.equal(cover.width,84);assert.equal(cover.height,122);
  assert.deepEqual([title.fontSize,title.lineHeight,title.maxLines],[24,34,2]);
  assert.deepEqual([author.fontFamily,author.fontSize,author.lineHeight],['ReaderNotoSansSC',13,20]);assert.equal(author.fontColor,readerAppColor('TOK_MUTED','day'));
  const hero=nodes.find(n=>n.type==='Row'&&n.constraintSize?.minHeight===122);assert.ok(hero);assert.equal(hero.height,undefined,'long titles can grow the hero instead of clipping');
}
check('detail cover and two-line title use the approved natural hero instead of a fixed five-line block',()=>{
  checkNaturalHero();
  if (!baseline) {
    const wrongCover = detailSource.replace('Image(this.displayCoverUrl() as string).width(84)',
      'Image(this.displayCoverUrl() as string).width(104)');
    assert.notEqual(wrongCover, detailSource, 'negative control changes the actual novel hero source');
    assert.throws(() => checkNaturalHero(wrongCover), assert.AssertionError,
      'a real SDK hero width regression cannot pass through the shared probe');
  }
});
await checkAsync('missing synopsis is explained without contaminating metadata and expansion preserves content', async () => {
  const receipt = { full: 48, folded: 48 }, measures = [];
  // Exact platform-result seam: MeasureUtils owns wrapping. This test does
  // not estimate glyph widths or assume every non-empty intro overflows.
  const uiContext = { px2vp: value => value / 3, fp2px: value => value * 3,
    getMeasureUtils: () => ({ measureTextSize(options) {
      measures.push({ ...options });
      return { width: 500, height: options.maxLines === 3 ? receipt.folded : receipt.full };
    } }) };
  const probe = detailProbe(['summary','displayIntro'], { bookIntroText, uiContext }, { allowEmptyBranchAdmission: true });
  const { owner } = probe;
  Object.assign(owner, { appThemeScheme: 'day', book: Object.freeze({ sourceId: 'source', bookId: 'intro-book', intro: '' }), introExpanded: false,
    viewportWidth: 390, readerWindowMetricsRevision: 1 });
  owner.summary();
  assert.ok(texts(owner).some(node => node.create === '暂无简介'));
  assert.equal(owner.displayIntro(), ''); assert.equal(owner.book.intro, '');
  if (baseline) {
    // Keep the archived pre-repair contract isolated from the new measurement.
    owner.book = { intro: '真实简介' }; owner.replay();
    const intro = texts(owner).find(node => node.create === '真实简介'); assert.equal(intro.maxLines, 3);
    const expand = texts(owner).find(node => node.create === '展开'); expand.onClick(); owner.replay();
    assert.equal(owner.introExpanded, true); assert.equal(intro.maxLines, 10000); assert.equal(owner.book.intro, '真实简介');
    return;
  }
  Object.assign(owner, { mounted: true, book: { sourceId: 'source', bookId: 'intro-book', intro: '真实短简介' } });
  // Unmeasured content stays readable. An unavailable measurement must never
  // manufacture a fold action or silently clip to three lines.
  owner.replay();
  assert.equal(texts(owner).find(node => node.create === '真实短简介').maxLines, 10000);
  assert.ok(!texts(owner).some(node => node.create === '展开'));
  owner.measureIntro(); await new Promise(done => setImmediate(done)); probe.properties.flush(); owner.replay();
  assert.equal(owner.introMeasured, true); assert.equal(owner.introOverflow, false);
  assert.equal(texts(owner).find(node => node.create === '真实短简介').maxLines, 3);
  assert.ok(!texts(owner).some(node => node.create === '展开'), 'short measured content does not expose an inert expansion action');
  assert.equal(measures.length, 2);
  const [full, folded] = measures;
  assert.deepEqual([full.fontFamily, full.fontSize, full.lineHeight, full.fontWeight, full.constraintWidth],
    ['ReaderNotoSansSC', '13fp', '24fp', 400, '350vp']);
  assert.equal(full.maxLines, 10000); assert.deepEqual({ ...full, maxLines: 3 }, folded);
  const longIntro = '真实完整长简介\n'.repeat(16);
  receipt.full = 240; receipt.folded = 72;
  owner.book = { ...owner.book, intro: longIntro }; owner.onBookChanged();
  await new Promise(done => setImmediate(done)); probe.properties.flush(); owner.replay();
  assert.equal(owner.introMeasured, true); assert.equal(owner.introOverflow, true);
  const intro = texts(owner).find(node => node.create === owner.displayIntro());
  assert.equal(intro.fontFamily, 'ReaderNotoSansSC'); assert.equal(intro.fontSize, 13); assert.equal(intro.lineHeight, 24);
  assert.equal(intro.maxLines, 3);
  const expand = texts(owner).find(node => node.create === '展开'); assert.ok(expand);
  expand.onClick(); owner.replay();
  assert.equal(owner.introExpanded, true); assert.equal(intro.maxLines, 10000);
  assert.equal(owner.book.intro, longIntro, 'folding never changes canonical metadata');
});
for(const [message,reason,expected] of [['','','暂无章节信息'],['正在读取本地目录…','','正在读取本地目录…'],['','目录读取失败，请重试','目录读取失败，请重试']]) {
  check(`empty chapters expose status: ${expected}`,()=>{
    const {owner}=detailProbe(['catalog','chapterRow','chapterEmptyMessage'],{});
    Object.assign(owner,{appThemeScheme:'day',book:{sourceId:'local',bookId:'empty',contentKind:'novel'},toc:[],loadingMessage:message,readingEnabled:false,readingBlockedReason:reason,removing:false});owner.catalog();
    assert.ok(texts(owner).some(n=>n.create===expected));
    assert.equal([...owner.nodes.values()].find(n=>n.type==='Stack'&&n.width===94&&n.height===44).enabled,true,'directory recovery remains reachable');
  });
}
const sourcePage = read('source/SourceManagementPage.ets');
for (const loginUrl of [undefined, 'https://example.test/login']) {
  check(`source name/category/URL remain distinct and login precedes detect (${loginUrl ? 'login' : 'no login'})`, () => {
    const names = ['sourceRow', 'detectButton', 'loginButton', 'statusBadge', 'sourceSwitch'];
    if (!baseline) names.push('operation', 'mounted', 'temporaryBackIdentity', 'sourceToggleBusy', 'sourceToggleEnabled');
    if (sourcePage.includes('private sourceMeta(')) names.push('sourceMeta');
    const deps = {
      readerSourceCategoryLabel,
      TYPE_SOURCE_MANAGEMENT_META: {
        fontFamily: 'ReaderNotoSansSC', fontWeight: 400, fontSizeFp: 10, lineHeightFp: 12.5,
      },
      StatusBadge: Child, ...(baseline ? { ReaderToggle: Child } : {}),
    };
    const ui = baseline ? {owner:createReaderBuilderProbe(sourcePage,names,deps).owner} : sourceSharedActionFixture(names,deps);
    const { owner } = ui;
    Object.assign(owner, { appThemeScheme: 'day', mounted: true, temporaryBackIdentity: 'source-metadata-visit',
      contentFrame: () => ({ width: 326 }), statusBadgeBackground() {}, statusBadgeDot() {} });
    const source = { sourceId: 'source', name: '实际书源名称', baseUrl: 'https://example.test/very/long/path', category: 'novel', enabled: true, loginUrl, checkState: 'failed', checkMessage: '检测失败，请重试' };
    let logins = 0, detects = 0;
    owner.onLoginSource = id => { assert.equal(id, source.sourceId); logins++; };
    owner.onDetectSource = id => { assert.equal(id, source.sourceId); detects++; };
    owner.sourceRow(source);
    const allNodes = baseline ? [...owner.nodes.values()] : ui.controls.orderedNodes(owner);
    if (!baseline) {
      const toggle = allNodes.find(node => node.accessibilityRole === 'AccessibilityRoleType.SWITCH');
      assert.ok(toggle, 'actual shared Toggle native actor mounts through the Root bounded resolver');
      assert.deepEqual([toggle.width, toggle.height, toggle.accessibilityChecked, toggle.enabled], [44, 24, true, true]);
    }
    const nodes = allNodes.filter(n=>n.type==='Text'), labels = nodes.map(n => n.create);
    assert.ok(labels.includes(source.baseUrl)); assert.ok(labels.includes(readerSourceCategoryLabel('novel')));
    assert.ok(labels.includes(source.checkMessage));
    assert.ok(labels.indexOf(readerSourceCategoryLabel('novel')) < labels.indexOf(source.baseUrl));
    const name = nodes.find(n => n.create === source.name), category = nodes.find(n => n.create === readerSourceCategoryLabel('novel'));
    assert.equal(name.flexShrink, 1); assert.equal(category.flexShrink, 0);
    assert.equal(name.maxLines, 1); assert.equal(name.textOverflow.overflow, 'TextOverflow.Ellipsis');
    const buttons = baseline ? [...owner.nodes.values()].filter(n => n.type === 'Stack' && n.onClick).map(native=>({native,click:native.onClick})) :
      [...(loginUrl ? [ui.action('source-management-login','登录')] : []),ui.action('source-management-detect','检测')];
    if (loginUrl) { assert.ok(labels.indexOf('登录') < labels.indexOf('检测')); buttons[0].click(); buttons[1].click(); assert.deepEqual([logins, detects], [1, 1]); }
    else { assert.ok(!labels.includes('登录')); buttons[0].click(); assert.deepEqual([logins, detects], [0, 1]); }
    if(!baseline){for(const action of buttons){assert.deepEqual([action.native.width,action.native.height,action.native.borderRadius],[44,28,7],'shared native target preserves the original compact geometry');action.actor.aboutToDisappear();action.click();}assert.deepEqual([logins,detects],loginUrl?[1,1]:[0,1],'retired actual compact actors cannot dispatch');
      owner.detectButton({...source,checkState:'checking'});const busy=ui.action('source-management-detect','检测中');assert.equal(busy.native.opacity,0.62,'busy native feedback preserves the original detect opacity');busy.click();assert.equal(detects,1,'actual Source checking guard prevents a second detection');}
  });
}
check('single-book sheet matches cover frame and both layers have straight lower corners', () => {
  const shelf = read('bookshelf/BookshelfPage.ets'), sheet = read('bookshelf/BookshelfBookActionSheet.ets');
  const method = shelf.match(/private bookActionWidth\(\): number \{([\s\S]*?)\n  \}/)[1];
  const width = new Function('ReaderWindowCoordinator', 'readerVisualSafeLeft', 'readerVisualSafeRight', method);
  for (const available of [240, 326, 352, 630]) assert.equal(width.call({ shelfContentWidth: () => available, isWideViewport: () => available > 500,
    effectiveViewportWidth: () => available + 38 }, { metrics: () => ({}) }, () => 19, () => 19), available);
  assert.match(shelf, /radius: \{ topLeft: this\.bookActionSheetSpec\(\)\.borderRadius, topRight: this\.bookActionSheetSpec\(\)\.borderRadius, bottomLeft: 0, bottomRight: 0 \}/);
  if (baseline) assert.match(sheet, /borderRadius\(\{ topLeft: this\.surfaceSpec\(\)\.borderRadius, topRight: this\.surfaceSpec\(\)\.borderRadius, bottomLeft: 0, bottomRight: 0 \}\)/);
  else {
    assert.match(sheet, /ReaderBoundedSurface\(\{ specId: 'bookshelf-book-action'/);
    const kit = boundedSurfaceSdk();
    const frame = kit.consumer(read('common/ReaderBoundedSurface.ets'), undefined, {}, { specId: 'bookshelf-book-action' });
    frame.initialRender();
    const painted = [...frame.nodes.values()].find(node => node.backgroundColor);
    assert.deepEqual(painted.borderRadius, { topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 }, 'actual SDK shared frame retains both straight lower corners');
  }
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
