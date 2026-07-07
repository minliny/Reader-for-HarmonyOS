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
import { HostTtsSystemStartRequest } from '../host/types';

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
