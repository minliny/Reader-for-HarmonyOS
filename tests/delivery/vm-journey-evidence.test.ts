import assert from 'node:assert/strict';
import test from 'node:test';
import { fontReorderPair, journeys } from '../../scripts/lib/vm-journey-cases.mjs';
import { layoutReceiptProblem, layoutReports, matchingTransitions, matchesVmEnvironment, shareReports, ttsAuditionReports,
  transitionReceiptProblem, transitionReports, transitionWatermark, verticalSwipeLane, vmJourneyMatrix } from '../../scripts/lib/vm-journey-evidence.mjs';
import { READER_VM_IMPORT_SOURCE, readerVmJourneyImportDocument, readerVmJourneyResponse,
  readerVmJourneySources } from '../../entry/src/main/ets/app/diagnostics/ReaderVmJourneyData.ts';

const log = (pid: string, marker: string, payload: string): string =>
  `11-27 15:42:00.001  ${pid}  401 I A05244/Reader: ${marker} ${payload}`;

const layout = {
  schemaVersion: 2, sequence: 3, status: 'measured', scheme: 'night',
  observedRules: ['R13', 'R14'], violations: [], missing: [],
  features: [{ id: 'tts-transport', state: 'pass' }],
  nativeAudit: { complete: true, textCount: 3, imageCount: 1, interactiveCount: 4 },
  environment: { widthVp: 320, heightVp: 610, fontScale: 1.6, material: 'performance', reducedMotion: true },
};
const transition = { schemaVersion: 1, sequence: 8, kind: 'launch', action: 'tts', subject: 'reader-session-launch',
  status: 'measured', observedRules: ['T3'], missing: [], violations: [], frameCount: 3 };
const frames = [0, 16, 32].map(atMs => ({ atMs, nodes: [], unreadableIds: [] }));
const frameText = JSON.stringify({ sequence: 8, frames });
const firstChunk = log('401', 'READER_TRANSITION_FRAMES', `8/0/2 ${frameText.slice(0, 15)}`);
const lastChunk = log('401', 'READER_TRANSITION_FRAMES', `8/1/2 ${frameText.slice(15)}`);
const summary = log('401', 'READER_TRANSITION_INVARIANTS', JSON.stringify(transition));

test('matrix selects all fourteen journeys and expands independently supported axes', () => {
  assert.deepEqual(Object.keys(journeys), Array.from({ length: 14 }, (_, index) => `J${index + 1}`));
  const profiles = vmJourneyMatrix({ material: 'native,performance', motion: 'standard,reduced',
    scheme: 'day,night', 'reading-mode': 'paged,continuous' });
  assert.equal(profiles.length, 16);
  assert.equal(new Set(profiles.map(profile => profile.id)).size, 16);
  assert.throws(() => vmJourneyMatrix({ 'font-scale': '1.8' }), /Invalid fontScale/);
  assert.throws(() => vmJourneyMatrix({ material: 'native,performance', motion: 'standard,reduced',
    scheme: 'day,night', 'reading-mode': 'paged,continuous', window: 'actual,portrait,landscape' }), /32/);
});

test('matrix environment requires actual native measurements, including provisioned size/scale', () => {
  const [profile] = vmJourneyMatrix({ material: 'performance', motion: 'reduced', scheme: 'night',
    'font-scale': '1.6', window: 'narrow' });
  assert.deepEqual(matchesVmEnvironment(profile, layout), []);
  assert.equal(matchesVmEnvironment(profile, { ...layout, environment: undefined }).length, 1);
  assert.equal(matchesVmEnvironment(profile, { ...layout, environment: { ...layout.environment,
    widthVp: 380, fontScale: 1.1, material: 'fallback', reducedMotion: false } }).length, 4);
});

test('J9 uses a clear scroll lane when the visible rate slider covers the previous swipe origin', () => {
  const scroll = [101, 1772, 1181, 2388];
  const rate = [123, 2198, 1159, 2352];
  const lane = verticalSwipeLane(scroll, 2234, 1926, [rate]);
  assert.ok(lane !== undefined && lane > scroll[0] && lane < scroll[2]);
  assert.ok(lane < rate[0] || lane > rate[2]);
  assert.equal(verticalSwipeLane(scroll, 2150, 1926, [rate]), 641);
  assert.equal(verticalSwipeLane(scroll, 2234, 1926, [[101, 2100, 660, 2388], [655, 2000, 1181, 2300]]), undefined);
});

test('J11 derives an adjacent built-in font pair from fully visible native bounds', () => {
  const viewport = '[89,1772][1193,2388]';
  const card = (slot: string, bounds: string, origBounds = bounds, canDrag = true) =>
    ({ slot, bounds, origBounds, canDrag });
  const partiallyVisible = [
    card('serif', '[120,2291][370,2388]', '[120,2291][370,2445]'),
    card('sans', '[384,2291][634,2388]', '[384,2291][634,2445]'),
  ];
  assert.equal(fontReorderPair(viewport, partiallyVisible), undefined);

  const measured = [
    card('kai', '[911,1996][1161,2150]'),
    card('import', '[384,1996][634,2150]', undefined, false),
    card('serif', '[120,1996][370,2150]'),
    card('sans', '[648,1996][898,2150]'),
    card('system', '[120,2162][370,2316]'),
  ];
  assert.deepEqual(fontReorderPair(viewport, measured), ['sans', 'kai']);
  assert.equal(fontReorderPair(viewport, measured, ['serif', 'sans']), undefined);
  assert.equal(fontReorderPair(viewport, measured, ['serif', 'system']), undefined);
  assert.deepEqual(fontReorderPair(viewport, measured.map(item => {
    if (item.slot === 'kai') return { ...item, slot: 'sans' };
    if (item.slot === 'sans') return { ...item, slot: 'kai' };
    return item;
  }), ['sans', 'kai']), ['kai', 'sans']);
});

test('layout evidence isolates current process and rejects missing rules, features and violations', () => {
  const sample = log('401', 'READER_LAYOUT_INVARIANTS', JSON.stringify(layout));
  const other = log('400', 'READER_LAYOUT_INVARIANTS', JSON.stringify({ ...layout, sequence: 8 }));
  const old = log('401', 'READER_LAYOUT_INVARIANTS', JSON.stringify({ ...layout, schemaVersion: 1, sequence: 9 }));
  assert.deepEqual(layoutReports([sample, old, other].join('\n'), '401'), [layout]);
  assert.equal(layoutReceiptProblem(layout, { requiredRules: ['R14'], features: ['tts-transport'] }), '');
  assert.match(layoutReceiptProblem(layout, { requiredRules: ['R8'] }), /R 规则/);
  assert.match(layoutReceiptProblem(layout, { features: ['not-confirmed'] }), /功能强断言/);
  assert.match(layoutReceiptProblem({ ...layout, nativeAudit: { complete: false } }, { requiredRules: ['R13'] }), /原生树扫描/);
  assert.match(layoutReceiptProblem({ ...layout, violations: [{ rule: 'R13' }] }, {}), /违规/);
});

test('transition evidence joins out-of-order chunks under exact process, subject and action', () => {
  const output = transitionReports([lastChunk, summary, firstChunk].join('\n'), '401');
  assert.deepEqual(output[0].frames, frames);
  assert.equal(matchingTransitions(output, 7, { kind: 'launch', action: 'tts', subject: 'reader-session-launch' }).length, 1);
  assert.equal(matchingTransitions(output, 8, { kind: 'launch', action: 'tts' }).length, 0);
  assert.equal(matchingTransitions(output, 7, { kind: 'launch', action: 'autoPage' }).length, 0);
  assert.equal(transitionReceiptProblem(output[0], ['T3']), '');
  assert.match(transitionReceiptProblem(output[0], ['T1']), /T 规则/);
  assert.match(transitionReceiptProblem({ ...output[0], violations: [{ rule: 'T3' }] }, ['T3']), /违规/);
  assert.match(transitionReceiptProblem({ ...output[0], frames: [...frames].reverse() }, ['T3']), /采样顺序/);
});

test('a preceding in-flight transition cannot fulfill the next identical action', () => {
  const before = [log('401', 'READER_TRANSITION_BEGIN', '8'), log('407', 'READER_TRANSITION_BEGIN', '32')].join('\n');
  const watermark = transitionWatermark(before, '401', []);
  assert.equal(watermark, 8);
  const completed = transitionReports([summary, firstChunk, lastChunk].join('\n'), '401');
  assert.equal(matchingTransitions(completed, watermark, { kind: 'launch', action: 'tts' }).length, 0);
});

test('share receipt accepts only native records in the current process with a valid operation id', () => {
  const output = [log('408', 'READER_JOURNEY_SHARE', '12 presented'), log('401', 'READER_JOURNEY_SHARE', '20 presented'),
    log('401', 'READER_JOURNEY_SHARE', '20 dismissed'), log('401', 'READER_JOURNEY_SHARE', '23 assumed'),
    log('401', 'READER_JOURNEY_SHARE', '0 shown')].join('\n');
  assert.deepEqual(shareReports(output, '401'), [{ operationId: 20, state: 'presented' }, { operationId: 20, state: 'dismissed' }]);
});

test('audition receipts bind native audio delivery to the current Reader process', () => {
  const audition = (pid: string, operationId: number, state: string) =>
    log(pid, 'READER_VM_TTS_AUDITION', JSON.stringify({ schemaVersion: 1, operationId, state }));
  const output = [
    audition('408', 12, 'started'), audition('401', 2, 'started'), audition('401', 2, 'synthesized'),
    audition('401', 2, 'completed'), audition('401', 0, 'completed'),
  ].join('\n');
  assert.deepEqual(ttsAuditionReports(output, '401'), [
    { schemaVersion: 1, operationId: 2, state: 'started' },
    { schemaVersion: 1, operationId: 2, state: 'completed' },
  ]);
});

test('source-journey input is exact, inert outside its finite synthetic transport and excluded from initial catalog', () => {
  const url = 'https://novel-a.reader-journeys.invalid/fixtures/v9-source.json';
  const document = readerVmJourneyImportDocument(url);
  assert.ok(document);
  assert.equal(JSON.parse(document)[0].bookSourceUrl, READER_VM_IMPORT_SOURCE);
  assert.equal(readerVmJourneySources().some(row => row.bookSourceUrl === READER_VM_IMPORT_SOURCE), false);
  assert.equal(readerVmJourneyImportDocument(url + '?other'), undefined);
  assert.equal(readerVmJourneyResponse({ url, method: 'POST' }), undefined);
  assert.equal(readerVmJourneyResponse({ url, method: 'GET', usePlatformCookieJar: true }), undefined);
  assert.equal(readerVmJourneyResponse({ url, method: 'GET' })?.body, document);
});

test('foreign, missing and contradictory transition chunks stay unaccepted', () => {
  for (const chunks of [firstChunk, [firstChunk, lastChunk.replace('401  401', '402  401')].join('\n'),
    [firstChunk, lastChunk, log('401', 'READER_TRANSITION_FRAMES', '8/1/2 corrupted')].join('\n')]) {
    const reports = transitionReports([summary, chunks].join('\n'), '401');
    assert.equal(reports.length, 1);
    assert.match(transitionReceiptProblem(reports[0], ['T3']), /分片不完整/);
  }
});
