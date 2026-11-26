import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import assert from 'node:assert/strict';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers, readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { actualReaderPageLayout } from './lib/reader-page-shell-runtime-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';
import { localBookDetailSdk, localBookDetailSource } from './lib/local-book-detail-sdk-probe.mjs';
import * as raisedShape from '../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';
import * as windowMetrics from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerIsExpandedWidth } from '../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import { sourceSwitchTriggerFocusId } from '../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';
import * as headerMetrics from '../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import * as fontFamilies from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import { bookCoverDisplayUrl } from '../entry/src/main/ets/app/library/BookCoverDisplay.ts';
import { DEFAULT_BOOKSHELF_VIEW } from '../entry/src/main/ets/features/bookshelf/application/BookshelfViewMode.ts';
const definitions = {
    'shelf-selection-frame': { description: 'Actual selection card/list/details/header SDK, safe lane, font growth and old-code negative controls', resources: [] },
    'shelf-projection-frame': { description: 'Actual bookshelf retained projection SDK, list row/step/cover budgets and selection identity', resources: [] },
    'detail-action-target': { description: 'Actual text/manga detail native action targets and natural parent budgets', resources: [] },
    'detail-notice-width': { description: 'Actual detail notice SDK forwards current outer lane to both recovery surfaces and retains operation identity', resources: [] },
    'management-parent-frame': { description: 'Retained management actual shared controls, caller and Native full-width allocation, and font-aware list frames', resources: [] },
    'shelf-list-residual-lane': { description: 'Actual full-width list rows, optional copy, narrow badges, compact More and scaled retained actors', resources: [] },
    'shelf-filter-action-target': { description: 'Actual shelf filter clear and collapse Native two-axis targets, natural parent budget, and current callbacks', resources: [] },
};
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const surfaceRect = await import('../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts');
const nativeRectMeasurement = pureModuleProbe(read('ui/layout/ReaderSurfaceRectMeasurement.ets'),
    'ReaderSurfaceRectMeasurement.ets', surfaceRect, ['readerMeasureSurfaceRect']);
const nativeSlotMeasurement = pureModuleProbe(read('ui/layout/ReaderNativeSlotMeasurement.ets'),
    'ReaderNativeSlotMeasurement.ets', { FrameCallback: class {}, ...nativeRectMeasurement , ReaderPostLayoutFrame: actualReaderPostLayoutFrame()}, ['ReaderNativeSlotMeasurement']);

const shelf = name => read('features/bookshelf/ui/' + name + '.ets');
const selectionSource = shelf('BookshelfMultiSelectPage');
const detailsSource = shelf('ShelfBookListDetails');
const gridSource = shelf('BookshelfGridSpec');
const grid = pureModuleProbe(gridSource, 'BookshelfGridSpec.ets', { ...readerTypographyRoles, ...readerFoundationTokens,
    ...fontFamilies, prepareReaderFontFamily: async () => {} }, ['bookshelfGridFrame', 'bookshelfCoverHeight', 'bookshelfGridTextFrame',
    'bookshelfColumnCount', 'bookshelfListCardWidth', 'bookshelfListTextHeight', 'bookshelfListTextFrame', 'BookshelfListTextBudget',
    'prepareBookshelfListTextFonts', 'bookshelfSelectionCardHeight', ...Array.from(gridSource.matchAll(/^export const (BOOKSHELF_\w+)/gm), match => match[1])]);
const action = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets', { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } }, ['ReaderActionAccessibility', 'READER_ACTION_MIN_TARGET']);
const book = { sourceId: 'source', bookId: 'one', title: '一部长标题与真实当前书籍身份', author: '超长作者名称用于窄窗口与两倍系统字体',
    currentChapterTitle: '当前章节标题', latestChapterTitle: '最新章节标题', readProgress: 0.234, contentKind: 'text', coverUrl: 'https://example.test/cover' };
// Finite Repeat scheduling port mounts the SDK-emitted visible item closures.
// Native virtualization, branch removal and pixel layout stay outside this probe.
function Repeat(data) {
    let each;
    return {
        each(callback) {
            each = callback;
            return this;
        },
        key() { return this; },
        virtualScroll() { return this; },
        render(initial) {
            if (initial) data.forEach(item => each({ item }));
        },
    };
}
const constants = source => pureModuleProbe(source.match(/^const .+;$/gm)?.join('\n') ?? '', 'PageConstants.ts', {}, [...source.matchAll(/^const (\w+) =/gm)].map(m => m[1]));
const detailDeps = source => ({ ...fontFamilies, ...constants(source), EllipsisMode: { END: 'EllipsisMode.END' } });
let metrics;
function setMetrics(width, scale, left = 0, right = 0) {
    metrics = new windowMetrics.ReaderWindowMetricsSnapshot(new windowMetrics.ReaderRectVp(0, 0, width, 844));
    metrics.systemFontScale = scale;
    metrics.systemInsets = new windowMetrics.ReaderInsetsVp(left, 0, right, 0);
    metrics.gestureInsets = new windowMetrics.ReaderInsetsVp(left, 0, right, 0);
    return metrics;
}
class Cover {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
const nodes = owner => [...owner.nodes.values()];
const recursiveNodes = owner => [...nodes(owner), ...[...owner.children.values()].flatMap(child => child.nodes ? recursiveNodes(child) : [])];
const recursiveActors = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? recursiveActors(child) : [])];
function selectionSdk(candidate = selectionSource, detailCandidate = detailsSource, overrides = {}) {
    const properties = createArkUIPropertyRuntimeProbe();
    const deps = { ...properties.sdk, ...readerTypographyRoles, ...readerFoundationTokens, ...windowMetrics, ...actualReaderPageLayout(), ...nativeSlotMeasurement, ...grid, ...action,
        ...constants(candidate), ...detailDeps(detailCandidate), Repeat, ListItemAlign: { Center: 'ListItemAlign.Center' }, ShelfBookPresentation, bookCoverDisplayUrl, DEFAULT_BOOKSHELF_VIEW, readerIsExpandedWidth, registerReaderFonts() { }, readerFontFamilyReady: () => true, prepareReaderFontFamily: async () => { },
        NoCoverCover: Cover, ReaderWindowCoordinator: { metrics: () => metrics }, readerActionIcon: () => '',
        uiContext: { getFont: () => ({}), px2vp: x => x, getMeasureUtils: () => ({ measureText(options) {
                    const size = Number.parseFloat(options.fontSize), factor = String(options.fontSize).endsWith('vp') ? 1 : metrics.systemFontScale, wide = options.fontFamily === readerTypographyRoles.TYPE_SHELF_SELECTION_HEADING.fontFamily;
                    // Finite real-font measurements are recorded in the private repair receipt.
                    // These CJK labels have one-em glyph advances. Heading includes the real
                    // NotoSerif spacing/digit advances measured at 24vp.
                    if (wide) {
                        const digit = options.textContent.match(/\d+/)?.[0] ?? '0';
                        const base = digit === '1' ? 119.184 : digit.length === 4 ? 165.216 : 122.232;
                        return base * factor;
                    }
                    return Array.from(options.textContent).length * size * factor;
                } }) }, ...overrides };
    const hooks = { ...properties.hooks, mountChildren: true, childSources: { ShelfBookListDetails: detailCandidate, NoCoverCover: read('ui/patterns/NoCoverCover.ets') } };
    deps.ShelfBookListDetails = createReaderBuilderProbe(detailCandidate, boundedMembers(detailCandidate), deps, hooks).Component;
    const probe = createReaderBuilderProbe(candidate, boundedMembers(candidate), deps, hooks);
    Object.assign(probe.owner, { books: [book], mounted: true, viewportWidth: metrics.windowRect.width, viewportHeight: 844, readerWindowMetricsRevision: 1,
        appThemeScheme: 'day', selectedKeys: [], storedViewMode: 'cover', storedSelectedGroup: '', readingFilter: 'all', sourceFilter: 'all', mangaRevision: 0,
        ready: true, busy: false });
    probe.owner.refreshGeometry();
    return { ...probe, properties };
}
function checkDetails(owner, currentBook = book) {
    const details = [...owner.children.values()].find(child => child.book?.bookId === currentBook.bookId && child.nodes);
    assert.ok(details, 'consumer mounts actual shared details child');
    const all = nodes(details), root = all.find(node => node.type === 'Column');
    assert.equal(root.height, Math.max(88, details.textFrame.height), 'details reserve the full text lane');
    assert.equal(root.justifyContent, 'FlexAlign.SpaceBetween');
    for (const value of [currentBook.title, currentBook.author, ShelfBookPresentation.listReadingPosition(currentBook),
        ShelfBookPresentation.listSecondary(currentBook)].filter(Boolean)) {
        const label = all.find(node => node.type === 'Text' && node.create === value);
        assert.ok(label, value);
        assert.equal(label.maxLines, 1);
        assert.equal(label.ellipsisMode, 'EllipsisMode.END');
    }
    for (const value of [currentBook.title, currentBook.author]) {
        const label = all.find(node => node.type === 'Text' && node.create === value);
        assert.equal(label.layoutWeight, 1);
        assert.equal(label.constraintSize.minWidth, 0);
    }
    assert.ok(!all.some(node => ['小说', '在线', '最新：暂无最新章节'].includes(node.create)));
    return details;
}
function selectionFrame(candidate = selectionSource, detailCandidate = detailsSource) {
    for (const width of [320, 366, 390, 600, 760])
        for (const scale of [1, 1.3, 1.6, 2])
            for (const [left, right] of [[0, 0], [28, 12], [12, 28]]) {
                setMetrics(width, scale, left, right);
                const fixture = selectionSdk(candidate, detailCandidate), owner = fixture.owner;
                const frame = owner.geometry.content.frame;
                assert.ok(frame.left >= left && frame.right >= right && frame.left + frame.width + frame.right <= width + .001);
                owner.selectionList();
                const list = nodes(owner).find(node => node.type === 'List');
                assert.equal(list.width, frame.width);
                assert.equal(list.margin.left, frame.left);
                const gridRow = nodes(owner).find(node => node.type === 'Row' && typeof node.width === 'number');
                assert.ok(gridRow.width <= frame.width, 'real grid row stays inside safe lane');
                const card = nodes(owner).find(node => node.type === 'Column' && typeof node.onClick === 'function');
                assert.ok(card.width * 3 + owner.gridFrame().columnGap * 2 <= frame.width + .001, 'three real selection cards fit the safe content lane');
                assert.ok(card.height >= owner.coverHeight() + 12 + (owner.isWide() ? 35.5 : 29.5) * scale, 'selection text lanes grow after the unchanged cover ratio');
                const selected = [];
                owner.onRemoveSelected = keys => selected.push(keys);
                card.onClick();
                assert.equal(owner.selectedKeys.length, 1);
                const listFixture = selectionSdk(candidate, detailCandidate), listOwner = listFixture.owner;
                listOwner.storedViewMode = 'list';
                listOwner.selectedKeys = [listOwner.bookKey(book)];
                listOwner.onRemoveSelected = keys => selected.push(keys);
                listOwner.selectionList();
                const row = nodes(listOwner).find(node => node.type === 'Row' && typeof node.onClick === 'function');
                assert.ok(row.width <= frame.width, 'real selection list row stays inside safe lane');
                assert.ok(row.height >= grid.bookshelfListTextHeight(scale), 'selection list parent pays shared text height');
                const child = checkDetails(listOwner), childIds = nodes(child).map(n => n.id);
                metrics.systemFontScale = 2;
                listOwner.readerWindowMetricsRevision += 1;
                listOwner.listTextFontRevision += 1;
                listOwner.replay();
                child.replay();
                listFixture.properties.flush();
                assert.deepEqual(nodes(child).map(n => n.id), childIds);
                assert.equal(row.height, listOwner.listContentHeight() + 2 * (12 + readerFoundationTokens.TOK_BORDER_W),
                    'same actor list budget reacts to system font change');
                listOwner.removeVisibleSelection();
                assert.deepEqual(selected, [[listOwner.bookKey(book)]]);
            }
    setMetrics(320, 2);
    const fixture = selectionSdk(candidate, detailCandidate), owner = fixture.owner;
    owner.selectedKeys = [owner.bookKey(book)];
    owner.selectionTopBar();
    assert.equal(owner.selectionHeaderInline(), false, '2x header selects stacked composition from actual measured widths');
    assert.ok(owner.selectionHeaderMinimumHeight() >= 126.98, 'header reserves 2x heading plus a real 44 action row and padding');
    const header = nodes(owner).find(node => node.type === 'Column');
    assert.equal(header.height, undefined, 'header grows naturally');
    const all = nodes(owner), buttons = all.filter(node => node.type === 'Button');
    assert.equal(buttons.length, 2);
    for (const button of buttons) {
        assert.ok(button.constraintSize.minHeight >= 44);
        assert.equal(button.width, undefined, 'four-character action retains its natural width');
    }
    const select = buttons.find(node => node.accessibilityText === '取消全选');
    assert.ok(select);
    select.onClick();
    assert.equal(owner.selectedKeys.length, 0);
    assert.equal(all.find(node => node.type === 'Text' && node.create === '取消全选').maxLines, 1);
}
function selectionWrappedHeader(candidate = selectionSource) {
    setMetrics(320, 2, 28, 12);
    const { owner } = selectionSdk(candidate);
    owner.books = [book, { ...book, bookId: 'two' }, { ...book, bookId: 'three' }];
    owner.selectedKeys = owner.books.map(current => owner.bookKey(current));
    const context = owner.getUIContext();
    const utils = context.getMeasureUtils();
    const measurements = [];
    owner.getUIContext = () => ({ ...context, getMeasureUtils: () => ({ ...utils, measureTextSize(options) {
        measurements.push(options);
        return { height: 137.96 };
    } }) });
    owner.onGeometryInputsChanged();
    assert.ok(owner.geometry.header.height >= 195.96, 'stacked header pays the current native two-line title receipt plus its action row');
    assert.equal(measurements[0].constraintWidth, '240vp');
    assert.equal(measurements[0].fontSize, '24fp');
    assert.equal(measurements[0].lineHeight, '34.49fp');
    owner.selectionTopBar();
    const heading = nodes(owner).find(node => node.type === 'Text' && node.create === '已选择 3 本');
    assert.equal(heading.maxLines, undefined, 'stacked title can wrap inside asymmetric safe edges');
}

async function selectionFontReceipt(candidate = selectionSource) {
    setMetrics(390, 1);
    let ready = false;
    const receipts = [];
    const fixture = selectionSdk(candidate, detailsSource, { readerFontFamilyReady: () => ready, prepareReaderFontFamily: () => new Promise(resolve => receipts.push(resolve)) });
    const owner = fixture.owner;
    assert.equal(owner.selectionHeaderInline(), false, 'pending font receipt uses natural stacked header');
    owner.initialSelectedKey = owner.bookKey(book);
    owner.aboutToAppear();
    assert.equal(owner.selectedKeys[0], owner.bookKey(book), 'normal page entry retains the long-pressed book before deriving its header budget');
    assert.equal(receipts.length, 2);
    const key = owner.measurementKey;
    const footerKey = owner.footerMeasurementKey;
    owner.recordMeasurement('selection:header', 100, key);
    ready = true;
    receipts.forEach(resolve => resolve());
    await new Promise(done => setImmediate(done));
    assert.equal(owner.headerFontRevision, 1, 'checked font receipt changes the actual header observer input');
    assert.equal(owner.measurementKey, key + 1, 'font completion invalidates old header measurement generation');
    assert.equal(owner.footerMeasurementKey, footerKey, 'header font completion preserves independent footer measurement');
    assert.notEqual(owner.geometry.header.height, 100, 'old fallback-font height is excluded from current geometry');
    assert.equal(owner.selectionHeaderInline(), true, 'ready fonts restore the single-line default header when it fits');
    owner.prepareSelectionHeaderFonts();
    owner.aboutToDisappear();
    receipts.slice(2).forEach(resolve => resolve());
    await new Promise(done => setImmediate(done));
    assert.equal(owner.headerFontRevision, 1, 'late font completion cannot update a retired page');
}
function projectionFrame(candidate = shelf('BookshelfPage')) {
    const near = (actual, expected, message) => {
        assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${message} uses finite geometry`);
        assert.ok(Math.abs(actual - expected) <= 1e-9, `${message}: ${actual} vs ${expected}`);
    };
    const methods = ['projectionRowHeight', 'projectionBookWidth', 'projectionBookHeight', 'projectionBookTranslateX', 'projectionBookTranslateY',
        'projectionCoverScale', 'projectionCoverRadius', 'projectionCoverCompensationX', 'projectionCoverCompensationY', 'projectionListDetailsWidth',
        'projectionCoverLayerOpacity', 'gridBookCardHeight', 'gridProgressLabel', 'listCoverWidth', 'listCoverHeight', 'listContentHeight',
        'listRowHeight', 'listTextFrame', 'listTextBudget', 'listTextFontRevision', 'shelfBookCardWidth',
        'bookCardWidth', 'bookCardHeight', 'bookRowSpace', 'projectionListDetails', 'projectionDetailsOpacity', 'projectionListProgress'];
    for (const width of [280, 326, 560, 720])
        for (const scale of [0.85, 1, 1.3, 1.6, 2]) {
            setMetrics(width, scale);
            const properties = createArkUIPropertyRuntimeProbe();
            const controls = iconButtonControls({ properties });
            const deps = { ...controls.dependencies, ...grid, ...action, ...readerFoundationTokens, ...detailDeps(detailsSource),
                ...constants(candidate), ShelfBookPresentation, ReaderWindowCoordinator: { metrics: () => metrics } };
            const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, ShelfBookListDetails: detailsSource } };
            deps.ShelfBookListDetails = createReaderBuilderProbe(detailsSource, boundedMembers(detailsSource), deps, hooks).Component;
            const { owner } = createReaderBuilderProbe(candidate, methods, deps, hooks);
            const expanded = width >= 560;
            Object.assign(owner, { readerWindowMetricsRevision: 1, viewMode: 'list', reduceMotion: true, appThemeScheme: 'day',
                shelfContentWidth: () => width, viewSwitchListContentOpacity: 1, bookActionFocusKey: () => '', bookActionPresentationHandler: () => () => { } });
            owner.projectionListDetails(book, expanded);
            const row = nodes(owner).find(node => node.type === 'Row');
            const innerHeight = Math.max(88, 82 * scale + 6);
            near(row.height, innerHeight, 'main shelf list parent reserves the scaled five-line details height');
            checkDetails(owner);
            const listColumns = expanded ? 2 : 1;
            const rowHeight = owner.listRowHeight(expanded), step = owner.projectionBookTranslateY(listColumns, expanded, 0);
            const projectionBookCount = 3 * listColumns;
            near(rowHeight, innerHeight + 24, 'list card includes both 12vp insets');
            near(owner.projectionBookHeight(book, expanded, 0), rowHeight, 'projection card endpoint pays the current list height');
            near(step, rowHeight + readerFoundationTokens.TOK_SPACE_CONTROL_INLINE, 'projection step pays the current list height and gap');
            near(owner.projectionRowHeight(Array(projectionBookCount).fill(book), expanded, 0), rowHeight * 3 + readerFoundationTokens.TOK_SPACE_CONTROL_INLINE * 2,
                'projection row pays three list lines and two gaps');
            near(owner.listCoverHeight(expanded), grid.bookshelfCoverHeight(62, expanded),
                'both width classes preserve the grid cover aspect ratio in list mode');
            assert.equal(owner.listCoverWidth(expanded), 62, 'both width classes share the nominal cover width');
            owner.viewMode = 'cover';
            owner.replay();
            assert.equal(row.enabled, false);
            assert.equal(row.hitTestBehavior, 'HitTestMode.None');
            owner.viewMode = 'list';
            metrics.systemFontScale = 2;
            owner.readerWindowMetricsRevision += 1;
            owner.replay();
            near(row.height, owner.listRowHeight(expanded) - 24, 'retained details follow the current font budget');
        }
}
function detailActions(candidate = localBookDetailSource) {
    for (const kind of ['text', 'manga'])
        for (const scale of [1, 1.3, 1.6, 2, 3.2]) {
            setMetrics(320, scale, 28, 12);
            const switched = [], opened = [];
            const sdk = localBookDetailSdk({ ...nativeSlotMeasurement, ...action, ...raisedShape, ...readerSurfaceSpecsForProbe(metrics), sourceSwitchTriggerFocusId, ReaderWindowCoordinator: { metrics: () => metrics } }, { source: candidate });
            const owner = sdk.owner;
            Object.assign(owner, { book: { ...book, contentKind: kind, intro: '长简介'.repeat(100), sourceName: '很长的当前来源', mangaPosition: undefined },
                toc: [], mounted: true, viewportWidth: 320, viewportHeight: 844, appThemeScheme: 'day', sourceSwitchEnabled: true, removing: false, admissionIdentity: 'current',
                directoryFocusContext: 'detail', introOverflow: true, introExpanded: false, introMeasured: true, introMeasuredWidth: 240,
                mangaPresentation: new Map(), mangaPreviewRows: [], onSwitchSource: id => switched.push(id), onOpenDirectory: () => opened.push('directory') });
            owner.mangaFontsReady = true;
            owner.refreshGeometry();
            owner.initialRender();
            const buttons = recursiveNodes(owner).filter(node => node.type === 'Button');
            const labels = ['换源', '展开简介', '完整目录'];
            for (const label of labels) {
                const button = buttons.find(node => node.accessibilityText === label);
                assert.ok(button, label);
                assert.ok(button.constraintSize?.minHeight >= 44, `${kind} ${label} native target minimum44`);
                if (label === '完整目录') {
                    const directoryActor = recursiveActors(owner).find(actor => actor.specId === 'detail-directory');
                    assert.ok(directoryActor, 'actual shared directory action');
                    const nativeDirectory = recursiveNodes(directoryActor).filter(node => node.type === 'Row' && node.constraintSize?.minHeight === 30);
                    assert.ok(nativeDirectory.length > 0 && nativeDirectory.every(node => node.height === undefined),
                        'authored thirty-vp content row grows naturally within its paid44 native action');
                    assert.equal(button.width, undefined, 'directory native width follows its icon, label and padding');
                }
                else
                    assert.ok(button.constraintSize?.minWidth >= 44, `${kind} ${label} native width minimum44`);
                assert.equal(button.height, undefined, 'action grows with line height');
                button.onClick();
            }
            assert.equal(switched.length, 1);
            assert.equal(owner.introExpanded, true);
            assert.deepEqual(opened, ['directory']);
            for (const label of [owner.readingActionLabel(), owner.shelfActionLabel()]) {
                const target = buttons.find(node => node.accessibilityText === label);
                assert.ok(target);
                assert.equal(target.height, undefined, 'detail dock native action grows naturally');
                const text = nodes(owner).find(node => node.type === 'Text' && node.create === label);
                assert.equal(text.height, undefined);
                assert.equal(text.maxFontScale, scale, 'detail dock inherits the current system font scale without a local cap');
            }
            const oldEnd = owner.geometry.content.endInset, oldFooter = owner.geometry.footer.height, key = owner.footerMeasurementKey;
            owner.recordFrameHeight('detail:dock', 120, key);
            assert.equal(owner.geometry.footer.height, 120);
            assert.equal(owner.geometry.content.endInset, oldEnd + 120 - oldFooter);
            owner.invalidateFrame();
            assert.equal(owner.footerMeasurementKey, key, 'unchanged geometry preserves the current dock generation');
            assert.equal(owner.geometry.footer.height, 120);
            owner.viewportWidth = 319;
            owner.invalidateFrame();
            assert.ok(owner.footerMeasurementKey > key, 'actual width change renews the dock measurement');
            const currentFooter = owner.geometry.footer.height;
            owner.recordFrameHeight('detail:dock', 200, key);
            assert.equal(owner.geometry.footer.height, currentFooter, 'old width-dependent dock receipt cannot rewrite the new generation');
            const beforeDock = nodes(owner).length;
            owner.actionSurface();
            const rows = nodes(owner).slice(beforeDock).filter(node => node.type === 'Row' && node.width === '100%');
            assert.ok(rows.length > 0);
            for (const row of rows)
                assert.equal(row.height, undefined, 'detail action parent keeps natural height');
        }
}
function detailNoticeWidth(candidate = shelf('BookshelfDetailNotice')) {
    const observed = read('features/bookshelf/presentation/BookshelfDetailPresentation.ets');
    assert.match(observed, /@Observed\s+export class BookshelfDetailPresentation/);
    const compiler = installedEtsCompiler();
    compiler.require(compiler.root + '/lib/validate_ui_syntax.js').observedClassCollection.add('BookshelfDetailPresentation');
    const properties = createArkUIPropertyRuntimeProbe(), calls = [];
    let allowed = true;
    class Notice {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    }
    const childSource = read('ui/feedback/ReaderRecoveryNotice.ets');
    const presentation = { addRecovery: () => ({ visible: true, generation: 1 }), removalRecovery: () => ({ visible: true, generation: 7 }),
        identity: () => 'source\0book', operationGeneration: () => 7, reconciliationBusy: () => false,
        reconcile: (generation, identity) => calls.push([generation, identity]) };
    const { owner } = createReaderBuilderProbe(candidate, boundedMembers(candidate), { ...properties.sdk,
        SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU, ReaderRecoveryNotice: Notice }, { ...properties.hooks, initialParams: { presentation: properties.sdk.ObservedObject.createNew(presentation, undefined) }, childSources: { ReaderRecoveryNotice: childSource } });
    Object.assign(owner, { layoutWidthVp: 280, canInteract: () => allowed });
    owner.initialRender();
    const notices = [...owner.children.values()];
    assert.equal(notices.length, 2);
    for (const notice of notices)
        assert.equal(notice.params.layoutWidthVp, 280);
    const reconcile = notices.find(notice => notice.params.onReconcile).params.onReconcile;
    reconcile();
    assert.deepEqual(calls, [[7, 'source\0book']]);
    owner.layoutWidthVp = 240;
    owner.replay();
    for (const notice of notices)
        assert.equal(notice.params.layoutWidthVp, 240, 'same recovery actors receive current parent width');
    allowed = false;
    reconcile();
    assert.equal(calls.length, 1, 'existing input owner shields late recovery action');
}
function managementFrame(candidate = shelf('BookshelfManagementPage')) {
    for (const scale of [1, 2]) {
        setMetrics(320, scale);
        const controls = foundationControls({ windowMetrics: () => metrics });
        const managementActions = [];
        const methods = ['groupEditorCard', 'groupsCard', 'groupRow', 'currentGroup', 'assignmentCard', 'assignmentBookRow', 'recordsCard', 'recordRow', 'heading', 'actionButton', 'smallAction', 'isSelectedBook', 'managementTextRowHeight', 'formatDuration', 'formatTimestamp'];
        const { owner } = createReaderBuilderProbe(candidate, methods, { ...controls.dependencies, registerReaderFonts() { }, ReaderWindowCoordinator: { metrics: () => metrics } }, controls.hooks);
        Object.assign(owner, { readerWindowMetricsRevision: 1, appThemeScheme: 'day', snapshot: { busy: false, selectedGroupId: 1, groupNameDraft: '组', groupOrderDraft: '1', assignmentGroupDraft: '组',
                selectedSourceId: 's', selectedBookId: 'b', data: { groups: [{ groupId: 1, groupName: '很长的分组标题', order: 1, show: true }], books: [book], records: [{ deviceId: 'd', bookName: book.title, readTime: 120000, lastRead: 0 }] } },
            onSaveGroup: () => managementActions.push('save'), onClearGroupEditor: () => managementActions.push('cancel'),
            onSelectGroup() { }, onToggleGroupShown() { }, onDeleteGroup() { }, onSelectBook() { }, onAssignmentGroupChanged() { }, onAssignBook() { } });
        owner.groupEditorCard();
        const equalWrappers = nodes(owner).filter(node => node.type === 'Column' && node.layoutWeight === 1);
        assert.equal(equalWrappers.length, 2, 'both equal buttons receive an outer Common lane');
        for (const n of equalWrappers)
            assert.equal(n.constraintSize.minWidth, 0);
        const actionCommons = nodes(owner).filter(node => node.type === '__Common__' && node.width === '100%');
        assert.equal(actionCommons.length, 2, 'both management actions fill their outer Common lanes');
        const actionChildren = [...owner.children.values()].filter(child => child instanceof controls.button.Component && child.specId === 'shelf-action');
        assert.equal(actionChildren.length, 2);
        for (const child of actionChildren) {
            const native = controls.nodes(child).find(node => node.type === 'Button');
            assert.ok(native);
            assert.equal(native.width, '100%', 'native shelf action fills its allocated outer lane');
            native.onClick();
        }
        assert.deepEqual(managementActions, ['save', 'cancel'], 'the full-width targets retain their current management callbacks');
        owner.groupRow(owner.snapshot.data.groups[0]);
        owner.assignmentBookRow(book);
        owner.recordRow(owner.snapshot.data.records[0]);
        const all = controls.nodes(owner), buttons = all.filter(node => node.type === 'Button');
        assert.ok(buttons.length >= 6);
        for (const button of buttons)
            assert.ok(button.constraintSize?.minHeight >= 44, 'actual shared shelf controls retain44 native minimum');
        const record = nodes(owner).find(node => node.type === 'Column' && node.constraintSize?.minHeight === 44 && node.padding?.top === 8);
        assert.ok(record);
        assert.equal(record.height, undefined);
        assert.ok(owner.managementTextRowHeight() >= 33 * scale + 18, 'list viewport grows with the two natural metadata rows');
    }
}
function shelfFilterTargets(candidate = shelf('BookshelfPage')) {
    for (const scale of [1, 1.3, 1.6, 2]) {
        setMetrics(320, scale, 28, 12);
        const properties = createArkUIPropertyRuntimeProbe();
        const methods = ['filterRow', 'filterChip', 'isFilterSelected', 'hasActiveFilters', 'selectFilter', 'clearFilters', 'isShelfPresentationCurrent'];
        const { owner } = createReaderBuilderProbe(candidate, methods, {
            ...properties.sdk, ...readerFoundationTokens, ...action,
            ReaderWindowCoordinator: { metrics: () => metrics },
        }, properties.hooks);
        const projectionRequests = [], collapseRequests = [];
        Object.assign(owner, {
            appThemeScheme: 'day', contentFilter: 'manga', sourceFilter: 'online',
            mounted: true, navigationGeneration: 7, feedbackEnabled: true, isCurrentShelfInput: () => true,
            shelfPressed: () => false,
            queueShelfProjection: () => projectionRequests.push('current'),
            setFilterExpanded: value => collapseRequests.push(value),
        });
        owner.filterRow(7);
        const all = nodes(owner);
        const targetLabels = ['清除内容类型和来源筛选', '收起筛选'];
        const targets = targetLabels.map(label => all.find(node => node.type === 'Button' && node.accessibilityText === label));
        assert.ok(targets.every(Boolean), 'the actual two compact filter actions are mounted');
        for (const target of targets) {
            assert.ok(target.constraintSize?.minWidth >= 44, 'filter native action minimum width44');
            assert.ok(target.constraintSize?.minHeight >= 44, 'filter native action minimum height44');
            assert.equal(target.height, undefined, 'compact filter actions grow with their text');
            assert.equal(target.padding, 0);
        }
        const parent = all.find(node => node.type === 'Row' && node.create.space === readerFoundationTokens.TOK_SPACE_MD);
        assert.ok(parent);
        assert.equal(parent.width, '100%');
        assert.equal(parent.height, undefined, 'the filter action parent pays natural child height');
        const heading = all.find(node => node.type === 'Text' && node.create === '筛选');
        assert.equal(heading.layoutWeight, 1, 'the title consumes the lane remaining after both targets');
        const lane = metrics.windowRect.width - metrics.systemInsets.left - metrics.systemInsets.right;
        assert.ok(targets.reduce((width, target) => width + target.constraintSize.minWidth, 0) +
            readerFoundationTokens.TOK_SPACE_MD * 2 <= lane, 'both 44vp targets and their two parent gaps fit the safe lane');
        const chips = all.filter(node => node.type === 'Button' && !targetLabels.includes(node.accessibilityText));
        const chipPaint = all.filter(node => node.type === 'Row' && node.constraintSize?.maxWidth === 160);
        assert.equal(chips.length, 6);
        assert.equal(chipPaint.length, 6);
        for (const chip of chips) {
            assert.equal(chip.padding, 0);
            assert.equal(chip.constraintSize.minWidth, 44, 'chip button pays the native minimum target');
        }
        for (const paint of chipPaint) {
            assert.equal(paint.padding.left, 12);
            assert.equal(paint.padding.right, 12);
            assert.equal(paint.constraintSize.minWidth, undefined, 'chip paint retains the natural-width recipe');
        }
        assert.equal(targets[0].enabled, true);
        targets[0].onClick();
        assert.equal(owner.contentFilter, 'all');
        assert.equal(owner.sourceFilter, 'all');
        assert.deepEqual(projectionRequests, ['current']);
        owner.replay();
        assert.equal(targets[0].enabled, false, 'the real clear target follows the current filter state');
        targets[1].onClick();
        assert.deepEqual(collapseRequests, [false]);
        const manga = chips.find(node => node.accessibilityText === '内容类型：漫画');
        manga.onClick();
        assert.equal(owner.contentFilter, 'manga');
        assert.deepEqual(projectionRequests, ['current', 'current']);
    }
}
function shelfResidualLane(childSource = detailsSource) {
    const source = shelf('BookshelfPage');
    const properties = createArkUIPropertyRuntimeProbe();
    const controls = iconButtonControls({ properties });
    const deps = { ...controls.dependencies, ...grid, ...detailDeps(childSource), ShelfBookPresentation,
        ReaderWindowCoordinator: { metrics: () => metrics } };
    const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, ShelfBookListDetails: childSource } };
    deps.ShelfBookListDetails = createReaderBuilderProbe(childSource, boundedMembers(childSource), deps, hooks).Component;
    const methods = ['listCoverWidth', 'listCoverHeight', 'listTextFrame', 'listTextBudget', 'listTextFontRevision',
        'listContentHeight', 'projectionListDetailsWidth', 'projectionListDetails', 'projectionDetailsOpacity'];
    const longChapter = '长章节标题'.repeat(16);
    const onlineBook = { ...book, contentKind: 'audio', readProgress: 3400, unreadCount: 12,
        currentChapterTitle: '当前' + longChapter, lastChapter: '最终' + longChapter };
    const withoutLatest = { ...book, readProgress: 0, currentChapterTitle: undefined };
    const localBook = { ...withoutLatest, sourceId: 'local', kind: 'epub', chapterCount: 27 };
    const moreCalls = [];
    for (const [width, expanded, currentBook] of [[240, false, onlineBook], [760, true, onlineBook],
        [240, false, withoutLatest], [650, true, localBook]]) {
        setMetrics(width, 1);
        const { owner } = createReaderBuilderProbe(source, methods, deps, hooks);
        Object.assign(owner, { mounted: true, readerWindowMetricsRevision: 1, appThemeScheme: 'day',
            shelfContentWidth: () => width, viewMode: 'list', viewSwitchListContentOpacity: 1,
            bookActionFocusKey: () => 'current-book-more', bookActionPresentationHandler: () => () => moreCalls.push(currentBook.sourceId) });
        owner.projectionListDetails(currentBook, expanded);
        const details = checkDetails(owner, currentBook);
        const wrapper = nodes(owner).find(node => node.type === 'Row');
        const button = controls.nodes(details).find(node => node.type === 'Button');
        const buttonIcon = controls.nodes(details).find(node => node.type === 'Image');
        const detailActors = nodes(details).map(node => node.id);
        const cardWidth = expanded ? (width - 10) / 2 : width;
        assert.equal(wrapper.width, cardWidth - 98, 'details release the former right-side width reservation');
        assert.deepEqual(wrapper.translate, { x: 86, y: 12 });
        assert.equal(wrapper.height, 88);
        assert.equal(button?.width, 20);
        assert.equal(button?.height, 20);
        assert.equal(buttonIcon?.width, 18);
        assert.deepEqual(button?.responseRegion, { x: -12, y: -12, width: 44, height: 44 });
        assert.equal(button?.accessibilityText, currentBook.title + '更多操作');
        assert.equal(button?.enabled, true);
        const defaultUpdate = nodes(details).find(node => node.create === '更新 12 章');
        if (currentBook === onlineBook) {
            assert.equal(defaultUpdate?.flexShrink, 0);
            assert.equal(defaultUpdate?.borderRadius, 5);
        }
        const label = nodes(details).find(node => node.create === ShelfBookPresentation.listProgress(currentBook));
        assert.equal(label?.fontFeature, '"tnum" 1');
        assert.equal(label?.flexShrink, 0);
        const nativeProgress = nodes(details).find(node => node.type === 'Progress');
        assert.equal(nativeProgress?.height, 3);
        assert.equal(nativeProgress?.layoutWeight, 1);
        assert.equal(nativeProgress?.alignSelf, 'ItemAlign.End', 'the real stroke reaches the bottom of the last row');
        assert.equal(nodes(details).filter(node => node.type === 'Text' && node.width === '100%').length,
            currentBook === withoutLatest ? 1 : 2, 'optional secondary line takes a full row only when present');
        if (currentBook === localBook) {
            assert.ok(nodes(details).some(node => node.create === '本地 EPUB · 共 27 章'));
            assert.ok(nodes(details).some(node => node.create === '本地' && node.flexShrink === 0));
        }
        metrics.systemFontScale = 2;
        owner.readerWindowMetricsRevision += 1;
        owner.replay();
        properties.flush();
        assert.equal(wrapper.height, 170);
        assert.equal(details.targetHeight, 170);
        assert.equal(details.textFrame.width, wrapper.width);
        // Change the rendered label without replacing its native text actor.
        if (currentBook === onlineBook) {
            const update = nodes(details).find(node => node.create === (expanded ? '更新 12 章' : '+12章'));
            assert.equal(update, defaultUpdate);
        }
        assert.deepEqual(nodes(details).map(node => node.id), detailActors);
        assert.equal(controls.nodes(details).find(node => node.type === 'Button'), button);
        button.onClick();
        owner.viewMode = 'cover';
        owner.replay();
        properties.flush();
        assert.equal(wrapper.enabled, false);
        assert.equal(wrapper.hitTestBehavior, 'HitTestMode.None');
        assert.equal(button.enabled, false);
        button.onClick();
    }
    assert.deepEqual(moreCalls, ['source', 'source', 'source', 'local'], 'only list-mode More dispatches');
}
for (const id of selectContractCases(definitions)) {
    if (id === 'shelf-selection-frame') {
        selectionFrame();
        selectionWrappedHeader();
        await selectionFontReceipt();
        const fixed = selectionSource.replace("return this.isListMode() ? this.geometry.content.frame.width : this.gridFrame().rowWidth;", 'return this.isWide() ? 622 : 351;');
        assert.notEqual(fixed, selectionSource);
        assert.throws(() => selectionFrame(fixed), /safe lane/);
        const short = selectionSource.replace('.height(this.listContentHeight() + 2 * (BOOKSHELF_LIST_CARD_PADDING + TOK_BORDER_W))', '.height(80)');
        assert.notEqual(short, selectionSource);
        assert.throws(() => selectionFrame(short), /shared text height|same actor list budget/);
        const details = detailsSource.replace('height(this.targetHeight)', 'height(72)');
        assert.notEqual(details, detailsSource);
        assert.throws(() => selectionFrame(selectionSource, details), /full text lane/);
        const header = selectionSource.replace('.constraintSize({ minWidth: 72, minHeight: READER_ACTION_MIN_TARGET }).flexShrink(0)', '.width(72).height(44)');
        assert.notEqual(header, selectionSource);
        assert.throws(() => selectionFrame(header));
    }
    if (id === 'shelf-projection-frame') {
        projectionFrame();
        const source = shelf('BookshelfPage');
        const short = source.replace('return Math.max(BOOKSHELF_LIST_COVER_HEIGHT, this.listTextFrame(expandedLayout).height);',
            'return BOOKSHELF_LIST_COVER_HEIGHT;');
        assert.notEqual(short, source);
        assert.throws(() => projectionFrame(short), /five-line details height|retained details/);
    }
    if (id === 'detail-action-target') {
        detailActions();
        const short = localBookDetailSource.replaceAll('minHeight: READER_ACTION_MIN_TARGET', 'minHeight: 30');
        assert.notEqual(short, localBookDetailSource);
        assert.throws(() => detailActions(short), /minimum44/);
        const visualShort = localBookDetailSource.replaceAll('minHeight: visual.sectionActionHeight', 'minHeight: 36');
        assert.notEqual(visualShort, localBookDetailSource);
        assert.throws(() => detailActions(visualShort), /minimum44/);
        const capped = localBookDetailSource.replaceAll('.maxFontScale(Math.max(1, this.mangaFontScale()))', '.maxFontScale(2)');
        assert.notEqual(capped, localBookDetailSource);
        assert.throws(() => detailActions(capped), /without a local cap/);
    }
    if (id === 'detail-notice-width') {
        detailNoticeWidth();
        const source = shelf('BookshelfDetailNotice');
        const old = source.replaceAll('layoutWidthVp: this.layoutWidthVp, ', '');
        assert.notEqual(old, source);
        assert.throws(() => detailNoticeWidth(old), /strictly equal/);
    }
    if (id === 'management-parent-frame') {
        managementFrame();
        const source = shelf('BookshelfManagementPage');
        const short = source.replaceAll('}.layoutWeight(1).constraintSize({ minWidth: 0 });', '};');
        assert.notEqual(short, source);
        assert.throws(() => managementFrame(short), /outer Common lane/);
        const equal = source.replace("layout: 'full'", "layout: 'equal'");
        assert.notEqual(equal, source);
        assert.throws(() => managementFrame(equal), /native shelf action fills its allocated outer lane/);
    }
    if (id === 'shelf-filter-action-target') {
        shelfFilterTargets();
        const source = shelf('BookshelfPage');
        const narrow = source.replaceAll('minWidth: 44, minHeight: 44', 'minHeight: 44');
        assert.notEqual(narrow, source);
        assert.throws(() => shelfFilterTargets(narrow), /filter native action minimum width44/);
    }
    if (id === 'shelf-list-residual-lane') {
        shelfResidualLane();
        const packed = detailsSource.replace('.justifyContent(FlexAlign.SpaceBetween)', '.justifyContent(FlexAlign.Start)');
        assert.notEqual(packed, detailsSource);
        assert.throws(() => shelfResidualLane(packed), /FlexAlign.SpaceBetween/);
    }
    recordContractCasePass(id);
}
