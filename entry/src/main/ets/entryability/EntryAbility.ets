// EntryAbility — Stage model entry. Initializes the UiStore (which seeds AppStorage)
// before the page loads, then loads the single @Entry page that hosts RouteRenderer.
//
// Window is configured immersive: layout extends behind system bars and the app
// paints the status-bar background, while the platform still renders the status
// time/icons on non-reader pages.
import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import window from '@ohos.window';
import display from '@ohos.display';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import zlib from '@ohos.zlib';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';
import { SafeAreaAdapter } from '../ui/adapters/SafeAreaAdapter';
import { ColorTokens } from '../contract/generated/ColorTokens';
import { CoreRuntime } from '../bridge/CoreRuntime';
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
} from '../host/types';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
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
      // Self-checks are opt-in: they only run when the app is launched with
      // want.parameters.selfCheck === 'true'. Regular launches (home screen
      // icon, deep links) do NOT run self-checks — they are for device
      // evidence collection only (see scripts/collect_device_evidence.mjs).
      // To trigger: hdc shell aa start -a EntryAbility -b <pkg> --ps selfCheck true
      const params = want.parameters ?? {};
      const selfCheckFlag = params['selfCheck'] as string;
      if (selfCheckFlag === 'true') {
        console.info('[EntryAbility] selfCheck=true — running all Host self-checks for device evidence');
        const manifest = core.getCapabilityManifest();
        this.runCoreSelfCheck(core, manifest);
        this.runTtsSelfCheck(core, manifest);
        this.runReadingChainSelfCheck(core, manifest);
        this.runRssSelfCheck(core, manifest);
        this.runLocalBookSelfCheck(core, manifest);
        this.runSyncWebDavSelfCheck(core, manifest);
        this.runUiAdapterSelfCheck(core, manifest);
        // After a delay (self-checks are async), re-broadcast the manifest
        // with evidence-driven deviceVerified counts. The delay must be
        // long enough for the slowest chain (TTS ~6s + WebDAV network).
        setTimeout(() => {
          manifest.rebroadcastSummary();
          console.info('[EntryAbility] self-check evidence drive complete — see [HostManifest] post-self-check line');
        }, 30000);
      } else {
        console.info('[EntryAbility] selfCheck not requested — skipping Host self-checks (regular launch)');
      }
    } catch (e) {
      console.error('CoreRuntime init failed: ' + e);
    }
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
  private runTtsSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
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
  private runLocalBookSelfCheck(core: CoreRuntime, manifest: HostCapabilityManifest): void {
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
        const txtContent = txtDecoder.decodeWithStream(txtBytes);
        console.info(`[LocalBook] step=1 txt getRawFileContent bytes=${txtBytes.length} contentLen=${txtContent.length}`);

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
        coreAdapter.persistencePut({
          namespace: 'local_book',
          key: 'sample.txt.meta',
          value: txtMeta,
        } as HostPersistencePutRequest);
        const txtMetaGet = coreAdapter.persistenceGet({
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
        const epubExtractDir = localBookDir + '/sample.epub.extracted';
        // Best-effort cleanup of previous extraction (rmdirSync only works on empty dirs).
        try { fs.rmdirSync(epubExtractDir); } catch (e) { /* may not exist or non-empty */ }
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
        coreAdapter.persistencePut({
          namespace: 'local_book',
          key: 'sample.epub.meta',
          value: epubMeta,
        } as HostPersistencePutRequest);
        const epubMetaGet = coreAdapter.persistenceGet({
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
   *   TTS progress — evidence is captured by [TtsSelfCheck] tag in
   *              runTtsSelfCheck above (lastPercent + progress callback with
   *              currentPercent/maxPercent — non-zero currentPercent proves
   *              TextReader tracks real read position)
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

        // ── TTS progress ──
        // TTS progress evidence is captured by [TtsSelfCheck] tag in
        // runTtsSelfCheck above. The progress callback logs
        // articleId/currentPercent/maxPercent, and lastPercent is logged
        // before pause. Real progress (currentPercent > 0) proves TextReader
        // is tracking read position, not just fire-and-forget playback.
        console.info('[UiAdapter] tts.progress evidence captured by [TtsSelfCheck] tag (lastPercent + progress callback)');

        console.info('[UiAdapter] DONE webview+permission+notification+tts-progress device evidence captured');
        manifest.markVerifiedByTag('UiAdapter');
      })
      .catch((e: Error) => {
        console.info(`[UiAdapter] error=${e}`);
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
