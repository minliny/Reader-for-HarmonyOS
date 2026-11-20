// Exact current authored-time behavior; finite clock/curve/frame ports.
import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selectedCases = selectContractCases({
 'timeline-lifecycle': 'Actual opening/close timing, geometry/fade/reduce/replacement and unmount callbacks with linear curve port.',
 'reverse-continuity': 'Actual same-clock reverse poses, one sampling chain, stale forward and fade refusal.',
 'fixed-layout-assets': 'Actual stable layout/title/shadow fields and current image load/error identity, opaque close wait.',
 'immediate-reverse': 'Actual coalesced initial reverse/fade and close direction admission.',
 'delayed-prop-authority': 'Actual queued forward frame reconciles authoritative Root reverse before stale Prop terminal.',
 'render-contract': 'Actual current SDK actor attribute records; fixed layout/paper/ink/font/shadow and equivalent private Builder syntax with dynamic-layout negative.',
});
if (selectedCases.length) {
 const { bookshelfOpeningSource, bookshelfOpeningInputs, bookshelfOpeningActor } = await import('./lib/bookshelf-opening-probe.mjs');
 const { bookshelfMotionRectAt } = await import('../entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts');
 const src = bookshelfOpeningSource();
 let now = 0;
 const Actor = bookshelfOpeningActor({ hilog: { info() {} }, readerMotionNowMs: () => now }, src);
const target = { x: 0, y: 0, width: 390, height: 844 };
const palette = { paperColor: '#f4f2ed', paperInk: '#24211d' };
const origin = { sourceId: 's', bookId: 'b', coverUrl: '', title: '', radius: 8,
  rect: { x: 70, y: 180, width: 90, height: 130 } };
function fixture(request, reduceMotion = false) {
  const frames = [], covered = [], finished = [], terminal = [], readerOpacity = [];
  const actor = Object.assign(new Actor(), { request: { ...request, ...palette }, reduceMotion, getUIContext: () => ({ postFrameCallback: f => frames.push(f) }),
    onCovered: id => covered.push(id), onFinished: (id, reversed) => { finished.push(id); terminal.push({ id, reversed }); },
    onReaderOpacity: (id, opacity) => readerOpacity.push({ id, opacity }) });
  actor.aboutToAppear();
  const tick = ms => { now = ms; assert.ok(frames.length); frames.shift().onFrame(ms); };
  return { actor, frames, covered, finished, terminal, readerOpacity, tick };
}
for (const caseId of selectedCases) {
 now = 0;
 if (caseId === "timeline-lifecycle") {
const equalRect = (a, b) => assert.deepEqual(a, b);
equalRect(bookshelfMotionRectAt({ origin, target }, 0), origin.rect);
equalRect(bookshelfMotionRectAt({ origin, target }, 1), target);
equalRect(bookshelfMotionRectAt({ origin, target }, .5), { x: 35, y: 90, width: 240, height: 487 });
now = 0;
const open = fixture({ id: 1, direction: 'open', origin, target });
assert.deepEqual(open.readerOpacity, [{ id: 1, opacity: 0 }]);
open.tick(130); assert.deepEqual(open.readerOpacity.at(-1), { id: 1, opacity: .25 });
open.tick(260); assert.deepEqual(open.readerOpacity.at(-1), { id: 1, opacity: .5 });
assert.ok(open.actor.actorWidth < target.width); assert.ok(Math.abs(open.actor.coverAngle) < 1e-9);
open.tick(390); assert.equal(open.actor.coverAngle, -39);
assert.ok(open.actor.actorWidth < target.width, 'turn overlaps the latter half of expansion');
open.tick(520); assert.equal(open.actor.coverAngle, -78); assert.equal(open.actor.actorX, target.x);
assert.equal(open.readerOpacity.at(-1).opacity, 1);
assert.equal(open.actor.layoutWidth, target.width); assert.equal(open.actor.layoutHeight, target.height);
assert.equal(open.actor.actorScaleX, 1); assert.equal(open.actor.actorScaleY, 1);
open.tick(590); assert.equal(open.actor.coverAngle, -87); assert.equal(open.actor.actorOpacity, .5);
const openAt590 = { angle: open.actor.coverAngle, opacity: open.actor.actorOpacity, x: open.actor.actorX, width: open.actor.actorWidth };
open.tick(660); assert.deepEqual(open.finished, [1]);
now = 0;
const updated = fixture({ id: 2, direction: 'open', origin, target });
updated.tick(130);
const newTarget = { ...target, x: 35, width: 280 };
updated.actor.request = { ...updated.actor.request, target: newTarget }; updated.actor.onRequestChanged();
updated.tick(520); assert.equal(updated.actor.actorX, 35); assert.equal(updated.actor.actorWidth, 280);
assert.equal(updated.actor.layoutWidth, 280);
now = 0;
const close = fixture({ id: 3, direction: 'close', origin, target, awaitingOrigin: true });
close.tick(139); assert.deepEqual(close.covered, []);
close.tick(140); assert.deepEqual(close.covered, [3]); assert.equal(close.actor.actorX, target.x); assert.equal(close.frames.length, 0);
assert.equal(close.actor.actorScaleX, 1); assert.equal(close.actor.actorScaleY, 1);
assert.equal(close.actor.actorOpacity, 1); assert.equal(close.actor.coverAngle, -78);
close.actor.reduceMotion = true; close.actor.onReduceMotionChanged();
assert.equal(close.actor.waiting, true); assert.equal(close.actor.actorOpacity, 1);
close.actor.request = { ...close.actor.request, awaitingOrigin: false, origin: { ...origin, rect: { ...origin.rect, x: 80 } } };
close.actor.onRequestChanged(); close.tick(320); assert.deepEqual(close.finished, [3]);
now = 0;
const reduced = fixture({ id: 4, direction: 'open', origin, target }, true);
assert.equal(reduced.actor.fadeSurface, true); reduced.tick(90); assert.equal(reduced.actor.actorOpacity, .5);
assert.deepEqual(reduced.readerOpacity.at(-1), { id: 4, opacity: .5 });
reduced.tick(180); assert.deepEqual(reduced.finished, [4]);
now = 0;
const normalClose = fixture({ id: 7, direction: 'close', origin, target, awaitingOrigin: true });
normalClose.tick(70); assert.deepEqual({ angle: normalClose.actor.coverAngle, opacity: normalClose.actor.actorOpacity,
  x: normalClose.actor.actorX, width: normalClose.actor.actorWidth }, openAt590, 'reverse samples the same visible pose');
normalClose.tick(140); assert.deepEqual(normalClose.covered, [7]); assert.deepEqual(normalClose.readerOpacity, []);
normalClose.actor.request = { ...normalClose.actor.request, awaitingOrigin: false };
normalClose.actor.onRequestChanged(); normalClose.tick(660); assert.deepEqual(normalClose.finished, [7]);
now = 0;
const syncClose = fixture({ id: 8, direction: 'close', origin, target, awaitingOrigin: true });
syncClose.actor.onCovered = id => { syncClose.covered.push(id); syncClose.actor.request = { ...syncClose.actor.request, awaitingOrigin: false }; syncClose.actor.onRequestChanged(); };
syncClose.tick(140); assert.equal(syncClose.frames.length, 1); syncClose.tick(660); assert.deepEqual(syncClose.finished, [8]);
now = 0;
const fadedClose = fixture({ id: 6, direction: 'close', origin, target, awaitingOrigin: true, fadeOnly: true });
fadedClose.tick(180); assert.deepEqual(fadedClose.covered, [6]); assert.equal(fadedClose.actor.visible, true);
assert.equal(fadedClose.frames.length, 0); assert.deepEqual(fadedClose.finished, []);
fadedClose.actor.request = { ...fadedClose.actor.request, awaitingOrigin: false };
fadedClose.actor.onRequestChanged(); fadedClose.tick(360); assert.deepEqual(fadedClose.finished, [6]);
now = 0;
const switchToReduced = fixture({ id: 11, direction: 'open', origin, target });
switchToReduced.tick(130); assert.equal(switchToReduced.readerOpacity.at(-1).opacity, .25);
switchToReduced.actor.reduceMotion = true; switchToReduced.actor.onReduceMotionChanged();
assert.equal(switchToReduced.readerOpacity.at(-1).opacity, .25, 'switching branches preserves visible progress');
// The previously queued native frame is invalidated by the new generation.
switchToReduced.tick(160); assert.equal(switchToReduced.readerOpacity.at(-1).opacity, .25);
switchToReduced.tick(220); assert.equal(switchToReduced.readerOpacity.at(-1).opacity, .625);
switchToReduced.tick(310); assert.deepEqual(switchToReduced.finished, [11]);
now = 0;
const cancelled = fixture({ id: 5, direction: 'open', origin, target });
cancelled.actor.aboutToDisappear(); cancelled.tick(400); assert.deepEqual(cancelled.finished, []);


}
 else if (caseId === "reverse-continuity") {
const pose = a => ({ x: a.actorX, y: a.actorY, width: a.actorWidth, height: a.actorHeight,
  radius: a.actorRadius, angle: a.coverAngle, opacity: a.actorOpacity, shadow: a.shadowScale,
  sx: a.actorScaleX, sy: a.actorScaleY, imageX: a.imageScaleX, imageY: a.imageScaleY,
  titleX: a.titleScaleX, titleY: a.titleScaleY, radiusX: a.clipRadiusX, radiusY: a.clipRadiusY });
for (const point of [100, 300, 600]) {
  now = 0;
  const reverse = fixture({ id: point, direction: 'open', origin, target });
  reverse.tick(point);
  const beforePose = pose(reverse.actor), beforeOpacity = reverse.readerOpacity.at(-1).opacity;
  const timeline = reverse.actor.timeline, generation = reverse.actor.generation;
  reverse.actor.request = { ...reverse.actor.request, reversed: true };
  reverse.actor.onRequestChanged();
  assert.equal(reverse.actor.timeline, timeline, 'reversal keeps the timeline object');
  assert.equal(timeline.sample(now), point, 'reversal preserves authored time');
  assert.deepEqual(pose(reverse.actor), beforePose, 'no visual reset at retarget');
  assert.equal(reverse.actor.generation, generation + 1, 'retire the queued forward frame');
  reverse.actor.onRequestChanged();
  assert.equal(reverse.actor.generation, generation + 1, 'repeated reverse does not requeue');
  const events = reverse.readerOpacity.length;
  reverse.tick(point);
  assert.equal(reverse.readerOpacity.length, events, 'old forward callback is inert');
  assert.equal(reverse.frames.length, 1, 'only one active sampling chain remains');
  reverse.tick(point);
  assert.deepEqual(pose(reverse.actor), beforePose, 'same-time sample is continuous');
  assert.equal(reverse.readerOpacity.at(-1).opacity, beforeOpacity);
  reverse.actor.reduceMotion = true;
  reverse.actor.onReduceMotionChanged();
  assert.equal(reverse.actor.timeline, timeline, 'background/reduce keeps reverse clock');
  assert.equal(reverse.actor.generation, generation + 1);
  assert.equal(reverse.actor.fading, false);
  const firstReverseEvent = reverse.readerOpacity.length - 1;
  for (let elapsed = 20; elapsed < point; elapsed += 20) reverse.tick(point + elapsed);
  reverse.tick(point * 2);
  const values = reverse.readerOpacity.slice(firstReverseEvent).map(event => event.opacity);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] <= values[i - 1], 'reader visibility only falls');
  assert.equal(values.at(-1), 0);
  assert.deepEqual(reverse.covered, [], 'reverse open never uses close route handshake');
  assert.deepEqual(reverse.finished, [point]);
  assert.equal(reverse.frames.length, 0);
  assert.equal(reverse.actor.reversed, false, 'clearActor resets reversal state');
}
for (const reducedFlag of [false, true]) {
  now = 0;
  const fading = fixture({ id: 90, direction: 'open', origin, target, fadeOnly: !reducedFlag }, reducedFlag);
  fading.tick(60);
  const timeline = fading.actor.timeline, generation = fading.actor.generation;
  fading.actor.request = { ...fading.actor.request, reversed: true };
  fading.actor.onRequestChanged();
  assert.equal(fading.actor.reversed, false, 'fade branch rejects reverse even if a caller sends one');
  assert.equal(fading.actor.generation, generation);
  assert.equal(fading.actor.timeline, timeline);
  assert.equal(fading.actor.shadowScale, 0);
  fading.tick(180);
  assert.deepEqual(fading.finished, [90]);
}
}
 else if (caseId === "fixed-layout-assets") {
now = 0;
const styling = fixture({ id: 91, direction: 'open', origin, target });
assert.equal(styling.actor.paperColor, palette.paperColor);
assert.equal(styling.actor.paperInk, palette.paperInk);
assert.equal(styling.actor.shadowScale, 1);
styling.tick(130); assert.equal(styling.actor.shadowScale, .75);
styling.tick(260); assert.equal(styling.actor.shadowScale, .5);
styling.tick(520); assert.equal(styling.actor.shadowScale, 0);
now = 0;
const fixedLayout = fixture({ id: 910, direction: 'open', origin, target });
let layoutWrites = 0;
for (const key of ['layoutWidth', 'layoutHeight', 'titleLayoutWidth', 'titleBaseFont', 'shadowRadiusX', 'shadowRadiusY']) {
  let value = fixedLayout.actor[key];
  Object.defineProperty(fixedLayout.actor, key, { get: () => value, set: next => { value = next; layoutWrites++; } });
}
for (const time of [100, 130, 200, 260, 300, 390, 520, 590]) fixedLayout.tick(time);
assert.equal(layoutWrites, 0, 'frames never publish another layout/font/blur geometry');
now = 590;
const angleBeforeLoad = fixedLayout.actor.coverAngle;
fixedLayout.actor.onCoverLoaded(910, 100, 200);
assert.equal(fixedLayout.actor.coverAngle, angleBeforeLoad, 'load callback cannot advance a pending goal');
fixedLayout.actor.readCurrentRequest = () => ({ ...fixedLayout.actor.request, id: 911 });
fixedLayout.actor.onCoverLoaded(910, 200, 100);
assert.equal(fixedLayout.actor.imageAspect, .5, 'retired image load cannot update the actor');
fixedLayout.actor.onCoverError(910); assert.equal(fixedLayout.actor.coverFailed, false);
styling.actor.onCoverError(90); assert.equal(styling.actor.coverFailed, false);
styling.actor.onCoverError(91); assert.equal(styling.actor.coverFailed, true);
assert.equal(styling.actor.paperInk, palette.paperInk, 'failed cover keeps request ink');
// Origin unavailable after covered switches only the remaining return to fade.
now = 0;
const unavailable = fixture({ id: 92, direction: 'close', origin, target, awaitingOrigin: true });
unavailable.tick(140);
unavailable.actor.request = { ...unavailable.actor.request, awaitingOrigin: false, fadeOnly: true };
unavailable.actor.onRequestChanged();
assert.equal(unavailable.actor.fadeSurface, true);
assert.equal(unavailable.actor.actorOpacity, 1);
assert.equal(unavailable.actor.shadowScale, 0);
unavailable.tick(320); assert.deepEqual(unavailable.finished, [92]);
}
 else if (caseId === "immediate-reverse") {
// ArkUI may coalesce the initial request and a rapid Back before its watcher.
now = 0;
const immediateReverse = fixture({ id: 93, direction: 'open', origin, target, reversed: true });
assert.equal(immediateReverse.actor.reversed, true);
assert.equal(immediateReverse.actor.timeline.sample(0), 0);
assert.equal(immediateReverse.actor.actorWidth, origin.rect.width);
immediateReverse.tick(16);
assert.deepEqual(immediateReverse.finished, [93]);
assert.ok(immediateReverse.readerOpacity.every(event => event.opacity === 0));
for (const reducedFlag of [false, true]) {
  now = 0;
  const immediateFade = fixture({ id: 94, direction: 'open', origin, target,
    reversed: true, fadeOnly: !reducedFlag }, reducedFlag);
  assert.equal(immediateFade.actor.reversed, false);
  immediateFade.tick(180);
  assert.deepEqual(immediateFade.finished, [94]);
  assert.equal(immediateFade.readerOpacity.at(-1).opacity, 1);
}
now = 0;
const closeReverseFlag = fixture({ id: 95, direction: 'close', origin, target, awaitingOrigin: false, reversed: true });
const closeGeneration = closeReverseFlag.actor.generation;
closeReverseFlag.actor.onRequestChanged();
assert.equal(closeReverseFlag.actor.reversed, false, 'close cannot become an opening reverse');
assert.equal(closeReverseFlag.actor.generation, closeGeneration);
closeReverseFlag.tick(140);
closeReverseFlag.tick(660);
assert.deepEqual(closeReverseFlag.covered, [95]);
assert.deepEqual(closeReverseFlag.finished, [95]);

}
 else if (caseId === "delayed-prop-authority") {
// Parent accepts reverse before ArkUI delivers the @Prop/Watch update. The
// already queued forward frame must reconcile the authority before finishing.
now = 0;
const delayedProp = fixture({ id: 970, direction: 'open', origin, target });
const delayedTimeline = delayedProp.actor.timeline;
const delayedGeneration = delayedProp.actor.generation;
const staleChildRequest = delayedProp.actor.request;
let authoritativeRequest = { ...staleChildRequest, reversed: true };
delayedProp.actor.readCurrentRequest = () => authoritativeRequest;
delayedProp.tick(826);
assert.equal(delayedProp.actor.request, staleChildRequest, 'test keeps stale child Prop and never invokes its Watch');
assert.equal(delayedProp.actor.timeline, delayedTimeline, 'authoritative reverse retains the same timeline');
assert.equal(delayedProp.actor.reversed, true, 'queued forward frame admits Root reverse');
assert.equal(delayedProp.actor.generation, delayedGeneration + 1, 'old frame generation retired at reconciliation');
assert.deepEqual(delayedProp.finished, [], 'stale forward terminal cannot finish Root reverse');
assert.equal(delayedProp.frames.length, 1, 'one replacement sampling chain remains');
delayedProp.tick(1486);
assert.deepEqual(delayedProp.finished, [970]);
assert.deepEqual(delayedProp.terminal, [{ id: 970, reversed: true }], 'finish acknowledges actual reverse terminal');
assert.equal(delayedProp.frames.length, 0);
}
 else if (caseId === 'render-contract') {
// Execute the current full SDK actor Builder; finite Rect constructor and
// native frame recording are explicit ports, not a compositor simulation.
const { createEtsBuilderProbe, builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const shadows = await import('../entry/src/main/ets/features/bookshelf/BookshelfCoverVisual.ts');
const { parseBookshelfOpening } = await import('./lib/bookshelf-opening-probe.mjs');
const { ts, tree } = parseBookshelfOpening(src);
const ownerDeclaration = tree.statements.find(node => node.name?.text === 'BookshelfNavigationTransition');
for (const name of ['actorWidth', 'actorHeight', 'actorRadius']) {
  const field = ownerDeclaration.members.find(node => node.name?.getText(tree) === name); assert.ok(field);
  assert.ok(!ts.getAllDecorators(field).some(node => node.expression.getText(tree) === 'State'),
    'derived geometry does not publish an independent reactive layout owner');
}
function render(definition = src, time = 130, cover = 'cover') {
  const properties = createArkUIPropertyRuntimeProbe(), frames = [];
  let currentTime = 0;
  const dependencies = { ...properties.sdk, ...bookshelfOpeningInputs(definition), ...readerTypographyRoles, ...shadows, readerAppColor,
    readerMotionNowMs: () => currentTime, hilog: { info() {} },
    uiContext: { postFrameCallback: frame => frames.push(frame) } };
  const { owner } = createEtsBuilderProbe(definition, builderComponentMembers(definition, 'BookshelfNavigationTransition'), dependencies,
    { ...properties.hooks, initialParams: { request: { id: 101, direction: 'open', target,
      origin: { ...origin, coverUrl: cover }, ...palette }, reduceMotion: false },
      createGlobals: ({ platform }) => {
        class Rect { constructor(params) { Object.assign(this, params); } }
        Object.setPrototypeOf(Rect, platform.Rect);
        return { Rect };
      } });
  owner.aboutToAppear();
  if (time > 0) { currentTime = time; assert.ok(frames.length); frames.shift().onFrame(time); }
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  const carrier = nodes.filter(node => node.scale?.x === owner.actorScaleX && node.scale?.y === owner.actorScaleY && node.translate);
  assert.equal(carrier.length, 1, 'one current actor carrier');
  assert.equal(carrier[0].width, target.width, 'actor width stays at target layout');
  assert.equal(carrier[0].height, target.height);
  assert.deepEqual(carrier[0].translate, { x: owner.actorX, y: owner.actorY });
  assert.equal(carrier[0].opacity, owner.actorOpacity);
  const paper = nodes.filter(node => node.backgroundColor === palette.paperColor);
  assert.ok(paper.length >= 1, 'actual opaque request paper is submitted');
  for (const node of paper) { assert.equal(node.width, target.width); assert.equal(node.height, target.height); }
  const shadow = nodes.find(node => node.type === 'Rect' && node.shadow);
  assert.ok(shadow); assert.equal(shadow.shadow.radius, shadows.BOOKSHELF_COVER_SHADOW_RADIUS);
  assert.equal(shadow.shadow.offsetY, shadows.BOOKSHELF_COVER_SHADOW_OFFSET_Y);
  const title = nodes.find(node => node.type === 'Text' && node.create === origin.title);
  if (!cover) { assert.ok(title); assert.equal(title.fontColor, palette.paperInk);
    assert.equal(title.fontSize, owner.titleBaseFont); assert.equal(title.width, owner.titleLayoutWidth); }
  const coverNode = nodes.find(node => node.type === 'Image');
  if (cover) { assert.ok(coverNode); assert.equal(coverNode.width, target.width); assert.equal(coverNode.height, target.height);
    assert.deepEqual(coverNode.scale, { x: owner.imageScaleX, y: owner.imageScaleY }); }
  owner.aboutToDisappear();
  return { width: carrier[0].width, height: carrier[0].height, titleFont: title?.fontSize };
}
const samples = [0, 130, 390, 520, 590].map(time => render(src, time, ''));
assert.ok(samples.every(row => row.titleFont === samples[0].titleFont), 'native title font stays fixed through authored samples');
render(src, 390, 'cover');
let widthArgument, builderName;
const visit = node => {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'scale' &&
    node.arguments[0]?.properties?.some(property => property.initializer?.getText(tree) === 'this.actorScaleX')) {
    let carrier = node.expression.expression;
    while (ts.isCallExpression(carrier) && ts.isPropertyAccessExpression(carrier.expression)) {
      if (carrier.expression.name.text === 'width') { assert.equal(widthArgument, undefined); widthArgument = carrier.arguments[0]; }
      carrier = carrier.expression.expression;
    }
  }
  if (ts.isMethodDeclaration(node) && ts.getAllDecorators(node).some(decorator => decorator.getText(tree) === '@Builder')) {
    assert.equal(builderName, undefined); builderName = node.name.getText(tree);
  }
  ts.forEachChild(node, visit);
};
visit(ownerDeclaration); assert.ok(widthArgument && builderName);
const wrongLayout = src.slice(0, widthArgument.getStart(tree)) + 'this.actorWidth' + src.slice(widthArgument.end);
assert.throws(() => render(wrongLayout), /actor width stays at target layout/);
const edits = [{ start: widthArgument.getStart(tree), end: widthArgument.end, text: '(' + widthArgument.getText(tree) + ')' }];
const rename = node => { if (ts.isIdentifier(node) && node.text === builderName)
  edits.push({ start: node.getStart(tree), end: node.end, text: builderName + 'Equivalent' }); ts.forEachChild(node, rename); };
rename(ownerDeclaration); assert.ok(edits.length >= 3);
let equivalent = src;
for (const edit of edits.sort((a,b) => b.start-a.start)) equivalent = equivalent.slice(0, edit.start) + edit.text + equivalent.slice(edit.end);
render(equivalent);
console.log('current actor SDK fixed layout/paper/ink/font/shadow/transform; private Builder and parenthesis equivalent PASS, dynamic-layout fault REJECTED; Native compositor NOT_RUN');
}
 recordContractCasePass(caseId);
}
}
