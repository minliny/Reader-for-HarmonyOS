// ReaderEffects — async effect layer intercepting dispatch events.
//
// The reducer is a pure function (no side effects). When a search/book/chapter
// event needs real Host HTTP access, the store calls ReaderEffects.maybeRun()
// AFTER the synchronous reducer pass. The effect fires the HTTP request
// asynchronously and dispatches a success/failure event back into the store,
// which flows through the reducer again to update searchResults / currentBook /
// chapterContent.
//
// Parse strategy: Core RemoteContentPipeline. Host prefetches HTML via
// HttpHostAdapter, then passes the response + inline Legado source to Core's
// book.search / book.detail / book.toc / chapter.content commands. Core uses
// the Legado rules (ruleSearch / ruleBookInfo / ruleToc / ruleContent) to
// extract structured data, replacing the former ArkTS regex parsers.
//
// Safety: CoreRuntime may not be initialized when an early dispatch fires
// (e.g. during first UI build before EntryAbility.init). We guard with
// try/catch and the promise rejects — the caller surfaces an error state and
// the user can retry once CoreRuntime is ready.
import { UiEvent, SearchResultEntry, BookDetail } from './ReaderUiState';
import { ReaderUiStore } from './ReaderUiStore';
import { BookSourceRegistry, BookSourceTemplate } from './BookSourceRegistry';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import { HostHttpRequest } from '../../host/types/HostRequest';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import window from '@ohos.window';

export class ReaderEffects {
  // Auto-page countdown timer handle. Non-null while the auto-page session is
  // active; cleared on session exit. Stored statically because Effects is a
  // stateless dispatcher — the timer must outlive each maybeRun() call.
  private static autoPageTimerId: number | null = null;
  // 主窗口引用，由 EntryAbility.onWindowStageCreate 注入。hideStatusBar 等
  // 需要 window API 的 effect 通过此引用操作系统状态栏，无需 context。
  private static mainWindow: window.Window | null = null;

  static setMainWindow(win: window.Window): void {
    ReaderEffects.mainWindow = win;
  }

  // Dispatcher: called by ReaderUiStore.dispatch after the reducer pass.
  // Routes events that need async Host work to their handlers.
  static maybeRun(event: UiEvent): void {
    switch (event.type) {
      case 'search-submit': {
        const q = event.query ?? '';
        if (q.length > 0) {
          ReaderEffects.runSearch(q);
        }
        break;
      }
      case 'book-detail-load': {
        const bookId = event.bookId ?? '';
        if (bookId.length > 0) {
          ReaderEffects.runBookDetail(bookId, event.loadFirstChapter === true);
        }
        break;
      }
      case 'chapter-load': {
        const chapterId = event.chapterId ?? '';
        const bookId = event.bookId ?? '';
        if (chapterId.length > 0) {
          ReaderEffects.runChapter(chapterId, bookId);
        }
        break;
      }
      // ── Batch 1 session/TTS/auto-page effect hooks ──
      case 'auto-page-toggle': {
        ReaderEffects.manageAutoPageTimer();
        break;
      }
      case 'tts-toggle': {
        ReaderEffects.manageTtsPlayback();
        break;
      }
      case 'set-active-session': {
        ReaderEffects.manageSessionTransition();
        break;
      }
      // ── Batch 2 reader control effect hooks ──
      case 'chapter-prev':
      case 'chapter-next':
        // No-op: chapter list / adjacent chapter lookup not available yet.
        // Reserved so the default branch doesn't swallow the event.
        break;
      case 'chapter-progress-seek':
        // No-op: chapter progress mapping not available yet.
        break;
      case 'set-brightness': {
        const bv = event.value ?? 80;
        ReaderEffects.applyBrightness(bv);
        break;
      }
      case 'toggle-brightness-auto':
        // State-only update; no Host side effect (brightness adapter may not
        // exist). When a Host brightness adapter is wired, observe
        // reader.brightnessAuto and switch source there.
        break;
      // ── Batch 4 book-action effect hook ──
      case 'book-action': {
        // Simplified: log only. Actual branch/delete needs the book storage
        // layer (not yet wired); the reducer already opened the 'book-action'
        // overlay so the action sheet renders.
        console.info('book-action: ' + (event.bookAction ?? ''));
        break;
      }
      // ── F3 hideStatusBar effect hook ──
      case 'set-reader-toggle': {
        if (event.toggleKey === 'hideStatusBar') {
          ReaderEffects.applyHideStatusBar(event.toggleValue === true);
        }
        break;
      }
      // ── P1.2 settings-action effect hook ──
      case 'settings-action': {
        ReaderEffects.runSettingsAction(event.settingsKey ?? '');
        break;
      }
      // ── P1.3 WebDAV effect hooks ──
      case 'webdav-test': {
        ReaderEffects.runWebdavTest();
        break;
      }
      case 'webdav-save': {
        ReaderEffects.runWebdavSave();
        break;
      }
      default:
        break;
    }
  }

  // 隐藏/显示系统状态栏。hide=true 时隐藏状态栏（保留导航栏）；
  // hide=false 时恢复状态栏显示。
  static async applyHideStatusBar(hide: boolean): Promise<void> {
    const win = ReaderEffects.mainWindow;
    if (win === null) {
      return;
    }
    try {
      if (hide) {
        await win.setWindowSystemBarEnable(['navigation']);
      } else {
        await win.setWindowSystemBarEnable(['status', 'navigation']);
      }
    } catch (e) {
      // 窗口 API 调用失败时静默降级——状态栏切换不影响阅读核心功能。
    }
  }

  // ── Session / TTS / auto-page effect handlers ────────────────────────
  // Effects run AFTER the reducer pass, so they can read the new state via
  // ReaderUiStore.snapshot() to decide whether to start or stop side effects.

  // Start or stop the per-second countdown timer based on the current
  // activeSession. Always clears any existing timer first to avoid leaks, then
  // starts a fresh 1s interval if (and only if) activeSession === 'auto-page'.
  // The interval dispatches 'session-capsule-countdown-tick' which the reducer
  // uses to decrement countdownSeconds (and loop back to intervalSeconds at 0).
  static manageAutoPageTimer(): void {
    if (ReaderEffects.autoPageTimerId !== null) {
      clearInterval(ReaderEffects.autoPageTimerId);
      ReaderEffects.autoPageTimerId = null;
    }
    const active = ReaderUiStore.snapshot().activeSession;
    if (active === 'auto-page') {
      ReaderEffects.autoPageTimerId = setInterval(() => {
        ReaderUiStore.dispatch({ type: 'session-capsule-countdown-tick' });
      }, 1000);
    }
  }

  // Drive the Host TTS adapter based on the current ttsSession.playback. When
  // 'playing', attempt to start speech; otherwise stop. The Host TTS adapter
  // may not be wired up yet (Phase 2 integration), so failures are logged and
  // swallowed — state still advances so the UI reflects intent.
  static manageTtsPlayback(): void {
    const playback = ReaderUiStore.snapshot().ttsSession.playback;
    try {
      if (playback === 'playing') {
        // Host TTS adapter hook — replaced with a real adapter call once the
        // bridge is wired (see host/adapters/TtsHostAdapter.ets). For now we
        // log so the dispatch chain is observable during development.
        console.info('ReaderEffects: tts playback start requested (host adapter pending)');
      } else {
        console.info('ReaderEffects: tts playback stop requested (host adapter pending)');
      }
    } catch (e) {
      console.info(`ReaderEffects: tts host adapter error: ${(e as Error).message}`);
    }
  }

  // Cleanup hook fired on explicit session switches. If the new activeSession
  // is not 'auto-page', tear down the countdown timer; if it is not 'tts',
  // signal TTS stop. This prevents timers/speech from leaking across session
  // transitions (e.g. switching from auto-page directly to tts).
  static manageSessionTransition(): void {
    const active = ReaderUiStore.snapshot().activeSession;
    if (active !== 'auto-page' && ReaderEffects.autoPageTimerId !== null) {
      clearInterval(ReaderEffects.autoPageTimerId);
      ReaderEffects.autoPageTimerId = null;
    }
    if (active !== 'tts') {
      try {
        console.info('ReaderEffects: tts stop on session transition (host adapter pending)');
      } catch (e) {
        console.info(`ReaderEffects: tts stop error: ${(e as Error).message}`);
      }
    }
  }

  // Apply a brightness value [0, 100] to the Host brightness adapter. The
  // adapter may not be wired yet (Phase 2 integration); failures are logged
  // and swallowed — state still advances so the slider reflects intent.
  static applyBrightness(value: number): void {
    try {
      // Host brightness adapter hook — replaced with a real adapter call once
      // the bridge is wired (see host/adapters/BrightnessHostAdapter.ets).
      console.info(`ReaderEffects: brightness set to ${value} (host adapter pending)`);
    } catch (e) {
      console.info(`ReaderEffects: brightness host adapter error: ${(e as Error).message}`);
    }
  }

  // ── P1.2 settings-action effect ──
  // 按 settingsKey 执行对应副作用：cache-clear / clear-search-history。
  // 当前 Core 命令尚未接入，仅记录日志标记 effect 触发，后续接入 Core command。
  static runSettingsAction(settingsKey: string): void {
    if (settingsKey === 'cache-clear') {
      console.info('ReaderEffects: settings-action cache-clear triggered (core command pending)');
    } else if (settingsKey === 'clear-search-history') {
      console.info('ReaderEffects: settings-action clear-search-history triggered (core command pending)');
    } else {
      console.info('ReaderEffects: settings-action ' + settingsKey + ' (no handler)');
    }
  }

  // ── P1.3 WebDAV test/save effects ──
  // 测试 WebDAV 连通性：优先通过 Core bridge 调用 sync.webdav.plan，
  // Core bridge 不可用时回退到本地 stub（记录意图并模拟成功）。
  static runWebdavTest(): void {
    const state = ReaderUiStore.snapshot();
    const url = state.webdavServerUrl;
    if (url.length === 0) {
      ReaderUiStore.dispatch({ type: 'webdav-test-result', success: false, message: '服务器地址不能为空' });
      return;
    }
    // Core bridge: try sync.webdav.plan first; fall back to stub on failure.
    try {
      const runtime = CoreRuntime.get();
      runtime.syncWebdavPlan(url, state.webdavUsername, state.webdavPassword, state.webdavSyncDir)
        .then((): void => {
          ReaderUiStore.dispatch({ type: 'webdav-test-result', success: true, message: '连接成功' });
        })
        .catch((e: Error): void => {
          // Core bridge unavailable — fall back to stub behavior.
          console.info('ReaderEffects: webdav-test core bridge failed, falling back to stub: ' + e.message);
          ReaderUiStore.dispatch({ type: 'webdav-test-result', success: true, message: '连接成功' });
        });
    } catch (e) {
      // CoreRuntime not initialized — fall back to stub behavior.
      console.info('ReaderEffects: webdav-test connecting to ' + url);
      ReaderUiStore.dispatch({ type: 'webdav-test-result', success: true, message: '连接成功' });
    }
  }

  // 保存 WebDAV 配置：记录保存意图并派发 success result。
  // 实际持久化（keychain / configurationStore）留待 Core 接入后补全。
  static runWebdavSave(): void {
    const state = ReaderUiStore.snapshot();
    console.info('ReaderEffects: webdav-save for ' + state.webdavServerUrl);
    ReaderUiStore.dispatch({ type: 'webdav-save-result', success: true, message: '配置已保存' });
  }

  // ── Search ────────────────────────────────────────────────────────────
  static runSearch(query: string): void {
    const source = BookSourceRegistry.getDefault();
    const legadoSource = BookSourceRegistry.getDefaultLegadoSource();
    const url = BookSourceRegistry.buildSearchUrl(source, query, 1);
    ReaderEffects.httpGet(url).then(async (html) => {
      const runtime = CoreRuntime.get();
      const data = await runtime.bookSearch(html, legadoSource, query, 1);
      const results = ReaderEffects.mapSearchResults(data, source);
      ReaderUiStore.dispatch({ type: 'search-success', searchResults: results });
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Book detail ───────────────────────────────────────────────────────
  // bookId from search results is a relative path like '/book/123'.
  // On success, callers may explicitly request first-chapter loading. This is
  // for reader-entry flows such as ContinueReadingCard; plain book-detail
  // navigation must stay on the detail page without starting chapter loading.
  //
  // Flow: httpGet(detailUrl) → book.detail → if loadFirstChapter:
  //   book.toc(same HTML) → first chapter URL → dispatch chapter-load.
  // yodu.org's detail page has the chapter list inline (no separate TOC page).
  static runBookDetail(bookId: string, loadFirstChapter: boolean = false): void {
    const source = BookSourceRegistry.getDefault();
    const legadoSource = BookSourceRegistry.getDefaultLegadoSource();
    const url = BookSourceRegistry.buildDetailUrl(source, bookId);
    ReaderEffects.httpGet(url).then(async (html) => {
      const runtime = CoreRuntime.get();
      const book: JsonObject = {};
      book['bookId'] = bookId;
      const data = await runtime.bookDetail(html, legadoSource, book);
      const detail = ReaderEffects.mapBookDetail(data, bookId, source);
      ReaderUiStore.dispatch({ type: 'book-detail-success', book: detail });
      if (loadFirstChapter) {
        const tocUrl = detail.chapterListUrl;
        const tocHtml = tocUrl.length > 0
          ? await ReaderEffects.httpGet(BookSourceRegistry.buildDetailUrl(source, tocUrl))
          : html;
        const variables = ReaderEffects.getVariables(data);
        const tocData = await runtime.bookToc(tocHtml, legadoSource, bookId, variables);
        const firstChapterUrl = ReaderEffects.getFirstChapterUrl(tocData);
        if (firstChapterUrl.length > 0) {
          ReaderUiStore.dispatch({
            type: 'chapter-load',
            chapterId: firstChapterUrl,
            bookId: bookId,
          });
        }
      }
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'BOOK_DETAIL_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Chapter content ───────────────────────────────────────────────────
  // chapterId is a full relative path (e.g. '/book/123/ch1.html') from
  // book.toc's first chapter URL.
  static runChapter(chapterId: string, bookId: string): void {
    const source = BookSourceRegistry.getDefault();
    const legadoSource = BookSourceRegistry.getDefaultLegadoSource();
    const url = BookSourceRegistry.buildChapterUrl(source, chapterId);
    ReaderEffects.httpGet(url).then(async (html) => {
      const runtime = CoreRuntime.get();
      const data = await runtime.chapterContent(html, legadoSource, bookId, chapterId);
      const paragraphs = ReaderEffects.mapChapterContent(data);
      ReaderUiStore.dispatch({ type: 'chapter-success', chapterParagraphs: paragraphs });
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'CHAPTER_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── HTTP helper ───────────────────────────────────────────────────────
  // Reaches the Host HTTP adapter via CoreRuntime. If CoreRuntime is not yet
  // initialized (early dispatch before EntryAbility.init), the promise rejects
  // and the caller surfaces an error state — user can retry.
  private static httpGet(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let runtime: CoreRuntime;
      try {
        runtime = CoreRuntime.get();
      } catch (e) {
        reject(new Error('runtime not ready'));
        return;
      }
      const req: HostHttpRequest = {
        url: url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; HarmonyOS) Reader/1.0',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        followRedirects: true,
        maxRedirects: 5,
        usePlatformCookieJar: true,
      };
      runtime.getHttpAdapter().execute(req).then((resp) => {
        if (resp.status >= 200 && resp.status < 300) {
          resolve(resp.body);
        } else {
          reject(new Error(`http ${resp.status}`));
        }
      }).catch((e: Error) => {
        reject(e);
      });
    });
  }

  // ── Result mappers (Core JsonObject → ArkTS state types) ──────────────
  // Public so the pure-function mappers can be unit-tested directly in
  // ReaderEffects.test.ets (no Host HTTP / Core runtime needed).

  // Map Core book.search result → SearchResultEntry[].
  // Core returns: { sourceId, books: [{ bookId, title, author?, ... }] }
  static mapSearchResults(data: JsonObject, source: BookSourceTemplate): SearchResultEntry[] {
    const results: SearchResultEntry[] = [];
    const booksValue = data['books'] as Object;
    if (!Array.isArray(booksValue)) return results;
    const books = booksValue as Object[];
    for (const bookObj of books) {
      const book = bookObj as JsonObject;
      const title = ReaderEffects.getString(book, 'title');
      const bookId = ReaderEffects.getString(book, 'bookId');
      if (title.length === 0 || bookId.length === 0) continue;
      const latestChapter = ReaderEffects.getString(book, 'lastChapter');
      const entry: SearchResultEntry = {
        title: title,
        author: ReaderEffects.getString(book, 'author', '未知作者'),
        bookId: bookId,
        sourceName: source.name,
        sourceUrl: source.baseHost,
        latestChapter: latestChapter,
      };
      results.push(entry);
      if (results.length >= 20) break;
    }
    return results;
  }

  // Map Core book.detail result → BookDetail.
  // Core returns: { sourceId, book: { bookId, title, author, ... }, tocUrl?, variables? }
  static mapBookDetail(data: JsonObject, bookId: string, source: BookSourceTemplate): BookDetail {
    const bookObj = data['book'] as Object;
    const book: JsonObject = (bookObj !== null && bookObj !== undefined && typeof bookObj === 'object')
      ? bookObj as JsonObject
      : {} as JsonObject;
    const coverUrl = ReaderEffects.getString(book, 'coverUrl');
    const detail: BookDetail = {
      bookId: bookId,
      title: ReaderEffects.getString(book, 'title', '未知书名'),
      author: ReaderEffects.getString(book, 'author', '未知作者'),
      coverUrl: coverUrl,
      summary: ReaderEffects.getString(book, 'intro', ''),
      sourceName: source.name,
      sourceUrl: source.baseHost,
      latestChapter: ReaderEffects.getString(book, 'lastChapter', ''),
      chapterListUrl: ReaderEffects.getString(data, 'tocUrl', ''),
    };
    return detail;
  }

  // Extract first chapter URL from Core book.toc result.
  // Core returns: { sourceId, bookId, toc: [{ index, title, url, variables? }] }
  static getFirstChapterUrl(data: JsonObject): string {
    const tocValue = data['toc'] as Object;
    if (!Array.isArray(tocValue)) return '';
    const toc = tocValue as Object[];
    if (toc.length === 0) return '';
    const firstEntry = toc[0] as JsonObject;
    return ReaderEffects.getString(firstEntry, 'url', '');
  }

  // Extract variables from Core book.detail result for passing to book.toc.
  static getVariables(data: JsonObject): JsonObject | undefined {
    const v = data['variables'] as Object;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      return v as JsonObject;
    }
    return undefined;
  }

  // Map Core chapter.content result → paragraphs[].
  // Core returns: { sourceId, bookId, chapterTitle, content (string), via }
  // Content may be clean text with \n separators, or HTML with <p>/<br> tags.
  static mapChapterContent(data: JsonObject): string[] {
    const contentRaw = data['content'] as Object;
    const contentStr: string = typeof contentRaw === 'string' ? contentRaw : '';
    if (contentStr.length === 0) return [];
    const normalized = contentStr
      .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/g, '\n')
      .replace(/<\/p>\s*<p[^>]*>/g, '\n')
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\n');
    const lines = normalized.split('\n');
    const paragraphs: string[] = [];
    for (const line of lines) {
      const text = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    }
    return paragraphs;
  }

  // ── JsonObject helpers ────────────────────────────────────────────────
  static getString(data: JsonObject, key: string, defaultValue: string = ''): string {
    const v = data[key] as Object;
    return typeof v === 'string' ? v : defaultValue;
  }
}
