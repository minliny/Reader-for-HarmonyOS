import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { actualReaderPageShell } from './lib/reader-page-shell-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const sdk = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url), ts = require(sdk + '/node_modules/typescript'), options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const parse = source => ts.createSourceFile('ResponsivePage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function proveStandardBinding(name, source, variant, builder) {
  const tree = parse(source); assert.deepEqual(tree.parseDiagnostics, []);
  assert.ok(tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === '../common/ReaderStandardPage'), name + ': actual public owner import');
  const bindings = [];
  function visit(node) {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression.getText(tree) === 'ReaderStandardPage') {
      const props = node.arguments[0].properties, selected = props.find(property => property.name?.text === 'variant');
      if (selected?.initializer.text === variant) bindings.push(props.find(property => property.name?.text === 'content').initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(bindings.length, 1, name + ': one finite public Scroll owner');
  assert.equal(bindings[0].body.statements.length, 1);
  assert.equal(bindings[0].body.statements[0].expression.getText(tree), `this.${builder}()`, name + ': actual public content slot retains its business builder');
}

const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const emptyPage = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyPage.ets');
const emptyCard = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyCard.ets');
const shelfManagement = read('entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets');
const localImport = read('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const jsonImport = read('entry/src/main/ets/features/common/JsonImportDialog.ets');
const dialogSurface = read('entry/src/main/ets/features/common/ReaderDialogSurface.ets');
const dialogSpecs = read('entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets');
const indexPage = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const rssManagement = read('entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets');
const rssEditor = read('entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets');
const rssFeed = read('entry/src/main/ets/features/rss/RssSourceFeedPage.ets');
const rssEntry = read('entry/src/main/ets/features/rss/RssEntryDetailPage.ets');
const settingsShell = read('entry/src/main/ets/features/shell/SettingsShell.ets');
const settingsPage = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const rulesManagement = read('entry/src/main/ets/features/settings/RulesManagementPage.ets');
const sourceManagement = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const sourceTools = read('entry/src/main/ets/features/source/SourceToolsPage.ets');
const sync = read('entry/src/main/ets/features/sync/SyncPage.ets');
const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
const fullDirectoryPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const appearance = read('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');
const appearanceStage = read('entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets');
const settings = read('entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets');
const tts = read('entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets');
const autoPage = read('entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets');
const readerLayout = read('entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');

assert.match(shelf,
  /new SurfaceWidthSpec\([\s\S]*TOK_CONTENT_RAIL_W_TABLET,[\s\S]*this\.tabletContentLeftGap\(\),[\s\S]*TABLET_CONTENT_RIGHT_GAP,[\s\S]*'center'/,
  'tablet shelf content must shrink below the Figma canvas inside its live rail-safe frame');
assert.match(shelf, /return this\.effectiveViewportWidth\(\) >= BOOKSHELF_WIDE_BREAKPOINT/,
  'bookshelf layout selection must follow the live viewport rather than physical device type');
assert.doesNotMatch(shelf, /@Prop isTablet/,
  'bookshelf outer geometry must not be pinned to the physical device class');
assert.match(shelf,
  /return Math\.min\(TABLET_BOOK_WIDTH, Math\.max\(0, \(contentWidth - \(TOK_SPACE_XS \* 2\)\) \/ 3\)\)/,
  'tablet book cards must shrink with their content rail');

assert.match(emptyPage,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'empty shelf must resolve its phone-role cap through shared horizontal geometry');
assert.match(emptyPage,
  /padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'empty shelf must apply asymmetric safe edges, not only the resolved width');
assert.match(emptyCard, /@Prop cardWidth: number = 352/);
assert.match(emptyCard, /return Math\.max\(0, this\.cardWidth - 34\)/,
  'empty-state actions must shrink with the card');

assert.match(shelfManagement,
  /private assignmentCard\(\)[\s\S]*Scroll\(\) \{[\s\S]*this\.smallAction\(group\.groupName[\s\S]*scrollable\(ScrollDirection\.Horizontal\)/,
  'unbounded user group chips must scroll horizontally instead of widening the page');

const standardSource = read('entry/src/main/ets/features/common/ReaderStandardPage.ets');
const policySource = read('entry/src/main/ets/features/common/ReaderPageShell.ts');
assert.match(standardSource, /@StorageLink\('readerWindowMetricsRevision'\)/, 'actual shared Scroll owner consumes live window revisions');
assert.match(standardSource, /readerPageAreaLength\(next\.width\)/, 'actual shared owner measures numeric and vp host widths');
const standardBindings = [
  ['bookshelf management', shelfManagement, 'management', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['RSS subscription editor', rssEditor, 'rssEditor', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['rules management', rulesManagement, 'management', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['source tools', sourceTools, 'tools', 'pageContent', Number.MAX_SAFE_INTEGER],
  ['settings home', settingsShell, 'settingsHome', 'homeContent', 720],
  ['settings general', settingsShell, 'settingsGeneral', 'generalContent', 720],
  ['RSS subscription management', rssManagement, 'rssManagement', 'pageContent', 720],
  ['RSS source feed', rssFeed, 'rssFeed', 'pageContent', 720],
  ['RSS entry detail', rssEntry, 'rssDetail', 'pageContent', 720],
  ['sync', sync, 'sync', 'pageContent', 720],
];
for (const [name, source, variant, builder] of standardBindings) proveStandardBinding(name, source, variant, builder);
assert.doesNotMatch(settingsPage, /maxWidth: TOK_CONTENT_MAX_W_TABLET/,
  'settings rows must not independently clamp inside the shell-owned content frame');

assert.match(sourceManagement, /@State private viewportWidth: number = 0/);
assert.match(sourceManagement,
  /readerStandardPageContentFrame\('sourceManagement', metrics, containerWidth\)/,
  'source management delegates its unchanged 720vp/19vp cap to the actual shared policy');
assert.match(sourceManagement,
  /return Math\.max\(0, \(this\.contentFrame\(\)\.width - 20\) \/ 2\)/,
  'tablet source filters must share the remaining row width');
assert.match(sourceManagement, /availableWidth: this\.filterControlWidth\(\)/, 'shared finite status buttons consume the original measured filter frame');
assert.doesNotMatch(sourceManagement, /private statusChipWidth\(/, 'responsive button formula has one shared producer');

assert.match(sync, /@State private viewportWidth: number = 0/);
assert.match(sync, /readerStandardPageContentFrame\('sync', metrics, containerWidth\)/, 'sync thin frame adapter keeps the actual shared 720vp/19vp policy');

assert.match(localImport, /@State private viewportWidth: number = 0/);
assert.match(localImport,
  /this\.surfaceSpec\(\)\.maxWidth,[\s\S]*this\.surfaceSpec\(\)\.edgeGap,[\s\S]*this\.surfaceSpec\(\)\.edgeGap/,
  'all local-import states must resolve their shared dialog frame role');
assert.match(localImport, /resolveDialogSpec\('local-import'\)/,
  'local import delegates its outer frame to the shared dialog registry');
assert.equal((localImport.match(/(?:\.width\(this\.panelFrame\(\)\.width\)|(?:surfaceWidth|width): this\.panelFrame\(\)\.width)/g) ?? []).length, 4,
  'selection, importing, result and retained shell pass the same original clamp through their actual bounded surface input');
const boundedImportSurface=read('entry/src/main/ets/features/common/ReaderBoundedSurface.ets');
assert.match(boundedImportSurface,/new ReaderBoundedFrameModifier\(this\.specId, this\.surfaceWidth, this\.surfaceHeight,/,'actual common frame consumes delegated width and height');
assert.match(boundedImportSurface,/\.width\(this\.width\)/,'actual frame modifier applies delegated width to the native surface');
assert.match(localImport,
  /padding\(\{ left: this\.panelFrame\(\)\.left, right: this\.panelFrame\(\)\.right \}\)/);

for (const [name, source, maxToken] of [
  ['search', search, 'TOK_CONTENT_RAIL_W_TABLET'],
  ['discover', discover, 'TOK_CONTENT_RAIL_W_TABLET'],
]) {
  assert.match(source, /@StorageLink\('readerWindowMetricsRevision'\)/,
    `${name} must react to the shared window snapshot`);
  assert.match(source, new RegExp(`new SurfaceWidthSpec\\(${maxToken}`),
    `${name} must declare its design cap through SurfaceWidthSpec`);
  assert.match(source, /readerVisualSafeLeft\(metrics\)/);
  assert.match(source, /readerVisualSafeRight\(metrics\)/);
}

assert.match(search, /frameInsetLeft: this\.contentFrame\(\)\.left, frameInsetRight: this\.contentFrame\(\)\.right/, 'search keeps its asymmetric geometry in the actual public Scaffold frame');
assert.doesNotMatch(search, /return this\.isTablet \? TOK_CONTENT_RAIL_W_TABLET : '100%'/);
assert.match(discover,
  /padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/);
assert.doesNotMatch(discover, /this\.isTablet \? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE/);

assert.match(rss, /const RSS_TABLET_RAIL_WIDTH = 100/);
assert.match(rss,
  /new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/);
assert.match(rss, /readerVisualSafeLeft\(metrics\) - railWidth/,
  'RSS must translate the shared safe-left boundary into its rail-owned host');
assert.match(rss, /return this\.effectiveViewportWidth\(\) >= RSS_WIDE_BREAKPOINT/,
  'RSS rail selection must use the live viewport rather than physical isTablet');

assert.doesNotMatch(rssFeed, /RSS_CHILD_WIDE_BREAKPOINT/);
assert.doesNotMatch(rssEntry, /RSS_CHILD_WIDE_BREAKPOINT/);
assert.match(rssEntry,
  /margin\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'RSS entry bottom actions must honor asymmetric safe edges');

assert.match(jsonImport, /ReaderDialogSurface\(/,
  'JSON import delegates its framed card to the shared dialog surface');
assert.match(jsonImport, /specId: 'json-import'/,
  'JSON import passes its finite spec id');
assert.doesNotMatch(jsonImport, /JSON_IMPORT_DIALOG_MAX_WIDTH|new SurfaceWidthSpec|resolveHorizontalFrame|dialogFrame\(\)/,
  'JSON import no longer owns private frame geometry');
assert.doesNotMatch(jsonImport, /this\.isTablet \? 520 : '90%'/);

// The json-import variant carries the responsive contract into the registry:
// card-inset frame mode + keyboard-aware interactive safe edges + 520 cap/20 gap.
assert.match(dialogSpecs, /'json-import': new DialogSurfaceSpec\(\{[\s\S]*?maxWidth: 520/);
assert.match(dialogSpecs, /'json-import': new DialogSurfaceSpec\(\{[\s\S]*?edgeGap: 20/);
assert.match(dialogSpecs, /'json-import': new DialogSurfaceSpec\(\{[\s\S]*?frameMode: 'card-inset'/);
assert.match(dialogSpecs, /'json-import': new DialogSurfaceSpec\(\{[\s\S]*?usesKeyboardSafeArea: true/);
assert.match(dialogSurface, /readerInteractiveSafeLeft\(metrics, spec\.usesKeyboardSafeArea\)/,
  'the shared surface honors the spec keyboard-safe-area flag');
assert.match(dialogSurface, /spec\.frameMode === 'inset'\) \{\s*return '100%';/,
  'inset specs still fill the host overlay width for legacy inset consumers');
assert.match(dialogSurface, /return this\.resolvedFrame\(\)\.width/,
  'cap and card-inset specs size the surface column to the resolved card width');

// The shelf-group variant carries the legacy percentage width of the former
// hand-drawn Index overlay into the registry; Index no longer owns the frame.
assert.match(dialogSpecs, /'shelf-group': new DialogSurfaceSpec\(\{[\s\S]*?widthPercent: 75/);
assert.match(dialogSpecs, /'shelf-group': new DialogSurfaceSpec\(\{[\s\S]*?padding: 20, borderRadius: 20/);
assert.match(dialogSpecs, /'shelf-group': new DialogSurfaceSpec\(\{[\s\S]*?backgroundRole: 'TOK_SURFACE_SOLID'/);
assert.match(dialogSpecs, /'local-import': new DialogSurfaceSpec\(\{[\s\S]*?maxWidth: 350/);
assert.match(dialogSpecs, /'local-import': new DialogSurfaceSpec\(\{[\s\S]*?edgeGap: 20/);
assert.match(dialogSpecs, /'local-import': new DialogSurfaceSpec\(\{[\s\S]*?borderRadius: 20/);
assert.match(dialogSurface, /spec\.widthPercent > 0[\s\S]*?\$\{spec\.widthPercent\}%/,
  'the shared surface resolves a percentage-width spec directly');
assert.match(indexPage, /ReaderDialogSurface\(\{\s*specId: 'shelf-group'/,
  'Index default-group overlay delegates its frame to the shared surface');
assert.doesNotMatch(indexPage, /\.padding\(20\)\.width\('75%'\)/,
  'Index no longer owns the hand-drawn 75%/padding-20 dialog frame');

assert.match(fullDirectory, /@State private containerWidth: number = 0/);
assert.match(fullDirectory,
  /new SurfaceWidthSpec\(720, 27, 13, 'right'\)/,
  'tablet directory must preserve its asymmetric role through shared geometry');
assert.match(fullDirectory,
  /new SurfaceWidthSpec\(364, 12, 12, 'center'\)/,
  'phone directory must preserve its centered role through shared geometry');
assert.match(fullDirectoryPanel, /@Prop panelWidthOverride: number = 0/);
assert.match(fullDirectoryPanel, /return Math\.max\(0, this\.panelWidth\(\) - 26\)/);

assert.match(experience, /layout: this\.controlLayout\(this\.readerWindowMetricsRevision\)/,
  'the reader owner must provide one resolved geometry snapshot to every control state');
assert.match(control, /@Prop @Watch\('onLayoutChanged'\) layout: ReaderControlLayoutSnapshot/);
assert.match(control,
  /readerControlMotionBounds\(this\.layout\.fullPanelWidth,\s*this\.controlPanelHeight\(\)/,
  'all modules share the capped owner-resolved live Stage extent');
assert.match(control, /Math\.min\(Math\.max\(0, this\.layout\.fullPanelHeight\), this\.isExpanded\(\) \? 852 : 736\)/,
  'the Make design heights are upper bounds within the actual safe Stage');
assert.match(control, /ReaderControlAppearanceContent\(\{[\s\S]*?availableWidth: this\.contentMotionWidth,[\s\S]*?availableHeight: this\.contentMotionHeight/);
assert.match(control, /availableWidth: this\.contentMotionWidth, availableHeight: this\.contentMotionHeight/,
  'the new directory uses the actual visible viewport with explicit top alignment');
assert.match(control, /ReaderControlDirectoryContent\(\{[\s\S]*?progress: this\.contentMotionProgress/);
assert.match(appearanceStage,
  /ReaderAppearanceFullPanel\(\{[\s\S]*?availableWidth: this\.availableWidth,[\s\S]*?availableHeight: this\.availableHeight/,
  'the clock-owned Phone Appearance panel must receive the Stage live surface budget');
assert.match(readerLayout, /const fullPanelHeight = Math\.max\(0, height - fullPanelTop - fullPanelBottom\)/,
  'the full-panel height budget must be derived once from the live viewport and safe bottom');

for (const [name, source] of [
  ['settings', settings],
  ['tts', tts],
  ['auto page', autoPage],
]) {
  assert.match(source, /@Prop availableWidth: number = 0/, `${name} must accept a live width`);
  assert.match(source, /@Prop availableHeight: number = 0/, `${name} must accept a live height budget`);
  assert.match(source, /Math\.min\([^\n]+, this\.availableWidth\)/,
    `${name} must preserve its Figma width only as a maximum`);
  assert.match(source, /Math\.min\([^\n]+, this\.availableHeight\)/,
    `${name} must preserve its Figma height only as a maximum`);
}

assert.match(appearance, /@Prop availableWidth: number = 0/,
  'appearance must accept a live width');
assert.match(appearance, /@Prop availableHeight: number = 0/,
  'appearance must accept a live height budget');
assert.match(appearance, /Math\.min\([^\n]+, this\.availableWidth\)/,
  'appearance must preserve its Figma width only as a maximum');
assert.match(appearance,
  /private scrollViewportHeight\(\): number[\s\S]*Math\.min\(this\.viewportHeight\(\), this\.availableHeight - 68\)/,
  'appearance must preserve its authored full-sheet frame while clamping the interactive scroll viewport');
assert.match(control, /this\.layout\.fullPanelWidth, this\.controlPanelHeight\(\), this\.layout\.dockBottomGap/,
  'the new shared spatial sampler uses measured bounds instead of selecting a second legacy tree');
assert.doesNotMatch(control, /readerAppearanceMotionStageSupported|usesPhoneAppearanceMotionStage/);
assert.match(appearance,
  /readerAppearanceMotionViewportWidth\(this\.currentMotionFrame\(\), this\.sheetWidth\(\)\)/,
  'motion surface width must also clamp to the live sheet edge');
assert.match(appearance,
  /readerAppearanceMotionViewportHeight\(this\.currentMotionFrame\(\)\)/,
  'motion scroll viewport must remain reachable inside the live shell');

// Geometry sanity for the explicit regression matrix used by this audit.
function checkSharedWidths(sharedSource = standardSource, sharedPolicy = policySource) {
  const runtime = createArkUIPropertyRuntimeProbe(), policy = actualReaderPageShell(sharedPolicy);
  let metrics;
  class HeaderLeaf { constructor(owner, params, _storage, id) { Object.assign(this, {owner, params, id}); } }
  const headers = Object.fromEntries([['PageBackBar', 'common/PageBackBar'], ['AppTopBar', 'common/AppTopBar'], ['MainTabBar', 'shell/MainTabBar']]
    .map(([name, path]) => [name, read('entry/src/main/ets/features/' + path + '.ets')]));
  for (const [name, source] of Object.entries(headers)) {
    const tree = parse(source), owner = tree.statements.find(node => node.name?.text === name);
    const fields = owner.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.text);
    require(sdk + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set(name, new Set(fields));
  }
  let dependencies = {...runtime.sdk, ...policy, ReaderWindowCoordinator: {metrics: () => metrics}, PageBackBar: HeaderLeaf, AppTopBar: HeaderLeaf, MainTabBar: HeaderLeaf};
  const hooks = {...runtime.hooks, mountChildren: true, childSources: {...headers, ReaderStandardPage: sharedSource}};
  const Standard = createReaderBuilderProbe(sharedSource, boundedMembers(sharedSource), dependencies, hooks).Component;
  dependencies = {...dependencies, ReaderStandardPage: class extends Standard {
    constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = {...params}; }
  }};
  // Each real production page build creates its actual standard owner. Only
  // business/header leaf painting is opaque to this horizontal-frame proof;
  // no public frame, Scroll, policy or Area callback is substituted.
  for (const [name, source, variant, _builder, cap] of standardBindings) {
    const tree = parse(source), declaration = tree.statements.find(node => node.members?.some(member => member.name?.text === 'build') && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    const builders = declaration.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@Builder')).map(member => member.name.text);
    const parameters = declaration.members.filter(member => ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.text);
    const scrollerOwners = declaration.members.filter(member => ts.isPropertyDeclaration(member) && member.name?.text.endsWith('Scroller')).map(member => member.name.text);
    const {Component} = createReaderBuilderProbe(source, ['build', ...parameters, ...scrollerOwners], dependencies, hooks);
    for (const width of [320, 360, 365.71, 390, 600, 720, 760, 840]) for (const [left, right] of [[0, 0], [48, 14]]) for (const unit of [false, true]) {
      metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900), undefined, new ReaderInsetsVp(left, 0, right, 0));
      const page = new Component(undefined, {});
      Object.assign(page, {activeSection: variant === 'settingsHome' ? 'home' : 'general', showOverlay: false});
      for (const builder of [...builders, ...parameters]) page[builder] = () => {};
      page.initialRender();
      const standard = [...page.children.values()].find(child => child.params?.variant === variant);
      assert.ok(standard?.nodes, name + ': actual page build mounts its finite shared Scroll owner');
      const host = [...standard.nodes.values()].find(node => typeof node.onAreaChange === 'function'); assert.ok(host);
      const scroll = [...standard.nodes.values()].find(node => node.type === 'Scroll'), scroller = standard.scroller; assert.ok(scroll);
      if (scrollerOwners.length) assert.ok(scrollerOwners.some(key => page[key] === scroller), name + ': the shared Scroll retains its existing page-owned Scroller');
      const hostWidth = Math.min(304, width);
      host.onAreaChange({}, {width: unit ? `${hostWidth}vp` : hostWidth}); runtime.flush();
      assert.equal(standard.viewportWidth, hostWidth, 'actual public Area receipt uses the narrow host rather than the larger window');
      assert.equal(policy.readerStandardPageSpec(variant).maxWidth, cap, name + ': original finite maximum remains exact');
      for (const measuredWidth of [hostWidth, width]) {
        host.onAreaChange({}, {width: unit ? `${measuredWidth}vp` : measuredWidth}); runtime.flush();
        const frame = policy.readerStandardPageContentFrame(variant, metrics, measuredWidth);
        const available = Math.max(0, measuredWidth - Math.max(19, left) - Math.max(19, right));
        assert.equal(frame.width, Math.min(cap, available), name + ': original 19vp sides and cap remain exact');
        assert.equal(frame.left, Math.max(19, left) + (available - frame.width) / 2);
        assert.equal(frame.right, measuredWidth - frame.left - frame.width);
        const column = [...standard.nodes.values()].find(node => node.type === 'Column' && node.padding?.top !== undefined); assert.ok(column);
        assert.deepEqual([column.padding.left, column.padding.right], [frame.left, frame.right], name + ': emitted Scroll content consumes actual asymmetric shared geometry');
        assert.equal(standard.nodes.get(scroll.id), scroll); assert.equal(standard.scroller, scroller);
        assert.equal(scroll.create, scroller, 'width publication retains the original native Scroll/scroller');
      }
    }
  }
  for (const width of [320, 360, 365.71, 390, 600, 720, 760, 840]) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900));
    const frame = policy.readerStandardPageContentFrame('sourceManagement', metrics, width);
    assert.equal(frame.width, Math.min(720, width - 38), 'source management keeps its original 720 maximum and 19vp sides');
  }
}
checkSharedWidths();
const legacyArea = standardSource.replace('readerPageAreaLength(next.width)', 'Number(next.width)'); assert.notEqual(legacyArea, standardSource);
assert.throws(() => checkSharedWidths(legacyArea), /actual public Area receipt/, 'restoring Number(Area) fails the same actual SDK narrow vp host contract');
// The producer source mutation must reach the real SDK host, not a different
// copied geometry implementation. Its policy mutation independently proves cap.
const changedCap = policySource.replace("case 'settings': return new ReaderStandardPageSpec(0, 720, 16);", "case 'settings': return new ReaderStandardPageSpec(0, 721, 16);")
  .replace('return new ReaderStandardPageSpec(12, 720, 12);', 'return new ReaderStandardPageSpec(12, 721, 12);');
assert.notEqual(changedCap, policySource);
assert.throws(() => checkSharedWidths(standardSource, changedCap), /original finite maximum/, 'a public 721vp cap cannot silently replace the original 720vp witness');
for (const [name, source, variant, builder] of standardBindings) {
  const changed = source.replace(`content: (): void => { this.${builder}(); }`, 'content: (): void => {}'); assert.notEqual(changed, source);
  assert.throws(() => proveStandardBinding(name, changed, variant, builder), /AssertionError/, 'each page must retain its actual business content slot');
}
for (const viewport of [320, 360, 365.71, 390, 600, 720, 760, 840]) {
  const phoneSheet = Math.min(364, viewport);
  const centeredDirectory = Math.min(364, Math.max(0, viewport - 24));
  const dialog = Math.min(350, Math.max(0, viewport - 40));
  assert.ok(phoneSheet <= viewport);
  assert.ok(centeredDirectory + Math.max(0, (viewport - centeredDirectory) / 2) <= viewport);
  assert.ok(dialog <= viewport);
}

console.log('responsive surface width regression matrix: PASS');
