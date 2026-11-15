import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selected = selectContractCases({
    'owner-admission': { description: 'Actual offline Host normal load preserves unresolved original after successful availability read. Actual Operations accepts exact current reader/directory recovery, coalesces and rejects stale/foreign foreground input. Finite public original receipt ports, no Core or writes.', resources: [] },
    'reader-assembly': { description: 'Actual text recovery availability, grouped/nonpending SDK slot and current callback generation reach original owner. Normal Manga root forwards original facts/callbacks. Known results retain their dedicated host.', resources: [] },
    'manga-download-hosts': { description: 'Actual bounded catalog popup and reading download-sheet initializers forward original offline recovery into existing shared Surface. Current popup/panel identity and generation reject old callbacks. No native layout or business mutation.', resources: [] },
    'native-fixture': { description: 'Independent actual offline Host fixture keeps original unknown after availability succeeds, holds explicit read/continue replies, rejects stale/busy input, and never calls Core or storage.', resources: [] },
    'clear-progress-copy': { description: 'Actual Host with a valid failed-chapter projection keeps original clear facts. Legacy clear snapshots ignore download progress, while a real download keeps its partial-result copy.', resources: [] },
});
if (selected.length === 0)
    process.exit(0);
registerHooks({ resolve(specifier, context, next) {
        try {
            return next(specifier, context);
        }
        catch (error) {
            if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
                return next(specifier + '.ts', context);
            throw error;
        }
    } });
const { selectedProductionClasses, selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const { readingDirectoryRecovery, EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const offlineFile = new URL('../entry/src/main/ets/features/reading/application/ReadingOfflineHost.ts', import.meta.url);
const operationsFile = new URL('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryOperations.ts', import.meta.url);
class Captured {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
}
async function originalFixture(downloadState = 'cached') {
    const { ReadingOfflineHost } = selectedProductionClasses(offlineFile, ['ReadingOfflineHost'], { projectPersistedReceipt });
    const book = { sourceId: 'source', bookId: 'manga-book', title: 'Original book', author: 'Author' };
    const entries = [{ index: 0, title: 'Chapter', url: 'https://example.invalid/chapter', navigable: true, downloadState }];
    const session = { identity: { sourceId: book.sourceId, bookId: book.bookId }, contentKind: 'manga', entries };
    const reads = [], publications = [];
    const pending = { version: 1, method: 'cache.clear', params: { scope: 'book', sourceId: book.sourceId, bookId: book.bookId, operationId: 'original-id/1', sequence: 1 }, context: book, phase: 'pending' };
    let active = true;
    const host = new ReadingOfflineHost({ ownsRuntime: () => active, gateway: {
            async pendingClearOperation() { reads.push('pending'); return pending; },
            async reconcileClearOperation(context, current, _evidence, continuing) {
                assert.equal(current(), true);
                assert.equal(context.bookId, book.bookId);
                reads.push(continuing ? 'continue-original' : 'qualified-original-read');
                if (!continuing)
                    throw new Error('original receipt unavailable');
                return { intent: pending, data: { scope: 'book', cacheEntriesRemoved: 0, chapterEntriesRemoved: 0, queueEntriesRemoved: 0, removedContentBytes: 0 } };
            },
            async loadDirectoryProjection() { reads.push('projection'); return entries; },
        } });
    const binding = { session, current: () => active, currentEntries: () => entries, emitEntries() { }, emitOperation: operation => publications.push(operation) };
    await host.load(binding);
    assert.deepEqual(reads, ['pending', 'qualified-original-read', 'projection']);
    assert.equal(host.snapshot().projection.receipt.confirmation, 'unknown');
    assert.equal(host.snapshot().projection.receipt.readback, 'succeeded');
    const recovery = readingDirectoryRecovery('current-opening', book, undefined, host.snapshot());
    assert.equal(recovery.offline.visible, true);
    assert.equal(recovery.offlineKind, 'pending');
    assert.equal(recovery.canContinueOffline, true);
    return { book, session, entries, host, binding, reads, recovery, retire() { active = false; } };
}
const settle = async () => {
    for (let index = 0; index < 24; index++)
        await Promise.resolve();
};
function captureBuilder(path, members, childName, childPath, params, extra = {}) {
    const sdk = boundedSurfaceSdk();
    const owner = createReaderBuilderProbe(read(path), members, { ...sdk.deps, [childName]: Captured, ...extra }, { ...sdk.hooks, childSources: { ...sdk.childSources, [childName]: read(childPath) } }).owner;
    Object.assign(owner, params);
    return { sdk, owner, child: () => [...owner.children.values()].find(value => value instanceof Captured) };
}
for (const id of selected) {
    if (id === 'clear-progress-copy') {
        const current = await originalFixture('failed');
        const operation = current.host.snapshot();
        assert.equal(operation.progress, undefined, 'clear readback never acquires a download-progress owner');
        assert.doesNotMatch(current.recovery.offline.message, /下载部分完成/);
        const progress = { processedChapters: 1, totalChapters: 1, completedChapters: 0,
            cachedChapters: 0, failedChapters: 1, entries: current.entries };
        const legacy = { ...operation, progress };
        assert.doesNotMatch(readingDirectoryRecovery('legacy', current.book, undefined, legacy).offline.message, /下载部分完成/);
        const confirmed = { ...legacy, canContinueOriginal: false, projection: projectPersistedReceipt({
                confirmation: 'confirmed', readback: 'succeeded', generation: operation.generation,
                canRetry: false, value: current.entries,
            }) };
        assert.equal(readingDirectoryRecovery('legacy', current.book, undefined, confirmed).offlineKind, 'none');
        const download = { ...confirmed, action: 'book' };
        const downloadRecovery = readingDirectoryRecovery('download', current.book, undefined, download);
        assert.equal(downloadRecovery.offlineKind, 'result');
        assert.match(downloadRecovery.offline.message, /下载部分完成/);
        recordContractCasePass(id);
        continue;
    }
    if (id === 'native-fixture') {
        const { ReaderOfflineRecoveryFixtureOwner } = await import('../entry/src/main/ets/pages/ReaderOfflineRecoveryFixtureOwner.ts');
        const book = { sourceId: 'memory-source', sourceName: 'Memory', bookId: 'memory-book', title: 'Original', author: 'Author' };
        const entries = [{ index: 0, title: 'Memory chapter', navigable: true, downloadState: 'cached' }];
        let current = true;
        let publications = 0;
        const owner = new ReaderOfflineRecoveryFixtureOwner('memory-opening', book, () => entries, () => current, () => { publications += 1; });
        await owner.load();
        const generation = owner.recovery().offline.generation;
        const rawOriginal = owner.gateway.rawOriginal();
        assert.equal(owner.host.snapshot().projection.receipt.confirmation, 'unknown');
        assert.equal(owner.host.snapshot().projection.receipt.readback, 'succeeded');
        assert.equal(owner.gateway.queryCount, 1);
        assert.equal(owner.reconcile(generation + 1, 'memory-opening', false), false);
        assert.equal(owner.reconcile(generation, 'old-opening', false), false);
        assert.equal(owner.reconcile(generation, 'memory-opening', false), true);
        await settle();
        assert.equal(owner.recovery().offlineBusy, true);
        assert.equal(owner.reconcile(generation, 'memory-opening', false), false);
        assert.equal(owner.gateway.queryCount, 2);
        owner.complete(false);
        await settle();
        assert.equal(owner.recovery().offlineBusy, false);
        assert.equal(owner.recovery().offline.visible, true);
        assert.equal(owner.gateway.rawOriginal(), rawOriginal);
        assert.equal(owner.reconcile(generation, 'memory-opening', true), true);
        await settle();
        assert.equal(owner.gateway.continueCount, 1);
        assert.equal(owner.recovery().offlineRecoveryAction, 'continue');
        owner.complete(true);
        await settle();
        assert.equal(owner.host.snapshot().projection.receipt.confirmation, 'confirmed');
        assert.equal(owner.gateway.rawOriginal(), '');
        assert.equal(owner.runtime.unexpectedRequests, 0);
        assert.ok(publications > 0);
        current = false;
        const count = publications;
        assert.equal(owner.reconcile(generation, 'memory-opening', false), false);
        owner.close();
        assert.equal(publications, count);
        recordContractCasePass(id);
        continue;
    }
    if (id === 'owner-admission') {
        const f = await originalFixture(), runtime = {};
        const scene = { owner: runtime, mount: 1, navigation: 2, presentation: 3, sessionGeneration: 4, retired: false,
            directoryVisible: false, reading: true, acceptsProjection: true, foreground: true, book: f.book, session: f.session };
        const Operations = selectedProductionMethods(operationsFile, 'ReaderDirectoryOperations', ['reconcileOffline', 'acceptsRecoveryPresentation', 'acceptsBinding', 'bindingId', 'presentationId']);
        const owner = Object.assign(new Operations(), { ports: { scene: () => scene, ownsRuntime: value => value === runtime, feedback() { } },
            offlineHost: () => f.host, offlineBinding: () => f.binding });
        const identity = owner.presentationId(scene), generation = f.host.snapshot().generation;
        const before = f.reads.length;
        owner.reconcileOffline(generation, identity, false);
        owner.reconcileOffline(generation, identity, false);
        await settle();
        assert.equal(f.reads.length, before + 3, 'current reader recovery enters one original read, without a duplicate');
        assert.equal(f.host.snapshot().projection.receipt.confirmation, 'unknown');
        const count = f.reads.length;
        for (const updates of [{ foreground: false }, { retired: true }, { acceptsProjection: false }, { reading: false }]) {
            const previous = { ...scene };
            Object.assign(scene, updates);
            owner.reconcileOffline(generation, identity, false);
            await settle();
            assert.equal(f.reads.length, count, 'ineligible original recovery input is rejected');
            Object.assign(scene, previous);
        }
        owner.reconcileOffline(generation, identity + '-retired', false);
        owner.reconcileOffline(generation + 1, identity, false);
        await settle();
        assert.equal(f.reads.length, count);
        scene.directoryVisible = true;
        scene.reading = false;
        owner.reconcileOffline(generation, identity, true);
        await settle();
        assert.equal(f.reads.filter(value => value === 'continue-original').length, 1, 'explicit original continuation keeps its original owner and identity');
        assert.equal(f.host.snapshot().projection.receipt.confirmation, 'confirmed');
        recordContractCasePass(id);
        continue;
    }
    if (id === 'reader-assembly') {
        const f = await originalFixture(), calls = [];
        let active = true;
        const textSource = read('features/reading/ui/LocalReadingExperience.ets');
        const current = captureBuilder('features/reading/ui/LocalReadingExperience.ets', ['readerOfflineRecoveryContent', 'reconcileOfflineRecovery', 'readerOfflineRecoveryVisible', 'readerOfflinePending', 'hasReaderRecoveryContent', 'hasReaderPendingGroup'], 'ReaderDirectoryRecoverySurface', 'features/reading/ui/ReaderDirectoryRecoverySurface.ets', {
            bookmarkRecovery: f.recovery, lifecycleToken: 7, readerRecoveryInputCurrent: () => active,
            readerRecoveryView: { visible: false }, readerSettingsRecovery: { visible: false }, ttsPreferencesRecovery: { visible: false },
            ttsConfigurationRecovery: { visible: false }, replaceRecovery: { visible: false }, readerPreferenceModule: () => '', readerBookmarkPending: () => false,
            onReconcileOffline: (g, p) => calls.push(['read', g, p]), onContinueOffline: (g, p) => calls.push(['continue', g, p]),
        }, { EMPTY_READING_DIRECTORY_RECOVERY });
        assert.equal(current.owner.hasReaderRecoveryContent(), true);
        assert.equal(current.owner.hasReaderPendingGroup(), true);
        current.owner.readerOfflineRecoveryContent(true);
        const child = current.child();
        assert.equal(child.params.grouped, true);
        assert.equal(child.params.recovery.offline, f.recovery.offline);
        assert.equal(child.params.recovery.bookmarks.visible, false);
        const callback = child.params.onReconcileOffline, generation = f.recovery.offline.generation;
        callback(generation, f.recovery.presentationId);
        assert.equal(calls.length, 1);
        callback(generation + 1, f.recovery.presentationId);
        callback(generation, f.recovery.presentationId + 'old');
        assert.equal(calls.length, 1);
        current.owner.bookmarkRecovery = { ...f.recovery, offlineBusy: true };
        callback(generation, f.recovery.presentationId);
        assert.equal(calls.length, 1);
        current.owner.bookmarkRecovery = { ...f.recovery, offline: { ...f.recovery.offline, generation: generation + 1 } };
        callback(generation, f.recovery.presentationId);
        assert.equal(calls.length, 1);
        callback(generation + 1, f.recovery.presentationId);
        assert.equal(calls.length, 2, 'retained callback reads current original generation');
        active = false;
        callback(generation + 1, f.recovery.presentationId);
        assert.equal(calls.length, 2);
        current.owner.bookmarkRecovery = { ...f.recovery, offlineKind: 'result' };
        assert.equal(current.owner.hasReaderRecoveryContent(), false, 'known task result keeps its dedicated host');
        current.owner.bookmarkRecovery = { ...f.recovery, offlineKind: 'readback' };
        assert.equal(current.owner.hasReaderPendingGroup(), false);
        assert.equal(current.owner.hasReaderRecoveryContent(), true);
        const manga = captureBuilder('features/reading/ui/ReaderShell.ets', ['mangaSurface'], 'MangaReadingSurface', 'features/manga/ui/MangaReadingSurface.ets', {
            directoryRecovery: f.recovery, route: 'reading', visible: true, sourceId: f.book.sourceId, bookId: f.book.bookId,
            remoteSession: f.session, mangaIdentityKey: () => 'current-manga', readingContentIsForeground: () => true,
            acceptsMangaInput: () => active, onReconcileOffline: (g, p) => calls.push(['manga', g, p]),
        }, { ReaderRuntimeOwner: { current: () => ({ mangaOfflineProbeFor: () => false }) } });
        manga.owner.mangaSurface();
        assert.equal(manga.child().params.directoryRecovery, f.recovery);
        active = true;
        manga.child().params.onReconcileOffline(generation, f.recovery.presentationId);
        assert.equal(calls.length, 3);
        active = false;
        manga.child().params.onReconcileOffline(generation, f.recovery.presentationId);
        assert.equal(calls.length, 3);
        assert.ok(textSource.includes('onReconcileOffline: (generation: number, presentationId: string)'));
        recordContractCasePass(id);
        continue;
    }
    if (id === 'manga-download-hosts') {
        const f = await originalFixture(), calls = [];
        let current = true;
        const panel = captureBuilder('features/manga/ui/MangaDownloadOperationsPanel.ets', ['build', 'effectiveScheme'], 'ReaderDirectoryRecoverySurface', 'features/reading/ui/ReaderDirectoryRecoverySurface.ets', {
            directoryRecovery: f.recovery, recoveryActive: true, foreground: true, loading: true, panelScheme: 'day',
            onReconcileOffline: (g, p) => calls.push(['panel', g, p]),
        }, { EMPTY_READING_DIRECTORY_RECOVERY });
        panel.owner.initialRender();
        assert.equal(panel.child().params.recovery.offline, f.recovery.offline);
        assert.equal(panel.child().params.presentationActive, true);
        panel.owner.recoveryActive = false;
        assert.equal(panel.child().params.isPresentationCurrent(), false);
        const popup = captureBuilder('features/manga/ui/ReaderMangaDownloadPopup.ets', ['popupContent', 'spec'], 'MangaDownloadOperationsPanel', 'features/manga/ui/MangaDownloadOperationsPanel.ets', {
            specId: 'manga-download', availableWidth: 300, directoryRecovery: f.recovery, recoveryActive: true, visible: true,
            onReconcileOffline: (g, p, opening) => calls.push(['popup', g, p, opening]),
        }, { READER_MANGA_DOWNLOAD_POPUP: { maxWidth: 300, maxHeight: 400, padding: 8 }, EMPTY_READING_DIRECTORY_RECOVERY });
        popup.owner.popupContent(5);
        assert.equal(popup.child().params.directoryRecovery, f.recovery);
        popup.child().params.onReconcileOffline(1, 'current-opening');
        assert.deepEqual(calls.at(-1), ['popup', 1, 'current-opening', 5]);
        const book = captureBuilder('features/reading/ui/BookDirectoryPage.ets', ['mangaDownloadMenuButton'], 'ReaderMangaDownloadPopup', 'features/manga/ui/ReaderMangaDownloadPopup.ets', {
            mangaDownloadEnabled: true, directoryRecovery: f.recovery, downloadMenuVisible: true, downloadMenuGeneration: 5,
            identity: () => 'book-opening', directoryInputIsCurrent: () => current, contentFrame: () => ({ width: 300 }),
            onReconcileOffline: (g, p) => calls.push(['book', g, p]),
        });
        book.owner.mangaDownloadMenuButton();
        assert.equal(book.child().params.directoryRecovery, f.recovery);
        const callback = book.child().params.onReconcileOffline;
        callback(1, 'current-opening', 5);
        assert.equal(calls.at(-1)[0], 'book');
        const count = calls.length;
        book.owner.downloadMenuGeneration = 6;
        callback(1, 'current-opening', 5);
        assert.equal(calls.length, count);
        current = false;
        callback(1, 'current-opening', 6);
        assert.equal(calls.length, count);
        const reading = captureBuilder('features/manga/ui/MangaReadingSurface.ets', ['actionPanelBody', 'panelInputCurrent', 'ownsDownloadActions', 'downloadPanelInputCurrent'], 'MangaDownloadOperationsPanel', 'features/manga/ui/MangaDownloadOperationsPanel.ets', {
            panel: 'downloads', panelPhase: 'open', actionPanelPresentationGeneration: 4,
            downloadEnabled: true, downloadActionsGeneration: 7, downloadActions: [],
            downloadActionsLoading: true, directoryRecovery: f.recovery, readerPanelForeground: () => current,
            panelContentInset: () => 16, panelContentHeight: () => 300, actionHeaderHeight: () => 60,
            widePanel: () => false,
            onReconcileOffline: (generation, presentation) => calls.push(['reading-read', generation, presentation]),
            onContinueOffline: (generation, presentation) => calls.push(['reading-continue', generation, presentation]),
        });
        current = true;
        reading.owner.actionPanelBody(4);
        const readingChild = reading.child();
        assert.equal(readingChild.params.directoryRecovery, f.recovery);
        assert.equal(readingChild.params.recoveryActive, true);
        readingChild.params.onReconcileOffline(1, 'current-opening');
        assert.deepEqual(calls.at(-1), ['reading-read', 1, 'current-opening']);
        readingChild.params.onContinueOffline(1, 'current-opening');
        assert.deepEqual(calls.at(-1), ['reading-continue', 1, 'current-opening']);
        const readingCount = calls.length;
        for (const update of [
            { actionPanelPresentationGeneration: 5 }, { downloadActionsGeneration: 8 },
            { panel: 'settings' }, { panelPhase: 'closed' }, { panelPhase: 'dragging' }, { downloadEnabled: false },
        ]) {
            const original = Object.fromEntries(Object.keys(update).map(key => [key, reading.owner[key]]));
            Object.assign(reading.owner, update);
            readingChild.params.onReconcileOffline(1, 'current-opening');
            readingChild.params.onContinueOffline(1, 'current-opening');
            assert.equal(calls.length, readingCount, 'retained reading panel rejects an obsolete or ineligible owner');
            Object.assign(reading.owner, original);
        }
        current = false;
        readingChild.params.onReconcileOffline(1, 'current-opening');
        assert.equal(calls.length, readingCount, 'background reading panel rejects the retained callback');
        recordContractCasePass(id);
    }
}
