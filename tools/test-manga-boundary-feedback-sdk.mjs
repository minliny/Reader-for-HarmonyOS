import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"boundary-caption": {"description": "真实矢量箭头翻转、渐显与减动效", "resources": []}, "retained-paint": {"description": "真实旧章paint不透明/clip/穿透与三个mutant", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');


const source = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaBoundaryTurnFeedback.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile(virtualFilePath('MangaBoundaryFeedback.ets'), source, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const actor = tree.statements.find(node => node.name?.getText(tree) === 'MangaBoundaryTurnFeedback');
assert.ok(actor);
const names = actor.members.map(node => node.name?.getText(tree)).filter(Boolean);
const captionRole = readerTypographyRoles.MESSAGE_META;
const outcomes = [];
if(selectedCase === 'boundary-caption') {
for (const scheme of ['day', 'night']) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(source, names,
    { ...properties.sdk, ...productionReaderMotionSdk() }, properties.hooks);
  Object.assign(owner, {scheme, caption:'继续上拉进入下一话：帝都夜谈', distance:60});
  owner.initialRender();
  const nodes = [...owner.nodes.values()], row = nodes.find(node => node.type === 'Row');
  const text = nodes.find(node => node.type === 'Text'), arrow = nodes.find(node => node.type === 'Image');
  assert.deepEqual(nodes.map(node => node.type), ['Row', 'Image', 'Text']);
  assert.equal(arrow.create, scheme === 'night' ? 'app.media.reader_chevron_down_primary_theme_night' : 'app.media.reader_chevron_down_primary');
  assert.equal(arrow.rotate.angle, 180);
  assert.equal(arrow.animation.duration, 160);
  assert.deepEqual(arrow.animation.curve, [.2,0,0,1]);
  assert.equal(text.fontFamily, captionRole.fontFamily);
  assert.equal(text.fontColor, readerAppColor('TOK_PRIMARY_TEXT', scheme));
  assert.equal(text.onClick, undefined);
  assert.equal(row.width,'100%');
  assert.equal(row.backgroundColor, readerAppColor('TOK_SURFACE_ELEVATED', scheme));
  assert.equal(row.hitTestBehavior, 'HitTestMode.None');
  assert.ok(row.opacity > 0 && row.opacity < 1);
  const identities = nodes.map(node => node.id);
  Object.assign(owner,{armed:true,caption:'松手进入下一话：帝都夜谈'});properties.flush();
  assert.equal(arrow.rotate.angle,0);
  assert.equal(text.create,'松手进入下一话：帝都夜谈');
  assert.equal(row.opacity,1);
  owner.reduceMotion=true;properties.flush();
  assert.equal(arrow.rotate.angle,180);
  assert.equal(arrow.animation.duration,0);
  assert.equal(row.animation.duration,120);
  Object.assign(owner,{armed:false,distance:0});properties.flush();
  assert.equal(row.opacity,0);
  assert.deepEqual([...owner.nodes.values()].map(node=>node.id),identities);
}

}
if(selectedCase === 'retained-paint') {
// Execute the real parent Builder and the complete existing page modifier.
// A retained chapter's empty paper gaps must hide candidate pixels, while the
// noninteractive paint layer keeps native gestures owned by the reading stage.
const surfaceSource = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url), 'utf8');
const surfaceTree = ts.createSourceFile(virtualFilePath('MangaRetainedPaint.ets'), surfaceSource, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(surfaceTree.parseDiagnostics.length, 0);
const surface = surfaceTree.statements.find(node => node.name?.getText(surfaceTree) === 'MangaReadingSurface');
const retainedBuilder = surface.members.find(node => node.name?.getText(surfaceTree) === 'retainedChapterPixels').getText(surfaceTree);
assert.equal(/\.backgroundColor\s*\(/.test(retainedBuilder), false,
  'retained chapter paper delegates to the existing shared paint owner, preserving the private Surface budget');
const pixels = [
  { key: 'a', uri: 'file://retained-a', width: 300, height: 700, x: 0, y: -150 },
  { key: 'b', uri: 'file://retained-b', width: 300, height: 350, x: 0, y: 600 },
];
function retainedProof(text = surfaceSource, policySource) {
  const properties = createArkUIPropertyRuntimeProbe();
  const probe = createReaderBuilderProbe(text,
    ['retainedChapterPixels', 'paperColor', 'backgroundPreference', 'previousChapterPixels',
      'onWindowChromeChanged', 'mounted'],
    { ...properties.sdk, ...actualReaderPageShell(policySource), ImageFit: { Fill: 'ImageFit.Fill' } }, properties.hooks);
  Object.assign(probe.owner, { backgroundPreference: 'paper', previousChapterPixels: pixels });
  probe.owner.retainedChapterPixels();
  const nodes = [...probe.owner.nodes.values()];
  const paint = nodes.find(node => node.type === 'Stack');
  const images = nodes.filter(node => node.type === 'Image');
  assert.equal(paint.width, '100%'); assert.equal(paint.height, '100%');
  assert.equal(paint.backgroundColor, '#F8F4EC', 'opaque real paper hides candidate pixels between retained tiles');
  assert.equal(paint.clip, true, 'retained paint must clip old offscreen pixels to the stage');
  assert.equal(paint.zIndex, 0, 'same shared base layer retains later-sibling paint ordering');
  assert.equal(paint.hitTestBehavior, 'HitTestMode.None', 'retained paint never owns native gestures or actions');
  assert.equal(images.length, pixels.length);
  images.forEach((image, index) => {
    assert.equal(image.create, pixels[index].uri);
    assert.equal(image.width, pixels[index].width); assert.equal(image.height, pixels[index].height);
    assert.deepEqual(image.position, { x: pixels[index].x, y: pixels[index].y });
    assert.equal(image.objectFit, 'ImageFit.Fill'); assert.equal(image.draggable, false);
  });
  const identities = nodes.map(node => node.id);
  for (const [preference, paper] of [['ink', '#1C1E1A'], ['white', '#FFFFFF'], ['paper', '#F8F4EC']]) {
    probe.owner.backgroundPreference = preference; properties.flush();
    assert.equal(paint.backgroundColor, paper, 'live theme paper reaches the same retained paint actor');
    assert.deepEqual([...probe.owner.nodes.values()].map(node => node.id), identities,
      'paper changes do not remount old chapter images');
    assert.equal(paint.clip, true); assert.equal(paint.hitTestBehavior, 'HitTestMode.None');
  }
}
retainedProof();
const policySource = readFileSync(readerPageShellSourceUrl, 'utf8');
const missingPaper = policySource.replace(
  'backgroundColor(this.readingUnderlayColor.length > 0 ? this.readingUnderlayColor : Color.Transparent)',
  'backgroundColor(Color.Transparent)');
assert.notEqual(missingPaper, policySource);
assert.throws(() => retainedProof(surfaceSource, missingPaper), /opaque real paper/,
  'a shared paint policy that leaves transparent gaps cannot pass the actual Builder proof');
const withoutClip = retainedBuilder.replace('.clip(true)', '.clip(false)');
assert.notEqual(withoutClip, retainedBuilder);
assert.throws(() => retainedProof(surfaceSource.replace(retainedBuilder, withoutClip)), /clip old offscreen pixels/);
const interceptingPaint = retainedBuilder.replace('HitTestMode.None', 'HitTestMode.Default');
assert.notEqual(interceptingPaint, retainedBuilder);
assert.throws(() => retainedProof(surfaceSource.replace(retainedBuilder, interceptingPaint)), /never owns native gestures/);
outcomes.push('Actual retained chapter SDK paint reuses the complete shared page modifier: opaque live paper, clipped old pixels, gesture pass-through and retained image actors; three broken-policy controls rejected');
console.log(JSON.stringify({ outcomes,
  boundary: 'Actual official SDK component emission and property runtime; footer structure/copy/theme and retained paint attributes only. Parent release threshold, native gesture delivery, chapter readiness, HAP and user acceptance are separate checks.' }, null, 2));

}

}
