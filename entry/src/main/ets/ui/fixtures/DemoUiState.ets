// DemoUiState — Phase 1 demo initial state (from ui-state.fixtures.json).
// Opens directly to the bookshelf (cover-mode). firstOpen ceremony is Phase 2 polish.
import { ReaderUiState, ReplaceRule } from '../store/ReaderUiState';

export class DemoUiState {
  static initial(): ReaderUiState {
    return {
      routeId: 'bookshelf',
      tab: 'bookshelf',
      readerMode: 'default',
      paginationMode: 'horizontal',
      fontSize: 18,
      lineHeight: 1.96,
      paragraphGap: 16,
      letterSpacing: 0,
      fontFamily: 'serif',
      topMargin: 72,
      sideMargin: 32,
      bottomMargin: 16,
      paragraphIndent: 2,
      overlay: '',
      activeSession: '',
      focusTarget: '',
      loading: false,
      error: null,
      reducedMotion: false,
      pageState: 'cover-mode',
      firstOpenPlayed: true,
      stack: [{ id: 'bookshelf' }],
      searchQuery: '',
      searchResults: [],
      currentBook: null,
      chapterContent: [],
      // ── Batch 1 session/TTS/settings defaults ──
      ttsSession: {
        playback: 'idle',
        rate: 1.0,
        voice: '',
        scope: 'chapter',
        timer: 'off',
        currentSegment: 0,
        totalSegments: 0,
      },
      autoPageSession: {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: 5,
      },
      brightness: 80,
      brightnessAuto: false,
      tocMode: 'directory',
      readerToggles: {
        autoPage: false,
        volumePage: false,
        landscapeLock: false,
        keepScreenOn: false,
        statusInfo: true,
        hapticFeedback: true,
        cacheNext: true,
        hideStatusBar: false,
      },
      readerSettingOptions: {
        pageMode: 'horizontal',
        tapMode: '左右区域',
        pageAnimation: '平滑',
      },
      selection: {
        visible: false,
        action: '',
        selectedText: '',
      },
      // ── Batch 4 bookshelf/discover/source-switch defaults ──
      bookshelfFilter: {
        view: 'cover',
        group: 'all',
        sort: 'recent',
        filters: [],
      },
      discoverFilter: {
        filters: [],
        sort: 'popular',
      },
      sourceSelection: [],
      // ── B1 P0 全局设置默认值 ──
      appThemeMode: 'system',
      coverColumns: 3,
      settingsToggles: {
        autoCheckUpdate: true,
        tapBottomBarToTop: true,
        showUpdateBadge: true,
        mergeSameBooks: true,
        enableSearchHistory: true,
      },
      // ── F3 交互连接默认值 ──
      readerTheme: 'paper',
      readerSettingExpandedOption: '',
      autoPageMode: 'continuous',
      // ── P1.2 select/action 控件展开状态默认值 ──
      expandedOptionKey: '',
      // ── P1.3 WebDAV 配置默认值 ──
      webdavServerUrl: '',
      webdavUsername: '',
      webdavPassword: '',
      webdavSyncDir: '/reader/backup',
      webdavTestStatus: 'idle',
      webdavTestMessage: '',
      webdavSaveStatus: 'idle',
      webdavSaveMessage: '',
      // ── W1 资源导入预览默认值 ──
      importPreviewFormat: '',
      importPreviewCount: 0,
      // ── W5 规则替换默认值（demo 规则） ──
      replaceRules: [
        { id: 'rule-1', pattern: '雨容', replacement: '雨容（统一）', scope: 'chapter', enabled: true },
        { id: 'rule-2', pattern: '旧称', replacement: '新称', scope: 'book', enabled: true },
        { id: 'rule-3', pattern: '标点清理', replacement: '规范标点', scope: 'chapter', enabled: false },
        { id: 'rule-4', pattern: '广告', replacement: '', scope: 'book', enabled: true },
      ] as ReplaceRule[],
    };
  }
}
