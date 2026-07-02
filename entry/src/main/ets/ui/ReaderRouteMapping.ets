export class ReaderMainTab {
  static readonly bookshelf: string = 'bookshelf';
  static readonly discover: string = 'discover';
  static readonly rss: string = 'rss';
  static readonly settings: string = 'settings';

  static readonly all: string[] = [
    ReaderMainTab.bookshelf,
    ReaderMainTab.discover,
    ReaderMainTab.rss,
    ReaderMainTab.settings
  ];

  static label(tab: string): string {
    if (tab === ReaderMainTab.discover) {
      return '发现';
    }
    if (tab === ReaderMainTab.rss) {
      return 'RSS';
    }
    if (tab === ReaderMainTab.settings) {
      return '设置';
    }
    return '书架';
  }

  static indexOf(tab: string): number {
    for (let i = 0; i < ReaderMainTab.all.length; i++) {
      if (ReaderMainTab.all[i] === tab) {
        return i;
      }
    }
    return 0;
  }

  static at(index: number): string {
    if (index >= 0 && index < ReaderMainTab.all.length) {
      return ReaderMainTab.all[index];
    }
    return ReaderMainTab.bookshelf;
  }
}

export class ReaderRoute {
  static readonly bookshelf: string = 'bookshelf';
  static readonly discover: string = 'discover';
  static readonly rss: string = 'rss';
  static readonly settings: string = 'settings';
  static readonly search: string = 'search';
  static readonly immersiveReading: string = 'immersive-reading';
  static readonly readerControl: string = 'reader';
  static readonly tocBookmarks: string = 'toc-bookmarks';
  static readonly tts: string = 'tts';
  static readonly readerAppearance: string = 'reader-appearance';
  static readonly readerSettings: string = 'reader-settings';
  static readonly readerFullDirectory: string = 'reader-full-directory';
  static readonly readerFullTts: string = 'reader-full-tts';
  static readonly readerFullAppearance: string = 'reader-full-appearance';
  static readonly readerFullSettings: string = 'reader-full-settings';
  static readonly autoPage: string = 'auto-page';
  static readonly contentSearch: string = 'content-search';
  static readonly contentReplacement: string = 'content-replacement';
  static readonly readerBookCache: string = 'reader-book-cache';
  static readonly readerDebugInfo: string = 'reader-debug-info';
  static readonly sourceManagement: string = 'source-management';

  static rootForTab(tab: string): string {
    if (tab === ReaderMainTab.discover) {
      return ReaderRoute.discover;
    }
    if (tab === ReaderMainTab.rss) {
      return ReaderRoute.rss;
    }
    if (tab === ReaderMainTab.settings) {
      return ReaderRoute.settings;
    }
    return ReaderRoute.bookshelf;
  }

  static tabForRoute(route: string, fallbackTab: string): string {
    if (route === ReaderRoute.discover) {
      return ReaderMainTab.discover;
    }
    if (route === ReaderRoute.rss) {
      return ReaderMainTab.rss;
    }
    if (route === ReaderRoute.settings || route === ReaderRoute.sourceManagement) {
      return ReaderMainTab.settings;
    }
    if (route === ReaderRoute.bookshelf || route === ReaderRoute.search || route === ReaderRoute.immersiveReading) {
      return ReaderMainTab.bookshelf;
    }
    return fallbackTab;
  }

  static shellFor(route: string): string {
    if (ReaderRoute.isReaderRoute(route)) {
      return 'ReaderShell';
    }
    if (route === ReaderRoute.settings || route === ReaderRoute.sourceManagement) {
      return 'SettingsShell';
    }
    if (route === ReaderRoute.search) {
      return 'LibraryShell';
    }
    return 'MainTabShell';
  }

  static isMainTabRoute(route: string): boolean {
    return route === ReaderRoute.bookshelf ||
      route === ReaderRoute.discover ||
      route === ReaderRoute.rss ||
      route === ReaderRoute.settings;
  }

  static isReaderRoute(route: string): boolean {
    return route === ReaderRoute.immersiveReading ||
      route === ReaderRoute.readerControl ||
      route === ReaderRoute.tocBookmarks ||
      route === ReaderRoute.tts ||
      route === ReaderRoute.readerAppearance ||
      route === ReaderRoute.readerSettings ||
      route === ReaderRoute.readerFullDirectory ||
      route === ReaderRoute.readerFullTts ||
      route === ReaderRoute.readerFullAppearance ||
      route === ReaderRoute.readerFullSettings ||
      route === ReaderRoute.autoPage ||
      route === ReaderRoute.contentSearch ||
      route === ReaderRoute.contentReplacement ||
      route === ReaderRoute.readerBookCache ||
      route === ReaderRoute.readerDebugInfo;
  }

  static isReaderModuleRoute(route: string): boolean {
    return route === ReaderRoute.tocBookmarks ||
      route === ReaderRoute.tts ||
      route === ReaderRoute.readerAppearance ||
      route === ReaderRoute.readerSettings;
  }

  static isReaderFullRoute(route: string): boolean {
    return route === ReaderRoute.readerFullDirectory ||
      route === ReaderRoute.readerFullTts ||
      route === ReaderRoute.readerFullAppearance ||
      route === ReaderRoute.readerFullSettings;
  }

  static isReaderQuickRoute(route: string): boolean {
    return route === ReaderRoute.autoPage ||
      route === ReaderRoute.contentSearch ||
      route === ReaderRoute.contentReplacement;
  }

  static fullRouteForPresentation(route: string): string {
    if (route === ReaderRoute.tocBookmarks) {
      return ReaderRoute.readerFullDirectory;
    }
    if (route === ReaderRoute.tts) {
      return ReaderRoute.readerFullTts;
    }
    if (route === ReaderRoute.readerAppearance) {
      return ReaderRoute.readerFullAppearance;
    }
    if (route === ReaderRoute.readerSettings) {
      return ReaderRoute.readerFullSettings;
    }
    return ReaderRoute.readerFullSettings;
  }

  static compactRouteForFullRoute(route: string): string {
    if (route === ReaderRoute.readerFullDirectory) {
      return ReaderRoute.tocBookmarks;
    }
    if (route === ReaderRoute.readerFullTts) {
      return ReaderRoute.tts;
    }
    if (route === ReaderRoute.readerFullAppearance) {
      return ReaderRoute.readerAppearance;
    }
    if (route === ReaderRoute.readerFullSettings) {
      return ReaderRoute.readerSettings;
    }
    return ReaderRoute.readerControl;
  }

  static readerPresentationLabel(route: string): string {
    if (route === ReaderRoute.tocBookmarks || route === ReaderRoute.readerFullDirectory) {
      return '目录';
    }
    if (route === ReaderRoute.tts || route === ReaderRoute.readerFullTts) {
      return '朗读';
    }
    if (route === ReaderRoute.readerAppearance || route === ReaderRoute.readerFullAppearance) {
      return '界面';
    }
    if (route === ReaderRoute.readerSettings || route === ReaderRoute.readerFullSettings) {
      return '设置';
    }
    if (route === ReaderRoute.autoPage) {
      return '自动翻页';
    }
    if (route === ReaderRoute.contentSearch) {
      return '内容搜索';
    }
    if (route === ReaderRoute.contentReplacement) {
      return '内容替换';
    }
    if (route === ReaderRoute.readerBookCache) {
      return '书籍缓存';
    }
    if (route === ReaderRoute.readerDebugInfo) {
      return '调试信息';
    }
    if (route === ReaderRoute.readerControl) {
      return '控制';
    }
    return '沉浸阅读';
  }
}
