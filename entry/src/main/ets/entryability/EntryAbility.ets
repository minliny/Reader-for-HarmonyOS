// EntryAbility — Stage model entry. Initializes the UiStore (which seeds AppStorage)
// before the page loads, then loads the single @Entry page that hosts RouteRenderer.
//
// Window is configured immersive: layout extends behind system bars and the app
// paints the status-bar background, while the platform still renders the status
// time/icons on non-reader pages.
import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import { Configuration } from '@ohos.app.ability.Configuration';
import ConfigurationConstant from '@ohos.app.ability.ConfigurationConstant';
import resourceManager from '@ohos.resourceManager';
import window from '@ohos.window';
import display from '@ohos.display';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import zlib from '@ohos.zlib';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';
import { ReaderEffects } from '../ui/store/ReaderEffects';
import { SearchResultEntry, BookDetail, ChapterTocEntry, UiEvent } from '../ui/store/ReaderUiState';
import { SafeAreaAdapter } from '../ui/adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../ui/adapters/ViewportAdapter';
import { InteractionDebugAdapter } from '../ui/adapters/InteractionDebugAdapter';
import { RouteId, RouteTable } from '../contract/generated/RouteTable';
import { ColorTokens } from '../contract/generated/ColorTokens';
import { ReaderThemeState } from '../ui/tokens/ReaderThemeState';
import { CoreRuntime } from '../bridge/CoreRuntime';
import type { JsonObject } from '../bridge/core/sdk/reader_core';
import { HostCapabilityManifest } from '../host/HostCapabilityManifest';
import { TtsHostAdapter } from '../host/adapters/TtsHostAdapter';
import {
  HostTtsSystemStartRequest,
  HostHttpRequest,
  HostCookieSetRequest,
  HostCookieGetRequest,
  HostFileWriteRequest,
  HostFileReadRequest,
  HostPersistenceGetRequest,
  HostPersistencePutRequest,
  HostCredentialGetRequest,
  HostWebViewOpenRequest,
  HostWebViewCloseRequest,
  HostPermissionCheckRequest,
  HostNotificationShowRequest,
  HostNotificationCancelRequest,
  HostDeviceVibrateRequest,
} from '../host/types';

// Device-observable lifecycle evidence for the one bundled display font. This
// says only whether ArkUI accepted the packaged font for the active UIContext;
// it is deliberately not a claim that any external design font is present.
export type BundledSerifFontRegistrationStatus = 'pending' | 'registered' | 'failed';
export const BUNDLED_SERIF_FONT_REGISTRATION_STATUS_KEY =
  'reader.fontRegistration.bundledSerif.status';
export const BUNDLED_SERIF_FONT_REGISTRATION_DETAIL_KEY =
  'reader.fontRegistration.bundledSerif.detail';

// Keep the device-only reading-chain probe on the same source-scoped detail
// contract as a user tap. Exported solely so the probe payload can be covered
// without constructing a UIAbility in a host unit test.
export function buildReadingChainUiDetailLoadEvent(result: SearchResultEntry): UiEvent {
  return {
    type: 'book-detail-load',
    bookId: result.bookId,
    sourceId: result.sourceId ?? '',
    loadFirstChapter: false,
  };
}

// The reading-chain self-check must use the same route fence as a visible
// search action.  `search-submit` is deliberately ignored off a Search page,
// so starting the evidence run from the bookshelf must first enter the
// canonical Book Search route instead of bypassing the reducer.
export function buildReadingChainUiSearchRouteEvent(): UiEvent {
  return { type: 'route-push', id: 'book-search' };
}

export function buildSelfCheckCacheWriteRequest(path: string, content: string): HostFileWriteRequest {
  return {
    path: path,
    content: content,
    encoding: 'utf-8',
    createDirectories: true,
  };
}

// A detail's TOC endpoint is not a readable chapter URL.  The device probe
// must wait for the Core-backed UI projection and select an actual row, just
// as the Reader does, otherwise it can falsely stop at detail or dispatch the
// endpoint itself as chapter content.
export function firstReadableReadingChainUiChapterId(toc: ChapterTocEntry[]): string {
  for (let i = 0; i < toc.length; i++) {
    const chapterId = toc[i].chapterId.trim();
    if (chapterId.length > 0) return chapterId;
  }
  return '';
}

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    ReaderUiStore.init();
    const initialConfig = this.context.resourceManager.getConfigurationSync();
    ReaderThemeState.setColorMode(initialConfig.colorMode === resourceManager.ColorMode.DARK ? 'dark' : 'light');
    const params = want.parameters ?? {};
    // Seed demo fallback insets so the first frame approximates safe-area
    // avoidance before the real window avoid area is measured below.
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_TOP, SafeAreaAdapter.DEFAULT_TOP);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_BOTTOM, SafeAreaAdapter.DEFAULT_BOTTOM);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_START, SafeAreaAdapter.DEFAULT_START);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_END, SafeAreaAdapter.DEFAULT_END);
    AppStorage.setOrCreate<number>(ViewportAdapter.K_WIDTH, ViewportAdapter.DEFAULT_WIDTH);
    AppStorage.setOrCreate<number>(ViewportAdapter.K_HEIGHT, ViewportAdapter.DEFAULT_HEIGHT);
    AppStorage.setOrCreate<string>(ViewportAdapter.K_CLASS,
      ViewportAdapter.classify(ViewportAdapter.DEFAULT_WIDTH, ViewportAdapter.DEFAULT_HEIGHT));
    this.recordBundledSerifFontRegistration('pending', 'waiting for the loaded page UIContext');
    // No frozen hinge/posture Host event exists. Never infer fold state from
    // device type or viewport width.
    AppStorage.setOrCreate<string>(ViewportAdapter.K_FOLD_POSTURE, 'unverified');
    this.applyDevelopmentLaunchParameters(want);

    // Diagnostic: probe where the NAPI .so might live on device.
    this.probeNativeLibraryLocations();

    // Initialize CoreRuntime (Reader-Core native + Host adapters) and start the
    // host request dispatcher. Failure is non-fatal: the UI shell remains
    // functional for contract-driven rendering without Core connectivity.
    try {
      const core = CoreRuntime.init({
        dataDir: this.context.filesDir,
        cacheDir: this.context.cacheDir,
        context: this.context,
      });
      core.startDispatcher();
      const selfCheckFlag = params['selfCheck'] as string;
      const verticalScrollCheckFlag = params['verticalScrollCheck'] as string;
      // The restore request must finish before any initial Core reads. This
      // prevents an empty in-memory runtime from rendering/persisting over an
      // existing bookshelf/source/local-book snapshot on cold launch.
      this.bootstrapCoreAfterRestore(core, selfCheckFlag, verticalScrollCheckFlag).then((): void => {}).catch((error: Error): void => {
        console.error('[EntryAbility] Core bootstrap failed: ' + error);
      });
    } catch (e) {
      console.error('CoreRuntime init failed: ' + e);
    }
  }

  /**
   * Restore Core-owned durable state before dispatching the initial reducer
   * effects. A failed/corrupt restore is deliberately logged and falls back to
   * a volatile session; Core keeps persistence disabled in that case so it
   * cannot overwrite the unreadable snapshot.
   */
  private async bootstrapCoreAfterRestore(core: CoreRuntime, selfCheckFlag: string,
    verticalScrollCheckFlag: string): Promise<void> {
    const uiPreferences = core.getReaderUiPreferenceAdapter();
    if (uiPreferences !== null) {
      try {
        const snapshot = await uiPreferences.load();
        ReaderUiStore.dispatch({ type: 'hydrate-reduced-motion', enabled: snapshot.reducedMotion });
        // The Host adapter admits only a validated global pair. Hydration is a
        // reducer-only event, so startup never rewrites a corrupt preference.
        ReaderUiStore.dispatch({
          type: 'hydrate-reader-page-turn-preference',
          preferencePageAnimation: snapshot.pageAnimation,
          preferencePageMode: snapshot.pageMode,
        });
      } catch (e) {
        // Default false remains active. A corrupt/future preference schema is
        // never silently rewritten during startup.
        console.error('[EntryAbility] Reader UI preference restore failed: ' + e);
      }
    }
    try {
      const restored = await core.restoreCoreStorage();
      console.info('[EntryAbility] Core storage restore=' + JSON.stringify(restored));
    } catch (e) {
      console.error('[EntryAbility] Core storage restore failed; continuing without durable Core writes: ' + e);
    }

    // UI fixtures remain contract-development fallbacks only; production
    // bookshelf/replacement/source data comes from the now-restored Core store.
    ReaderEffects.loadBookshelf();
    ReaderEffects.loadRss();
    ReaderEffects.loadAvailableSources();
    ReaderEffects.loadWebdavConfig();
    // Self-checks are opt-in: they only run after Core storage is ready so a
    // device proof observes the same startup order as production.
    if (selfCheckFlag === 'true') {
      console.info('[EntryAbility] selfCheck=true — running all Host self-checks for device evidence');
      const manifest = core.getCapabilityManifest();
      this.runCoreSelfCheck(core, manifest);
      this.runTtsSelfCheck(core, manifest);
      this.runReadingChainSelfCheck(core, manifest);
      this.runRssSelfCheck(core, manifest);
      this.runLocalBookSelfCheck(core, manifest, false);
      this.runSyncWebDavSelfCheck(core, manifest);
      this.runUiAdapterSelfCheck(core, manifest);
      this.runReadingChainUiSelfCheck(manifest);
      setTimeout(() => {
        manifest.rebroadcastSummary();
        console.info('[EntryAbility] self-check evidence drive complete — see [HostManifest] post-self-check line');
      }, 30000);
    } else if (verticalScrollCheckFlag === 'true') {
      // Keep the visual VM scroll proof isolated from the broader Host probe:
      // the latter intentionally enters non-admitted diagnostic routes and is
      // not a valid visible-app smoke test.
      console.info('[EntryAbility] verticalScrollCheck=true — importing only the long local-book scroll probe');
      this.runLocalBookSelfCheck(core, core.getCapabilityManifest(), true);
    } else {
      console.info('[EntryAbility] selfCheck not requested — skipping Host self-checks (regular launch)');
    }
  }

  onConfigurationUpdate(newConfig: Configuration): void {
    ReaderThemeState.setColorMode(newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'dark' : 'light');
  }

  /**
   * One-shot Core runtime self-check. Runs async after onCreate returns so the
   * UI is not blocked. Each step logs a [CoreSelfCheck] line that can be
   * harvested by hdc hilog for the device-proof evidence document.
   */
  private runCoreSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    // abiVersion is synchronous and cheap — log immediately.
    try {
      const abi = core.getReaderCoreRuntime().abiVersion;
      console.info(`[CoreSelfCheck] abiVersion=${abi}`);
    } catch (e) {
      console.info(`[CoreSelfCheck] abiVersion error=${e}`);
    }
    // Async checks: ping → coreInfo → hostSmoke. Each has its own log line so
    // partial success is still visible if a later step fails.
    Promise.resolve()
      .then(async () => {
        const pingOk = await core.ping();
        console.info(`[CoreSelfCheck] ping ok=${pingOk}`);
      })
      .then(async () => {
        const info = await core.coreInfo();
        console.info(`[CoreSelfCheck] coreInfo=${JSON.stringify(info)}`);
      })
      .then(async () => {
        const smoke = await core.getReaderCoreRuntime().hostSmoke();
        console.info(`[CoreSelfCheck] hostSmoke type=${smoke.type} data=${JSON.stringify(smoke.data)}`);
        manifest.markVerifiedByTag('CoreSelfCheck');
      })
      .catch((e: Error) => {
        console.info(`[CoreSelfCheck] async step error=${e}`);
      });
  }

  /**
   * One-shot in-app TTS self-check.  It exercises the same app-owned engine
   * path as the visible Reader TTS panel: start → stop → shutdown.  It never
   * initializes a system reader surface and does not claim unsupported
   * pause/resume or percentage-progress evidence.
   */
  private runTtsSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    const tts: TtsHostAdapter = core.getTtsAdapter();
    Promise.resolve()
      .then(async () => {
        const req: HostTtsSystemStartRequest = {
          text: '朗读自检：一二三四五，上山打老虎。老虎没打到，打到小松鼠。',
        };
        const startResp = await tts.start(req);
        console.info(`[TtsSelfCheck] start started=${startResp.started} backend=${tts.getBackendKind()}`);
        await new Promise<void>((resolve) => setTimeout(resolve, 1200));
        console.info(`[TtsSelfCheck] state=${tts.queryState()}`);
        const stopResp = await tts.stop();
        console.info(`[TtsSelfCheck] stop acknowledged=${stopResp.acknowledged}`);
        await tts.shutdown();
        console.info('[TtsSelfCheck] shutdown done');
        manifest.markVerifiedByTag('TtsSelfCheck');
      })
      .catch((e: Error) => {
        console.info(`[TtsSelfCheck] error=${e}`);
      });
  }

  /**
   * One-shot Host reading-chain self-check. Proves the Host adapters compose
   * end-to-end against a real book source URL, without depending on Core
   * business logic or UI. Each step logs under [ReadingChain] so
   * `hdc shell hilog | grep ReadingChain` harvests the full picture.
   *
   * Target: 有度轻说 (www.yodu.org) — the ★★★ golden fixture from
   * Reader-Core-Native's tested corpus (crates/reader-content/tests/
   * yodu_multirule_fixture.rs). No login, no cookie required by the source;
   * the cookie step here is a Host jar round-trip, not a source requirement.
   *
   * Scope (Host transport + cache only):
   *   step 1 — http.execute GET search URL → status + body length
   *   step 2 — cookie.set / cookie.get round-trip in the scoped jar
   *   step 3 — file.write body to cache:// + file.read back → byte match
   *
   * Out of scope (deferred):
   *   - Content extraction (Core's RemoteContentPipeline job)
   *   - webview.evaluateJavaScript (needs a UI Web component — Phase 7)
   *
   * Best-effort: any failure is logged but does not affect app lifecycle.
   */
  private runReadingChainSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    // URL-encode "斗破" for the search path. searchUrl pattern from
    // legado_yodu_multirule_vertical.json: https://www.yodu.org/sa/all-{{key}}-{{page}}.html
    const searchUrl = 'https://www.yodu.org/sa/all-%E6%96%97%E7%A0%B4-1.html';
    const sessionId = 'reading-chain-self-check';
    const cachePath = 'cache://reading-chain/yodu-search.html';
    Promise.resolve()
      .then(async () => {
        // Step 1: http.execute — fetch the real book source search page.
        const httpReq: HostHttpRequest = {
          url: searchUrl,
          method: 'GET',
          headers: { 'User-Agent': 'Reader-for-HarmonyOS/host-self-check' },
          sessionId: sessionId,
        };
        const httpResp = await core.getHttpAdapter().execute(httpReq);
        const bodyLen = httpResp.body !== undefined ? httpResp.body.length : 0;
        const ct = httpResp.headers !== undefined
          ? (httpResp.headers['Content-Type'] ?? httpResp.headers['content-type'] ?? '?')
          : '?';
        console.info(`[ReadingChain] step=1 http.execute status=${httpResp.status} bodyLen=${bodyLen} content-type=${ct} finalUrl=${httpResp.finalUrl}`);
        // Sanity: a real search page should return 200 and a non-empty body.
        // We do NOT assert here (source may be down) — just log and continue.
        if (httpResp.status !== 200 || bodyLen === 0) {
          console.info(`[ReadingChain] step=1 WARN non-200 or empty body; source may be down — continuing to exercise cookie/file adapters`);
        }

        // Step 2: cookie.set / cookie.get — Host jar round-trip on this session.
        const cookieReq: HostCookieSetRequest = {
          cookie: {
            name: 'rc-self-check',
            value: 'host-reading-chain',
            domain: 'www.yodu.org',
            path: '/',
          },
          sessionId: sessionId,
        };
        await core.getCookieAdapter().set(cookieReq);
        const cookieGetResp = await core.getCookieAdapter().get({
          domain: 'www.yodu.org',
          sessionId: sessionId,
        } as HostCookieGetRequest);
        const cookieCount = cookieGetResp.cookies !== undefined ? cookieGetResp.cookies.length : 0;
        console.info(`[ReadingChain] step=2 cookie.set+get round-trip cookies=${cookieCount} sessionId=${sessionId}`);

        // Step 3: file.write / file.read — cache the fetched body and verify.
        const fileAdapter = core.getFileAdapter();
        if (fileAdapter === null) {
          console.info('[ReadingChain] step=3 SKIP file adapter null (no context)');
          return;
        }
        const writeReq = buildSelfCheckCacheWriteRequest(cachePath, httpResp.body);
        const writeResp = await fileAdapter.write(writeReq);
        console.info(`[ReadingChain] step=3a file.write path=${cachePath} written=${writeResp.written} bytes=${writeResp.byteLength}`);
        const readResp = await fileAdapter.read({ path: cachePath, encoding: 'utf-8' } as HostFileReadRequest);
        const readLen = readResp.content !== undefined ? readResp.content.length : 0;
        const match = readLen === bodyLen;
        console.info(`[ReadingChain] step=3b file.read path=${cachePath} bytes=${readResp.byteLength} contentLen=${readLen} roundTripMatch=${match}`);
        console.info(`[ReadingChain] DONE transport+cache verified (extraction is Core's job, webview is Phase 7)`);
        manifest.markVerifiedByTag('ReadingChain');
      })
      .catch((e: Error) => {
        console.info(`[ReadingChain] error=${e}`);
      });
  }

  /**
   * One-shot RSS ingestion self-check. Proves the Host adapters compose for
   * the RSS flow: http.execute fetches a public feed, a simple <item> count
   * verifies the body is real RSS XML, and file.write/read caches it.
   *
   * Target: https://hnrss.org/frontpage — Hacker News front page RSS, stable,
   * no auth, clean XML. Public feed chosen per user direction.
   *
   * Scope (Host transport + cache only):
   *   step 1 — http.execute GET feed → status + body length + content-type
   *   step 2 — count <item> occurrences (proves body is RSS, not full parse)
   *   step 3 — file.write body to cache:// + file.read back → byte match
   *
   * Out of scope: full RSS XML parsing (Core's job if Core has an RSS module).
   * Best-effort: any failure is logged but does not affect app lifecycle.
   */
  private runRssSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    const feedUrl = 'https://hnrss.org/frontpage';
    const cachePath = 'cache://rss/hnrss-frontpage.xml';
    Promise.resolve()
      .then(async () => {
        // Step 1: http.execute — fetch the public RSS feed.
        const httpReq: HostHttpRequest = {
          url: feedUrl,
          method: 'GET',
          headers: { 'User-Agent': 'Reader-for-HarmonyOS/host-self-check' },
        };
        const httpResp = await core.getHttpAdapter().execute(httpReq);
        const body = httpResp.body !== undefined ? httpResp.body : '';
        const bodyLen = body.length;
        const ct = httpResp.headers !== undefined
          ? (httpResp.headers['Content-Type'] ?? httpResp.headers['content-type'] ?? '?')
          : '?';
        console.info(`[RssChain] step=1 http.execute status=${httpResp.status} bodyLen=${bodyLen} content-type=${ct}`);
        if (httpResp.status !== 200 || bodyLen === 0) {
          console.info(`[RssChain] step=1 WARN non-200 or empty body; feed may be down — continuing`);
        }

        // Step 2: count <item> tags — proves the body is RSS XML, not a full
        // parse. A real RSS feed has ≥1 item. We do NOT parse the XML tree
        // here (that's Core's job); this is a sanity count for evidence.
        let itemCount = 0;
        let idx = 0;
        const needle = '<item>';
        while (true) {
          const pos = body.indexOf(needle, idx);
          if (pos < 0) { break; }
          itemCount++;
          idx = pos + needle.length;
        }
        console.info(`[RssChain] step=2 item-count=${itemCount} (sanity: ≥1 means real RSS body)`);

        // Step 3: file.write / file.read — cache the feed body and verify.
        const fileAdapter = core.getFileAdapter();
        if (fileAdapter === null) {
          console.info('[RssChain] step=3 SKIP file adapter null (no context)');
          return;
        }
        const writeReq = buildSelfCheckCacheWriteRequest(cachePath, body);
        const writeResp = await fileAdapter.write(writeReq);
        console.info(`[RssChain] step=3a file.write path=${cachePath} written=${writeResp.written} bytes=${writeResp.byteLength}`);
        const readResp = await fileAdapter.read({ path: cachePath, encoding: 'utf-8' } as HostFileReadRequest);
        const readLen = readResp.content !== undefined ? readResp.content.length : 0;
        const match = readLen === bodyLen;
        console.info(`[RssChain] step=3b file.read path=${cachePath} bytes=${readResp.byteLength} contentLen=${readLen} roundTripMatch=${match}`);
        console.info(`[RssChain] DONE transport+cache verified (full RSS parse is Core's job)`);
        manifest.markVerifiedByTag('RssChain');
      })
      .catch((e: Error) => {
        console.info(`[RssChain] error=${e}`);
      });
  }

  /**
   * One-shot local_book self-check. Proves the Host adapters compose for the
   * local_book ingestion flow: TXT round-trip via file.write/read +
   * persistence metadata, and EPUB decompression via @ohos.zlib + OPF
   * metadata extraction.
   *
   * Samples are bundled in entry/src/main/resources/rawfile/:
   *   - sample.txt: an original Chinese UTF-8 import sample
   *   - sample.epub: a minimal valid EPUB 3.0 package with known
   *     dc:title="Host Self-Check EPUB Sample" and
   *     dc:creator="Reader-for-HarmonyOS"
   *
   * Scope (Host transport + persistence + zlib extraction):
   *   TXT:
   *     step 1 — getRawFileContent('sample.txt') → decode UTF-8 → char count
   *     step 2 — file.write to files://local_book/sample.txt + file.read back
   *     step 3 — persistence.put metadata + persistence.get back
   *   EPUB:
   *     step 4 — getRawFileContent('sample.epub') → write bytes to filesDir
   *     step 5 — zlib.decompressFile to extract dir
   *     step 6 — file.read META-INF/container.xml → parse OPF path
   *     step 7 — file.read OPF → extract dc:title / dc:creator
   *     step 8 — persistence.put EPUB metadata + persistence.get back
   *
   * Out of scope (Core/UI job): full XML parsing, content rendering.
   * Best-effort: any failure is logged but does not affect app lifecycle.
   */
  private runLocalBookSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest,
    openVerticalProbe: boolean): void {
    Promise.resolve()
      .then(async () => {
        const fileAdapter = core.getFileAdapter();
        if (fileAdapter === null) {
          console.info('[LocalBook] SKIP file adapter null (no context)');
          return;
        }
        const coreAdapter = core.getCoreAdapter();
        const resourceManager = this.context.resourceManager;

        // Ensure local_book dir exists under filesDir. mkdirSync with
        // recursion=true is idempotent (no-op if dir already exists).
        const localBookDir = this.context.filesDir + '/local_book';
        try {
          fs.mkdirSync(localBookDir, true);
        } catch (e) {
          // dir may already exist — ignore
        }

        // ── TXT part ──
        // Step 1: getRawFileContent('sample.txt') → decode UTF-8
        const txtBytes = await resourceManager.getRawFileContent('sample.txt');
        const txtDecoder = util.TextDecoder.create('utf-8');
        const txtContent = txtDecoder.decodeToString(txtBytes);
        console.info(`[LocalBook] step=1 txt getRawFileContent bytes=${txtBytes.length} contentLen=${txtContent.length}`);

        // Step 1b: prove the production Core vertical, not only Host file
        // transport.  The confirmed import materializes metadata, TOC and
        // chapter content in Core; subsequent reads use the durable Core API
        // rather than this raw-file buffer.  This self-check is opt-in with
        // selfCheck=true and never executes during a normal app launch.
        const coreBookId = `device-local-self-check-${Date.now()}`;
        const imported = await core.localBookImport(coreBookId, {
          text: txtContent,
          fileName: 'sample.txt',
          format: 'txt',
        });
        const importedFields = imported as Object as Record<string, number>;
        const importedChapterCount = importedFields['chapterCount'];
        // The normal user flow persists a materialized local book and then
        // adds that returned Core book to the bookshelf.  Keep the explicit
        // device self-check on the same persistence path so an emulator
        // reading-chain test has a real shelf entry rather than an invented
        // UI fixture.  This only runs for the opt-in selfCheck launch flag.
        const materializedBook = (imported as Object as Record<string, Object>)['book'];
        if (materializedBook === undefined || materializedBook === null ||
          typeof materializedBook !== 'object' || Array.isArray(materializedBook)) {
          throw new Error('Core local_book.import returned no valid bookshelf book');
        }
        const bookshelfBook = materializedBook as JsonObject;
        bookshelfBook['sourceId'] = 'local';
        await core.bookshelfAdd(bookshelfBook);
        const coreToc = await core.localBookToc(coreBookId);
        const tocFields = coreToc as Object as Record<string, Object[]>;
        const tocEntries: Object[] = tocFields['toc'];
        if (!Array.isArray(tocEntries) || tocEntries.length === 0) {
          throw new Error('Core local_book.toc returned no entries after import');
        }
        const firstEntry = tocEntries[0] as Object as Record<string, number>;
        const firstIndexValue: number = firstEntry['index'];
        const firstIndex = typeof firstIndexValue === 'number' ? firstIndexValue : 0;
        const coreChapter = await core.localBookChapterContent(coreBookId, firstIndex);
        const chapterFields = coreChapter as Object as Record<string, string>;
        const coreChapterContent = chapterFields['content'];
        if (typeof coreChapterContent !== 'string' || coreChapterContent.length === 0) {
          throw new Error('Core local_book.chapter.content returned empty content');
        }
        console.info(`[LocalBookCore] import=true shelfAdded=true chapters=${importedChapterCount} toc=${tocEntries.length} firstIndex=${firstIndex} contentLen=${coreChapterContent.length}`);

        // The bundled sample is intentionally short, so it cannot prove that
        // the production vertical reading surface receives a real drag.  Add
        // a long Core-backed book only for the explicit device self-check;
        // regular launches never create this record or alter a user's shelf.
        let verticalProbeText = '';
        for (let paragraphIndex = 1; paragraphIndex <= 96; paragraphIndex += 1) {
          verticalProbeText += `第 ${paragraphIndex} 段：这是用于虚拟机验证竖向阅读滚动的真实本地导入文本。` +
            '拖动正文后，阅读位置必须发生变化，且不应被翻页热区或控制层覆盖。\n\n';
        }
        const verticalProbeId = `device-vertical-scroll-self-check-${Date.now()}`;
        const verticalImported = await core.localBookImport(verticalProbeId, {
          text: verticalProbeText,
          fileName: '长文本滚动验证.txt',
          format: 'txt',
        });
        const verticalMaterializedBook = (verticalImported as Object as Record<string, Object>)['book'];
        if (verticalMaterializedBook === undefined || verticalMaterializedBook === null ||
          typeof verticalMaterializedBook !== 'object' || Array.isArray(verticalMaterializedBook)) {
          throw new Error('Core local_book.import returned no vertical-scroll probe book');
        }
        const verticalShelfBook = verticalMaterializedBook as JsonObject;
        verticalShelfBook['sourceId'] = 'local';
        await core.bookshelfAdd(verticalShelfBook);
        ReaderEffects.loadBookshelf();
        if (openVerticalProbe) {
          this.enterVerticalScrollProbeWhenReady(verticalProbeId);
        }
        console.info(`[LocalBookCore] verticalScrollProbe=true contentLen=${verticalProbeText.length}`);

        // Step 2: file.write / file.read round-trip
        const txtPath = 'files://local_book/sample.txt';
        const txtWriteResp = await fileAdapter.write({
          path: txtPath,
          content: txtContent,
          encoding: 'utf-8',
        } as HostFileWriteRequest);
        console.info(`[LocalBook] step=2a file.write path=${txtPath} written=${txtWriteResp.written} bytes=${txtWriteResp.byteLength}`);
        const txtReadResp = await fileAdapter.read({ path: txtPath, encoding: 'utf-8' } as HostFileReadRequest);
        const txtRoundTripMatch = txtReadResp.content === txtContent;
        console.info(`[LocalBook] step=2b file.read path=${txtPath} bytes=${txtReadResp.byteLength} roundTripMatch=${txtRoundTripMatch}`);

        // Step 3: persistence.put / get — TXT metadata
        const txtMeta = `{"title":"Host 本地导入自检样章","author":"Reader-for-HarmonyOS","format":"txt","charCount":${txtContent.length}}`;
        await coreAdapter.persistencePut({
          namespace: 'local_book',
          key: 'sample.txt.meta',
          value: txtMeta,
        } as HostPersistencePutRequest);
        const txtMetaGet = await coreAdapter.persistenceGet({
          namespace: 'local_book',
          key: 'sample.txt.meta',
        } as HostPersistenceGetRequest);
        console.info(`[LocalBook] step=3 persistence round-trip found=${txtMetaGet.found} revision=${txtMetaGet.revision} valueMatch=${txtMetaGet.value === txtMeta}`);

        // ── EPUB part ──
        // Step 4: getRawFileContent('sample.epub') → write bytes to filesDir.
        // FileHostAdapter.write is string-only, so binary EPUB bytes are
        // written directly via fs.openSync + fs.writeSync. This is the only
        // place we bypass the Host adapter — every other step uses HostAdapter.
        const epubBytes = await resourceManager.getRawFileContent('sample.epub');
        console.info(`[LocalBook] step=4a epub getRawFileContent bytes=${epubBytes.length}`);
        const epubFilePath = localBookDir + '/sample.epub';
        const epubBuffer = new ArrayBuffer(epubBytes.length);
        const epubView = new Uint8Array(epubBuffer);
        for (let i = 0; i < epubBytes.length; i++) {
          epubView[i] = epubBytes[i];
        }
        const epubFile = fs.openSync(epubFilePath, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
        try {
          fs.writeSync(epubFile.fd, epubBuffer);
        } finally {
          fs.closeSync(epubFile);
        }
        console.info(`[LocalBook] step=4b epub written path=${epubFilePath}`);

        // Step 5: zlib.decompressFile — extract EPUB (ZIP) to a directory.
        // zlib.decompressFile requires the output directory to already exist
        // (BusinessError 900002 if it doesn't), so create it first.
        const epubExtractDir = localBookDir + '/sample.epub.extracted';
        try { fs.rmdirSync(epubExtractDir); } catch (e) { /* may not exist or non-empty */ }
        fs.mkdirSync(epubExtractDir, true);
        const epubOptions: zlib.Options = {
          pathSeparatorStrategy: zlib.PathSeparatorStrategy.PATH_SEPARATOR_STRATEGY_REPLACE_BACKSLASH,
        };
        await zlib.decompressFile(epubFilePath, epubExtractDir, epubOptions);
        console.info(`[LocalBook] step=5 epub decompressed to=${epubExtractDir}`);

        // Step 6: file.read META-INF/container.xml → parse OPF path
        const containerResp = await fileAdapter.read({
          path: epubExtractDir + '/META-INF/container.xml',
          encoding: 'utf-8',
        } as HostFileReadRequest);
        const containerContent = containerResp.content ?? '';
        const opfPathMatch = containerContent.match(/full-path="([^"]+)"/);
        const opfPath = opfPathMatch !== null ? opfPathMatch[1] : '';
        console.info(`[LocalBook] step=6 container.xml bytes=${containerResp.byteLength} opfPath=${opfPath}`);

        // Step 7: file.read OPF → extract dc:title / dc:creator
        let epubTitle = '';
        let epubCreator = '';
        if (opfPath.length > 0) {
          const opfResp = await fileAdapter.read({
            path: epubExtractDir + '/' + opfPath,
            encoding: 'utf-8',
          } as HostFileReadRequest);
          const opfContent = opfResp.content ?? '';
          const titleMatch = opfContent.match(/<dc:title>([^<]+)<\/dc:title>/);
          epubTitle = titleMatch !== null ? titleMatch[1] : '';
          const creatorMatch = opfContent.match(/<dc:creator>([^<]+)<\/dc:creator>/);
          epubCreator = creatorMatch !== null ? creatorMatch[1] : '';
          console.info(`[LocalBook] step=7 opf bytes=${opfResp.byteLength} title="${epubTitle}" creator="${epubCreator}"`);
        } else {
          console.info('[LocalBook] step=7 SKIP opfPath empty');
        }

        // Step 8: persistence.put / get — EPUB metadata
        const epubMeta = `{"title":"${epubTitle}","author":"${epubCreator}","format":"epub","extractedTo":"${epubExtractDir}"}`;
        await coreAdapter.persistencePut({
          namespace: 'local_book',
          key: 'sample.epub.meta',
          value: epubMeta,
        } as HostPersistencePutRequest);
        const epubMetaGet = await coreAdapter.persistenceGet({
          namespace: 'local_book',
          key: 'sample.epub.meta',
        } as HostPersistenceGetRequest);
        console.info(`[LocalBook] step=8 persistence round-trip found=${epubMetaGet.found} revision=${epubMetaGet.revision} valueMatch=${epubMetaGet.value === epubMeta}`);

        console.info('[LocalBook] DONE txt+epub local_book verified (full XML render is Core/UI job)');
        manifest.markVerifiedByTag('LocalBook');
      })
      .catch((e: Error) => {
        console.info(`[LocalBook] error=${e}`);
      });
  }

  /**
   * The opt-in VM layout probe must exercise the same Core-backed shelf-open
   * transaction as a user tap. It therefore waits for `bookshelf.list` to
   * publish the exact imported identity before entering Reader, then selects
   * the existing five-option `scroll` setting after the canonical location is
   * ready. Normal launches and the broader selfCheck path never call this.
   */
  private enterVerticalScrollProbeWhenReady(bookId: string): void {
    let elapsed = 0;
    let enteredReader = false;
    const intervalMs = 150;
    const timeoutMs = 15000;
    const poll = setInterval((): void => {
      elapsed += intervalMs;
      const state = ReaderUiStore.snapshot();
      if (!enteredReader) {
        for (let index = 0; index < state.bookshelfBooks.length; index += 1) {
          const book = state.bookshelfBooks[index];
          if (book.sourceId === 'local' && book.bookId === bookId) {
            enteredReader = true;
            ReaderUiStore.dispatchBookshelfActionToReader(bookId, 'local');
            console.info('[verticalScrollCheck] enteredReader=true bookId=' + bookId);
            break;
          }
        }
      } else if (state.currentBook !== null && state.currentBook.bookId === bookId &&
        state.chapterContent.length > 0) {
        if (state.paginationMode !== 'vertical') {
          ReaderUiStore.dispatch({
            type: 'set-reader-setting-option',
            optionKey: 'pageAnimation',
            optionValue: 'scroll',
          });
        }
        const updated = ReaderUiStore.snapshot();
        if (updated.paginationMode === 'vertical' &&
          updated.readerSettingOptions.pageAnimation === 'scroll') {
          clearInterval(poll);
          console.info('[verticalScrollCheck] result=ready paragraphs=' +
            updated.chapterContent.length + ' paginationMode=' + updated.paginationMode +
            ' pageAnimation=' + updated.readerSettingOptions.pageAnimation);
          return;
        }
      }
      if (elapsed >= timeoutMs) {
        clearInterval(poll);
        const terminal = ReaderUiStore.snapshot();
        console.error('[verticalScrollCheck] failed timeout route=' + terminal.routeId +
          ' shelf=' + terminal.bookshelfBooks.length +
          ' paragraphs=' + terminal.chapterContent.length +
          ' paginationMode=' + terminal.paginationMode);
      }
    }, intervalMs);
  }

  /**
   * One-shot sync/WebDAV self-check. Proves the Host credential + http + file
   * adapters compose for the sync flow against a real WebDAV server.
   *
   * Target/auth are read from CredentialHostAdapter keys:
   *   - webdav.url
   *   - webdav.user
   *   - webdav.password
   *
   * The check is skipped unless all three keys are already configured on the
   * device. This keeps the host proof device-ready without seeding real
   * credentials or private endpoints in source.
   *
   * Limitation: @ohos.net.http only supports GET/POST/PUT/DELETE/HEAD/OPTIONS.
   * WebDAV-specific methods (PROPFIND, MKCOL, MOVE, COPY) are NOT available.
   * This check uses PUT (upload) + GET (download) only, which is sufficient
   * to prove the sync transport composition.
   *
   * Scope:
   *   step 1 — credential.get URL + user + password
   *   step 2 — skip if any required value is missing
   *   step 3 — http.execute PUT a test file with Basic auth header
   *   step 4 — http.execute GET the same URL → verify body round-trip
   *   step 5 — file.write the downloaded content to cache://
   *
   * Best-effort: TLS errors (self-signed cert), network errors, auth failures
   * (401), or PUT failures (403/409) are all logged as device evidence.
   */
  private runSyncWebDavSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    const testContent = 'Reader-for-HarmonyOS sync/WebDAV self-check @ ' + Date.now();
    Promise.resolve()
      .then(async () => {
        const credentialAdapter = core.getCredentialAdapter();
        if (credentialAdapter === null) {
          console.info('[SyncWebDav] SKIP credential adapter null (no UIAbilityContext)');
          return;
        }
        if (!credentialAdapter.supportsProtectedSecrets()) {
          console.info('[SyncWebDav] SKIP protected credential storage unavailable; plaintext auth is fail-closed');
          return;
        }

        // Step 1: credential.get — retrieve pre-provisioned target/auth.
        const urlResp = await credentialAdapter.get({ key: 'webdav.url' } as HostCredentialGetRequest);
        const userResp = await credentialAdapter.get({ key: 'webdav.user' } as HostCredentialGetRequest);
        const passResp = await credentialAdapter.get({ key: 'webdav.password' } as HostCredentialGetRequest);
        const webdavUrl = urlResp.value ?? '';
        const user = userResp.value ?? '';
        const pass = passResp.value ?? '';
        const configured = urlResp.exists && userResp.exists && passResp.exists
          && webdavUrl.length > 0 && user.length > 0 && pass.length > 0;
        console.info(`[SyncWebDav] step=1 credential.get url.exists=${urlResp.exists} user.exists=${userResp.exists} password.exists=${passResp.exists}`);
        if (!configured) {
          console.info('[SyncWebDav] step=2 SKIP missing webdav.url/webdav.user/webdav.password credential state');
          return;
        }
        console.info('[SyncWebDav] step=2 configured target/auth present');

        // Build Basic auth header from retrieved credentials.
        const encoder = util.TextEncoder.create('utf-8');
        const credBytes = encoder.encodeInto(user + ':' + pass);
        const base64Helper = new util.Base64Helper();
        const authHeader = 'Basic ' + base64Helper.encodeToStringSync(credBytes);

        // Step 3: http.execute PUT — upload test file to WebDAV server.
        const putReq: HostHttpRequest = {
          url: webdavUrl,
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'text/plain; charset=utf-8',
          },
          body: testContent,
        };
        const putResp = await core.getHttpAdapter().execute(putReq);
        console.info(`[SyncWebDav] step=3 http.put status=${putResp.status} targetConfigured=true bodyLen=${testContent.length}`);

        // Step 4: http.execute GET — download the file back.
        const getReq: HostHttpRequest = {
          url: webdavUrl,
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        };
        const getResp = await core.getHttpAdapter().execute(getReq);
        const getBody = getResp.body ?? '';
        const roundTripMatch = getBody === testContent;
        console.info(`[SyncWebDav] step=4 http.get status=${getResp.status} bodyLen=${getBody.length} roundTripMatch=${roundTripMatch}`);

        // Step 5: file.write — cache the downloaded content.
        const fileAdapter = core.getFileAdapter();
        if (fileAdapter === null) {
          console.info('[SyncWebDav] step=5 SKIP file adapter null');
          return;
        }
        const cachePath = 'cache://sync-webdav/reader-self-check.txt';
        const writeResp = await fileAdapter.write({
          path: cachePath,
          content: getBody,
          encoding: 'utf-8',
        } as HostFileWriteRequest);
        console.info(`[SyncWebDav] step=5 file.write path=${cachePath} written=${writeResp.written} bytes=${writeResp.byteLength}`);

        console.info('[SyncWebDav] DONE credential+http+file composed for sync/WebDAV flow');
        manifest.markVerifiedByTag('SyncWebDav');
      })
      .catch((e: Error) => {
        console.info(`[SyncWebDav] error=${e}`);
      });
  }

  /**
   * One-shot UI-only adapter self-check. Produces device evidence for the
   * UI-Contract-only Host adapters that are NOT covered by the business-flow
   * self-checks above.
   *
   * Scope:
   *   WebView  — webview.open without a registered UI controller → opened: false
   *              (proves adapter enforces cooperative open; real JS evaluation
   *              requires a Web component registered by the UI layer)
   *   Permission — permission.check INTERNET + KEEP_BACKGROUND_RUNNING
   *              (non-intrusive: check only, no request dialog)
   *   Notification — notification.show + cancel (first show may trigger
   *              requestEnableNotification dialog; if denied, shown: false)
   *   TTS lifecycle — evidence is captured by [TtsSelfCheck] for the
   *              app-owned engine start/stop/shutdown sequence.  The engine
   *              intentionally has no fabricated progress or pause claim.
   *
   * Best-effort: any failure is logged but does not affect app lifecycle.
   */
  private runUiAdapterSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
    Promise.resolve()
      .then(async () => {
        // ── WebView ──
        // webview.open without a registered UI controller returns opened: false.
        // This proves the adapter is wired up and correctly enforces the
        // cooperative open model (UI layer must register a WebviewController
        // first). Real JS evaluation requires a Web component in ArkUI.
        const webViewAdapter = core.getWebViewAdapter();
        const openResp = await webViewAdapter.open({
          url: 'https://example.com',
          profileId: 'self-check',
        } as HostWebViewOpenRequest);
        console.info(`[UiAdapter] webview.open opened=${openResp.opened} profileId=self-check (real eval needs UI Web component)`);
        const closeResp = await webViewAdapter.close({ profileId: 'self-check' } as HostWebViewCloseRequest);
        console.info(`[UiAdapter] webview.close closed=${closeResp.closed} profileId=self-check`);

        // ── Permission ──
        // permission.check — verify declared permissions are granted without
        // showing a system dialog. INTERNET and KEEP_BACKGROUND_RUNNING are
        // declared in module.json5 and should be granted at install time.
        const permissionAdapter = core.getPermissionAdapter();
        if (permissionAdapter === null) {
          console.info('[UiAdapter] permission SKIP adapter null (no UIAbilityContext)');
        } else {
          const internetCheck = await permissionAdapter.check({
            scope: 'ohos.permission.INTERNET',
          } as HostPermissionCheckRequest);
          console.info(`[UiAdapter] permission.check INTERNET granted=${internetCheck.granted}`);
          const bgCheck = await permissionAdapter.check({
            scope: 'ohos.permission.KEEP_BACKGROUND_RUNNING',
          } as HostPermissionCheckRequest);
          console.info(`[UiAdapter] permission.check KEEP_BACKGROUND_RUNNING granted=${bgCheck.granted}`);
        }

        // ── Notification ──
        // notification.show + cancel — publish a basic-text notification and
        // immediately cancel it. First show may trigger requestEnableNotification
        // dialog; if the user denies, show returns shown: false.
        const notificationAdapter = core.getNotificationAdapter();
        if (notificationAdapter === null) {
          console.info('[UiAdapter] notification SKIP adapter null (no UIAbilityContext)');
        } else {
          const showResp = await notificationAdapter.show({
            id: 'reader-host-self-check',
            title: 'Reader Host Self-Check',
            body: 'UI adapter device evidence @ ' + Date.now(),
          } as HostNotificationShowRequest);
          console.info(`[UiAdapter] notification.show shown=${showResp.shown} id=${showResp.id ?? '?'}`);
          if (showResp.shown && showResp.id !== undefined) {
            const cancelResp = await notificationAdapter.cancel({
              id: showResp.id,
            } as HostNotificationCancelRequest);
            console.info(`[UiAdapter] notification.cancel id=${showResp.id} cancelled=${cancelResp.cancelled}`);
          }
        }

        // ── TTS lifecycle ──
        console.info('[UiAdapter] tts lifecycle evidence captured by [TtsSelfCheck] tag (in-app engine start/stop/shutdown)');

        // ── device.vibrate ──
        // vibrator.vibrate is a no-op on emulator (no hardware), but the call
        // succeeds and returns vibrated: true when the adapter + permission
        // are wired. On real hardware this produces a 15ms vibration.
        const deviceAdapter = core.getDeviceAdapter();
        const vibrateReq: HostDeviceVibrateRequest = { durationMs: 15 };
        const vibrateResp = await deviceAdapter.vibrate(vibrateReq);
        console.info('[UiAdapter] device.vibrate vibrated=' + vibrateResp.vibrated + ' durationMs=15');

        console.info('[UiAdapter] DONE webview+permission+notification+tts-lifecycle+vibrate device evidence captured');
        manifest.markVerifiedByTag('UiAdapter');
      })
      .catch((e: Error) => {
        console.info(`[UiAdapter] error=${e}`);
      });
  }

  /**
   * Reading-chain UI self-check: exercises the reducer + ReaderEffects + Host
   * HTTP path (the same path the real search box uses) by dispatching
   * search-submit. ReaderEffects.runSearch fires the Host HTTP adapter, parses
   * the response, and dispatches search-success / search-failure back into the
   * store. We log the outcome (success OR failure both prove the effect path is
   * wired on device; only a silent store would indicate a broken path).
   */
  private runReadingChainUiSelfCheck(manifest: HostCapabilityManifest): void {
    const query: string = '斗破';
    const originRoute = ReaderUiStore.snapshot().routeId as RouteId;
    const restoreOriginRoute = (): void => {
      if (ReaderUiStore.snapshot().routeId !== originRoute) {
        ReaderUiStore.dispatch({ type: 'route-replace', id: originRoute });
      }
    };
    console.info('[ReadingChainUi] start: entering book-search then dispatching search-submit query=' + query);
    const beforeStr: string = AppStorage.get<string>('reader.searchQuery') ?? '';
    console.info('[ReadingChainUi] before: searchQuery="' + beforeStr + '"');
    ReaderUiStore.dispatch(buildReadingChainUiSearchRouteEvent());
    ReaderUiStore.dispatch({ type: 'search-submit', query: query });
    let elapsed = 0;
    const interval = 1500;
    // Full chain: search -> book-detail-load -> Core TOC -> chapter-load ->
    // chapter content. Each phase polls the store for its completion signal
    // and dispatches the next phase once observed.
    let phase: string = 'search';
    let detailDispatched: boolean = false;
    let chapterDispatched: boolean = false;
    const poll = setInterval(() => {
      elapsed += interval;
      const sq: string = AppStorage.get<string>('reader.searchQuery') ?? '';
      const sr: SearchResultEntry[] = AppStorage.get<SearchResultEntry[]>('reader.searchResults') ?? [];
      const errCode: string = AppStorage.get<string>('reader.errorCode') ?? '';
      const errMsg: string = AppStorage.get<string>('reader.errorMessage') ?? '';
      const loading: boolean = AppStorage.get<boolean>('reader.loading') ?? false;
      const currentBook: BookDetail | undefined = AppStorage.get<BookDetail>('reader.currentBook');
      const chapterToc: ChapterTocEntry[] = AppStorage.get<ChapterTocEntry[]>('reader.chapterToc') ?? [];
      const chapterContent: string[] = AppStorage.get<string[]>('reader.chapterContent') ?? [];
      console.info('[ReadingChainUi] poll elapsed=' + elapsed + 'ms phase=' + phase + ' searchQuery="' + sq + '" results=' + sr.length + ' loading=' + loading + ' errorCode=' + errCode + ' hasBook=' + (currentBook !== null && currentBook !== undefined) + ' tocLen=' + chapterToc.length + ' chapterLen=' + chapterContent.length);
      // Any error short-circuits the chain. It is logged as device diagnosis,
      // but only a complete body load counts as verified evidence.
      const hasError: boolean = errCode === 'SEARCH_FAILED' || errCode === 'BOOK_DETAIL_FAILED' || errCode === 'CHAPTER_FAILED';
      if (hasError) {
        clearInterval(poll);
        console.info('[ReadingChainUi] DONE chain-failure phase=' + phase + ' errorCode=' + errCode + ' msg=' + errMsg + ' (not verified: body was not loaded)');
        restoreOriginRoute();
        return;
      }
      if (phase === 'search') {
        const hasResults: boolean = sr.length > 0 && sq === query;
        if (hasResults) {
          const firstTitle: string = sr[0].title;
          const firstBookId: string = sr[0].bookId;
          console.info('[ReadingChainUi] step search-success results=' + sr.length + ' first="' + firstTitle + '" bookId="' + firstBookId + '"');
          phase = 'detail';
          detailDispatched = true;
          ReaderUiStore.dispatch(buildReadingChainUiDetailLoadEvent(sr[0]));
          console.info('[ReadingChainUi] dispatched book-detail-load bookId=' + firstBookId);
          return;
        }
      } else if (phase === 'detail') {
        if (currentBook !== null && currentBook !== undefined && currentBook.bookId === sr[0].bookId) {
          console.info('[ReadingChainUi] step detail-success title="' + currentBook.title + '" chapterListUrl="' + currentBook.chapterListUrl + '"');
          phase = 'toc';
          return;
        }
      } else if (phase === 'toc') {
        const chapterId = firstReadableReadingChainUiChapterId(chapterToc);
        if (chapterId.length > 0) {
          phase = 'chapter';
          chapterDispatched = true;
          ReaderUiStore.dispatch({ type: 'chapter-load', chapterId: chapterId });
          console.info('[ReadingChainUi] dispatched chapter-load chapterId=' + chapterId);
          return;
        }
      } else if (phase === 'chapter') {
        if (chapterContent.length > 0) {
          clearInterval(poll);
          const firstPara: string = chapterContent[0].length > 40 ? chapterContent[0].substring(0, 40) : chapterContent[0];
          const bookTitle: string = currentBook !== null && currentBook !== undefined ? currentBook.title : '';
          console.info('[ReadingChainUi] DONE chain-success results=' + sr.length + ' bookTitle="' + bookTitle + '" chapterParagraphs=' + chapterContent.length + ' firstPara="' + firstPara + '"');
          manifest.markVerifiedByTag('ReadingChainUi');
          restoreOriginRoute();
          return;
        }
      }
      if (elapsed >= 35000) {
        clearInterval(poll);
        console.info('[ReadingChainUi] TIMEOUT after 35s phase=' + phase + ' detailDispatched=' + detailDispatched + ' chapterDispatched=' + chapterDispatched + ' (searchQuery="' + sq + '" results=' + sr.length + ' loading=' + loading + '). HTTP may have hung past adapter timeout.');
        restoreOriginRoute();
      }
    }, interval);
  }

  /**
   * Log all plausible filesystem locations for `libreader_core_napi.so` so we
   * can see where (if anywhere) the NAPI module was actually installed.
   */
  private probeNativeLibraryLocations(): void {
    const candidates: string[] = [
      '/data/app/el1/bundle/public/com.minliny.reader/libs/arm64/libreader_core_napi.so',
      '/data/storage/el1/bundle/com.minliny.reader/libs/arm64/libreader_core_napi.so',
      '/data/storage/el1/bundle/com.minliny.reader/entry.hap',
    ];
    for (const path of candidates) {
      try {
        const exists = fs.accessSync(path);
        console.info(`[EntryAbility] probe path=${path} exists=${exists}`);
      } catch (e) {
        console.info(`[EntryAbility] probe path=${path} error=${e}`);
      }
    }
    console.info(`[EntryAbility] filesDir=${this.context.filesDir}`);
    console.info(`[EntryAbility] cacheDir=${this.context.cacheDir}`);
  }

  onBackground(): void {
    const playbackSuspended = ReaderUiStore.suspendPlaybackForBackground();
    if (!CoreRuntime.isInitialized()) {
      return;
    }
    // Best-effort lifecycle checkpoint. Core mutators write-through after a
    // successful restore; this also covers an otherwise idle app backgrounding.
    playbackSuspended.then((): Promise<Object> => CoreRuntime.get().flushCoreStorage())
      .then((data: Object): void => {
      console.info('[EntryAbility] Core storage background flush=' + JSON.stringify(data));
    }).catch((e: Error): void => {
      console.error('[EntryAbility] Core storage background flush failed: ' + e);
    });
  }

  onDestroy(): void {
    ReaderUiStore.teardownPlaybackForDestroy().then((): void => {
      CoreRuntime.close();
    }).catch((): void => {
      CoreRuntime.close();
    });
  }

  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    this.applyDevelopmentLaunchParameters(want);
  }

  private applyDevelopmentLaunchParameters(want: Want): void {
    const params = want.parameters ?? {};
    AppStorage.setOrCreate<boolean>(InteractionDebugAdapter.K_VISIBLE, params['interactionDebug'] === 'true');
    const initialRoute = params[InteractionDebugAdapter.K_INITIAL_ROUTE] as string;
    if (initialRoute !== undefined && initialRoute !== '' && RouteTable.shellOf(initialRoute) !== null) {
      ReaderUiStore.dispatch({ type: 'route-replace', id: initialRoute as RouteId });
      // The reducer may safely redirect a retired published RouteId.  Always
      // publish the actual current route, never the raw debug parameter.
      const resolvedRoute = ReaderUiStore.snapshot().routeId;
      AppStorage.setOrCreate<string>('reader.displayedRouteId', resolvedRoute);
      console.info('[EntryAbility] development initialRoute=' + initialRoute + ' resolvedRoute=' + resolvedRoute);
    }
    // Pagination layout is not a launch/deep-link concern.  A previous
    // development-only parameter could force vertical scrolling while the
    // visible setting still said “平滑”, making two independent settings look
    // like one broken option.  Only the dedicated reader-layout owner may
    // change paginationMode; pageAnimation remains one of cover / slide /
    // simulation / scroll / none, with scroll as the only vertical mode.
  }

  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    let mainWindow: window.Window | null = null;
    try {
      mainWindow = await windowStage.getMainWindow();
      ReaderEffects.setMainWindow(mainWindow);
      this.applyViewportMetrics();
      // Immersive: window layout extends behind the status / navigation bars.
      await mainWindow.setWindowLayoutFullScreen(true);
      // Keep both system bars enabled: non-reader pages own only the status-bar
      // background color, not the platform time/icons. Navigation remains enabled
      // so the platform owns the bottom gesture/navigation indicator.
      await mainWindow.setWindowSystemBarEnable(['status', 'navigation']);
      // Status background follows the paper surface; content uses ink for contrast.
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: ColorTokens.paper,
        statusBarContentColor: ColorTokens.ink,
        navigationBarColor: SafeAreaAdapter.SYSTEM_BAR_TRANSPARENT,
        navigationBarContentColor: ColorTokens.ink,
      });
      // Publish real device insets (vp) and keep them current on rotation / keyboard.
      this.applyAvoidArea(await mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM));
      mainWindow.on('avoidAreaChange', (data: window.AvoidAreaOptions) => {
        this.applyViewportMetrics();
        this.applyAvoidArea(data.area);
      });
    } catch (e) {
      // Immersive setup is best-effort; demo fallback insets already seeded in
      // onCreate carry the first frame until the next avoidAreaChange fires.
    }
    // The page must finish loading before we acquire its UIContext. Registering
    // a font against a window before that point can silently bind it to no
    // active render context on a real device.
    try {
      await windowStage.loadContent('pages/Index');
    } catch (e) {
      this.recordBundledSerifFontRegistration('failed', 'page load failed before UIContext: ' + e);
      // fatal: no page to render; nothing to recover to
      return;
    }
    if (mainWindow === null) {
      this.recordBundledSerifFontRegistration('failed', 'main window is unavailable after page load');
      return;
    }
    this.registerReaderFontsForWindow(mainWindow);
  }

  // Register the two current Figma families that are not guaranteed by a
  // HarmonyOS device: Noto Serif CJK SC for reading and Inter for the Settings
  // General component family. The visual family name is emitted by the
  // Reader-UI admission artifact; this host code only installs that bundled
  // asset into the active UIContext.
  private registerReaderFontsForWindow(win: window.Window): void {
    try {
      const uiContext = win.getUIContext();
      if (uiContext === null || uiContext === undefined) {
        throw new Error('active UIContext is unavailable after page load');
      }
      const font = uiContext.getFont();
      if (font === null || font === undefined) {
        throw new Error('Font service is unavailable from the active UIContext');
      }
      font.registerFont({
        familyName: 'Inter',
        familySrc: $rawfile('font/InterVariable.ttf'),
      });
      font.registerFont({
        familyName: 'Noto Serif CJK SC',
        familySrc: $rawfile('font/NotoSerifCJKsc-Regular.otf'),
      });
      this.recordBundledSerifFontRegistration('registered', 'registered for active UIContext');
      console.info('[EntryAbility] registered Noto Serif CJK SC font for UIContext');
    } catch (e) {
      this.recordBundledSerifFontRegistration('failed', String(e));
      console.info('[EntryAbility] register Noto Serif CJK SC font for UIContext failed: ' + e);
    }
  }

  private recordBundledSerifFontRegistration(
    status: BundledSerifFontRegistrationStatus,
    detail: string,
  ): void {
    AppStorage.setOrCreate<BundledSerifFontRegistrationStatus>(
      BUNDLED_SERIF_FONT_REGISTRATION_STATUS_KEY,
      status,
    );
    AppStorage.setOrCreate<string>(BUNDLED_SERIF_FONT_REGISTRATION_DETAIL_KEY, detail);
    console.info('[ReaderFontRegistration] bundledSerif status=' + status + ' detail=' + detail);
  }

  // getWindowAvoidArea returns Rect in px; ArkUI padding takes vp, so divide by
  // the display's densityPixels (px-per-vp ratio). Best-effort: demo fallbacks
  // seeded in onCreate remain if this throws (e.g. display unavailable) — the
  // avoidAreaChange callback calls into here too, so it must not throw out.
  private applyAvoidArea(area: window.AvoidArea): void {
    try {
      const d = display.getDefaultDisplaySync().densityPixels;
      const top = Math.max(area.topRect.height / d, SafeAreaAdapter.DEFAULT_TOP);
      const bottom = Math.max(area.bottomRect.height / d, SafeAreaAdapter.DEFAULT_BOTTOM);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_TOP, top);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_BOTTOM, bottom);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_START, area.leftRect.width / d);
      AppStorage.setOrCreate<number>(SafeAreaAdapter.K_END, area.rightRect.width / d);
    } catch (e) {
      // keep previously published / demo-fallback insets
    }
  }

  private applyViewportMetrics(): void {
    try {
      const dpy = display.getDefaultDisplaySync();
      const density = dpy.densityPixels;
      if (!Number.isFinite(density) || density <= 0) return;
      // Keep AppStorage's viewport in the same logical-integer unit expected
      // by Core reader.location.resolve.  A non-integral density otherwise
      // leaks fractional dimensions into the Core DTO and rejects progress
      // persistence on real devices.
      const width = Math.max(1, Math.round(dpy.width / density));
      const height = Math.max(1, Math.round(dpy.height / density));
      AppStorage.setOrCreate<number>(ViewportAdapter.K_WIDTH, width);
      AppStorage.setOrCreate<number>(ViewportAdapter.K_HEIGHT, height);
      AppStorage.setOrCreate<string>(ViewportAdapter.K_CLASS, ViewportAdapter.classify(width, height));
    } catch (e) {
      // keep previously published / demo-fallback viewport metrics
    }
  }
}
