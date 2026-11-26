import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { actualSourceSwitchPresentation } from './lib/source-switch-presentation-probe.mjs';
const selected = selectContractCases({
  'surface-notifications': { description: 'Actual source-picker child lifecycle defers parent-observed receipts, with superseded scope, hidden input and native attachment identity negatives', resources: [] },
  'cover-receipt': { description: 'Actual source-picker cover error callback rejects replaced URL, repeated URL generation and retired surface attachment', resources: [] },
});
for (const id of selected) {
  if (id === 'cover-receipt') {
    const source = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceSwitchWindow.ets', import.meta.url), 'utf8');
    const owner = boundedSurfaceSdk().consumer(source, ['coverChanged', 'coverFailureHandler']);
    Object.assign(owner, { mounted: true, coverGeneration: 0, coverUrl: 'cover-a', coverFailed: false,
      surfaceAttachment: 2, surfaceScope: 3 });
    const first = owner.coverFailureHandler();
    owner.coverUrl = 'cover-b'; owner.coverChanged(); first(); assert.equal(owner.coverFailed, false);
    const second = owner.coverFailureHandler(); second(); assert.equal(owner.coverFailed, true);
    owner.coverUrl = 'cover-a'; owner.coverChanged(); first(); assert.equal(owner.coverFailed, false);
    const current = owner.coverFailureHandler(); owner.surfaceAttachment = 4; current(); assert.equal(owner.coverFailed, false);
    owner.surfaceAttachment = 2; owner.mounted = false; current(); assert.equal(owner.coverFailed, false);
    assert.match(source, /\.onError\(this\.coverFailureHandler\(\)\)/);
    console.log('PASS source-picker current cover error receipt and retired URL/surface actors');
    recordContractCasePass(id); continue;
  }
  const source = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceSwitchPanel.ets', import.meta.url), 'utf8');
  const sdk = boundedSurfaceSdk(), frames = [], publications = [];
  const Presentation = actualSourceSwitchPresentation({});
  const surface = new Presentation(); surface.visible = true; surface.scopeId = 1;
  let parentRendering = false;
  for (const key of ['surfaceAttached', 'surfaceClosing']) {
    let value = surface[key];
    Object.defineProperty(surface, key, { get: () => value, set(next) {
      assert.equal(parentRendering, false, 'a child receipt cannot write the ObjectLink parent during its render');
      value = next; publications.push([key, next]);
    } });
  }
  const owner = sdk.consumer(source, ['aboutToAppear', 'aboutToDisappear', 'surfaceChanged', 'applySurfaceChanged',
    'postSurfaceAction', 'acceptsInput', 'isCurrent'], { SourceSwitchSurfaceFrame: class { constructor(action) { this.onFrame = action; } } });
  Object.assign(owner, { surface, attachment: 0, attachedScope: -1, attachedSurface: undefined, surfaceRevision: 0,
    scopeId: 1, showing: true, mounted: false, interactive: true, appForeground: true, reduceMotion: true,
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }) });
  parentRendering = true; owner.aboutToAppear(); assert.deepEqual(publications, []);
  assert.equal(owner.acceptsInput(), false, 'unattached native carrier is unavailable');
  assert.throws(() => owner.applySurfaceChanged(), /ObjectLink parent/, 'the old synchronous publication mechanism reaches the rendering parent');
  parentRendering = false; frames.shift().onFrame();
  assert.equal(surface.surfaceAttached, true); assert.equal(owner.isCurrent(1), true);
  const first = owner.attachment;
  parentRendering = true; owner.showing = false; surface.visible = false; owner.surfaceChanged();
  assert.equal(surface.surfaceAttached, true, 'hide receipt waits until after the parent render');
  assert.equal(owner.acceptsInput(), false);
  owner.showing = true; surface.visible = true; surface.scopeId = 2; owner.scopeId = 2; owner.surfaceChanged();
  parentRendering = false; frames.shift().onFrame();
  assert.equal(owner.attachment, first, 'obsolete hide cannot retire a successor opening');
  frames.shift().onFrame(); assert.notEqual(owner.attachment, first); assert.equal(owner.isCurrent(2), true);
  const second = owner.attachment;
  parentRendering = true; owner.aboutToDisappear(); assert.equal(surface.surfaceIsCurrent(second, 2), true);
  parentRendering = false; frames.shift().onFrame(); assert.equal(surface.surfaceAttached, false);
  assert.equal(owner.isCurrent(2), false);
  mock.timers.enable({apis: ['setTimeout']});
  try {
    let restored = 0;
    function openAndHide() {
      surface.visible = true;
      const attachment = surface.attachSurface(2);
      surface.bindSurfaceFocus(2, {current: () => true, postFrame: action => action(), restore: () => { restored++; }});
      surface.surfacePartAppeared(attachment, 2, 'scrim');
      surface.surfacePartAppeared(attachment, 2, 'drawer:0');
      surface.visible = false;
      surface.hideSurface(attachment, 2);
      surface.surfaceTransitionFinished(attachment, 2, 'scrim', false);
      return attachment;
    }
    const missing = openAndHide();
    assert.equal(surface.isSurfacePresented(), true);
    mock.timers.tick(1000);
    assert.equal(surface.isSurfacePresented(), false, 'a missing drawer exit receipt cannot retain a modal');
    assert.equal(restored, 1);
    surface.surfaceTransitionFinished(missing, 2, 'drawer:0', false);
    const old = openAndHide();
    surface.visible = true;
    const next = surface.attachSurface(2);
    surface.surfaceTransitionFinished(old, 2, 'drawer:0', false);
    surface.surfacePartDisappeared(old, 2, 'drawer:0');
    mock.timers.tick(1000);
    assert.equal(surface.surfaceIsCurrent(next, 2), true, 'late exit cannot detach a reopened picker');
    assert.equal(restored, 1);
    surface.detachSurface(next, 2);
    const normal = openAndHide();
    surface.surfaceTransitionFinished(normal, 2, 'drawer:0', false);
    assert.equal(surface.isSurfacePresented(), false, 'normal exit releases immediately');
    mock.timers.tick(1000);
    assert.equal(restored, 2, 'normal and fallback completion restore focus exactly once');
    const detached = openAndHide();
    surface.surfacePartDisappeared(detached, 2, 'drawer:0');
    assert.equal(surface.isSurfacePresented(), false, 'a detached native actor releases without waiting for its exit timer');
    surface.surfaceTransitionFinished(detached, 2, 'drawer:0', false);
    mock.timers.tick(1000);
    assert.equal(restored, 3, 'detachment, exit callback and timer cannot restore focus more than once');
    surface.visible = true;
    const earlyDetach = surface.attachSurface(2);
    surface.surfacePartAppeared(earlyDetach, 2, 'drawer:0');
    surface.surfacePartDisappeared(earlyDetach, 2, 'drawer:0');
    assert.equal(surface.isSurfacePresented(), true, 'replacing an actor while open leaves the attachment active');
    surface.visible = false;
    surface.hideSurface(earlyDetach, 2);
    assert.equal(surface.isSurfacePresented(), false, 'hide completes immediately when the native actor already disappeared');
  } finally { mock.timers.reset(); }
  assert.match(source, /this\.attachment > 0 \? \[this\.attachment\] : \[\]/, 'attachment zero never creates native surface actors');
  console.log('PASS source-picker current lifecycle receipts with owner-bound notification delivery; no native scheduling proof');
  recordContractCasePass(id);
}
