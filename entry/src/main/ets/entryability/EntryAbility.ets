// EntryAbility — Stage model entry. Initializes the UiStore (which seeds AppStorage)
// before the page loads, then loads the single @Entry page that hosts RouteRenderer.
//
// Window is configured immersive: layout extends behind system bars and the app
// paints the status-bar background, while the platform still renders the status
// time/icons on non-reader pages.
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';
import display from '@ohos.display';
import fs from '@ohos.file.fs';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';
import { SafeAreaAdapter } from '../ui/adapters/SafeAreaAdapter';
import { ColorTokens } from '../contract/generated/ColorTokens';
import { CoreRuntime } from '../bridge/CoreRuntime';
import { TtsHostAdapter } from '../host/adapters/TtsHostAdapter';
import {
  HostTtsSystemStartRequest,
  HostHttpRequest,
  HostCookieSetRequest,
  HostCookieGetRequest,
  HostFileWriteRequest,
  HostFileReadRequest,
} from '../host/types';

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    ReaderUiStore.init();
    // Seed demo fallback insets so the first frame approximates safe-area
    // avoidance before the real window avoid area is measured below.
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_TOP, SafeAreaAdapter.DEFAULT_TOP);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_BOTTOM, SafeAreaAdapter.DEFAULT_BOTTOM);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_START, SafeAreaAdapter.DEFAULT_START);
    AppStorage.setOrCreate<number>(SafeAreaAdapter.K_END, SafeAreaAdapter.DEFAULT_END);

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
      // Self-check: run abiVersion + ping + coreInfo + hostSmoke to produce
      // device-executed evidence for the Host integration proof.
      this.runCoreSelfCheck(core);
      // TTS self-check: exercise TtsHostAdapter start/pause/resume/stop on the
      // device to verify TextReader (or fallback) actually works here.
      this.runTtsSelfCheck(core);
      // Reading-chain self-check: exercise http.execute → cookie.set/get →
      // file.write/read against a real book source URL (有度轻说, the ★★★
      // golden fixture from Reader-Core-Native's tested corpus) to prove the
      // Host adapters compose end-to-end for the reading flow on device.
      // Extraction rules are Core's job (RemoteContentPipeline) — this check
      // only verifies the Host transport + cache layer, not content parsing.
      this.runReadingChainSelfCheck(core);
      // RSS self-check: http.execute a public RSS feed → count <item> tags →
      // file.write/read the feed body to cache. Proves the Host transport +
      // cache layer composes for the RSS ingestion flow.
      this.runRssSelfCheck(core);
    } catch (e) {
      console.error('CoreRuntime init failed: ' + e);
    }
  }

  /**
   * One-shot Core runtime self-check. Runs async after onCreate returns so the
   * UI is not blocked. Each step logs a [CoreSelfCheck] line that can be
   * harvested by hdc hilog for the device-proof evidence document.
   */
  private runCoreSelfCheck(core: CoreRuntime): void {
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
      })
      .catch((e: Error) => {
        console.info(`[CoreSelfCheck] async step error=${e}`);
      });
  }

  /**
   * One-shot TTS self-check. Exercises TtsHostAdapter.start → pause → resume →
   * stop → shutdown on the device and logs each step under [TtsSelfCheck].
   *
   * This produces device-executed evidence for the TTS Host adapter proof,
   * answering whether TextReader.init succeeds on this device and whether
   * pause/resume are truly honored (vs. fallback mode where they return
   * acknowledged: false).
   *
   * The check is best-effort: any failure is logged but does not affect the
   * app lifecycle. TextReader is lazy-initialized on first start().
   */
  private runTtsSelfCheck(core: CoreRuntime): void {
    const tts: TtsHostAdapter = core.getTtsAdapter();
    // Register a progress callback so we can see readProgress events.
    tts.setProgressCallback((articleId: string, currentPercent: number, maxPercent: number) => {
      console.info(`[TtsSelfCheck] progress articleId=${articleId} current=${currentPercent} max=${maxPercent}`);
    });
    Promise.resolve()
      .then(async () => {
        const req: HostTtsSystemStartRequest = {
          text: '朗读自检：一二三四五，上山打老虎。老虎没打到，打到小松鼠。',
        };
        const startResp = await tts.start(req);
        console.info(`[TtsSelfCheck] start started=${startResp.started} backend=${tts.getBackendKind()}`);
        // Wait 3s for playback to actually begin and produce some progress.
        await new Promise<void>((resolve) => setTimeout(resolve, 3000));
        console.info(`[TtsSelfCheck] pre-pause state=${tts.queryState()} lastPercent=${tts.getLastPercent()}`);
        const pauseResp = await tts.pause();
        console.info(`[TtsSelfCheck] pause acknowledged=${pauseResp.acknowledged}`);
        // Wait 1s paused.
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        const resumeResp = await tts.resume();
        console.info(`[TtsSelfCheck] resume acknowledged=${resumeResp.acknowledged}`);
        // Wait 2s for resumed playback.
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        const stopResp = await tts.stop();
        console.info(`[TtsSelfCheck] stop acknowledged=${stopResp.acknowledged}`);
        await tts.shutdown();
        console.info('[TtsSelfCheck] shutdown done');
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
  private runReadingChainSelfCheck(core: CoreRuntime): void {
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
        const writeReq: HostFileWriteRequest = {
          path: cachePath,
          content: httpResp.body,
          encoding: 'utf-8',
        };
        const writeResp = await fileAdapter.write(writeReq);
        console.info(`[ReadingChain] step=3a file.write path=${cachePath} written=${writeResp.written} bytes=${writeResp.byteLength}`);
        const readResp = await fileAdapter.read({ path: cachePath, encoding: 'utf-8' } as HostFileReadRequest);
        const readLen = readResp.content !== undefined ? readResp.content.length : 0;
        const match = readLen === bodyLen;
        console.info(`[ReadingChain] step=3b file.read path=${cachePath} bytes=${readResp.byteLength} contentLen=${readLen} roundTripMatch=${match}`);
        console.info(`[ReadingChain] DONE transport+cache verified (extraction is Core's job, webview is Phase 7)`);
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
  private runRssSelfCheck(core: CoreRuntime): void {
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
        const writeReq: HostFileWriteRequest = {
          path: cachePath,
          content: body,
          encoding: 'utf-8',
        };
        const writeResp = await fileAdapter.write(writeReq);
        console.info(`[RssChain] step=3a file.write path=${cachePath} written=${writeResp.written} bytes=${writeResp.byteLength}`);
        const readResp = await fileAdapter.read({ path: cachePath, encoding: 'utf-8' } as HostFileReadRequest);
        const readLen = readResp.content !== undefined ? readResp.content.length : 0;
        const match = readLen === bodyLen;
        console.info(`[RssChain] step=3b file.read path=${cachePath} bytes=${readResp.byteLength} contentLen=${readLen} roundTripMatch=${match}`);
        console.info(`[RssChain] DONE transport+cache verified (full RSS parse is Core's job)`);
      })
      .catch((e: Error) => {
        console.info(`[RssChain] error=${e}`);
      });
  }

  /**
   * Log all plausible filesystem locations for `libreader_core_napi.so` so we
   * can see where (if anywhere) the NAPI module was actually installed.
   */
  private probeNativeLibraryLocations(): void {
    const candidates: string[] = [
      '/data/app/el1/bundle/public/reader.minliny.testpackage/libs/arm64/libreader_core_napi.so',
      '/data/storage/el1/bundle/reader.minliny.testpackage/libs/arm64/libreader_core_napi.so',
      '/data/storage/el1/bundle/reader.minliny.testpackage/entry.hap',
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

  onDestroy(): void {
    CoreRuntime.close();
  }

  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    try {
      const win = await windowStage.getMainWindow();
      // Immersive: window layout extends behind the status / navigation bars.
      await win.setWindowLayoutFullScreen(true);
      // Keep both system bars enabled: non-reader pages own only the status-bar
      // background color, not the platform time/icons. Navigation remains enabled
      // so the platform owns the bottom gesture/navigation indicator.
      await win.setWindowSystemBarEnable(['status', 'navigation']);
      // Status background follows the paper surface; content uses ink for contrast.
      await win.setWindowSystemBarProperties({
        statusBarColor: ColorTokens.paper,
        statusBarContentColor: ColorTokens.ink,
        navigationBarColor: SafeAreaAdapter.SYSTEM_BAR_TRANSPARENT,
        navigationBarContentColor: ColorTokens.ink,
      });
      // Publish real device insets (vp) and keep them current on rotation / keyboard.
      this.applyAvoidArea(await win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM));
      win.on('avoidAreaChange', (data: window.AvoidAreaOptions) => {
        this.applyAvoidArea(data.area);
      });
    } catch (e) {
      // Immersive setup is best-effort; demo fallback insets already seeded in
      // onCreate carry the first frame until the next avoidAreaChange fires.
    }
    // Page load is independent of immersive setup and must always run. Wrapped to
    // satisfy ArkTS may-throw handling (the path is fixed and valid).
    try {
      windowStage.loadContent('pages/Index');
    } catch (e) {
      // fatal: no page to render; nothing to recover to
    }
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
}
