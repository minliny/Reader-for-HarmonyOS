import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import { ReaderAutoPageCoordinator } from '../entry/src/main/ets/features/reading/ReaderAutoPageCoordinator.ts';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';

// Exercise the SDK's actual @Component member lowering. A normal TypeScript
// class keeps accessors which ArkUI V1 silently drops, hiding this cold-entry bug.
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const names = ['automaticReadingState', 'automaticReadingConfiguration', 'currentMeasurementGeneration', 'currentMeasurementSelection',
  'beginMeasurement', 'admitReaderViewportSize', 'hasMeasuredViewport',
  'hasCurrentMaterializedChapter', 'isSelectionCurrent', 'requireMeasurementLayoutMap',
  'measuringChapter', 'measuringLayoutMap', 'measuringRanges', 'measuringDraft',
  'measuringOffset', 'measuringProgress', 'measuringRequestedAnchor',
  'setMeasuringDraft', 'setMeasuringOffset', 'setMeasuringProgress', 'setMeasuringRequestedAnchor',
  'measurementIncludesChapterTitle', 'isMeasurementChapterFirstPageStart'];
if (!existsSync(`${sdk}/lib/process_component_class.js`)) {
  assert.doesNotMatch(source, /private (?:get|set) measuring\w+\(/,
    'ArkUI V1 requires ordinary methods for the measurement context');
  console.log('first-page member contract PASS; actual SDK lowering NOT RUN (SDK unavailable)');
} else {
  const require = createRequire(import.meta.url);
  const ts = require(`${sdk}/node_modules/typescript`);
  const compiler = require(`${sdk}/lib/process_component_class.js`);
  const utils = require(`${sdk}/lib/utils.js`);
  const main = require(`${sdk}/main.js`);
  const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const parse = text => ts.createSourceFile('/tmp/ReaderFirstPageSdkProbe.ets', text,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const tree = parse(source);
  assert.equal(tree.parseDiagnostics.length, 0);
  const struct = tree.statements.find(n => n.name?.getText(tree) === 'ReadingExperience');
  const members = struct.members.filter(m => names.includes(m.name?.getText(tree)))
    .map(m => m.getText(tree)).join('\n');
  main.partialUpdateConfig.partialUpdateMode = true;
  utils.storedFileInfo.setCurrentArkTsFile();
  const file = parse(`@Component struct ReaderFirstPageSdkProbe { ${members} }`);
  let transformed;
  const diagnostics = [];
  const result = ts.transform(file, [context => node => {
    transformed = compiler.processComponentClass(node.statements[0], context, diagnostics, false);
    return node;
  }]);
  result.dispose();
  assert.ok(diagnostics.every(d => d.code === '10905103'),
    'only the intentional missing-build diagnostic is permitted');
  const emitted = ts.createPrinter().printNode(ts.EmitHint.Unspecified, transformed, file);
  const Owner = new Function('ViewPU', 'TextController',
    `${stripTypeScriptTypes(emitted)}; return ReaderFirstPageSdkProbe;`)(
    class { finalizeConstruction() {} }, class {});
  const chapter = { chapterIndex: 0, chapterTitle: 'Test chapter', content: 'Original paragraph.' };
  const map = { scalarCount: () => chapter.content.length, residentStart: () => 0, residentEnd: () => chapter.content.length };
  const ranges = [{ startScalar: 0, endScalar: chapter.content.length }];
  function owner() {
    return installReaderMeasurementOwner(Object.assign(new Owner(undefined, {}), {
      mounted: true, lifecycleToken: 1, isSessionActive: token => token === 1,
      chapter, chapterLayoutMap: map, paragraphRanges: ranges.slice(),
      chapterSelectionToken: 0, materializedChapterSelectionToken: 0,
      desiredChapterOffset: 0, desiredChapterProgress: 0, measurementRequestedAnchorScalar: -1,
      viewportWidth: 360, viewportHeight: 780, measurementCompleting: false,
      measurementBatch: [], visibleFragments: [], phase: 'loading', measurementGeneration: 0,
      measurementEpoch: 0, unicodeProbeVerified: true, batches: 0,
      readerSettingsSnapshot: { navigationMode: 'paged' },
      lastMeasurableScalar: () => chapter.content.length - 1,
      rangeIndexForOffset: () => 0, resetPendingPage() {}, ensureFirstPageReadyDeadline() {},
      prepareNextMeasurementBatch() { this.batches++; return true; }, armMeasurementDeadline() {},
      pageTurnInputPhase: () => 'idle', invalidatePageTurnRuntime() {},
      usesBookTurnSimulation: () => false, windowMetricsLayoutKey: () => 'real-device-layout',
      paginationLayoutSignature: () => 'real-device-layout',
    }));
  }
  const ready = owner();
  for (const name of ['automaticReadingState', 'automaticReadingConfiguration', 'currentMeasurementGeneration', 'currentMeasurementSelection']) {
    assert.equal(typeof Owner.prototype[name], 'function', `SDK preserves ordinary owner projection ${name}`);
  }
  delete ready.currentMeasurementGeneration; delete ready.currentMeasurementSelection;
  ready.autoPageRevision = 0;
  ready.autoPageCoordinator = new ReaderAutoPageCoordinator({ now: () => 1, schedule: () => 1, cancel() {},
    active: () => true, ready: () => true, canResumeTurn: () => true, turn: () => ({ kind: 'started' }),
    changed: () => { ready.autoPageRevision++; } });
  ready.autoPageCoordinator.setSpeed(6); ready.autoPageCoordinator.start();
  assert.equal(ready.automaticReadingState().status, 'running');
  assert.equal(ready.automaticReadingConfiguration().speedSeconds, 6);
  assert.ok(ready.autoPageRevision > 0);
  const materialized = typeof ready.measuringChapter === 'function' ? ready.measuringChapter() : ready.measuringChapter;
  assert.equal(materialized, chapter,
    'SDK-emitted component must retain the materialized chapter; missing accessor caused shelf timeout');
  ready.beginMeasurement(1);
  assert.equal(ready.batches, 1, 'first page reaches real measurement admission');
  assert.equal(ready.phase, 'measuring');
  assert.equal(ready.measurementEpoch, 1);
  assert.equal(ready.measurementIncludesChapterTitle(), true);
  const missingChapter = owner();
  missingChapter.chapter = undefined;
  assert.equal(missingChapter.measurementIncludesChapterTitle(), false);

  const viewportFirst = owner();
  viewportFirst.chapter = undefined;
  viewportFirst.chapterLayoutMap = undefined;
  viewportFirst.beginMeasurement(1);
  assert.equal(viewportFirst.batches, 0);
  viewportFirst.chapter = chapter;
  viewportFirst.chapterLayoutMap = map;
  viewportFirst.beginMeasurement(1);
  assert.equal(viewportFirst.batches, 1, 'chapter arrival starts after an existing viewport');

  const chapterFirst = owner();
  chapterFirst.viewportWidth = 0;
  chapterFirst.viewportHeight = 0;
  chapterFirst.beginMeasurement(1);
  assert.equal(chapterFirst.batches, 0);
  chapterFirst.admitReaderViewportSize(360, 780, 1);
  assert.equal(chapterFirst.batches, 1, 'viewport arrival starts an already materialized chapter');
  chapterFirst.admitReaderViewportSize(360, 780, 1);
  assert.equal(chapterFirst.batches, 1, 'unchanged viewport does not duplicate the initial generation');

  const stale = owner();
  stale.chapterSelectionToken = 1;
  stale.beginMeasurement(1);
  assert.equal(stale.batches, 0, 'superseded materialized chapter cannot start measurement');

  const isolated = owner();
  const adjacent = { chapter: { ...chapter, chapterIndex: 1 }, layoutMap: map,
    paragraphRanges: [], desiredChapterOffset: 3, desiredChapterProgress: 0.2,
    measurementRequestedAnchorScalar: 3, paginationDraft: undefined };
  isolated.adjacentMeasurementContext = adjacent;
  assert.equal(isolated.measuringChapter(), adjacent.chapter);
  isolated.setMeasuringOffset(7);
  isolated.setMeasuringProgress(0.4);
  isolated.setMeasuringRequestedAnchor(7);
  const draft = {};
  isolated.setMeasuringDraft(draft);
  isolated.measuringRanges().push(ranges[0]);
  assert.equal(adjacent.desiredChapterOffset, 7);
  assert.equal(adjacent.desiredChapterProgress, 0.4);
  assert.equal(adjacent.measurementRequestedAnchorScalar, 7);
  assert.equal(adjacent.paginationDraft, draft);
  assert.equal(isolated.desiredChapterOffset, 0, 'speculative measurement keeps the visible anchor');
  assert.equal(isolated.paragraphRanges.length, 1, 'speculative ranges stay isolated');
  isolated.adjacentMeasurementContext = undefined;
  assert.equal(isolated.measuringChapter(), chapter);
  isolated.setMeasuringOffset(2);
  assert.equal(isolated.desiredChapterOffset, 2);
  console.log('actual SDK first-page admission: viewport/chapter order, stale selection and adjacent context PASS');
}
