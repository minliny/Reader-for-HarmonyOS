import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const displayed = { chapterIndex: 988, chapterOffset: 125, chapterProgress: 0.25, bodyVersion: 'body', processingVersion: 'processing' };
const book = { sourceId: 'old', bookId: 'book', title: '终宋', author: '怪诞的表哥' };
const candidate = { sourceId: 'new', bookUrl: 'target', bookName: '终宋' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = async () => { for (let n = 0; n < 80; n++) await Promise.resolve(); };
function fixture({ writeGate, failReads = 0, failWrites = false, loseReceipt = false, commitGate } = {}) {
  let durable = { sourceId: 'old', bookId: 'book', chapterIndex: 17, chapterOffset: 0, chapterProgress: 0, updatedAt: 1 };
  let revision = 1, writes = 0, failures = failReads;
  const commits = [], errors = [];
  const runtime = { supportsCoreCapability: c => c === 'reading.progress.compareAndSet.v1',
    captureReadingContentValidity: () => () => true,
    async request(method, params, options = {}) {
      if (options.shouldCancel?.()) throw Error('cancelled');
      if (method === 'reading.progress.get') {
        if (failures-- > 0) throw Error('progress read unavailable');
        return { data: { found: true, progress: { ...durable }, progressRevision: `op:${revision}` } };
      }
      assert.equal(method, 'reading.progress.update'); writes++;
      if (writeGate) await writeGate.promise;
      if (failWrites) throw Error('progress write unavailable');
      assert.equal(params.expectedProgressRevision, `op:${revision}`);
      durable = { sourceId: 'old', bookId: 'book', chapterIndex: params.chapterIndex, chapterOffset: params.chapterOffset,
        chapterProgress: params.chapterProgress, bodyVersion: params.expectedBodyVersion,
        processingVersion: params.expectedProcessingVersion, updatedAt: ++revision, locationRevision: `r${revision}` };
      if (loseReceipt) throw Error('receipt lost');
      return { data: { stored: true, ...durable } };
    } };
  const Host = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    ['onPickSource', 'resolveSourceSwitchAnchor'], {
      ReaderRuntimeOwner: { current: () => runtime }, ReadingSessionFlowGateway, RemoteReadingFlowGateway,
      SourceSwitchAnchor: class { constructor(chapterIndex, chapterTitle) { Object.assign(this, { chapterIndex, chapterTitle }); } },
      PendingSourceSwitchTransaction: class {}, DOMAIN: 0, hilog: { warn() {} },
      sourceSwitchCandidateKey: (s, b) => JSON.stringify([s,b]), remoteReadingFailureKindOf: e => e.kind,
      buildSourceSwitchCommitParams: (_from,_candidate,_toc,title,index) => ({ title, index }),
    });
  const gateway = new ReadingSessionFlowGateway('old', 'book', { kind: 'remote' }, runtime);
  const host = Object.assign(new Host(), { detailBook: book, detailInBookshelf: true,
    detailToc: [{ index: 17, title: '第18章 废物' }, { index: 988, title: '第982章 国号' }],
    sourceSwitchState: { kind: 'candidates' }, sourceSwitchVisible: true, navigationGeneration: 0,
    nextNavigationGeneration() { return ++this.navigationGeneration; },
    isSourceSwitchActive(g) { return this.sourceSwitchVisible && g === this.navigationGeneration; },
    async preparePendingSourceSwitchForNextChoice() {},
    getSourceSwitchGateway: () => ({
      async fetchTargetToc() { return { readingSession: { identity: { sourceId: 'new', bookId: 'target' } } }; },
      async commitSwitch(params) { commits.push(params); if (commitGate) await commitGate.promise;
        return { status: 'success', book: { sourceId: 'new', bookId: 'target' }, matchedChapter: { order: params.index }, transactionId: 'tx' }; },
    }),
    performSourceSwitchSeam(_book,_session,index) { this.finalChapter = index; },
    presentSourceSwitchAcquisitionFailure(_book,_candidate,message) { errors.push(message); },
    reconcileUnknownSourceSwitchCommit() { assert.fail('no unknown switch is expected'); },
  });
  return { host, gateway, commits, errors, durable: () => durable, writes: () => writes };
}
if (process.argv.includes('--baseline')) {
  const gate = deferred(), f = fixture({ writeGate: gate });
  const pending = f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout);
  await settle(); f.host.onPickSource(candidate); await settle();
  assert.equal(f.commits[0]?.index, 17, 'baseline reproduces chapter18 selected while chapter982 save is pending');
  gate.resolve(); await pending;
  console.log(JSON.stringify({ baseline: 'REPRODUCED', displayedChapterIndex: 988, sourceSwitchChapterIndex: f.commits[0].index, afterWriteIndex: f.durable().chapterIndex }));
} else {
  const checks = [];
  {
    const gate = deferred(), f = fixture({ writeGate: gate });
    const pending = f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout);
    await settle(); f.host.onPickSource(candidate); await settle();
    assert.equal(f.commits.length, 0, 'source switch must await displayed progress durability');
    gate.resolve(); await pending; await settle();
    assert.deepEqual(f.commits, [{ title: '第982章 国号', index: 988 }]);
    assert.equal(f.host.finalChapter, 988); checks.push('pending-982-write-precedes-switch');
  }
  {
    const f = fixture({ failReads: 1 });
    await assert.rejects(f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout));
    f.host.onPickSource(candidate); await settle();
    assert.equal(f.commits[0]?.index, 988); checks.push('failed-read-reconciled-at-switch-boundary');
  }
  {
    const f = fixture({ failWrites: true });
    await assert.rejects(f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout));
    f.host.onPickSource(candidate); await settle();
    assert.equal(f.commits.length, 0); assert.equal(f.errors.length, 1);
    assert.equal(f.durable().chapterIndex, 17); checks.push('unresolved-write-stops-source-mutation');
  }
  {
    const f = fixture({ loseReceipt: true });
    await assert.rejects(f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout));
    f.host.onPickSource(candidate); await settle();
    assert.equal(f.commits[0]?.index, 988); assert.equal(f.writes(), 1); checks.push('lost-receipt-confirmed-without-rewrite');
  }
  {
    const gate = deferred(), f = fixture({ writeGate: gate });
    const pending = f.gateway.persistPresentedProgress('book', '第982章 国号', displayed, layout);
    await settle(); f.host.onPickSource(candidate); await settle();
    f.host.sourceSwitchVisible = false; gate.resolve(); await pending; await settle();
    assert.equal(f.commits.length, 0); checks.push('cancelled-switch-does-not-mutate-source');
  }
  {
    const gate = deferred(), f = fixture({ commitGate: gate });
    f.host.onPickSource(candidate); await settle(); assert.equal(f.commits.length, 1);
    await assert.rejects(f.gateway.persistPresentedProgress('book', 'later', displayed, layout), /TRANSACTION_PENDING/);
    gate.resolve(); await settle(); checks.push('ordinary-write-cannot-cross-source-transaction');
  }
  console.log(JSON.stringify({ status: 'PASS', checks }));
}
