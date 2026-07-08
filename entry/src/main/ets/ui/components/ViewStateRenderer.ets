// ViewStateRenderer — renders generated ViewStateTable component trees.
// Shell-owned components (top bars / bottom nav) are filtered by ViewStateTable;
// this renderer owns body components and simple recursive container children.
import { ViewStateComponent, ViewStateTable } from '../../contract/generated/ViewStateTable';
import { AppTopBar, BackTopBar, BottomNav, Loading, Empty, ErrorState, Offline,
  DemoButton, Input, ListRow, DemoList, Card, Content, FormSection, FilterBar, Overlay } from './SharedComponents';
import { ContinueReadingCard, BookshelfShelfSection, ShelfChipGroup, ShelfSectionHeader, BookCard, BookCover, BookGrid, BookEntry } from './BookshelfComponents';
import { BookHero, BookSummaryCard, BookChapterList } from './BookDetailComponents';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones, ReaderBase } from './ReaderComponents';
import { ReaderBottomBar, ReaderDirectoryPanel, ReaderAppearancePanel, ReaderTtsPanel, ReaderSettingsPanel, ReaderSearchPanel, ReaderReplacePanel, ReaderAutoScrollPanel, FloatingQuickActions, FloatingPageControl, FloatingBrightness, NightToast } from './ReaderOverlayComponents';
import { SourceSwitchResultsPanel } from './LibraryComponents';
import { SettingsHomeSection, SettingsSection, SettingsListItem } from './SettingsComponents';
import { DiscoverSourceBar, DiscoverEntryRow, DiscoverFilterTrigger, DiscoverListHead, DiscoverBookList } from './DiscoverComponents';
import { RssSearchEntry, RssModeRow, RssSourceOverview, RssArticleSection } from './RssComponents';
import { AppShellStructure, MainTabsStructure, SearchHomePage, SearchResultsPage, SearchStatePage, BookTocPreviewPage,
  BookshelfEmptyPage, SourceManagementPage, SourceDetailPage, SourceImportOptionsPage, SourceDisabledState,
  SourceSettingsEntryPage, SourceTestResultPage, WebDavConfigPage, SyncSettingsEntryPage, SyncErrorPage,
  SyncProgressPage, RemoteWebDavBooksPage, RssDetailPage, RssEmptyState, RssErrorState, GlobalStatePage,
  OfflineStatePage, PermissionRequiredPage, AboutVersionPage, LocalBookImportPage, ReadingSettingsEntryPage } from './StructuralPageComponents';
import { ProgressBar, BookTitleAuthor, SourceStatus, ReadButton, DirectoryPreview, BookIntro, ConfigEntry,
  SearchEntry, SourceTypeSegment, CurrentSourceCard, SourceCategoryChips, DiscoveryContentCard, SourceStatusBar,
  SubscriptionSummaryCard, FeedStatusChips, FeedSourceChips, RssEntryItem, UnreadIndicator,
  LocalOverviewCard, QuickEntryGrid, SearchInputBox, ScopeSelector, GroupSelector, SearchHistoryList } from './ContractComponents';

@Component
export struct ViewStateRenderer {
  // Read reader.displayedRouteId (the motion-delayed value RouteRenderer uses
  // to pick the shell) — NOT reader.routeId (the immediate target). This keeps
  // shell + body in sync during route transitions (no mis-frame where the old
  // shell renders the new route body).
  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';
  @StorageProp('reader.pageState') pageState: string = 'default';
  // 'column' (default — scrollable pages) | 'stack' (reader layered body, where
  // components are absolutely positioned over the reading base rather than
  // laid out vertically).
  @Prop layoutMode: string = 'column';

  build() {
    if (this.layoutMode === 'stack') {
      Stack() {
        ForEach(ViewStateTable.bodyComponentsFor(this.routeId, this.pageState), (component: ViewStateComponent, idx: number) => {
          this.renderComponent(component)
        }, (component: ViewStateComponent, idx: number) => `${component.id}-${component.type}-${idx}`)
      }
      .width('100%')
      .height('100%')
    } else {
      Column() {
        ForEach(ViewStateTable.bodyComponentsFor(this.routeId, this.pageState), (component: ViewStateComponent, idx: number) => {
          Column() {
            this.renderComponent(component)
          }
          .margin({ bottom: 8 })
        }, (component: ViewStateComponent, idx: number) => `${component.id}-${component.type}-${idx}`)
      }
      .width('100%')
      .height('100%')
    }
  }

  private textOr(value: string | undefined, fallback: string): string {
    return value !== undefined && value !== '' ? value : fallback;
  }

  private numOr(value: number | undefined, fallback: number): number {
    return value !== undefined ? value : fallback;
  }

  // Extract BookEntry[] from a BookGrid's children (BookCard ViewStateComponents).
  // Recurses into BookshelfShelfSection children to find the nested BookGrid.
  private extractBooks(children: ViewStateComponent[]): BookEntry[] {
    const books: BookEntry[] = [];
    for (const child of children) {
      if (child.type === 'BookCard') {
        const entry: BookEntry = {
          bookId: this.textOr(child.props.bookId, ''),
          title: this.textOr(child.props.title, '未命名'),
          author: this.textOr(child.props.author, '未知作者'),
        };
        books.push(entry);
      } else if (child.type === 'BookGrid' && child.children.length > 0) {
        // BookGrid's children are BookCard entries — extract them.
        const nested = this.extractBooks(child.children);
        for (const n of nested) {
          books.push(n);
        }
      }
    }
    return books;
  }

  @Builder renderChildren(children: ViewStateComponent[]) {
    ForEach(children, (child: ViewStateComponent, idx: number) => {
      this.renderComponent(child)
    }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
  }

  @Builder renderComponent(component: ViewStateComponent) {
    if (component.type === 'AppTopBar') {
      AppTopBar()
    } else if (component.type === 'BackTopBar') {
      BackTopBar()
    } else if (component.type === 'BottomNav') {
      BottomNav()
    } else if (component.type === 'Loading') {
      Loading()
    } else if (component.type === 'Empty') {
      Empty({ message: this.textOr(component.props.message, '书架为空') })
    } else if (component.type === 'ErrorState') {
      ErrorState()
    } else if (component.type === 'Offline') {
      Offline()
    } else if (component.type === 'ContinueReadingCard') {
      ContinueReadingCard({ bookId: this.textOr(component.props.bookId, ''), title: this.textOr(component.props.title, '示例书'), author: this.textOr(component.props.author, '示例作者') })
    } else if (component.type === 'BookshelfShelfSection') {
      BookshelfShelfSection({ title: this.textOr(component.props.title, '我的书架'), books: this.extractBooks(component.children) })
    } else if (component.type === 'BookHero') {
      BookHero()
    } else if (component.type === 'BookSummaryCard') {
      BookSummaryCard()
    } else if (component.type === 'BookChapterList') {
      BookChapterList()
    } else if (component.type === 'ReadingBackgroundLayer') {
      ReadingBackgroundLayer()
    } else if (component.type === 'ReadingTextFlow') {
      ReadingTextFlow()
    } else if (component.type === 'ReadingInfoLayer') {
      ReadingInfoLayer()
    } else if (component.type === 'TapZones') {
      TapZones()
    } else if (component.type === 'ReaderBase') {
      ReaderBase({ theme: this.textOr(component.props.theme, 'paper') })
    } else if (component.type === 'ReaderBottomBar') {
      ReaderBottomBar()
    } else if (component.type === 'FloatingQuickActions') {
      FloatingQuickActions()
    } else if (component.type === 'FloatingPageControl') {
      FloatingPageControl()
    } else if (component.type === 'FloatingBrightness') {
      FloatingBrightness()
    } else if (component.type === 'NightToast') {
      NightToast()
    } else if (component.type === 'SourceSwitchResultsPanel') {
      SourceSwitchResultsPanel()
    } else if (component.type === 'ReaderDirectoryPanel') {
      ReaderDirectoryPanel()
    } else if (component.type === 'ReaderAppearancePanel') {
      ReaderAppearancePanel()
    } else if (component.type === 'ReaderTtsPanel') {
      ReaderTtsPanel()
    } else if (component.type === 'ReaderSettingsPanel') {
      ReaderSettingsPanel()
    } else if (component.type === 'ReaderSearchPanel') {
      ReaderSearchPanel()
    } else if (component.type === 'ReaderReplacePanel') {
      ReaderReplacePanel()
    } else if (component.type === 'ReaderAutoScrollPanel') {
      ReaderAutoScrollPanel()
    } else if (component.type === 'SettingsHomeSection') {
      SettingsHomeSection()
    } else if (component.type === 'SettingsSection') {
      SettingsSection()
    } else if (component.type === 'SettingsListItem') {
      SettingsListItem()
    } else if (component.type === 'DiscoverSourceBar') {
      DiscoverSourceBar()
    } else if (component.type === 'DiscoverEntryRow') {
      DiscoverEntryRow()
    } else if (component.type === 'DiscoverFilterTrigger') {
      DiscoverFilterTrigger()
    } else if (component.type === 'DiscoverListHead') {
      DiscoverListHead()
    } else if (component.type === 'DiscoverBookList') {
      DiscoverBookList()
    } else if (component.type === 'RssSearchEntry') {
      RssSearchEntry()
    } else if (component.type === 'RssModeRow') {
      RssModeRow()
    } else if (component.type === 'RssSourceOverview') {
      RssSourceOverview()
    } else if (component.type === 'RssArticleSection') {
      RssArticleSection()
    } else if (component.type === 'AppShellStructure') {
      AppShellStructure({
        title: this.textOr(component.props.title, 'Reader for Android'),
        message: this.textOr(component.props.message, '统一承载书架、发现、RSS、设置与阅读页入口。'),
      })
    } else if (component.type === 'MainTabsStructure') {
      MainTabsStructure({
        title: this.textOr(component.props.title, '主导航'),
        message: this.textOr(component.props.message, '底部四项：书架、发现、RSS、设置。'),
      })
    } else if (component.type === 'SearchHomePage') {
      SearchHomePage({ placeholder: this.textOr(component.props.placeholder, '搜索书名/作者') })
    } else if (component.type === 'SearchResultsPage') {
      SearchResultsPage({ query: this.textOr(component.props.query, '深空信号') })
    } else if (component.type === 'SearchStatePage') {
      SearchStatePage({
        variant: this.textOr(component.props.variant, 'empty'),
        title: this.textOr(component.props.title, '暂无结果'),
        message: this.textOr(component.props.message, '换个关键词后重试。'),
        action: this.textOr(component.props.action, ''),
      })
    } else if (component.type === 'BookTocPreviewPage') {
      BookTocPreviewPage()
    } else if (component.type === 'BookshelfEmptyPage') {
      BookshelfEmptyPage({
        title: this.textOr(component.props.title, '书架为空'),
        message: this.textOr(component.props.message, '导入本地书籍或从书源搜索后加入书架。'),
      })
    } else if (component.type === 'SourceManagementPage') {
      SourceManagementPage()
    } else if (component.type === 'SourceDetailPage') {
      SourceDetailPage({ title: this.textOr(component.props.title, '阅读书源 1') })
    } else if (component.type === 'SourceImportOptionsPage') {
      SourceImportOptionsPage()
    } else if (component.type === 'SourceDisabledState') {
      SourceDisabledState({
        title: this.textOr(component.props.title, '书源已停用'),
        message: this.textOr(component.props.message, '该书源 disabled / error，请在书源详情中修复。'),
        action: this.textOr(component.props.action, '查看详情'),
      })
    } else if (component.type === 'SourceSettingsEntryPage') {
      SourceSettingsEntryPage()
    } else if (component.type === 'SourceTestResultPage') {
      SourceTestResultPage()
    } else if (component.type === 'WebDavConfigPage') {
      WebDavConfigPage()
    } else if (component.type === 'SyncSettingsEntryPage') {
      SyncSettingsEntryPage()
    } else if (component.type === 'SyncErrorPage') {
      SyncErrorPage({
        title: this.textOr(component.props.title, '同步冲突'),
        message: this.textOr(component.props.message, '本地与云端版本不一致，请选择处理方式。'),
      })
    } else if (component.type === 'SyncProgressPage') {
      SyncProgressPage({
        title: this.textOr(component.props.title, '同步中'),
        progress: this.numOr(component.props.progress, 0.64),
      })
    } else if (component.type === 'RemoteWebDavBooksPage') {
      RemoteWebDavBooksPage()
    } else if (component.type === 'RssDetailPage') {
      RssDetailPage({ title: this.textOr(component.props.title, 'AI 周报：端侧模型更新') })
    } else if (component.type === 'RssEmptyState') {
      RssEmptyState({
        title: this.textOr(component.props.title, '暂无订阅'),
        message: this.textOr(component.props.message, '添加 RSS 源后会在这里显示最新文章。'),
        action: this.textOr(component.props.action, '添加订阅'),
      })
    } else if (component.type === 'RssErrorState') {
      RssErrorState({
        title: this.textOr(component.props.title, '刷新失败'),
        message: this.textOr(component.props.message, '订阅源暂时无法访问。'),
        action: this.textOr(component.props.action, '重试'),
      })
    } else if (component.type === 'GlobalStatePage') {
      GlobalStatePage({
        variant: this.textOr(component.props.variant, 'empty'),
        title: this.textOr(component.props.title, '暂无内容'),
        message: this.textOr(component.props.message, ''),
        action: this.textOr(component.props.action, ''),
      })
    } else if (component.type === 'OfflineStatePage') {
      OfflineStatePage({
        title: this.textOr(component.props.title, '当前离线'),
        message: this.textOr(component.props.message, '检查网络后再继续同步或搜索。'),
      })
    } else if (component.type === 'PermissionRequiredPage') {
      PermissionRequiredPage({
        title: this.textOr(component.props.title, '需要权限'),
        message: this.textOr(component.props.message, '授予存储或通知权限后才能继续。'),
        action: this.textOr(component.props.action, '去授权'),
      })
    } else if (component.type === 'AboutVersionPage') {
      AboutVersionPage({
        title: this.textOr(component.props.title, 'Reader'),
        version: this.textOr(component.props.version, '0.1.0'),
      })
    } else if (component.type === 'LocalBookImportPage') {
      LocalBookImportPage()
    } else if (component.type === 'ReadingSettingsEntryPage') {
      ReadingSettingsEntryPage()
    } else if (component.type === 'Button') {
      DemoButton({ label: this.textOr(component.props.label, '操作'), destructive: component.props.destructive === true })
    } else if (component.type === 'Input') {
      Input({ placeholder: this.textOr(component.props.placeholder, '输入...') })
    } else if (component.type === 'ListRow') {
      ListRow({ title: this.textOr(component.props.title, '列表项') })
    } else if (component.type === 'List') {
      if (component.children.length > 0) {
        Column() {
          this.renderChildren(component.children)
        }
        .width('100%')
      } else {
        DemoList()
      }
    } else if (component.type === 'Card') {
      Card({ title: this.textOr(component.props.title, '卡片标题'), subtitle: this.textOr(component.props.author, '卡片摘要') })
    } else if (component.type === 'Content') {
      Content({ text: this.textOr(component.props.message, '正文内容') })
    } else if (component.type === 'FormSection') {
      FormSection({ title: this.textOr(component.props.title, '表单分组') })
    } else if (component.type === 'FilterBar') {
      FilterBar()
    } else if (component.type === 'Overlay') {
      Overlay()
    } else if (component.type === 'Error') {
      ErrorState()
    } else if (component.type === 'ShelfChipGroup') {
      ShelfChipGroup()
    } else if (component.type === 'ShelfSectionHeader') {
      ShelfSectionHeader({ title: this.textOr(component.props.title, '我的书架') })
    } else if (component.type === 'BookCard') {
      BookCard({ bookId: this.textOr(component.props.bookId, ''), title: this.textOr(component.props.title, '三体'), author: this.textOr(component.props.author, '刘慈欣') })
    } else if (component.type === 'BookCover') {
      BookCover()
    } else if (component.type === 'BookGrid') {
      BookGrid({ books: this.extractBooks(component.children) })
    } else if (component.type === 'ProgressBar') {
      ProgressBar({ progress: this.numOr(component.props.progress, 0.42) })
    } else if (component.type === 'BookTitleAuthor') {
      BookTitleAuthor({ title: this.textOr(component.props.title, '三体'), author: this.textOr(component.props.author, '刘慈欣') })
    } else if (component.type === 'SourceStatus') {
      SourceStatus()
    } else if (component.type === 'ReadButton') {
      ReadButton({ label: this.textOr(component.props.label, '开始阅读') })
    } else if (component.type === 'DirectoryPreview') {
      DirectoryPreview()
    } else if (component.type === 'BookIntro') {
      BookIntro()
    } else if (component.type === 'ConfigEntry') {
      ConfigEntry()
    } else if (component.type === 'SearchEntry') {
      SearchEntry()
    } else if (component.type === 'SourceTypeSegment') {
      SourceTypeSegment()
    } else if (component.type === 'CurrentSourceCard') {
      CurrentSourceCard()
    } else if (component.type === 'SourceCategoryChips') {
      SourceCategoryChips()
    } else if (component.type === 'DiscoveryContentCard') {
      DiscoveryContentCard()
    } else if (component.type === 'SourceStatusBar') {
      SourceStatusBar()
    } else if (component.type === 'SubscriptionSummaryCard') {
      SubscriptionSummaryCard({ sources: this.numOr(component.props.sources, 25), unread: this.numOr(component.props.unread, 28) })
    } else if (component.type === 'FeedStatusChips') {
      FeedStatusChips()
    } else if (component.type === 'FeedSourceChips') {
      FeedSourceChips()
    } else if (component.type === 'RssEntryItem') {
      RssEntryItem({ title: this.textOr(component.props.title, 'AI 周报') })
    } else if (component.type === 'UnreadIndicator') {
      UnreadIndicator()
    } else if (component.type === 'LocalOverviewCard') {
      LocalOverviewCard()
    } else if (component.type === 'QuickEntryGrid') {
      QuickEntryGrid()
    } else if (component.type === 'SearchInputBox') {
      SearchInputBox({ query: this.textOr(component.props.query, ''), placeholder: this.textOr(component.props.placeholder, '搜索书名/作者') })
    } else if (component.type === 'ScopeSelector') {
      ScopeSelector()
    } else if (component.type === 'GroupSelector') {
      GroupSelector()
    } else if (component.type === 'SearchHistoryList') {
      SearchHistoryList()
    } else {
      Empty()
    }
  }
}
