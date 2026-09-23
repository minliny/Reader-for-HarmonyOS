import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const appRoot = new URL('../entry/src/main/ets/', import.meta.url);
const coordinator = await readFile(new URL('app/ReaderWindowCoordinator.ts', appRoot), 'utf8');
const index = await readFile(new URL('pages/Index.ets', appRoot), 'utf8');
const experience = await readFile(new URL('features/reading/LocalReadingExperience.ets', appRoot), 'utf8');

// Fix 1: an equal-geometry window event must not broadcast
// readerWindowMetricsRevision — that revision re-renders every @StorageLink
// consumer including the Index root, which is the only per-event global
// re-render channel in the app.
const refreshMetricsBody = coordinator.match(
  /private static refreshMetrics\(\): void \{([\s\S]*?)\n  \}/);
assert.ok(refreshMetricsBody, 'refreshMetrics must exist');
const body = refreshMetricsBody[1];
const guardIndex = body.indexOf('if (previous.ready &&');
const revisionIndex = body.indexOf('const revision =');
assert.ok(guardIndex >= 0, 'refreshMetrics must gate on an equal-geometry previous snapshot');
assert.ok(revisionIndex > guardIndex,
  'the revision bump must happen only after the equality guard');
for (const probe of [
  'sameRectVp(previous.windowRect, windowRect)',
  'sameRectVp(previous.globalRect, globalRectVp)',
  'sameInsetsVp(previous.systemInsets, systemInsets)',
  'sameInsetsVp(previous.cutoutInsets, cutoutInsets)',
  'sameInsetsVp(previous.gestureInsets, gestureInsets)',
  'sameInsetsVp(previous.navigationInsets, navigationInsets)',
  'sameInsetsVp(previous.keyboardInsets, keyboardInsets)',
  'previous.densityPixels === density',
  'previous.systemFontScale === systemFontScale',
]) {
  assert.ok(body.includes(probe), `the equality guard must compare ${probe}`);
}
assert.ok(body.includes('return;'), 'an equal-geometry event must return before writing AppStorage');
const appStorageWrite = body.indexOf("AppStorage.setOrCreate<number>('readerWindowMetricsRevision'");
assert.ok(appStorageWrite > guardIndex, 'the AppStorage write must stay behind the guard');
assert.ok(body.includes('new ReaderWindowMetricsSnapshot(\n      windowRect'),
  'the guard must compare the same snapshot values that are committed');

// Fix 3: a same-value window-policy request must not touch AppStorage or
// re-enqueue device writes. The applied-revision guard keeps foreground
// reapply (revision bump) and failed applies (stale applied) re-executing.
assert.match(coordinator, /private static appliedPolicyRevision: number = -1;/);
assert.match(coordinator,
  /static requestReaderWindowPolicy\(policy: ReaderWindowPolicy\): Promise<void> \{[\s\S]*?if \(ReaderWindowCoordinator\.desiredWindowPolicyOwner === 'reader' &&\s*ReaderWindowCoordinator\.sameWindowPolicy\(\s*ReaderWindowCoordinator\.desiredReaderWindowPolicy, policy\) &&\s*ReaderWindowCoordinator\.appliedPolicyRevision === ReaderWindowCoordinator\.windowPolicyRevision\) \{\s*return Promise\.resolve\(\);/,
  'an identical reader policy with the current revision applied must short-circuit');
assert.match(coordinator,
  /static requestAppWindowPolicy\(\): Promise<void> \{\s*if \(ReaderWindowCoordinator\.desiredWindowPolicyOwner === 'app' &&\s*ReaderWindowCoordinator\.appliedPolicyRevision === ReaderWindowCoordinator\.windowPolicyRevision\) \{\s*return Promise\.resolve\(\);/,
  'an already-applied app policy must short-circuit');
assert.match(coordinator,
  /ReaderWindowCoordinator\.appliedPolicyRevision = revision;\s*ReaderWindowCoordinator\.refreshMetrics\(\);/,
  'only a completed, still-current policy apply may mark the applied revision');
const detachBody = coordinator.match(/static detach\(\): void \{([\s\S]*?)\n  \}/);
assert.ok(detachBody, 'detach must exist');
assert.ok(detachBody[1].includes('ReaderWindowCoordinator.appliedPolicyRevision = -1;'),
  'detach must invalidate the applied-policy marker so install re-applies');
assert.match(coordinator,
  /private static sameWindowPolicy\(a: ReaderWindowPolicy, b: ReaderWindowPolicy\): boolean \{[\s\S]*?a\.orientation === b\.orientation &&[\s\S]*?a\.extendIntoCutout === b\.extendIntoCutout;\s*\}/,
  'policy equality must cover all five semantic fields');
// Callers must keep awaiting the deduped promise (persistence continues).
{
  let writes = 0;
  const policy = {}, pending = new Promise(() => {});
  const Owner = productionMotionMethods(new URL('features/reading/LocalReadingExperience.ets', appRoot),
    ['applyReaderWindowPolicy'], { ReaderWindowCoordinator: { requestReaderWindowPolicy(value) {
      assert.equal(value, policy); writes++; return pending;
    } } });
  const owner = Object.assign(new Owner(), { windowPolicyFor: () => policy, controlsPresentedForWindow: () => false });
  assert.equal(owner.applyReaderWindowPolicy({}), pending,
    'the settings commit path must return the coordinator promise without releasing its persistence barrier');
  assert.equal(writes, 1, 'each settings application forwards exactly one coordinator request');
}

// Fix 2: a refresh-only shelf read that transiently reports empty must not
// unmount the admitted bookshelf route. Genuine user mutations keep the
// resetting semantics.
const applyBody = index.match(
  /private applyBookshelfState\(state: BookshelfDataState, refreshOnly: boolean = false, preserveAnchor: boolean = true\): void \{([\s\S]*?)\n  \}/);
assert.ok(applyBody, 'applyBookshelfState must keep its refreshOnly escape hatch');
assert.match(applyBody[1],
  /if \(refreshOnly && state\.kind !== 'populated' && this\.isBookshelfVisualAdmitted\) \{[\s\S]*?return;/,
  'the admitted tree must survive a refresh-only non-populated read');
const assignmentIndex = applyBody[1].indexOf('this.isCoreShelfEmpty =');
const hysteresisIndex = applyBody[1].indexOf('if (refreshOnly &&');
assert.ok(hysteresisIndex >= 0 && assignmentIndex > hysteresisIndex,
  'the hysteresis guard must run before any state assignment');
const refreshCallerCount =
  (index.match(/this\.applyBookshelfState\((?:state|shelf), true\)/g) ?? []).length;
assert.equal(refreshCallerCount, 2,
  'only the generic refresh and the background-sweep projection pass refreshOnly');
assert.match(index, /this\.applyBookshelfState\(outcome\.shelf\);/,
  'mutation outcomes keep the admission-resetting single-arg call');
assert.match(index, /this\.applyBookshelfState\(shelf\);/,
  'mutation-path reloads keep the admission-resetting single-arg call');

console.log('window flicker dedup contracts: PASS');
