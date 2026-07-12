// Verifies that the compiled HarmonyOS shadow allowlist cannot drift from the
// checked-in Reader-UI consumer lock. Runtime action semantics remain generated
// by Reader-UI; this gate only validates rollout membership and cohort shape.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(fs.readFileSync(path.join(repo, 'READER_UI_CONSUMER.json'), 'utf8'));
const coordinatorPath = path.join(
  repo,
  'entry/src/main/ets/ui/store/ReaderUIRuntimeShadowCoordinator.ets',
);
const coordinator = fs.readFileSync(coordinatorPath, 'utf8');
const syncExperiment = fs.readFileSync(
  path.join(repo, 'entry/src/main/ets/ui/store/ReaderSyncPilotExecutor.ets'),
  'utf8',
);
const overlayComponents = fs.readFileSync(
  path.join(repo, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'),
  'utf8',
);
const indexPage = fs.readFileSync(path.join(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const reducer = fs.readFileSync(path.join(repo, 'entry/src/main/ets/ui/store/ReaderReducer.ets'), 'utf8');

const allowlistMatch = coordinator.match(
  /export const READER_UI_SHADOW_COVERED_EVENTS:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/,
);
assert.ok(allowlistMatch, 'ReaderUIRuntime shadow allowlist declaration is missing');
const compiledEvents = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

assert.deepEqual(
  compiledEvents,
  lock.rollout.coveredEvents,
  'ReaderUIRuntime shadow allowlist must exactly match READER_UI_CONSUMER.json rollout.coveredEvents',
);
assert.equal(lock.rollout.mode, 'shadow', 'HarmonyOS default rollout must remain shadow for R7.2');
assert.equal(lock.readerUiVersion, '2.5.1', 'HarmonyOS must consume Reader-UI 2.5.1');
assert.equal(lock.hostRequestSchemaVersion, '1.2.0', 'HarmonyOS must consume HostRequest schema 1.2.0');
assert.equal(
  lock.runtimeActionsSha256,
  '0ac249341d8de651314687d8352bc1c3f62d3778371ff500f1f0a025a64be82c',
  'HarmonyOS runtime action hash must match Reader-UI 2.5.1',
);
assert.equal(compiledEvents.length, 35, 'HarmonyOS runtime allowlist must cover exactly thirty-five events');
assert.ok(lock.rollout.cohorts.length >= 1, 'HarmonyOS must define at least one rollout cohort');
const directoryCohort = lock.rollout.cohorts.find((c) => c.id === 'reader-directory-pair');
assert.ok(directoryCohort, 'HarmonyOS must define the reader-directory-pair cohort');
assert.equal(directoryCohort.mode, 'pilot', 'HarmonyOS directory pair must be a Pilot cohort');
assert.equal(directoryCohort.effectPolicy, 'none', 'HarmonyOS directory Pilot must remain effect-free');
assert.deepEqual(directoryCohort.events, ['reader.directory.open', 'reader.directory.close']);
const bookOpenCohort = lock.rollout.cohorts.find((c) => c.id === 'book-open-pilot');
assert.ok(bookOpenCohort, 'HarmonyOS must define the book-open-pilot cohort');
assert.equal(bookOpenCohort.mode, 'pilot', 'HarmonyOS book.open must be a Pilot cohort');
assert.equal(bookOpenCohort.effectPolicy, 'exactly-once',
  'HarmonyOS book.open Pilot must enforce exactly-once effects');
assert.deepEqual(bookOpenCohort.events, ['book.open'],
  'HarmonyOS book-open-pilot cohort must own only book.open');
const playbackCohort = lock.rollout.cohorts.find((c) => c.id === 'playback-pilot');
assert.ok(playbackCohort, 'HarmonyOS must define the playback-pilot cohort');
assert.equal(playbackCohort.mode, 'pilot', 'HarmonyOS playback pair must be a Pilot cohort');
assert.equal(playbackCohort.effectPolicy, 'exactly-once',
  'HarmonyOS playback Pilot must enforce exactly-once effects');
assert.deepEqual(playbackCohort.events,
  ['reader.tts.start', 'reader.tts.stop', 'reader.autoPage.start', 'reader.autoPage.stop'],
  'HarmonyOS playback-pilot cohort must own only TTS and auto-page events');
assert.ok(playbackCohort.evidence?.length > 0, 'playback Pilot must record evidence');
assert.ok(playbackCohort.rollback?.length > 0, 'playback Pilot must record rollback');
const importCohort = lock.rollout.cohorts.find((c) => c.id === 'import-shadow-experiment');
assert.ok(importCohort, 'HarmonyOS must define the import-shadow-experiment cohort');
assert.equal(importCohort.mode, 'shadow', 'HarmonyOS import events must remain a Shadow cohort');
assert.deepEqual(importCohort.events,
  ['import.start', 'import.apply', 'import.cancel'],
  'HarmonyOS import Shadow cohort must cover only import events');
assert.ok(importCohort.evidence?.length > 0, 'import Shadow cohort must record evidence');
assert.ok(importCohort.rollback?.length > 0, 'import Shadow cohort must record its promotion boundary');
const sourceSwitchOverlayCohort = lock.rollout.cohorts.find(
  (c) => c.id === 'source-switch-overlay-shadow-experiment',
);
assert.ok(sourceSwitchOverlayCohort,
  'HarmonyOS must define the source-switch-overlay-shadow-experiment cohort');
assert.equal(sourceSwitchOverlayCohort.mode, 'shadow',
  'HarmonyOS source switch overlay events must remain a Shadow cohort');
assert.deepEqual(sourceSwitchOverlayCohort.events,
  ['source.switch.open', 'source.switch.cancel', 'reader.sourceSwitch.open', 'reader.sourceSwitch.close'],
  'HarmonyOS source-switch overlay Shadow cohort must cover only overlay/route events');
assert.ok(sourceSwitchOverlayCohort.evidence?.length > 0,
  'source switch overlay Shadow cohort must record evidence');
assert.ok(sourceSwitchOverlayCohort.rollback?.length > 0,
  'source switch overlay Shadow cohort must record its promotion boundary');
const sourceSwitchEffectCohort = lock.rollout.cohorts.find(
  (c) => c.id === 'source-switch-effect-shadow-experiment',
);
assert.ok(sourceSwitchEffectCohort,
  'HarmonyOS must define the source-switch-effect-shadow-experiment cohort');
assert.equal(sourceSwitchEffectCohort.mode, 'shadow',
  'HarmonyOS source switch effect events must remain a Shadow cohort');
assert.deepEqual(sourceSwitchEffectCohort.events,
  ['source.switch.confirm', 'source.switch.rollback'],
  'HarmonyOS source-switch effect Shadow cohort must cover only effectful events');
assert.ok(sourceSwitchEffectCohort.evidence?.length > 0,
  'source switch effect Shadow cohort must record evidence');
assert.ok(sourceSwitchEffectCohort.rollback?.length > 0,
  'source switch effect Shadow cohort must record its promotion boundary');
const replaceRulesCohort = lock.rollout.cohorts.find((c) => c.id === 'replace-rules-shadow-experiment');
assert.ok(replaceRulesCohort, 'HarmonyOS must define the replace-rules-shadow-experiment cohort');
assert.equal(replaceRulesCohort.mode, 'shadow',
  'HarmonyOS replace rules events must remain a Shadow cohort');
assert.deepEqual(replaceRulesCohort.events,
  ['reader.replace.apply', 'reader.replace.create', 'reader.replace.validate'],
  'HarmonyOS replace-rules Shadow cohort must cover only replace rule events');
assert.ok(replaceRulesCohort.evidence?.length > 0, 'replace rules Shadow cohort must record evidence');
assert.ok(replaceRulesCohort.rollback?.length > 0,
  'replace rules Shadow cohort must record its promotion boundary');
const rssCohort = lock.rollout.cohorts.find((c) => c.id === 'rss-shadow-experiment');
assert.ok(rssCohort, 'HarmonyOS must define the rss-shadow-experiment cohort');
assert.equal(rssCohort.mode, 'shadow', 'HarmonyOS RSS events must remain a Shadow cohort');
assert.deepEqual(rssCohort.events,
  ['rss.refresh', 'rss.subscription.add', 'rss.subscription.delete', 'rss.subscription.edit',
    'rss.entry.open', 'rss.favorite.add', 'rss.favorite.remove'],
  'HarmonyOS RSS Shadow cohort must cover only RSS events');
assert.ok(rssCohort.evidence, 'RSS Shadow cohort must record evidence');
assert.ok(rssCohort.rollback, 'RSS Shadow cohort must record its promotion boundary');
const syncCohort = lock.rollout.cohorts.find((c) => c.id === 'sync-shadow-experiment');
assert.ok(syncCohort, 'HarmonyOS must define the sync-shadow-experiment cohort');
assert.equal(syncCohort.mode, 'shadow', 'HarmonyOS Sync events must remain a Shadow cohort');
assert.deepEqual(syncCohort.events,
  ['sync.run', 'webdav.config.test', 'sync.start', 'sync.progress', 'sync.complete',
    'sync.conflict', 'sync.resolve'],
  'HarmonyOS sync-shadow-experiment cohort must cover only Sync events');
assert.ok(syncCohort.evidence, 'Sync Shadow experiment must record its proof boundary');
assert.ok(syncCohort.rollback, 'Sync Shadow experiment must record its promotion boundary');
const pilotEventSet = new Set(lock.rollout.cohorts.filter((c) => c.mode === 'pilot').flatMap((c) => c.events));
assert.equal(pilotEventSet.size, 7, 'HarmonyOS must expose exactly 7 Pilot events');
assert.equal(
  compiledEvents.filter((event) => !pilotEventSet.has(event)).length,
  compiledEvents.length - pilotEventSet.size,
  'All non-pilot events must inherit the default Shadow mode',
);
assert.deepEqual(
  compiledEvents.filter((event) => !pilotEventSet.has(event)),
  ['reader.page.next', 'reader.page.prev', 'import.start', 'import.apply', 'import.cancel',
    'source.switch.open', 'source.switch.cancel', 'source.switch.confirm', 'source.switch.rollback',
    'reader.sourceSwitch.open', 'reader.sourceSwitch.close', 'reader.replace.apply',
    'reader.replace.create', 'reader.replace.validate', 'rss.refresh', 'rss.subscription.add',
    'rss.subscription.delete', 'rss.subscription.edit', 'rss.entry.open', 'rss.favorite.add',
    'rss.favorite.remove', 'sync.run', 'webdav.config.test', 'sync.start', 'sync.progress',
    'sync.complete', 'sync.conflict', 'sync.resolve'],
  'Import, source switch, replace rules, RSS, page, and Sync must remain Shadow',
);
assert.ok(coordinator.includes('private importPilotEnabled: boolean = false;'),
  'Import effect ownership must be disabled by default');
assert.ok(coordinator.includes('private sourceSwitchPilotEnabled: boolean = false;'),
  'Source-switch ownership must be disabled by default');
assert.ok(coordinator.includes('private replaceRulePilotEnabled: boolean = false;'),
  'Replace-rule effect ownership must be disabled by default');
assert.ok(coordinator.includes('private rssPilotEnabled: boolean = false;'),
  'RSS effect ownership must be disabled by default');
assert.ok(coordinator.includes('private syncPilotEnabled: boolean = false;'),
  'Sync effect ownership must be disabled by default');
assert.equal(syncExperiment.includes('CoreRuntimeSyncGateway'), false,
  'HarmonyOS must not present generated Sync effect names as verified production Core commands');
assert.equal(syncExperiment.includes('executeCoreMethod('), false,
  'The disabled Sync experiment must not directly dispatch generated names to CoreRuntime');
assert.ok(directoryCohort.evidence?.length > 0, 'directory Pilot must record evidence');
assert.ok(directoryCohort.rollback?.length > 0, 'directory Pilot must record rollback');
assert.ok(bookOpenCohort.evidence?.length > 0, 'book.open Pilot must record evidence');
assert.ok(bookOpenCohort.rollback?.length > 0, 'book.open Pilot must record rollback');
assert.ok(
  coordinator.includes('GENERATED_RUNTIME_ACTIONS'),
  'Coordinator must use Reader-UI GENERATED_RUNTIME_ACTIONS',
);
assert.ok(
  !coordinator.includes('coreSequence:') && !coordinator.includes('hostRequest:'),
  'Coordinator must not copy the generated action descriptor table',
);
assert.ok(overlayComponents.includes("ReaderUiStore.dispatch({ type: 'reader.directory.open' })"),
  'real directory UI entry must dispatch the canonical Pilot event');
assert.ok(overlayComponents.includes("ReaderUiStore.dispatch({ type: 'reader.directory.close' })"),
  'directory close must dispatch the canonical Pilot event');
assert.ok(indexPage.includes('ReaderUiStore.isDirectoryPilotActive()') &&
  indexPage.includes("type: 'reader.directory.close'"),
  'system back must close the directory through the Pilot coordinator');
assert.ok(overlayComponents.includes("@StorageProp('reader.chapterToc')") &&
  overlayComponents.includes("@StorageProp('reader.currentChapterTitle')") &&
  overlayComponents.includes('ForEach(this.chapterToc'),
  'directory panel must render native chapterToc/currentChapterTitle data');
assert.ok(!overlayComponents.includes('private tocRows:'),
  'directory panel must not use a hard-coded TOC completion fixture');
const moduleMapping = reducer.slice(reducer.indexOf('function moduleRouteId'), reducer.indexOf('function isReaderModuleOverlay'));
assert.ok(!moduleMapping.includes("case 'directory'"),
  'native reducer must not retain directory event ownership during Pilot');

const packageLock = JSON.parse(fs.readFileSync(path.join(repo, 'entry/oh-package-lock.json5'), 'utf8'));
const runtimePackages = Object.values(packageLock.packages ?? {})
  .filter((item) => item?.name === 'reader_ui_runtime');
assert.equal(runtimePackages.length, 1, 'HarmonyOS lockfile must contain exactly one reader_ui_runtime');
assert.equal(runtimePackages[0].version, '2.5.1', 'HarmonyOS lockfile must pin reader_ui_runtime 2.5.1');

console.log(`ReaderUIRuntime shadow allowlist verified: ${compiledEvents.join(', ')}`);
