import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
const selected = selectContractCases({ 'measurement-owner': {
  description: 'Actual SDK capsule Area sender and LRE receiver keep type/session/layout identities through late A-B-A, resize and deferred page-chrome admission', resources: [] },
  'measurement-recovery': { description: 'First-frame native text failure returns an estimate and retries the same measurement identity', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
for (const id of selected) {
  const capsuleSource = read('features/reading/ui/ReaderSessionCapsule.ets');
  if (id === 'measurement-recovery') {
    const textMeasurement = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'),
      'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break-word' } }, ['measureReaderControlText']);
    const { ReaderSessionCapsuleMetricsCache } = pureModuleProbe(capsuleSource.slice(0, capsuleSource.indexOf('/** The static capsule')),
      'ReaderSessionCapsuleMeasurement.ets', { ...readerTypographyRoles, ...textMeasurement,
        READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT: 44 }, ['ReaderSessionCapsuleMetricsCache']);
    for (const [type, unavailable] of [['autoPage', '自动翻页'], ['autoPage', '60'], ['tts', '朗读']]) {
      let ready = false, attempts = 0;
      const context = { px2vp: value => value, getMeasureUtils: () => ({
        measureTextSize: ({ textContent }) => {
          attempts++;
          return { width: textContent === '60' ? 24 : 60, height: !ready && textContent === unavailable ? 0 : 20 };
        },
        measureText: ({ textContent }) => textContent === '60' ? 24 : 60,
      }) };
      const cache = new ReaderSessionCapsuleMetricsCache();
      const estimated = cache.resolve(context, type, 1, 1);
      ready = true;
      const measured = cache.resolve(context, type, 1, 1);
      assert.ok(measured.width > estimated.width, `${type}/${unavailable} retries same-identity estimation`);
      assert.equal(measured.labelWidth, 60);
      assert.equal(measured.countdownSize, type === 'autoPage' ? 26 : 16);
      const attemptsAfterRecovery = attempts;
      assert.equal(cache.resolve(context, type, 1, 1), measured);
      assert.equal(attempts, attemptsAfterRecovery, 'native receipt is cached after recovery');
    }
    recordContractCasePass(id);
    continue;
  }
  const readingSource = read('features/reading/ui/LocalReadingExperience.ets');
  const sdk = boundedSurfaceSdk();
  const metrics = { revision: 1 };
  const host = sdk.consumer(readingSource, ['sessionCapsuleMeasurementIdentity','sessionCapsuleMeasurementCurrent',
    'onSessionCapsuleMeasured','admitSessionCapsuleMeasurement','activeSessionCapsuleWidth','activeSessionCapsuleHeight',
    'sessionLaunchLayoutKey','flushDeferredPageChromeState','isMountedToken','isSessionActive'],
    { ReaderWindowCoordinator: { metrics: () => metrics } });
  let snapshot = { type: 'autoPage' }, frozen = false, pagination = 'layout-one';
  const automatic = { generation: 1 };
  Object.assign(host, { mounted: true, exitRequested: false, lifecycleToken: 1, sourceId: 'source', bookId: 'book-a',
    viewportWidth: 366, viewportHeight: 844, readerAppScheme: 'day', appearanceSnapshot: { activeTheme: 'day' },
    appearanceMutationGeneration: 0, pageTurnRenderRevision: 0,
    sessionCapsuleMeasuredWidth: 0, sessionCapsuleMeasuredHeight: 24, sessionCapsuleMeasuredIdentity: '',
    sessionCapsuleSnapshot: () => snapshot, sessionCapsuleType: () => snapshot?.type ?? 'autoPage',
    sessionCapsuleMetrics: type => ({ width: type === 'tts' ? 94 : 96, targetHeight: 44 }),
    automaticReadingState: () => automatic, ttsState: { sessionGeneration: 1 },
    paginationLayoutSignature: () => pagination, isReaderIdentityCurrent: () => true,
    pageChromeStateFrozen: () => frozen, flushDeferredReadingImagePixels() {} });
  const frameStart = capsuleSource.indexOf('export class ReaderSessionCapsuleFrame');
  const frameEnd = capsuleSource.indexOf('/** Shared fixed leading actor');
  const frames = pureModuleProbe(capsuleSource.slice(frameStart, frameEnd), 'CapsuleFrame.ets', {
    readerAppColor: color => color, READER_SESSION_CAPSULE_RADIUS: 12,
    READER_SESSION_CAPSULE_SHADOW: { radius: 8, offsetX: 0, offsetY: 3 },
    ReaderPressFeedback: sdk.deps.ReaderPressFeedback,
  }, ['ReaderSessionCapsuleFrame']);
  let measurements = 0;
  const readReaderSessionCapsuleMeasurement = () => {
    measurements += 1;
    return { measured: true,
      metrics: { width: 96, paintHeight: 24, targetHeight: 44, labelWidth: 42, labelHeight: 16, countdownSize: 16 } };
  };
  const cacheSource = capsuleSource.slice(capsuleSource.indexOf('export class ReaderSessionCapsuleMetricsCache'),
    capsuleSource.indexOf('/** The static capsule'));
  const cache = pureModuleProbe(cacheSource, 'CapsuleMetricsCache.ets', { readReaderSessionCapsuleMeasurement },
    ['ReaderSessionCapsuleMetricsCache']);
  class Child { constructor(owner, params, _storage, id) { Object.assign(this,{owner,params,id}); } }
  sdk.hooks.childSources.ReaderSessionCapsuleLeading = capsuleSource;
  sdk.hooks.childSources.ReaderSessionCapsulePause = capsuleSource;
  const capsule = sdk.consumer(capsuleSource, ['build','measurementHandler','numericLength','finalWidth','metrics','type','measurementIdentity',
    'metricsRevision','metricsCache','pressPointer','effectiveTextColor','effectivePrimaryColor','effectiveOnPrimaryColor'], {
    ...frames, ...cache, ReaderSessionCapsuleLeading: Child, ReaderSessionCapsulePause: Child,
    readerWindowMetrics: () => ({ densityPixels: 3 }),
    readerSessionCapsuleAccessibility: () => 'capsule',
  }, { type: 'autoPage', measurementIdentity: host.sessionCapsuleMeasurementIdentity('autoPage') }, 'ReaderSessionCapsule');
  Object.assign(capsule, { themeScheme:'day',surfaceColor:'',surfaceBorderColor:'',textColor:'',primaryColor:'',onPrimaryColor:'',
    shadowColor:'',capsuleWidth:0,fontScale:1,interactionEnabled:true });
  capsule.onMeasured = (width,height,identity,type) => host.onSessionCapsuleMeasured(identity,type,width,height);
  capsule.initialRender(); sdk.properties.flush();
  assert.equal(measurements, 1, 'all initial paint attributes share one text measurement');
  capsule.metrics(); capsule.metrics();
  assert.equal(measurements, 1);
  capsule.fontScale = 1.5;
  capsule.metrics(); capsule.metrics();
  assert.equal(measurements, 2, 'font scaling invalidates the current cached receipt once');
  capsule.metricsRevision += 1;
  capsule.metrics(); capsule.metrics();
  assert.equal(measurements, 3, 'new window metrics invalidate even when the font scale is unchanged');
  const capsuleFrame = [...capsule.nodes.values()].find(node => node.shadow?.radius > 0);
  assert.deepEqual(capsuleFrame.shadow, { radius: 24, offsetX: 0, offsetY: 9, color: 'app.shadow.menu' });
  const target = [...capsule.nodes.values()].find(node => node.type === 'Button' && node.onAreaChange);
  const present = type => {
    capsule.updateStateVars({type, measurementIdentity: host.sessionCapsuleMeasurementIdentity(type)});
    sdk.properties.flush();
    return target.onAreaChange;
  };
  const first = target.onAreaChange;
  first({}, {width:140,height:44}); assert.equal(host.activeSessionCapsuleWidth(),140);
  snapshot = {type:'tts'};
  const tts = present('tts'); first({}, {width:900,height:90}); assert.equal(host.sessionCapsuleMeasuredWidth,140);
  assert.equal(measurements, 4, 'switching playback type invalidates the current measurement');
  tts({}, {width:120,height:44}); assert.equal(host.activeSessionCapsuleWidth(),120);
  snapshot = {type:'autoPage'}; automatic.generation++;
  const secondAuto = present('autoPage'); first({}, {width:900,height:90}); assert.equal(host.activeSessionCapsuleWidth(),96,'A-B-A cannot borrow the retired A receipt');
  secondAuto({}, {width:142,height:44}); assert.equal(host.activeSessionCapsuleWidth(),142);
  metrics.revision++; host.viewportWidth=320; pagination='layout-two';
  secondAuto({}, {width:900,height:90}); assert.equal(host.activeSessionCapsuleWidth(),96,'resize rejects cached and late previous dimensions');
  assert.equal(host.activeSessionCapsuleHeight(),44);
  const resized = present('autoPage'); resized({}, {width:145,height:46}); assert.equal(host.activeSessionCapsuleHeight(),46);
  frozen=true; resized({}, {width:150,height:48}); assert.equal(host.pendingSessionCapsuleWidth,150);
  metrics.revision++; host.viewportWidth=366; pagination='layout-three'; frozen=false;
  host.flushDeferredPageChromeState(); assert.equal(host.activeSessionCapsuleWidth(),96,'pending pre-resize receipt cannot admit after thaw');
  assert.equal(host.pendingSessionCapsuleIdentity,'');
  const current=present('autoPage'); frozen=true; current({}, {width:151,height:47}); frozen=false;
  host.flushDeferredPageChromeState(); assert.equal(host.activeSessionCapsuleWidth(),151,'same-owner pending receipt still admits');
  snapshot=undefined; automatic.generation++; current({}, {width:900,height:90}); assert.equal(host.sessionCapsuleMeasuredWidth,151);
  snapshot={type:'autoPage'}; automatic.generation++;
  current({}, {width:900,height:90}); assert.equal(host.activeSessionCapsuleWidth(),96,'stop/reopen retires old sender even at the same layout');
  const reopened=present('autoPage'); reopened({}, {width:152,height:44}); assert.equal(host.activeSessionCapsuleWidth(),152);
  host.lifecycleToken++; reopened({}, {width:900,height:90}); assert.equal(host.activeSessionCapsuleWidth(),96);
  host.mounted=false; reopened({}, {width:900,height:90}); assert.equal(host.sessionCapsuleMeasuredWidth,152);
  const guard = /!this\.sessionCapsuleMeasurementCurrent\(identity, type\)/g;
  assert.equal([...readingSource.matchAll(guard)].length,2,'both immediate and thaw admission own their identity guard');
  const unscopedSource=readingSource.replace(guard,'false');
  const old=sdk.consumer(unscopedSource,['onSessionCapsuleMeasured','admitSessionCapsuleMeasurement']);
  Object.assign(old,{sessionCapsuleSnapshot:()=>({type:'tts'}),pageChromeStateFrozen:()=>false,
    pageTurnRenderRevision:0,sessionCapsuleMeasuredWidth:0,sessionCapsuleMeasuredHeight:24});
  old.onSessionCapsuleMeasured('retired-auto-receipt','tts',900,90);
  assert.equal(old.sessionCapsuleMeasuredWidth,900,'removing current identity guards admits a retired box into the successor type');
  console.log('PASS actual capsule native Area declaration to LRE owner, deferred receipt and late actor negatives; no native layout execution');
  recordContractCasePass(id);
}
