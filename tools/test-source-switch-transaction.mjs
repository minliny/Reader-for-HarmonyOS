import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const reader = readFileSync(resolve(repo,
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'utf8');
const shell = readFileSync(resolve(repo, 'entry/src/main/ets/features/shell/ReaderShell.ets'), 'utf8');
const detail = readFileSync(resolve(repo,
  'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets'), 'utf8');
const window = readFileSync(resolve(repo,
  'entry/src/main/ets/features/source/SourceSwitchWindow.ets'), 'utf8');

const sourceHost = readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchHost.ts'), 'utf8');
const sourceGateway = readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchGateway.ts'), 'utf8');
const commitSuccess = sourceHost.slice(
  sourceHost.indexOf("if (outcome.status === 'success')"),
  sourceHost.indexOf('private async rollbackTransaction'),
);
assert.ok(commitSuccess.indexOf('pending: { fromSourceId: identity.sourceId') >= 0);
assert.ok(commitSuccess.indexOf('pending: { fromSourceId: identity.sourceId') < commitSuccess.indexOf("this.deliver({ kind: 'targetReady'"),
  'the real owner retains the Core transaction before delivering the reader seam');
assert.match(commitSuccess, /outcome\.matchedChapter\.order/);
assert.match(commitSuccess, /outcome\.transactionId/);
assert.match(index, /SourceSwitchHost\.forRuntime\(owner\)/);
assert.doesNotMatch(index, /new SourceSwitchGateway|preparePendingSourceSwitchForNextChoice|reconcileUnknownSourceSwitchCommit|resolveSourceSwitchAnchor/,
  'discovery, anchor election and compensation are owned by the actual feature Host');
assert.doesNotMatch(index, /rollbackToken|SourceSwitchRollbackToken/,
  'ArkUI must not retain the Core before-image journal');

const failureStart = index.indexOf('private onReadingFailure(');
const failure = index.slice(failureStart,index.indexOf('private onRemoteSessionReady(',failureStart));
assert.match(failure, /this\.detailLoadingMessage = message/);
assert.doesNotMatch(failure, /rollbackPendingSourceSwitch|showReadingFailure|returnToReadingOrigin/,
  'typed body errors retain the mounted reader and pending transaction for retry');
assert.match(index, /this\.performSourceSwitchSeam\(effect\.book, effect\.session, effect\.chapterIndex\)/);
assert.match(sourceHost, /this\.gateway\.rollbackSwitch\(transactionId/);
assert.match(index, /commit\.sourceSwitchTransactionId !== undefined[\s\S]*this\.getSourceSwitchHost\(\)\?\.targetCommitted\([\s\S]*commit\.sourceSwitchTransactionId\)/,
  'only the actual finalized ID from the canonical ACK releases the barrier');
assert.match(sourceHost, /pending\.transactionId !== transactionId[\s\S]*this\.currentTransactionId\(identity\)/);
const receiptStart = index.indexOf('private applyReadingCommit(');
const receipt = index.slice(receiptStart, index.indexOf('private getReadingOfflineHost(', receiptStart));
assert.ok(receiptStart >= 0);
assert.match(receipt, /if \(finalized !== undefined\) \{\s*this\.cleanupRetiredSourceCache\(finalized\);/,
  'cleanup remains the first action only after the exact finalized receipt');
assert.ok(receipt.indexOf('this.cleanupRetiredSourceCache(finalized)') < receipt.indexOf('new SourceSwitchCompletionPresentation('),
  'the pure completion view cannot replace or precede the existing canonical cleanup');
assert.match(sourceHost, /close\(scopeId: number\)[\s\S]*this\.busyOrUnknown\(\)/);
const failStart = reader.indexOf('private fail(');
const failureOwner = reader.slice(failStart, reader.indexOf('\n  private ', failStart + 10));
assert.match(failureOwner, /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode, failureKind\)/);
assert.doesNotMatch(failureOwner, /beginExit\(/,
  'reader error presentation must not begin an exit');
assert.match(shell, /onReadingFailure: \(sourceId: string, bookId: string, message: string,\s*failureKind\?: RemoteReadingFailureKind\)/);
assert.match(shell, /this\.onReadingFailure\(sourceId, bookId, message, failureKind\)/);
assert.match(shell, /sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);
assert.match(reader, /ReadingSessionFlowGateway\.open\([\s\S]*sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);

assert.match(detail, /@Prop sourceSwitchEnabled: boolean = false/);
assert.match(detail, /onSwitchSource: \(\) => void/);
assert.match(detail, /if \(this\.sourceSwitchEnabled\)[\s\S]*Text\('换源'\)/,
  'the current detail surface exposes source switching only for supported sources');
assert.match(detail, /onClick\(\(\): void => \{ if \(this\.sourceSwitchEnabled\) this\.onSwitchSource\(\); \}\)/,
  'the action rechecks eligibility when invoked');
assert.match(index, /sourceSwitchEnabled: this\.detailBook\.sourceId !== LOCAL_SOURCE_ID/);
assert.match(index, /onSwitchSource: \(\): void => \{ if \(this\.isCurrentDetailPresentation\(identity, owner\)\) this\.openDetailSourceSwitch\(\); \}/);

const detailOverlayStart = index.indexOf("if ((this.route === 'detail' || this.route === 'bookshelf') &&");
const detailOverlayEnd = index.indexOf("if (this.route === 'bookshelf'", detailOverlayStart);
assert.ok(detailOverlayStart >= 0 && detailOverlayEnd > detailOverlayStart,
  'Index must host the existing source-switch panel on remote detail');
const detailOverlay = index.slice(detailOverlayStart, detailOverlayEnd);
assert.match(detailOverlay, /!this\.readingSessionActive && this\.sourceSwitchVisible/);
assert.match(detailOverlay, /this\.sourceSwitchOverlayContent\(\)/);
const overlayStart=index.indexOf("private sourceSwitchOverlayContent()");
const overlay=index.slice(overlayStart,index.indexOf("private getSourceSwitchHost()",overlayStart));
assert.match(overlay, /SourceSwitchPanel\(\{/);
assert.match(overlay, /state: this\.sourceSwitchState/);
assert.match(overlay, /onSelectCandidate: \(candidate: SourceSwitchCandidate\): void => this\.onPickSource\(candidate, scopeId\)/);
assert.match(overlay, /ForEach\(\[this\.sourceSwitchScopeId\]/);

const detailOpenStart = index.indexOf('private openDetailSourceSwitch(): void');
const detailOpenEnd = index.indexOf('private retrySourceSwitch(', detailOpenStart);
assert.ok(detailOpenStart >= 0 && detailOpenEnd > detailOpenStart);
const detailOpen = index.slice(detailOpenStart, detailOpenEnd);
assert.match(detailOpen, /this\.route !== this\.readingOriginRoute/);
assert.match(detailOpen, /host\.open\(this\.sourceSwitchContext\(\), this\.sourceSwitchLease\(host\)\)/);
assert.doesNotMatch(detailOpen, /this\.route\s*=\s*'reading'/,
  'detail source switch must remain a detail-only overlay');

assert.match(window,
  /sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)/,
  'LazyForEach must key candidates by exact composite identity');
assert.match(window, /LazyForEach\(this\.candidateDataSource,[\s\S]*sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)/);
assert.doesNotMatch(window, /Repeat\([\s\S]*virtualScroll/);
assert.match(window, /this\.state\.candidates\.filter\(sourceSwitchIsAlternative\)/,
  'the exact current identity is shown in context and excluded from alternate rows');
assert.match(sourceGateway, /export function sourceSwitchIsAlternative\(candidate: SourceSwitchCandidate\): boolean \{\s*return candidate\.isCurrent !== true;/,
  'owner, Gateway and drawer share the current-source exclusion with unchanged unknown-flag semantics');
assert.match(window, /candidate === undefined \|\| candidate\.isCurrent === true/,
  'click admission resolves the latest exact identity, including same-source alternate URLs');

const pickStart=sourceHost.indexOf('async pick(candidate: SourceSwitchCandidate');
const pickSource=sourceHost.slice(pickStart,sourceHost.indexOf('async rollback(',pickStart));
assert.match(pickSource,/sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)[\s\S]*sourceSwitchCandidateKey\(context\.query\.sourceId, context\.query\.bookId\)/);
assert.match(sourceHost,/new RemoteReadingFlowGateway\(this\.runtime\)\.loadProgress/);
assert.match(pickSource,/buildSourceSwitchCommitParams\([\s\S]*anchor\.chapterTitle, anchor\.chapterIndex/);
assert.match(index,/private async reconcilePendingSourceSwitches\(\): Promise<void>/);
const recoveryStart=index.indexOf('private async reconcilePendingSourceSwitches()');
const recovery=index.slice(recoveryStart,index.indexOf('\n  private ',recoveryStart+10));
assert.match(recovery,/host\.inspectPending\(current\)/);assert.doesNotMatch(recovery,/rollbackSwitch|finalizeSwitch/);
assert.match(index,/host\.resolveTransaction\(\{ sourceId, bookId \}, current\)/);
assert.match(index,/this\.bindSourceSwitchReader\(host\)/);
assert.match(sourceHost,/record\.targetSourceId === identity\.sourceId && record\.targetBookId === identity\.bookId/);
assert.match(sourceHost,/error instanceof ReaderCoreRequestError/);
assert.doesNotMatch(index, /AppStorage.*transactionId|StorageLink.*sourceSwitch/,
  'source switch journal identity must not be copied into an ArkUI store');

const probeStart = index.indexOf('private sourceSwitchProbeQuery(): SourceSwitchProbeQuery');
const probeEnd = index.indexOf('\n  private knownSearchSourceCandidates', probeStart);
const probe = index.slice(probeStart, probeEnd);
assert.match(probe, /contentKind: \(session\?\.contentKind \?\? book\.contentKind\) === 'manga' \? 'manga' : 'text'/,
  'a no-TOC probe preserves the durable book content kind');
assert.match(probe, /contentKind: \(session\?\.contentKind \?\? book\.contentKind\) === 'manga' \? 'manga' : 'text'/,
  'a TOC-backed probe preserves the exact active session or book content kind');
const mangaSwitchStart = index.indexOf('private async switchMangaSource(');
const mangaSwitchEnd = index.indexOf('\n  private mangaSourceSwitchFailureMessage', mangaSwitchStart);
assert.ok(mangaSwitchEnd > mangaSwitchStart, 'bound the current production manga method');
const mangaSwitch = index.slice(mangaSwitchStart, mangaSwitchEnd);
assert.match(mangaSwitch, /this\.remoteReadingSession\?\.identity\.sourceId === original\.sourceId/,
  'manga source switch binds session identity to the displayed source/book');
assert.match(mangaSwitch, /openCachedCatalogSession\(\{ contentKind: 'manga'/,
  'missing in-memory session restores an exact manga catalog before prepare');
assert.match(mangaSwitch, /previous\.contentKind !== 'manga'/);
assert.match(mangaSwitch, /previous\.identity\.bookId !== original\.bookId/);
assert.match(sourceHost, /force && previous\.some\(sourceSwitchIsAlternative\)[\s\S]*?candidates: previous, refreshing: true/,
  'actual captured owner retains prior alternative identities during force refresh');
assert.match(sourceHost, /const cached = force \? \[\] : await this\.gateway\.loadCachedCandidates\(context\.query, current, knownCandidates\(\)\)/,
  'initial discovery uses exact cached candidates through the typed gateway');
assert.match(sourceHost, /refreshCandidates\(context\.query, current, force \? \[\] : context\.searchedSourceIds,\s*publishProgress, force \? previous : initialKnown\)/,
  'force refresh clears prior searched-source exclusions while passing progressive publication and retained identities');

console.log('source-switch post-commit transaction contract: PASS');

// The owner/refactor source claims above are also exercised through the real
// SDK-transformed Index -> finite Host -> Gateway -> candidate actor chain.
const { fixture, settle: settleOwner, deferred } = await import('./lib/source-switch-owner-probe.mjs');
const { makeIndex } = await import('./lib/source-switch-sdk-consumer.mjs');
const settle = async () => { await settleOwner(); await new Promise(setImmediate); await settleOwner(); };
{
  const f=fixture({shared:true,open:false}),x=makeIndex(f);
  x.index.openDetailSourceSwitch();await settle();
  const before=f.host.current().state.candidates,gate=deferred();
  assert.ok(before?.length>0);f.options.relatedGate=gate;
  const cached=f.calls.filter(([method])=>method==='search-book.get').length;
  x.index.refreshSourceSwitch(x.index.sourceSwitchScopeId);await settleOwner();
  assert.equal(f.host.current().state.refreshing,true);
  const retained=f.host.current().state.candidates;
  const withoutTiming=rows=>rows.map(({latencyMs,latencyKind,...row})=>row);
  assert.notEqual(retained,before,'new sweep snapshots rows without modifying old observers');
  assert.deepEqual(withoutTiming(retained),withoutTiming(before),
    'all candidate identities and non-timing facts remain visible while new source IO is pending');
  assert.ok(retained.every(row=>row.latencyMs===undefined&&row.latencyKind===undefined),
    'force refresh cannot display measurements from the previous sweep');
  assert.equal(f.calls.filter(([method])=>method==='search-book.get').length,cached,'force does not reopen the cached seed');
  gate.resolve();await settle();assert.equal(f.host.current().state.refreshing,false);
  assert.equal(f.host.current().state.candidates[0].sourceId,before[0].sourceId);
}
{
  const f = fixture({ shared: true, open: false, loseCommitAck: true, failExactQuery: true }), x = makeIndex(f);
  x.index.openDetailSourceSwitch(); await settle(); const panel = x.mount();
  panel.onSelectCandidate(f.candidate()); await settle();
  assert.equal(f.host.current().write.confirmation, 'unknown');
  panel.onClose(); assert.equal(f.host.current().visible, true);
  assert.equal(f.calls.filter(([method]) => method === 'source.switch.rollback').length, 0);
  const current=x.mount();assert.equal(current.requiresReconciliation(),true);assert.equal(current.rollbackRequired(),false);
  const retry=x.p.nodes(current).find(n=>n.type==='Button'&&Array.isArray(n.createWithLabel)&&n.createWithLabel[0]==='重试核对');
  assert.ok(retry?.onClick,'actual SDK native Button carries the read-only reconciliation callback');
  const originalTransaction=f.pending()[0]?.transactionId,originalWrite=f.calls.find(([method])=>method==='source.switch.commit')[1];
  assert.ok(originalTransaction);assert.equal(f.host.current().write.confirmation,'unknown');
  f.options.failExactQuery = false; retry.onClick(); await settle();
  assert.equal(f.host.current().write.confirmation, 'confirmed'); assert.equal(x.index.detailBook.sourceId, 'new');
  assert.equal(f.calls.filter(([method]) => method === 'source.switch.commit').length, 1);
  assert.equal(f.calls.filter(([method]) => method === 'source.switch.rollback').length, 0);
  assert.equal(f.host.current().pending.transactionId,originalTransaction,'pure reconciliation retains the original durable transaction');
  assert.deepEqual(f.calls.find(([method])=>method==='source.switch.commit')[1],originalWrite,'recovery cannot substitute a new commit payload/CAS identity');
}
{
  const f = fixture({ shared: true, open: false }), x = makeIndex(f); x.index.openDetailSourceSwitch(); await settle();
  const old = x.mount(); old.onClose(); x.index.openDetailSourceSwitch(); await settle(); const scope = x.index.sourceSwitchScopeId;
  old.onClose(); old.onRetry(); old.onSelectCandidate(f.candidate()); await settle();
  assert.equal(x.index.sourceSwitchScopeId, scope); assert.equal(f.host.current().visible, true);
  assert.equal(f.calls.filter(([method]) => method === 'source.switch.commit').length, 0);
}
console.log('actual SDK source-switch exact-query and stale physical-action contracts: PASS');
