import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"header-frame": {"description": "当前漫画header safe/viewport与vp测量", "resources": []}, "retained-preview": {"description": "实际same-key preview current DTO与canonical callback", "resources": []}, "manga-spec": {"description": "当前已确认漫画自然几何/字体scale", "resources": []}, "font-receipts": {"description": "真实checked font晚到/换书/卸载拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {localBookDetailSdk, localBookDetailSource} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {MANGA_DIRECTORY_VISUAL: visual, mangaDirectoryColor, mangaDirectoryContentTop} = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');
const {ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp} = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

let metrics;
const {Component, Header} = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
const scaffold = owner => {
  const frame = [...owner.children.values()].find(child => child.params?.variant ===
    (owner.book.contentKind === 'manga' ? 'mangaDetail' : 'detail'));
  assert.ok(frame?.nodes, 'detail mounts the actual SDK public page scaffold');
  return frame;
};
const fixedHeaderFrame = owner => {
  const frame = [...scaffold(owner).nodes.values()].find(node => node.type === 'Column' && node.zIndex === 10);
  assert.ok(frame, 'header geometry belongs to the actual shared header slot');
  return frame;
};
// Execute the actual approved detail/header SDK actors. These are emitted
// attributes and owner callbacks, not a simulation of native layout/pixels.
const mangaBook = {sourceId: 's', bookId: 'm', title: '漫画预览标题', author: '真实作者', sourceName: '实际来源',
  contentKind: 'manga', intro: '真实简介', mangaPosition: {chapterIndex: 17, chapterTitle: '当前章节', pageOrdinal: 2, totalPages: 8}};
function admitDetail(owner, extra = {}) {
  Object.assign(owner, {book: {...mangaBook}, toc: [{index: 17, title: '当前章节', navigable: true}],
    viewportWidth: metrics.windowRect.width, readerWindowMetricsRevision: 1, appThemeScheme: 'day',
    removing: false, removalEnabled: true, readingEnabled: true, inBookshelf: true, admissionIdentity: 's\0m',
    shelfMessage: '', onContinue() {}, onRemove() {}, onOpenDirectory() {}, onSwitchSource() {}, onBack() {}, ...extra});
  owner.onBookChanged();
}
if(selectedCase==='header-frame') {
function checkHeaderFrame(candidate = localBookDetailSource) {
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  const cases = [
    {width: 320, left: 0, right: 0, expected: [16, 16, 288]},
    {width: 390, left: 0, right: 0, expected: [16, 16, 358]},
    {width: 800, left: 0, right: 0, expected: [126, 126, 548]},
    {width: 390, left: 44, right: 12, expected: [40, 16, 334]},
    {width: 390, left: 12, right: 44, expected: [16, 40, 334]},
  ];
  for (const {width, left, right, expected} of cases) for (const contentKind of ['manga']) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900), undefined,
      new ReaderInsetsVp(left, 32, right, 24));
    const owner = new sdk.Component(undefined, {}), backCalls = [];
    admitDetail(owner, {book: {...mangaBook, contentKind}, onBack: () => backCalls.push('back')});
    owner.mangaFontsReady = true; owner.initialRender();
    const wrapper = fixedHeaderFrame(owner);
    const header = [...owner.children.values()].find(child => child instanceof sdk.Header);
    assert.ok(header?.nodes, 'the frame is bound to the actual shared Header child');
    if (contentKind === 'manga') {
      const frame = owner.headerFrame();
      assert.deepEqual([frame.left, frame.right, frame.width], expected,
        'manga detail uses the same content-frame expansion and 548vp demo cap');
      assert.deepEqual(wrapper.padding, {left: expected[0], right: expected[1]});
      assert.deepEqual(wrapper.margin, {top: 40});
      assert.equal(width - wrapper.padding.left - wrapper.padding.right, expected[2],
        'the actual wrapper paints the generated header width');
      const bar = [...header.nodes.values()].find(node => node.type === 'Row');
      assert.equal(bar.width, '100%'); assert.deepEqual(bar.padding, {left: 3, right: 3});
      assert.equal(bar.border.width, 1);
      assert.ok(wrapper.padding.left + bar.padding.left + bar.border.width >= left);
      assert.ok(wrapper.padding.right + bar.padding.right + bar.border.width >= right,
        'asymmetric safe edges remain outside the actual header action insets');
    }
    const back = [...header.nodes.values()].find(node => typeof node.onClick === 'function');
    back.onClick(); assert.deepEqual(backCalls, ['back']);
  }
}
checkHeaderFrame();
function checkAreaMeasurements(candidate = localBookDetailSource) {
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  for (const contentKind of ['text', 'manga']) for (const unit of [false, true]) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 800, 900));
    const owner = new sdk.Component(undefined, {});
    admitDetail(owner, {book: {...mangaBook, contentKind}, toc: []});
    owner.mangaFontsReady = true; owner.initialRender();
    const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
    const callbacks = [...owner.nodes.values()].filter(node => typeof node.onAreaChange === 'function');
    assert.equal(callbacks.length, 3, 'detail exposes its host-width, dock-height and actual synopsis-width measurements');
    const dock = callbacks.find(node => node.type === 'Stack' && node.constraintSize?.minHeight === (contentKind === 'manga' ? visual.detailDockHeight : 68));
    assert.ok(dock); const host = callbacks.find(node => node !== dock && node.type !== 'Text');
    assert.ok(callbacks.some(node => node.type === 'Text'), 'synopsis width is measured by its actual native text actor');
    host.onAreaChange({}, {width: unit ? '320vp' : 320});
    assert.equal(owner.viewportWidth, 320, 'actual narrow host width receipt overrides the 800vp window');
    assert.equal(owner.contentFrame().width, 280);
    dock.onAreaChange({}, {height: unit ? '112vp' : 112});
    if (contentKind === 'manga') {
      assert.equal(owner.mangaDockMeasuredHeight, 112, 'actual manga dock accepts both native Area length forms');
      assert.equal(owner.mangaContentBottomInset(), visual.detailDockBottom + 112 + visual.detailDockClearance);
    } else assert.equal(owner.mangaDockMeasuredHeight, 68, 'ordinary novel dock keeps its authored fixed height');
    owner.replay(); sdk.properties.flush();
    assert.equal(owner.nodes.get(scroll.id), scroll, 'native detail Scroll survives host/dock measurement updates');
    assert.equal(scroll.width, '100%'); assert.equal(scroll.height, '100%');
  }
}
checkAreaMeasurements();
for (const expression of ['readerPageAreaLength(area.width)', 'readerPageAreaLength(area.height)']) {
  const candidate = localBookDetailSource.replace(expression, expression.replace('readerPageAreaLength', 'Number'));
  assert.notEqual(candidate, localBookDetailSource);
  assert.throws(() => checkAreaMeasurements(candidate), /narrow host width receipt|manga dock accepts/, 'restoring Number(Area) rejects real vp host/dock receipts');
}
const uncappedHeader = localBookDetailSource
  .replace("this.book.contentKind === 'manga' ? this.headerFrame().left : 16 + this.safeLeft()", '16 + this.safeLeft()')
  .replace("this.book.contentKind === 'manga' ? this.headerFrame().right : 16 + this.safeRight()", '16 + this.safeRight()');
assert.notEqual(uncappedHeader, localBookDetailSource);
assert.throws(() => checkHeaderFrame(uncappedHeader), /deep-equal/, 'the old uncapped manga wrapper is rejected');
const transposedHeader = localBookDetailSource.replace(
  'Math.max(0, frame.right - expansion), frame.width + expansion * 2',
  'frame.width + expansion * 2, Math.max(0, frame.right - expansion)');
assert.notEqual(transposedHeader, localBookDetailSource);
assert.throws(() => checkHeaderFrame(transposedHeader), /548vp demo cap/, 'misordered frame coordinates are rejected');

}
if(selectedCase==='retained-preview') {
function checkRetainedPreview(candidate = localBookDetailSource) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900));
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  const owner = sdk.owner, selections = [], refreshedSelections = [];
  const initial = Object.freeze({index: 17, title: '旧命名章节', level: 1, navigable: true, downloadState: 'unknown'});
  admitDetail(owner, {toc: [initial], onSelectChapter: index => selections.push(index)});
  owner.mangaFontsReady = true; owner.initialRender();
  const child = [...owner.children.values()].find(value => value.row?.entries.some(entry => entry.index === 17));
  assert.ok(child?.nodes, 'the retained preview mounts the actual shared row');
  const childrenCount = owner.children.size, scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
  const title = [...child.nodes.values()].find(node => node.type === 'Text' && node.create === initial.title);
  const action = [...child.nodes.values()].find(node => node.onClick && node.accessibilityText?.includes(initial.title));
  assert.ok(title && action); action.onClick(); assert.deepEqual(selections, [17]);
  const next = Object.freeze({index: 17, title: '新命名章节', level: 2, navigable: undefined, downloadState: 'queued'});
  owner.onSelectChapter = index => refreshedSelections.push(index);
  owner.updateStateVars({book: owner.book, toc: [next], removing: false}); sdk.properties.flush();
  assert.equal(owner.mangaPreviewRows[0].entries[0].title, next.title);
  assert.deepEqual({...child.row.entries[0]}, next,
    'the same-key actual child receives the fresh canonical row and metadata');
  assert.equal(owner.children.get(child.id), child); assert.equal(owner.children.size, childrenCount,
    'same-key row refresh preserves child identity rather than remounting');
  assert.equal([...owner.nodes.values()].find(node => node.type === 'Scroll'), scroll);
  assert.equal(title.create, next.title, 'the retained native Text consumes the new row title');
  assert.ok(action.accessibilityText.includes('状态待确认'));
  action.onClick(); assert.deepEqual(selections, [17]);
  assert.deepEqual(refreshedSelections, [17], 'the retained click resolves current facts, current callback and canonical target');
  const numeric = Object.freeze({index: 17, title: '03', level: 2, navigable: true, downloadState: 'completed'});
  owner.updateStateVars({book: owner.book, toc: [numeric], removing: false}); sdk.properties.flush();
  assert.equal(child.row.kind, 'numeric', 'same child receives the new generated layout kind');
  assert.deepEqual({...child.row.entries[0]}, numeric); assert.equal(child.row.labels[0].kind, 'numeric');
  assert.equal(child.row.labels[0].numberText, '03');
  assert.equal(owner.children.get(child.id), child); assert.equal(owner.children.size, childrenCount);
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17]);
  assert.equal(initial.title, '旧命名章节', 'the original captured Builder argument remains immutable');
  owner.updateStateVars({book: owner.book, toc: owner.toc, removing: true}); sdk.properties.flush();
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17], 'live mutation state shields the retained row action');
  owner.updateStateVars({book: owner.book, removing: false, toc: []}); sdk.properties.flush();
  assert.deepEqual(owner.liveMangaPreviewRow({kind: 'row', columns: 1, startIndex: 0, entries: [initial], labels: []}).entries, [],
    'a removed row resolves to empty current facts instead of the original row');
  action.onClick(); assert.deepEqual(refreshedSelections, [17, 17], 'removed current facts reject retained old clicks');
  // The installed SDK's property classes and actual parent/child Builders run;
  // the probe does not simulate compositor removal or row/grid branch layout.
}
checkRetainedPreview();
const capturedPreview = localBookDetailSource.replace('row: this.liveMangaPreviewRow(row),', 'row: row,');
assert.notEqual(capturedPreview, localBookDetailSource);
assert.throws(() => checkRetainedPreview(capturedPreview), /fresh canonical row and metadata/,
  'initial ForEach row capture cannot supply a retained child');
const remountedPreview = localBookDetailSource.replace(
  'row.entries.map((entry: LocalReadingTocEntry): number => entry.index)]));',
  'row.entries.map((entry: LocalReadingTocEntry): string => entry.title)]));');
assert.notEqual(remountedPreview, localBookDetailSource);
assert.throws(() => checkRetainedPreview(remountedPreview), /preserves child identity/,
  'title changes cannot replace the canonical row key and remount the child');
const capturedPreviewCallback = localBookDetailSource.replace(
  'this.selectMangaPreviewEntry(entry),', 'this.selectMangaPreviewEntry(row.entries[0]),');
assert.notEqual(capturedPreviewCallback, localBookDetailSource);
assert.throws(() => checkRetainedPreview(capturedPreviewCallback), /current callback and canonical target/,
  'retained selection must consume the child current entry instead of its original ForEach row');

}
if(selectedCase==='manga-spec') {
function checkMangaGeometry(candidate = localBookDetailSource) {
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}}, {source: candidate});
  for (const width of [320, 390, 800]) for (const scale of [1, 2, 3.2]) for (const scheme of ['day', 'night']) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900)); metrics.systemFontScale = scale;
    const owner = new sdk.Component(undefined, {}), actions = [];
    admitDetail(owner, {appThemeScheme: scheme, sourceSwitchEnabled: true,
      book: {...mangaBook, coverUrl: 'https://example.invalid/cover.png', lastChapter: '最新事实'},
      onSwitchSource: () => actions.push('switch'), onOpenDirectory: () => actions.push('directory')});
    // This geometry probe starts after an independently checked font receipt.
    // The deferred first-paint admission is tested below, not bypassed in app code.
    owner.mangaFontsReady = true; owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const hero = nodes.find(node => node.type === 'Row' && node.create.space === 18 && node.padding?.top === 2);
    assert.ok(hero); assert.equal(hero.alignItems, 'VerticalAlign.Center');
    const cover = nodes.find(node => node.type === 'Image' && node.create === 'https://example.invalid/cover.png');
    assert.deepEqual([cover.width, cover.height, cover.borderRadius], [84, 122, 8]);
    const title = nodes.find(node => node.type === 'Text' && node.create === mangaBook.title);
    assert.deepEqual([title.fontSize, title.lineHeight, title.fontWeight, title.maxLines], [24, 34, 700, 2]);
    assert.equal(title.maxFontScale, scale); assert.equal(title.halfLeading, true);
    const author = nodes.find(node => node.type === 'Text' && node.create === mangaBook.author);
    assert.deepEqual([author.fontSize, author.lineHeight, author.maxLines], [13, 20, undefined]);
    assert.equal(author.fontColor, mangaDirectoryColor('muted', scheme));
    const tag = nodes.find(node => node.type === 'Text' && node.create === '漫画');
    assert.deepEqual([tag.width, tag.height], [Math.max(30, 18 * scale + 12), Math.max(16, 14 * scale + 2)]);
    const position = nodes.find(node => node.type === 'Column' && node.padding?.top === 13);
    assert.deepEqual(position.padding, {left: 14, right: 14, top: 13, bottom: 13});
    assert.equal(position.create.space, 5); assert.equal(position.borderRadius, 12); assert.equal(position.border, undefined);
    assert.deepEqual(position.margin, {top: 24}); assert.equal(position.backgroundColor, mangaDirectoryColor('soft', scheme));
    const chapter = nodes.find(node => node.type === 'Text' && node.create === '当前章节' && node.fontSize === 12);
    assert.equal(chapter.lineHeight, 19, 'fp setter stays unscaled; native font scale is applied once');
    assert.equal(chapter.fontWeight, 500);
    const page = nodes.find(node => node.type === 'Text' && node.create === '3 / 8 页');
    assert.deepEqual([page.fontSize, page.lineHeight, page.fontFeature], [11, 19, "'tnum' 1"]);
    const content = nodes.find(node => node.type === 'Column' && node.padding?.top === mangaDirectoryContentTop(scale));
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBar, 'BarState.Auto');
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBarWidth, 4);
    assert.equal(nodes.find(node => node.type === 'Scroll').scrollBarColor, '#47000000');
    const count = nodes.find(node => node.type === 'Text' && node.create === owner.mangaSummaryLabel() && node.fontSize === 11 && node.lineHeight === 17);
    assert.ok(count, 'catalog count retains the independent 11/17 block below its heading');
    assert.equal(content.width, Math.min(540, width - 40)); assert.equal(content.create.space, 0);
    const header = [...owner.children.values()].find(child => child instanceof sdk.Header);
    assert.equal(header.variant, 'mangaDirectory');
    assert.equal(header.backIcon, `app.media.manga_directory_back${scheme === 'night' ? '_theme_night' : ''}`);
    const heading = nodes.find(node => node.type === 'Text' && node.create === '章节目录');
    assert.deepEqual([heading.fontSize, heading.lineHeight, heading.fontWeight], [17, 25, [650, {enableVariableFontWeight: true}]]);
    assert.ok(nodes.some(node => node.create === '最新：最新事实'), 'business latest facts survive the visual conversion');
    nodes.find(node => node.create === '换源').onClick();
    nodes.find(node => node.type === 'Row' && node.onClick && node.constraintSize?.minHeight === 36 && node.flexShrink === 0).onClick();
    assert.deepEqual(actions, ['switch', 'directory']);
    const dock = nodes.find(node => node.type === 'Stack' && node.constraintSize?.minHeight === 68);
    assert.equal(dock.height, undefined, 'large-font actions can grow instead of clipping inside a fixed dock');
    dock.onAreaChange({}, {height: 180});
    assert.equal(owner.mangaContentBottomInset(), 223, 'real measured dock height reserves the matching scroll clearance');
    const primary = nodes.find(node => node.create === '继续阅读');
    assert.deepEqual([primary.height, primary.constraintSize.minHeight, primary.fontSize, primary.lineHeight], [undefined, 48, 14, 21]);
    assert.equal(primary.maxFontScale, scale);
  }
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900)); metrics.systemFontScale = 3.2;
  const art = new sdk.Component(undefined, {}); admitDetail(art); art.mangaFontsReady = true; art.initialRender();
  const artNodes = [...art.nodes.values()], printed = artNodes.find(node => node.create === mangaBook.title && node.fontSize === 19);
  assert.deepEqual([printed.lineHeight, printed.minFontScale, printed.maxFontScale], [27, 1, 1], 'cover lettering stays printed art while the UI title scales');
}
checkMangaGeometry();
{
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 320, 900)); metrics.systemFontScale = 3.2;
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
  const actor = new sdk.Component(undefined, {});
  admitDetail(actor, {book: {...mangaBook, mangaPosition: {...mangaBook.mangaPosition, totalPages: 999999999999999}}});
  actor.mangaFontsReady = true; actor.initialRender();
  const rendered = [...actor.nodes.values()];
  const chapter = rendered.find(node => node.type === 'Text' && node.create === '当前章节' && node.fontSize === 12);
  const page = rendered.find(node => node.type === 'Text' && node.create === '3 / 999999999999999 页');
  assert.equal(chapter.width, '100%', 'stacked chapter retains the full available title lane');
  assert.equal(chapter.layoutWeight, 0); assert.equal(page.width, '100%');
  assert.equal(page.maxLines, undefined, 'long position counts wrap naturally rather than stealing the title lane');
  assert.equal(page.textAlign, 'TextAlign.Start');
}
const oldCover = localBookDetailSource.replaceAll('visual.heroWidth', '104');
assert.notEqual(oldCover, localBookDetailSource); assert.throws(() => checkMangaGeometry(oldCover), /deep-equal/);
const doubledFp = localBookDetailSource.replace('.lineHeight(visual.positionLineHeight)', '.lineHeight(visual.positionLineHeight * this.mangaFontScale())');
assert.notEqual(doubledFp, localBookDetailSource); assert.throws(() => checkMangaGeometry(doubledFp), /fp setter stays unscaled/);


}
if(selectedCase==='font-receipts') {
const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};
const nextFrame = () => new Promise(done => setImmediate(done));
async function checkFontAdmission(candidate = localBookDetailSource, scenario = 'identity') {
  const receipts = [], requests = [];
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics},
    prepareReaderFontFamily: async family => requests.push(family),
    prepareMangaSheetFonts: () => {const receipt = deferred(); receipts.push(receipt); return receipt.promise;}}, {source: candidate});
  const owner = sdk.owner; admitDetail(owner); owner.aboutToAppear(); await nextFrame();
  assert.equal(receipts.length, 1); assert.equal(owner.mangaFontsReady, false);
  owner.initialRender(); assert.equal([...owner.children.values()].some(child => child instanceof sdk.Header), false,
    'first manga header and glyphs wait for checked font receipts');
  if (scenario === 'identity') {
    owner.book = {...mangaBook, bookId: 'next'}; owner.onBookChanged(); await nextFrame();
    assert.equal(receipts.length, 2); receipts[0].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, false, 'late prior-book font callback cannot admit the replacement detail');
    receipts[1].resolve(true); await nextFrame(); sdk.properties.flush();
    assert.equal(owner.mangaFontsReady, true);
    // The shared CPU probe deliberately does not simulate removal of the
    // loading Column branch. Lower the real admitted branch in a fresh actor;
    // native branch scheduling and first pixels remain a renderer gate.
    const admitted = new sdk.Component(undefined, {}); admitDetail(admitted, {book: owner.book});
    admitted.mangaFontsReady = owner.mangaFontsReady; admitted.initialRender();
    assert.ok([...admitted.children.values()].some(child => child instanceof sdk.Header));
  } else if (scenario === 'unmount') {
    owner.aboutToDisappear(); receipts[0].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, false, 'late font receipt cannot paint a retired detail');
  } else {
    receipts[0].reject(new Error('checked font failure')); await nextFrame(); sdk.properties.flush();
    assert.equal(owner.mangaFontsFailed, true); assert.equal(owner.mangaFontsReady, false);
    owner.prepareMangaDetailFonts(); await nextFrame(); receipts[1].resolve(true); await nextFrame();
    assert.equal(owner.mangaFontsReady, true); assert.equal(owner.mangaFontsFailed, false);
  }
  assert.ok(requests.every(family => family === 'ReaderNotoSerifSCBold'));
}
await checkFontAdmission(); await checkFontAdmission(localBookDetailSource, 'unmount'); await checkFontAdmission(localBookDetailSource, 'retry');
const unfencedFonts = localBookDetailSource.replaceAll('!this.mounted || generation !== this.mangaFontGeneration || identity !== this.mangaFontIdentity || ', '');
assert.notEqual(unfencedFonts, localBookDetailSource);
await assert.rejects(() => checkFontAdmission(unfencedFonts), /late prior-book font callback/);
const earlyGlyphs = localBookDetailSource.replace("this.book.contentKind !== 'manga' || this.mangaFontsReady", 'true');
assert.notEqual(earlyGlyphs, localBookDetailSource);
await assert.rejects(() => checkFontAdmission(earlyGlyphs), /first manga header and glyphs/);
console.log('PASS actual SDK detail/header: novels retain original geometry; manga header548 cap/asymmetric safe edges, cover84x122, title24/34, fixed printed art, position12/19/500, section17/25/650,320/390/800vp ×font1/2/3.2×day/night, natural dock and measured clearance; same-key row/title/metadata/kind/current-click updates retain child and Scroll, checked fonts fence identity/unmount/failure/retry. Negative uncapped/transposed/novel-leak/captured-row/remount/old-cover/double-fp/early/late controls rejected; native branch layout/pixels remain unverified');

}

}
