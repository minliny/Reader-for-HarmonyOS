import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--evidence-path='))?.slice('--evidence-path='.length);
if (output) assert.ok(output.startsWith('.reader-artifacts/') && !output.includes('..'));
const selected = selectContractCases({
  'rss-error': 'Actual retained RSS fatal state consumes current error count and distinct same-name error rows.',
  'search-empty': 'Actual retained Search empty state consumes current keyword and searched count.',
  'import-formats': 'Actual retained local import badges consume current app theme colors.',
  'appearance-geometry': 'Actual retained appearance layout controls consume current calculated row and button positions.',
  'shelf-row-index': 'Actual retained shelf projection uses the current row position in its shared motion cadence.',
  'rss-source-rows': 'Actual RSS source-feed Repeat rows consume current same-key item and position.',
  'rss-management-actions': 'Actual retained management row actions consume the current recycled entity.',
  'rss-management-rows': 'Actual RSS management Repeat rows consume current source facts, Toggle value and position.',
  'rss-repeat-rows': 'Actual RSS subscription and unread Repeat closures retain current DTO/index and actions.',
  'rss-feed-arrays': 'Actual retained RSS feed and empty-unread lists consume current projected arrays.',
  'source-overlay': 'Actual retained source recovery overlay consumes current header inset and available height.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { selectedProductionClasses, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { motionSegment } = await import('../entry/src/main/ets/ui/foundation/MotionTimeline.ts');
  const coverVisual = await import('../entry/src/main/ets/features/bookshelf/ui/BookshelfCoverVisual.ts');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { RssPresentationProjection } = await import('../entry/src/main/ets/features/rss/presentation/RssPresentationProjection.ts');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts, options } = installedEtsCompiler();
  const root = new URL('../', import.meta.url);
  const overrides = new Map();
  const read = path => overrides.get(path) ?? readFileSync(new URL(path, root), 'utf8');
  const rssPath = 'entry/src/main/ets/features/rss/ui/RssPage.ets';
  const searchPath = 'entry/src/main/ets/features/search/ui/SearchPage.ets';
  const importPath = 'entry/src/main/ets/features/bookshelf/ui/LocalImportDialog.ets';
  const appearancePath = 'entry/src/main/ets/features/reading/ui/ReaderControlAppearanceContent.ets';
  const shelfPath = 'entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets';
  const feedPath = 'entry/src/main/ets/features/rss/ui/RssSourceFeedPage.ets';
  const managementPath = 'entry/src/main/ets/features/rss/ui/RssSubscriptionManagementPage.ets';
  const sourcePath = 'entry/src/main/ets/features/source/ui/SourceManagementPage.ets';
  const results = {};

  function rssError() {
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(read(rssPath), ['presentation', 'appThemeScheme', 'rssContent',
      'errorContent', 'failedSources', 'stateCard', 'errorSourceRow', 'stateButtons'], controls.dependencies, controls.hooks).owner;
    let refreshed = 0;
    Object.assign(owner, { contentFrame: () => ({ width: 320, left: 0, right: 0 }),
      pageGeometry: () => ({ content: { startInset: 60, endInset: 20 } }), onManage() {}, onRefresh: () => refreshed++ });
    owner.presentation = { kind: 'fatalError', failedSources: [{ name: '同名源', reason: '旧原因' }] };
    owner.rssContent();
    const body = controls.nodes(owner).find(node => node.type === 'Text' && String(node.create).startsWith('1 个订阅源'));
    assert.ok(body);
    owner.presentation = { kind: 'fatalError', failedSources: [
      { name: '同名源', reason: '当前原因' }, { name: '同名源', reason: '另一个源原因' },
    ] };
    controls.properties.flush();
    assert.match(body.create, /^2 个订阅源/, 'retained RSS error count consumes current presentation');
    const texts = controls.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
    assert.ok(texts.includes('当前原因') && texts.includes('另一个源原因'), 'distinct same-name RSS errors consume current reasons');
    const action = controls.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '重试刷新');
    assert.ok(action); action.onClick(); assert.equal(refreshed, 1);
    return { currentCount: 2, currentReasons: 2, refreshIntents: refreshed,
      boundary: 'SDK observer and retained ForEach key admission, native row removal/layout is outside this probe' };
  }

  function rssFeedArrays() {
    for (const kind of ['feed', 'refreshing', 'emptyUnread']) {
      const controls = foundationControls();
      const observed = [];
      function Repeat(items) {
        return { each() { return this; }, key() { return this; }, virtualScroll() { return this; },
          render() { observed.push(items.map(item => item.subscriptionId)); } };
      }
      const source = read(rssPath);
      const owner = createReaderBuilderProbe(source, ['presentation', 'rssContent', 'feedScroll', 'emptyUnreadScroll',
        'subscriptionSection', 'recentUnreadSection', 'filteredSubscriptions', 'subscriptionStatus'],
        { ...controls.dependencies, Repeat, RssPresentationProjection }, controls.hooks).owner;
      const subscriptions = Array.from({ length: 3 }, (_, index) => ({ subscriptionId: `source-${index}`,
        title: `源 ${index}`, enabled: true, feedUrl: 'https://example.test/rss', unreadCount: 1 }));
      const unread = Array.from({ length: 2 }, (_, index) => ({ subscriptionId: 'source-0', guid: `item-${index}` }));
      Object.assign(owner, { filterValue: '全部', contentFrame: () => ({ width: 320, left: 0, right: 0 }),
        pageGeometry: () => ({ content: { startInset: 60, endInset: 20 } }), readFeedback() {}, refreshingRow() {},
        recentUnreadHeader() {}, emptyUnreadSection() {} });
      owner.presentation = { kind, subscriptions: subscriptions.slice(0, 1), recentUnread: unread.slice(0, 1) };
      owner.rssContent();
      const lists = controls.nodes(owner).filter(node => node.type === 'List');
      owner.presentation = { kind, subscriptions, recentUnread: unread }; controls.properties.flush();
      assert.equal(lists[0].height, 186, `retained RSS ${kind} subscription list consumes current array`);
      if (kind !== 'emptyUnread') assert.equal(lists[1].height, 144, 'retained RSS unread list consumes current array');
      assert.ok(observed.some(ids => ids.length === 3), 'current subscriptions reach Repeat input');
    }
    return { modes: 3, currentListExtents: 5, boundary: 'Finite Repeat input recorder, native virtualization remains target evidence' };
  }

  function rssRepeatRows() {
    const controls = foundationControls();
    const ports = new Map();
    function Repeat(items) {
      let each, key;
      return { each(callback) { each = callback; return this; }, key(callback) { key = callback; return this; },
        virtualScroll() { return this; }, render(initial) {
          items.forEach((item, index) => {
            const id = key(item);
            if (initial && !ports.has(id)) { const port = { item, index }; ports.set(id, port); each(port); }
            else if (ports.has(id)) Object.assign(ports.get(id), { item, index });
          });
        } };
    }
    class BadgePort {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      updateStateVars(params) { Object.assign(this.params, params); }
    }
    const owner = createReaderBuilderProbe(read(rssPath), ['presentation', 'rssContent', 'feedScroll',
      'subscriptionSection', 'recentUnreadSection', 'sourceItem', 'recentUnreadItem', 'filteredSubscriptions',
      'subscriptionStatus', 'sourceSubtitle', 'sourceBadgeStatus', 'sourceBadgeLabel', 'sourceRowOpacity', 'itemSubtitle'],
      { ...controls.dependencies, Repeat, RssPresentationProjection, STATUS_PAUSED_OPACITY: 0.62, StatusBadge: BadgePort,
        ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } },
      { ...controls.hooks, childSources: { ...controls.hooks.childSources, StatusBadge: read('entry/src/main/ets/ui/controls/StatusBadge.ets') } }).owner;
    const calls = [];
    const sub = { subscriptionId: 'current', title: '旧源', enabled: true, feedUrl: 'https://example.test/old', unreadCount: 1 };
    const other = { ...sub, subscriptionId: 'other', title: '另一源' };
    const item = { subscriptionId: 'current', guid: 'article', title: '旧文章', description: '旧摘要', pubDate: '昨天' };
    const otherItem = { ...item, guid: 'other-article' };
    Object.assign(owner, { filterValue: '全部', contentFrame: () => ({ width: 320, left: 0, right: 0 }),
      pageGeometry: () => ({ content: { startInset: 60, endInset: 20 } }), readFeedback() {}, recentUnreadHeader() {},
      onSelectSubscription: id => calls.push(['source', id]), onSelectItem: (id, guid) => calls.push(['item', id, guid]) });
    owner.presentation = { kind: 'feed', subscriptions: [other, sub], recentUnread: [otherItem, item] };
    owner.rssContent();
    for (const node of [...owner.nodes.values()]) {
      if (node.type === 'ListItem' && Array.isArray(node.create) && typeof node.create[0] === 'function')
        node.create[0](node.id, true);
    }
    const ids = [...owner.nodes.keys()];
    const sourceTitle = controls.nodes(owner).findLast(node => node.type === 'Text' && node.create === '旧源');
    const articleTitle = controls.nodes(owner).findLast(node => node.type === 'Text' && node.create === '旧文章');
    owner.presentation = { kind: 'feed', subscriptions: [{ ...sub, title: '当前源', enabled: false, unreadCount: 8,
      feedUrl: 'https://example.test/current' }, other], recentUnread: [{ ...item, title: '当前文章', description: '当前摘要', pubDate: '今天' }, otherItem] };
    controls.properties.flush();
    assert.equal(ports.get('rss-sub-current').item.title, '当前源', 'finite Repeat port received current same-key DTO');
    owner.replay(); controls.properties.flush();
    assert.equal(sourceTitle.create, '当前源', 'retained RSS Repeat subscription title consumes current DTO');
    assert.equal(articleTitle.create, '当前文章', 'retained RSS Repeat article title consumes current DTO');
    assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '当前源 · 今天'), 'unread subtitle uses current subscriptions and item');
    for (const value of ['8', 'https://example.test/current', '当前摘要'])
      assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === value), `current RSS metadata ${value}`);
    assert.ok([...owner.children.values()].some(child => child.params?.status === 'paused' && child.params.label === '订阅已暂停'));

    const rows = controls.nodes(owner).filter(node => node.type === 'Row' && typeof node.onClick === 'function' && node.border?.width?.top !== undefined);
    const sourceRow = rows.find(node => node.opacity === 0.62);
    assert.ok(sourceRow); assert.equal(sourceRow.border.width.top, 0, 'retained RSS row consumes current Repeat index');
    assert.equal(rows[3].border.width.top, 0, 'retained RSS article consumes current Repeat index');
    sourceRow.onClick(); rows[3].onClick();
    assert.deepEqual(calls, [['source', 'current'], ['item', 'current', 'article']]);
    assert.deepEqual([...owner.nodes.keys()], ids, 'current DTO/index uses retained SDK native actors');
    return { rows: 4, currentDto: true, currentIndex: true, acceptedCurrentActions: 2,
      boundary: 'Finite RepeatItem reference/index update port, native recycling and layout remain target evidence' };
  }

  function additionalRssRows(management) {
    const controls = foundationControls();
    const ports = new Map();
    function Repeat(items) {
      let each, key;
      return { each(callback) { each = callback; return this; }, key(callback) { key = callback; return this; },
        virtualScroll() { return this; }, render(initial) {
          items.forEach((item, index) => {
            const id = key(item);
            if (initial && !ports.has(id)) { const port = { item, index }; ports.set(id, port); each(port); }
            else if (ports.has(id)) Object.assign(ports.get(id), { item, index });
          });
        } };
    }
    class TogglePort {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      updateStateVars(params) { Object.assign(this.params, params); }
    }
    const path = management ? managementPath : feedPath;
    const methods = management ? ['items', 'subscriptionList', 'subscriptionItem'] : ['items', 'entryList', 'entryRow', 'itemMeta'];
    const owner = createReaderBuilderProbe(read(path), methods,
      { ...controls.dependencies, Repeat, ReaderToggle: TogglePort,
        ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } },
      { ...controls.hooks, childSources: { ...controls.hooks.childSources, ReaderToggle: read('entry/src/main/ets/ui/controls/ReaderToggle.ets') } }).owner;
    const calls = [], focused = [];
    const initial = { subscriptionId: 'current', guid: 'article', title: '旧标题', description: '旧摘要',
      pubDate: '昨天', read: false, enabled: true, meta: '旧来源信息' };
    const other = { ...initial, subscriptionId: 'other' };
    Object.assign(owner, { pageContent() {}, readFacts: { fact: 'current' }, subscription: { title: '当前订阅' },
      isExpanded: () => false, presentationIdentity: 'opening-current', operation: undefined,
      onSelectItem: item => calls.push(item), onToggle: (id, value) => calls.push([id, value]),
      focusSubscriptionIfNeeded: (item, index) => focused.push([item.title, index]), toggleDisclosure() {} });
    owner.items = [other, initial]; owner[management ? 'subscriptionList' : 'entryList']();
    for (const node of [...owner.nodes.values()]) {
      if (node.type === 'ListItem' && Array.isArray(node.create) && typeof node.create[0] === 'function')
        node.create[0](node.id, true);
    }
    const title = controls.nodes(owner).findLast(node => node.type === 'Text' && node.create === '旧标题');
    assert.ok(title); const ids = [...owner.nodes.keys()];
    const current = { ...initial, title: '当前标题', description: '当前摘要', pubDate: '今天', read: true,
      enabled: false, meta: '当前来源信息' };
    owner.updateStateVars({ items: [current, other] }); controls.properties.flush();
    owner.replay(); controls.properties.flush();
    assert.equal(title.create, '当前标题', `retained RSS ${management ? 'management' : 'source'} row consumes current DTO`);
    const row = controls.nodes(owner).filter(node => node.type === 'Row' && node.border?.width?.top !== undefined).at(-1);
    assert.ok(row); assert.equal(row.border.width.top, 0, 'retained additional RSS row consumes current index');
    if (management) {
      assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '当前来源信息'));
      const toggle = [...owner.children.values()].filter(child => child.params?.inputIdentity === 'opening-current:current').at(-1);
      assert.ok(toggle); assert.equal(toggle.params.value, false, 'current management DTO reaches actual Toggle value input');
      toggle.params.onToggle(true); assert.deepEqual(calls, [['current', true]]);
      const appeared = controls.nodes(owner).filter(node => node.type === 'Column' && node.onAppear).at(-1);
      assert.ok(appeared); appeared.onAppear(); assert.deepEqual(focused, [['当前标题', 0]]);
    } else {
      assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '当前订阅 · 今天'));
      assert.ok(controls.nodes(owner).some(node => node.type === 'Text' && node.create === '当前摘要'));
      row.onClick(); assert.equal(calls.length, 1); assert.equal(calls[0].title, '当前标题'); assert.equal(calls[0].read, true);
    }
    assert.deepEqual([...owner.nodes.keys()], ids, 'same-key RSS updates preserve recorded native row actors');
    return { currentDto: true, currentIndex: true, currentAction: true,
      boundary: 'Finite RepeatItem and Toggle input ports. Actual native recycling, Toggle focus and pixel layout remain target evidence' };
  }

  function rssManagementActions() {
    const controls = foundationControls();
    class ActionPort {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      updateStateVars(params) { Object.assign(this.params, params); }
    }
    const sources = { ...controls.hooks.childSources,
      ReaderToggle: read('entry/src/main/ets/ui/controls/ReaderToggle.ets'),
      ReaderLabeledIconAction: read('entry/src/main/ets/ui/controls/ReaderLabeledIconAction.ets') };
    const owner = createReaderBuilderProbe(read(managementPath), ['subscriptionItem', 'actionBar', 'actionTarget'],
      { ...controls.dependencies, ReaderToggle: ActionPort, ReaderLabeledIconAction: ActionPort },
      { ...controls.hooks, childSources: sources, allowEmptyBranchAdmission: true }).owner;
    let item = { subscriptionId: 'initial', title: '初始源', meta: '初始来源', enabled: true };
    const calls = [];
    Object.assign(owner, { presentationIdentity: 'opening-current', operation: undefined, isExpanded: () => true,
      onToggle: id => calls.push(['toggle', id]), onViewArticles: id => calls.push(['view', id]), onEditSource: id => calls.push(['edit', id]),
      onRefresh: id => calls.push(['refresh', id]), onDelete: id => calls.push(['delete', id]),
      focusSubscriptionIfNeeded() {} });
    owner.subscriptionItem(() => item, () => 0);
    const oldToggle = [...owner.children.values()].find(child => child.params?.inputIdentity === 'opening-current:initial');
    assert.ok(oldToggle);
    const actions = [...owner.children.values()].filter(child => child.params?.label);
    assert.equal(actions.length, 4);
    item = { ...item, subscriptionId: 'current', title: '当前源' }; owner.replay(); controls.properties.flush();
    oldToggle.params.onToggle(false); assert.deepEqual(calls, [], 'old Toggle entity callback is retired before current actions');
    for (const action of actions) action.params.onAction();
    assert.deepEqual(calls, [['view', 'current'], ['edit', 'current'], ['refresh', 'current'], ['delete', 'current']],
      'retained RSS management actions consume current recycled entity');
    return { currentActions: 4, boundary: 'Finite row-item replacement and shared action constructor callback ports. Native recycling and focus remain target evidence' };
  }

  function shelfRowIndex() {
    const controls = foundationControls();
    const motionPath = 'entry/src/main/ets/ui/foundation/MotionSpec.ets';
    const linearCurve = { interpolate: value => value };
    const { BOOKSHELF_VIEW_MOTION } = selectedProductionValues(new URL(motionPath, root), ['BOOKSHELF_VIEW_MOTION'],
      { curves: { cubicBezierCurve: () => linearCurve }, Curve: { Linear: 'linear', EaseOut: 'ease-out' } });
    const motionSource = read(motionPath);
    const tree = ts.createSourceFile('MotionSpec.ets', motionSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const delay = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'bookshelfViewCoverDelayMs');
    assert.ok(delay);
    const bookshelfViewCoverDelayMs = new Function('BOOKSHELF_VIEW_MOTION',
      stripTypeScriptTypes(delay.getText(tree)).replace(/^export /, '') + ';return bookshelfViewCoverDelayMs;')(BOOKSHELF_VIEW_MOTION);
    const { BookshelfRowDataSource } = selectedProductionClasses(new URL(shelfPath, root), ['BookshelfRowDataSource'],
      { DataOperationType: { ADD: 'ADD', DELETE: 'DELETE', RELOAD: 'RELOAD' } });
    const methods = ['bookshelfList', 'projectionRow', 'projectionBookCard', 'projectionBookCover', 'projectionBookCoverLayer',
      'projectionListProgress', 'projectionRowHeight', 'projectionBookWidth', 'projectionBookHeight',
      'projectionBookTranslateX', 'projectionBookTranslateY', 'projectionCoverScale', 'projectionCoverRadius',
      'projectionCoverCompensationX', 'projectionCoverCompensationY', 'bookRowRenderKey'];
    class CoverPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
    const source = read(shelfPath);
    const nativeGesture = new Proxy({}, { get: () => () => {} });
    const owner = createReaderBuilderProbe(source, methods, { ...controls.dependencies, ...coverVisual,
      motionSegment, bookshelfViewCoverDelayMs, BookshelfSectionHeader: CoverPort, ImageFit: { Cover: 'cover' }, NoCoverCover: CoverPort,
      globalThis: { Gesture: nativeGesture }, LongPressGesture: nativeGesture, GesturePriority: { Low: 'low' } },
      { ...controls.hooks, childSources: { ...controls.hooks.childSources, NoCoverCover: read('entry/src/main/ets/ui/patterns/NoCoverCover.ets'), BookshelfSectionHeader: read('entry/src/main/ets/features/bookshelf/ui/BookshelfSectionHeader.ets') } }).owner;
    Object.assign(owner, { viewMotion: BOOKSHELF_VIEW_MOTION, viewSwitchRunning: true, reduceMotion: false,
      viewMode: 'cover', viewSwitchDestinationMode: 'list', viewSwitchTimeMs: BOOKSHELF_VIEW_MOTION.layoutCommitMs + 20,
      shelfBookCardWidth: () => 100, shelfContentWidth: () => 300, gridBookCardHeight: () => 140,
      listRowHeight: () => 160, listCoverWidth: () => 60, listCoverHeight: () => 80, bookCardHeight: () => 140,
      bookRowSpace: () => 10, projectionGridDetails() {}, projectionListDetails() {}, hasCover: () => true,
      bookActionFocusKey: book => `book:${book.bookId}`, bookCoverMotionId: book => `cover:${book.bookId}`,
      gridProgressLabel: () => '', bookSelectionHandler: () => () => {}, bookActionPresentationHandler: () => () => {},
      projectionCoverLayerOpacity: () => 1, viewSwitchGridContentOpacity: 1 });
    const row = [{ sourceId: 'local', bookId: 'current', title: '当前书', author: '作者', coverUrl: 'test://cover' }];
    const other = [{ ...row[0], bookId: 'other' }];
    const data = new BookshelfRowDataSource(value => owner.bookRowRenderKey(value, 0));
    data.replace([row, other]);
    const initialKey = owner.bookRowRenderKey(row, 0);
    const currentPosition = typeof data.positionForKey === 'function' ? data.positionForKey(initialKey, 0) : undefined;
    assert.ok(source.includes('this.rowDataSource.positionForKey(this.bookRowRenderKey(row, rowIndex), rowIndex)'), 'normal bookshelfList entry binds the position getter to its actual row key');
    const rowMethod = source.match(/private projectionRow\([^\n]+/)[0];
    owner.projectionRow(row, false, rowMethod.includes('rowIndex: () => number') ? currentPosition : 0);
    const card = controls.nodes(owner).find(node => node.id === 'book:current');
    const cover = controls.nodes(owner).find(node => node.id === 'cover:current');
    assert.ok(card && cover); const before = card.width, ids = [...owner.nodes.keys()];
    let notifiedPosition;
    data.registerDataChangeListener({ onDataReloaded() { assert.fail('mixed legacy reload'); }, onDatasetChange(ops) { assert.deepEqual(ops,[{type:'RELOAD'}]); notifiedPosition = currentPosition?.(); } });
    data.replace([other, row]); owner.replay(); controls.properties.flush();
    assert.equal(owner.bookRowRenderKey(row, 1), initialKey, 'current row key intentionally excludes its moved position');
    const expected = owner.projectionBookWidth(false, 3);
    assert.notEqual(expected, before, 'first-row and later-row motion cadence differ at this actual sample');
    assert.equal(card.width, expected, 'retained shelf card consumes current row motion band');
    assert.equal(cover.borderRadius, owner.projectionCoverRadius(false, 3), 'retained shelf cover consumes current row motion band');
    const image = controls.nodes(owner).find(node => node.type === 'Image' && node.create === 'test://cover');
    assert.equal(image.borderRadius, owner.projectionCoverRadius(false, 3), 'retained shelf cover layer consumes current row motion band');
    const nativeRow = controls.nodes(owner).find(node => node.type === 'Stack' && node.width === 300);
    assert.equal(nativeRow.height, owner.projectionRowHeight(row, false, 3));
    assert.deepEqual([...owner.nodes.keys()], ids, 'row position updates preserve existing card and cover actors');
    assert.equal(currentPosition(), 1);
    assert.equal(notifiedPosition, 1, 'current position map is committed before synchronous native reload listeners');
    data.replace([row, other]); owner.replay(); assert.equal(card.width, before, 'returning to first row restores current cadence');
    data.replace([other]); assert.equal(currentPosition(), 0, 'removed row keeps its captured fallback for its final paint');
    return { rowPositions: [0, 1, 0], currentCadence: true, actorIdentityRetained: true,
      boundary: 'Actual motion timings and methods with finite linear native curve, native LazyForEach moves/compositor remain target evidence' };
  }

  function searchEmpty() {
    const controls = foundationControls();
    const feedback = boundedSurfaceSdk({ properties: controls.properties });
    const hooks = { ...controls.hooks, ...feedback.hooks,
      childSources: { ...controls.hooks.childSources, ...feedback.childSources, SearchResultCard: read(searchPath) } };
    const owner = createReaderBuilderProbe(read(searchPath), ['presentation', 'resultsContent', 'emptyContent'],
      { ...controls.dependencies, ...feedback.deps, SearchResultCard: class {}, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} }, readerScrollStartOffset: () => 60, readerScrollEndOffset: () => 20 }, hooks).owner;
    Object.assign(owner, { mainSearchNotices() {}, resultDataSource: { totalCount: () => 0 }, resultScroller: {}, searchOuterInset: () => 0, scrollLayout: () => ({}),
      isStoppedEmpty: () => false, searchBottomInset: () => 0, searchStateIllustration() {}, emptyStateActions() {},
      viewState: { revision: 1 }, pageEpoch: 1, visibleGroups: [], searchResultWidth: () => 320, searchContentStartInset: () => 0 });
    owner.presentation = { kind: 'empty', keyword: '原关键词', searchedSourceCount: 1 };
    owner.resultsContent();
    for (const node of [...owner.nodes.values()]) {
      if (node.type === 'ListItem' && Array.isArray(node.create) && typeof node.create[0] === 'function')
        node.create[0](node.id, true);
    }
    owner.presentation = { kind: 'empty', keyword: '当前关键词', searchedSourceCount: 7 };
    controls.properties.flush();
    assert.ok(feedback.nodes(owner).some(node => node.type === 'Text' &&
      node.create === '已搜索 7 个书源,未找到「当前关键词」的相关结果'), 'retained Search empty message consumes current facts ' + JSON.stringify(feedback.nodes(owner).filter(node => node.type === 'Text').map(node => node.create)));
    return { currentKeyword: true, currentCount: true };
  }

  function importFormats() {
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(read(importPath), ['appThemeScheme', 'fileSelectionBody', 'formatBadge'],
      { ...controls.dependencies, LOCAL_IMPORT_FILE_FOCUS_ID: 'import-file', BorderStyle: { Dashed: 'dashed' } }, controls.hooks).owner;
    Object.assign(owner, { canSelectFiles: () => true, selectFiles() {}, selectionBlockedMessage: '', failureMessage: '' });
    owner.fileSelectionBody();
    const badges = controls.nodes(owner).filter(node => node.type === 'Text' && ['TXT', 'EPUB', 'MOBI', 'AZW3'].includes(node.create));
    assert.equal(badges.length, 4);
    owner.appThemeScheme = 'night'; controls.properties.flush();
    assert.deepEqual(badges.map(node => node.backgroundColor), ['TOK_GREEN', 'app.import.formatText',
      'app.import.formatEpub', 'app.import.formatArchive'].map(role => readerAppColor(role, 'night')),
    'retained format badge backgrounds consume current theme');
    return { badges: 4, currentTheme: true };
  }

  function appearanceGeometry() {
    const controls = foundationControls();
    const { ReaderAppearanceTextMaximum } = pureModuleProbe(read(appearancePath).split('@Component')[0],
      'ReaderControlAppearanceContent.ets', { FrameCallback: class {} }, ['ReaderAppearanceTextMaximum']);
    class ReaderSelectPort {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
      updateStateVars(params) { Object.assign(this.params, params); }
    }
    const owner = createReaderBuilderProbe(read(appearancePath), ['layoutLibrary', 'selectField', 'selectFieldContent',
      'stepperRow', 'stepButton'], { ...controls.dependencies, readerAppearanceCanStep: () => true, ReaderAppearanceTextMaximum, ReaderSelect: ReaderSelectPort },
      { ...controls.hooks, childSources: { ...controls.hooks.childSources, ReaderSelect: read('entry/src/main/ets/ui/controls/ReaderSelect.ets') } }).owner;
    let width = 320, rowOffset = 0, steps = 0;
    Object.assign(owner, { frame: () => ({ sectionWidth: width, layout: { width, height: 500, opacity: 1 } }),
      actorPosition: () => ({ x: 0, y: 0 }), presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
      minimumProfile: () => undefined, layoutHeaderHeight: () => 30, layoutRowTop: index => 40 + rowOffset + index * 40,
      selectRowHeight: () => 40, stepperRowHeight: () => 40, stepperOffset: () => 0, stepperControlTop: y => y,
      selectLabel: kind => kind, selectValue: () => '', selectOptions: () => [], selectTriggerFocusId: kind => kind,
      toggleSelect() {}, fullInput: () => true, stepperMinusX: () => width - 130, stepperValueX: () => width - 85,
      stepperPlusX: () => width - 40, metricLabel: metric => metric, metricValue: () => '12', displaySnapshot: () => ({}),
      onMetricStep: () => steps++ });
    owner.layoutLibrary();
    const rows = controls.nodes(owner).filter(node => ['Row', 'Column', 'Stack'].includes(node.type) && node.position?.x === 3);
    const buttons = controls.nodes(owner).filter(node => node.type === 'Button');
    assert.equal(rows.length, 6); assert.equal(buttons.length, 8);
    width = 400; rowOffset = 20; owner.replay();
    assert.deepEqual(rows.map(node => node.position.y), [60, 100, 140, 180, 220, 260],
      'retained appearance rows consume current row geometry');
    assert.deepEqual(buttons.map(node => node.position.x), [270, 360, 270, 360, 270, 360, 270, 360],
      'retained appearance buttons consume current horizontal geometry');
    buttons[0].onClick(); assert.equal(steps, 1);
    return { rows: 6, buttons: 8, currentPositions: true, acceptedStep: 1 };
  }

  function sourceOverlay() {
    const controls = foundationControls();
    class RecoveryNoticePort {
      constructor(owner, params, _storage, id) { Object.assign(this, { owner, id, ...params }); }
      updateStateVars(params) { Object.assign(this, params); }
    }
    const owner = createReaderBuilderProbe(read(sourcePath), ['pendingOverlay'],
      { ...controls.dependencies, ReaderRecoveryNotice: RecoveryNoticePort }, { ...controls.hooks,
        childSources: { ...controls.hooks.childSources, ReaderRecoveryNotice: read('entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets') } }).owner;
    let inset = 60;
    Object.assign(owner, { operation: { receipt: { receipt: { confirmation: 'unknown' } } },
      geometry: { content: { startInset: inset } }, contentFrame: () => ({ width: 320, left: 10, right: 10 }),
      overlayBottom: () => 500, recovery: () => ({ visible: true, title: '原操作待核对' }),
      onReconcile() {}, appForeground: true, groupOpen: false, statusKind: 'ready' });
    if (read(sourcePath).includes('private pendingOverlay(contentStartInset: number)')) owner.pendingOverlay(owner.geometry.content.startInset);
    else owner.pendingOverlay();
    const column = controls.nodes(owner).find(node => node.type === 'Column' && node.padding?.top === inset);
    assert.ok(column);
    owner.geometry = { content: { startInset: 100 } }; owner.replay(); controls.properties.flush();
    assert.equal(column.padding.top, 100, 'retained source overlay padding consumes current header inset');
    const notice = [...owner.children.values()].find(child => child.maxHeightVp !== undefined);
    assert.ok(notice); assert.equal(notice.maxHeightVp, 400, 'current source overlay capacity excludes current header inset');
    return { currentTop: 100, currentCapacity: 400 };
  }

  function captureParameter(source, method, parameter) {
    const tree = ts.createSourceFile('CurrentBuilder.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const methods = tree.statements.flatMap(node => [...(node.members ?? [])])
      .filter(node => node.name?.getText(tree) === method);
    assert.equal(methods.length, 1);
    const member = methods[0], index = member.parameters.findIndex(node => node.name.getText(tree) === parameter);
    assert.ok(index >= 0);
    const declaration = member.parameters[index];
    assert.ok(ts.isFunctionTypeNode(declaration.type));
    const edits = [{ start: declaration.type.getStart(tree), end: declaration.type.end, text: declaration.type.type.getText(tree) }];
    const reads = node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === parameter) {
        assert.equal(node.arguments.length, 0);
        edits.push({ start: node.getStart(tree), end: node.end, text: parameter });
      }
      ts.forEachChild(node, reads);
    };
    reads(member.body);
    let parentCalls = 0;
    const calls = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && node.expression.name.text === method) {
        parentCalls++;
        const argument = node.arguments[index];
        if (ts.isArrowFunction(argument)) {
          assert.ok(!ts.isBlock(argument.body));
          edits.push({ start: argument.getStart(tree), end: argument.end, text: argument.body.getText(tree) });
        } else if (ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression) && argument.expression.name.text === 'positionForKey') {
          edits.push({ start: argument.getStart(tree), end: argument.end, text: `${argument.getText(tree)}()` });
        } else {
          assert.ok(ts.isIdentifier(argument), 'only actual forwarded getter parameters are restored');
          let parent = node.parent;
          while (parent && !ts.isMethodDeclaration(parent)) parent = parent.parent;
          const forwarded = parent?.parameters.find(item => item.name.getText(tree) === argument.text);
          if (forwarded && ts.isFunctionTypeNode(forwarded.type))
            edits.push({ start: argument.getStart(tree), end: argument.end, text: `${argument.text}()` });
        }
      }
      ts.forEachChild(node, calls);
    };
    calls(tree);
    assert.ok(parentCalls > 0 && edits.length >= 1, 'getter declaration and all actual parent calls located');
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    return source;
  }

  const restoreParameters = (source, methods, parameter) => methods.reduce((current, method) => captureParameter(current, method, parameter), source);
  const negativeCases = {
    'rss-management-actions': [[managementPath, source => captureParameter(source, 'actionBar', 'subscriptionId'), /management actions consume current recycled entity/]],
    'shelf-row-index': [
      [shelfPath, source => captureParameter(source, 'projectionRow', 'rowIndex'), /retained shelf card consumes current row motion band/],
      [shelfPath, source => restoreParameters(source, ['projectionBookCard', 'projectionBookCover', 'projectionBookCoverLayer'], 'index'), /retained shelf card consumes current row motion band/],
      [shelfPath, source => restoreParameters(source, ['projectionBookCover', 'projectionBookCoverLayer'], 'index'), /retained shelf cover consumes current row motion band/],
      [shelfPath, source => captureParameter(source, 'projectionBookCoverLayer', 'index'), /retained shelf cover layer consumes current row motion band/],
    ],
    'rss-source-rows': [
      [feedPath, source => captureParameter(source, 'entryRow', 'item'), /source row consumes current DTO/],
      [feedPath, source => captureParameter(source, 'entryRow', 'index'), /additional RSS row consumes current index/],
    ],
    'rss-management-rows': [
      [managementPath, source => captureParameter(source, 'subscriptionItem', 'item'), /management row consumes current DTO/],
      [managementPath, source => captureParameter(source, 'subscriptionItem', 'index'), /additional RSS row consumes current index/],
    ],
    'rss-error': [
      [rssPath, source => captureParameter(source, 'stateCard', 'body'), /retained RSS error count/],
      [rssPath, source => captureParameter(source, 'stateCard', 'failedSources'), /distinct same-name RSS errors/],
      [rssPath, source => source.replace("JSON.stringify([index, source.name, source.reason ?? ''])", '`rss-fail-${source.name}`'), /distinct same-name RSS errors/],
    ],
    'rss-feed-arrays': [
      [rssPath, source => restoreParameters(source, ['feedScroll', 'emptyUnreadScroll', 'subscriptionSection', 'recentUnreadSection', 'recentUnreadItem'], 'subscriptions'), /subscription list consumes current array/],
      [rssPath, source => restoreParameters(source, ['feedScroll', 'recentUnreadSection'], 'recentUnread'), /unread list consumes current array/],
    ],
    'rss-repeat-rows': [
      [rssPath, source => captureParameter(source, 'sourceItem', 'sub'), /retained RSS Repeat subscription title/],
      [rssPath, source => captureParameter(source, 'sourceItem', 'index'), /retained RSS row consumes current Repeat index/],
      [rssPath, source => captureParameter(source, 'recentUnreadItem', 'item'), /retained RSS Repeat article title/],
      [rssPath, source => captureParameter(source, 'recentUnreadItem', 'index'), /retained RSS article consumes current Repeat index/],
      [rssPath, source => captureParameter(source, 'recentUnreadItem', 'subscriptions'), /unread subtitle uses current/],
    ],
    'search-empty': [
      [searchPath, source => captureParameter(source, 'emptyContent', 'keyword'), /retained Search empty message/],
      [searchPath, source => captureParameter(source, 'emptyContent', 'searchedSourceCount'), /retained Search empty message/],
    ],
    'import-formats': [[importPath, source => source.replace('.backgroundColor(readerAppColor(colorRole, this.appThemeScheme))', ".backgroundColor(readerAppColor(colorRole, 'day'))"), /retained format badge backgrounds/]],
    'appearance-geometry': [
      [appearancePath, source => restoreParameters(source, ['selectField', 'selectFieldContent', 'stepperRow'], 'y'), /retained appearance rows/],
      [appearancePath, source => captureParameter(source, 'stepButton', 'x'), /retained appearance buttons/],
    ],
    'source-overlay': [[sourcePath, source => {
      const start = source.indexOf('  private pendingOverlay()');
      const end = source.indexOf('  private feedbackIdentity', start);
      assert.ok(start > 0 && end > start);
      return source.slice(0, start) + source.slice(start, end).replace('private pendingOverlay()', 'private pendingOverlay(contentStartInset: number)')
        .replaceAll('this.geometry.content.startInset', 'contentStartInset') + source.slice(end);
    }, /retained source overlay padding/]],
  };

  const scenarios = { 'rss-management-actions': rssManagementActions, 'shelf-row-index': shelfRowIndex, 'rss-source-rows': () => additionalRssRows(false), 'rss-management-rows': () => additionalRssRows(true), 'rss-error': rssError, 'search-empty': searchEmpty, 'import-formats': importFormats,
    'appearance-geometry': appearanceGeometry, 'source-overlay': sourceOverlay, 'rss-feed-arrays': rssFeedArrays, 'rss-repeat-rows': rssRepeatRows };
  for (const id of selected) {
    results[id] = scenarios[id]();
    for (const [path, mutate, expected] of negativeCases[id]) {
      const original = read(path), mutant = mutate(original);
      assert.notEqual(mutant, original); overrides.set(path, mutant);
      try { assert.throws(scenarios[id], expected, `${id} old capture must fail a current property/behavior assertion`); }
      finally { overrides.delete(path); }
    }
    results[id].negativeControlsRejected = negativeCases[id].length;
    recordContractCasePass(id);
  }
  const inputs = [shelfPath, rssPath, feedPath, managementPath, searchPath, importPath, appearancePath, sourcePath, 'tools/test-builder-live-data.mjs']
    .map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') }));
  if (output) writeFileSync(new URL(output, root), JSON.stringify({ status: 'PASS', cases: selected, results, inputs }, null, 2) + '\n');
}
