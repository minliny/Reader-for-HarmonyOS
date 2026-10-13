#!/usr/bin/env node
/** Actual SDK/native-attribute proof, finite route coverage and mutation controls.
 * This is not a native layout/compositor or device scroll acceptance claim. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { actualReaderPageShell, readerPageShellSourceUrl } from './lib/reader-page-shell-runtime-probe.mjs';
import { verifyReaderPageFrameworkCoverage } from './lib/reader-page-framework-coverage.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const read = name => readFileSync(`entry/src/main/ets/features/common/${name}.ets`, 'utf8');
const policySource = readFileSync(readerPageShellSourceUrl, 'utf8');
const flatten = owner => [...owner.nodes.values(), ...[...owner.children.values()].flatMap(flatten)];
const findChild = (owner, predicate) => {
  for (const child of owner.children.values()) { if (predicate(child)) return child; const nested = findChild(child, predicate); if (nested) return nested; }
};
function actual(name, dependencies = {}, hooks = {}, source = read(name)) {
  const properties = createArkUIPropertyRuntimeProbe();
  return { ...createReaderBuilderProbe(source, boundedMembers(source), { ...properties.sdk, ...dependencies },
    { ...properties.hooks, ...hooks }), properties };
}

const painted = new Map([
  ['standard', 'TOK_SURFACE_SOLID'], ['directoryTools', 'TOK_SURFACE_SOLID'],
  ['home', 'TOK_PAPER'], ['selection', 'TOK_PAPER'], ['search', 'TOK_PAPER'], ['rss', 'TOK_PAPER'],
  ['download', 'TOK_DOWNLOAD_PAPER'],
]);
function headerProof(kind, scheme, dependencies = {}) {
  const probe = actual('ReaderFixedHeaderHost', dependencies);
  let mounted = 0; const measured = [];
  Object.assign(probe.owner, { kind, appThemeScheme: scheme, content: () => mounted++, onHeightChange: height => measured.push(height) });
  probe.owner.initialRender();
  const header = [...probe.owner.nodes.values()].find(node => node.type === 'Column');
  assert.equal(mounted, 1, 'the real header slot mounts once');
  assert.equal(header.width, '100%'); assert.equal(header.zIndex, 10, 'fixed-header common layer is above the scrolling body');
  if (painted.has(kind)) {
    assert.equal(header.backgroundColor, readerAppColor(painted.get(kind), scheme), `${kind}/${scheme}: actual opaque mask`);
    assert.equal(header.clip, true);
    assert.match(header.backgroundColor, /^#FF[0-9a-f]{6}$/i, 'declared solid header really paints an opaque color');
  } else {
    assert.equal(header.backgroundColor, 'Color.Transparent', 'bounded floating/manga/reader actors retain their own surface');
    assert.equal(header.clip, false, 'bounded card shadows remain outside the host');
  }
  for (const height of [88, '95vp', -1, 'invalid']) header.onAreaChange({}, { height });
  assert.deepEqual(measured, [88, 95], 'real native measurement callbacks reject malformed/negative sizes');
  return probe;
}
for (const scheme of ['day', 'night']) for (const kind of [...painted.keys(), 'floating', 'mangaDirectory', 'reader']) headerProof(kind, scheme);

// Actual shared-policy changes must reach every affected actual SDK consumer.
// Reusing the same native node must clear previously solid paint and clip.
{
  const probe = headerProof('standard', 'day');
  const node = [...probe.owner.nodes.values()][0];
  probe.owner.surface = 'transparent'; probe.properties.flush();
  assert.equal(node.backgroundColor, 'Color.Transparent'); assert.equal(node.clip, true);
  probe.owner.surface = 'solid'; probe.properties.flush();
  assert.equal(node.backgroundColor, readerAppColor('TOK_SURFACE_SOLID', 'day'));
  probe.owner.kind = 'floating'; probe.properties.flush();
  assert.equal(node.backgroundColor, 'Color.Transparent'); assert.equal(node.clip, false,
    'standard-to-floating reuse cannot retain a clipping mask around card shadows');
}
const changedPolicy = policySource.replace("? 'TOK_SURFACE_SOLID'", "? 'TOK_PRIMARY_DARK'");
assert.notEqual(changedPolicy, policySource, 'mutation targets the real solid-surface policy');
for (const kind of ['standard', 'directoryTools']) {
  const probe = actual('ReaderFixedHeaderHost', actualReaderPageShell(changedPolicy));
  probe.owner.kind = kind; probe.owner.initialRender();
  assert.equal([...probe.owner.nodes.values()][0].backgroundColor, readerAppColor('TOK_PRIMARY_DARK', 'day'));
}
const omittedPaint = policySource.replace('if (this.surface === \'solid\') instance.backgroundColor', 'if (false) instance.backgroundColor');
assert.notEqual(omittedPaint, policySource);
assert.throws(() => headerProof('rss', 'day', actualReaderPageShell(omittedPaint)), /actual opaque mask/,
  'the historical solid-declaration/no-paint defect cannot pass runtime evidence');

for (const variant of ['standard', 'mainTab', 'settings', 'detail', 'mangaDetail', 'directory', 'mangaDirectory', 'search', 'selection', 'download', 'reader']) {
  const probe = actual('ReaderPageScaffold');
  const slots = [], headerHeights = [], footerHeights = [];
  Object.assign(probe.owner, { variant, headerKind: variant === 'reader' ? 'reader' : 'standard',
    frameInsetLeft: 13, frameInsetRight: 17, headerTop: 6, footerBottom: 28,
    content: () => slots.push('body'), header: () => slots.push('header'), footer: () => slots.push('footer'), overlay: () => slots.push('overlay'),
    onHeaderHeightChange: height => headerHeights.push(height), onFooterHeightChange: height => footerHeights.push(height) });
  probe.owner.initialRender();
  assert.deepEqual(slots, ['body', 'header', 'footer', 'overlay'], 'actual finite host delegates every slot exactly once');
  const root = [...probe.owner.nodes.values()].find(node => node.type === 'Stack' && node.padding?.left === 13 && node.padding?.right === 17);
  assert.deepEqual(root.padding, { left: 13, right: 17 }, 'measured safe/rail offsets go through the common frame');
  assert.equal(root.clip, variant === 'reader' ? false : true);
  const layers = [...probe.owner.nodes.values()].filter(node => [10, 20, 30].includes(node.zIndex));
  assert.deepEqual(layers.map(node => node.zIndex), [10, 20, 30], 'header, footer and overlay have one shared ordering');
  assert.ok(layers.every(node => node.hitTestBehavior === 'HitTestMode.Transparent'), 'empty hosts preserve body hit testing');
  const header = flatten(probe.owner).find(node => node.type === 'Column' && node.onAreaChange && node.zIndex === 10);
  header.onAreaChange({}, { height: 97 });
  const footer = [...probe.owner.nodes.values()].find(node => node.type === 'Column' && node.onAreaChange);
  footer.onAreaChange({}, { height: 54 });
  assert.deepEqual(headerHeights, [97]); assert.deepEqual(footerHeights, [54]);
}

{
  const policy = actualReaderPageShell();
  assert.throws(() => policy.readerStandardPageSpec('private99'), /Unknown|unknown/);
  assert.throws(() => policy.readerPageInitialHeaderHeight('private99'), /Unknown|unknown/);
}

{
  const probe = actual('ReaderPageScaffold');
  probe.owner.variant = 'reader'; probe.owner.headerKind = 'reader';
  let mounts = 0; probe.owner.content = () => mounts++;
  probe.owner.initialRender();
  const root = [...probe.owner.nodes.values()].find(node => node.type === 'Stack' && node.padding);
  assert.equal(root.backgroundColor, readerAppColor('app.window.background', 'day'), 'reader first frame consumes the real window paper fact');
  probe.owner.readingUnderlayColor = '#FF314159'; probe.properties.flush();
  assert.equal(root.backgroundColor, '#FF314159', 'updated window paper reaches the retained common reading frame');
  assert.equal(mounts, 1, 'window paper updates do not remount reading content');
  probe.owner.pageVisible = false; probe.properties.flush();
  assert.equal(root.opacity, 0); assert.equal(root.hitTestBehavior, 'HitTestMode.Transparent');
  probe.owner.pageVisible = true; probe.properties.flush();
  assert.equal(root.opacity, 1); assert.equal(root.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(mounts, 1, 'page visibility toggles preserve the persistent reader actor');

}

const variants = ['management', 'settings', 'rssManagement', 'rssEditor', 'rssFeed', 'rssDetail', 'tools', 'sync', 'sourceManagement', 'settingsHome', 'settingsGeneral'];
// Native reading geometry belongs to the same actual frame as the body.
// These finite runtime facts are not a caller-owned style/attribute bag.
{
 const probe=actual('ReaderPageScaffold');let mounts=0;
 Object.assign(probe.owner,{variant:'reader',readingContentKind:'text',content:()=>mounts++});probe.owner.initialRender();
 const root=[...probe.owner.nodes.values()].find(node=>node.type==='Stack'&&node.padding);
 assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM']]);
 assert.deepEqual(root.ignoreLayoutSafeArea,[[],[]]);
 probe.owner.readingContentKind='manga';probe.properties.flush();
 assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM','SafeAreaType.CUTOUT'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']]);
 assert.deepEqual(root.ignoreLayoutSafeArea,[['LayoutSafeAreaType.SYSTEM'],['LayoutSafeAreaEdge.ALL']]);
 probe.owner.variant='standard';probe.properties.flush();
 assert.deepEqual(root.expandSafeArea,[[],[]],'reader-to-ordinary reuse clears native expansion');
 assert.deepEqual(root.ignoreLayoutSafeArea,[[],[]],'reader-to-ordinary reuse clears native ignore policy');
 assert.equal(mounts,1,'native geometry fact changes retain the same body actor');
}
for (const variant of variants) {
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393; metrics.windowRect.height = 852;
  metrics.systemInsets.top = 32; metrics.cutoutInsets.top = 40;
  metrics.systemInsets.left = 24; metrics.cutoutInsets.right = 30;
  const probe = actual('ReaderStandardPage', { ReaderWindowCoordinator: { metrics: () => metrics } });
  let bodyMounted = 0;
  Object.assign(probe.owner, { variant, content: () => bodyMounted++ });
  probe.owner.initialRender();
  const body = [...probe.owner.nodes.values()].find(node => node.type === 'Column' && node.padding);
  assert.deepEqual([body.padding.left, body.padding.right, body.padding.top], [24, 30, 66],
    'conventional content obeys visual safe sides without charging the system top twice');
  assert.equal(bodyMounted, 1);
  const header = findChild(probe.owner, child => child.kind !== undefined && child.surface !== undefined);
  assert.ok(header, 'actual StandardPage → Scaffold → HeaderHost child delegation');
  const measured = [...header.nodes.values()].find(node => node.onAreaChange);
  measured.onAreaChange({}, { height: '93vp' }); probe.properties.flush();
  assert.equal(body.padding.top, 101, 'measured expanded header updates the actual Scroll content clearance');
  assert.equal(bodyMounted, 1, 'a measured chrome update does not remount business content');
  const outer = [...probe.owner.nodes.values()].find(node => node.type === '__Common__' && node.onAreaChange);
  assert.ok(outer, 'the real component instance retains its measured viewport callback');
  outer.onAreaChange({}, { width: '365vp' }); probe.properties.flush();
  assert.equal(probe.owner.viewportWidth, 365, 'native vp area strings preserve narrow-host measurement');
  assert.equal(probe.owner.contentFrame().width, 311, 'layout uses the measured host instead of window width');
  assert.equal(bodyMounted, 1, 'resizing measured chrome keeps the retained content slot');

  measured.onAreaChange({}, { height: -1 }); probe.properties.flush();
  assert.equal(body.padding.top, 101);
}

const coverageContract = JSON.parse(readFileSync('tools/fixtures/reader-page-framework-coverage.json', 'utf8'));
const coverage = verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract);
assert.equal(coverage.routes, 20, 'all current production route members, including hidden product branches');
const source = file => readFileSync(`entry/src/main/ets/${file}`, 'utf8');
const readerSource=source('features/shell/ReaderShell.ets');
const detachedKind=readerSource.replace('readingContentKind: this.contentKind',"readingContentKind: 'text'");assert.notEqual(detachedKind,readerSource);
assert.throws(()=>verifyReaderPageFrameworkCoverage(process.cwd(),coverageContract,file=>file==='features/shell/ReaderShell.ets'?detachedKind:source(file)),/exact page\/runtime fact/);
const missingHostFile = 'features/bookshelf/BookshelfManagementPage.ets';
const original = source(missingHostFile);
const missingHost = original.replace('ReaderStandardPage({', 'PrivatePageHost({');
assert.notEqual(missingHost, original);
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === missingHostFile ? missingHost : source(file)), /category\/common-host binding removed/,
  'a local page reverting to a private host fails reverse coverage');
const bareUiSlot = original.replace('this.pageHeader();', "PageBackBar({ title: '管理' });");
assert.notEqual(bareUiSlot, original);
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === missingHostFile ? bareUiSlot : source(file)), /bare UI component inside shared BuilderParam/,
  'component calls inside ordinary lambdas cannot pretend to be SDK-emitted native Builder slots');
const extraRoute = source('pages/Index.ets').replace("type ReaderRoute = 'bookshelf'", "type ReaderRoute = 'privateUnregisteredPage' | 'bookshelf'");
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === 'pages/Index.ets' ? extraRoute : source(file)), /every actual route requires exactly one/,
  'new routes cannot bypass category registration');
console.log(`PASS actual page/header SDK slots, opaque day/night masks, shared-policy propagation, native measurements and safe/inset replay; ${coverage.routes} routes/${coverage.bindings} actual finite bindings; reverse/missing-paint negative controls. Native pixels/scroll physics remain separate.`);
