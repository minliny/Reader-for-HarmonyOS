// ViewStateRenderer — renders generated ViewStateTable component trees.
// Shell-owned components (top bars / bottom nav) are filtered by ViewStateTable;
// this renderer owns body components and simple recursive container children.
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../../contract/generated/ViewStateTable';
import { AppTopBar, BackTopBar, BottomNav,
  DemoButton, DemoList, Card, FilterBar, Overlay } from './SharedComponents';
import { ContinueReadingCard, BookshelfShelfSection, BookshelfEmptyState, ShelfSectionHeader, BookCard, BookGrid, BookEntry } from './BookshelfComponents';
import { BookHero, BookSummaryCard, BookChapterList } from './BookDetailComponents';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones, ReaderBase, ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, DirectoryPanel, AppearancePanel,
  ReaderFullDirectoryPage, ReaderFullTtsPage, ReaderFullAppearancePage, ReaderFullSettingsPage, ReaderBookCachePage, ReaderDebugInfoPage,
  ReplacePanel, ReaderAutoScrollPanel, NightToast } from './ReaderOverlayComponents';
import { SourceImportPreviewPage, SourceGroupsPage, SourceDetectPage, SourceDebugPage,
  SourceDebugRunningPage, SourceDebugResultPage, SourceDebugContentLogPage, SourceCodeViewPage, SourceLogsPage,
  SourceDeleteConfirmPage, SourceRuleEditPage, SourceBatchPage } from './LibraryComponents';
import { SourceSwitchFlowPage } from './SourceSwitchFlowComponents';
import { SettingsHomeSection, SettingsHomePage, SettingsGeneralPage, BookshelfSearchSettingsPage, ProgressSyncPage, SettingsSection } from './SettingsComponents';
import { DiscoverSourceBar, DiscoverEntryRow, DiscoverFilterTrigger, DiscoverListHead, DiscoverBookList,
  DiscoverStatePage, DiscoverSourceBulkPage, DiscoverSourceLoginPage, DiscoverRuleTestPage } from './DiscoverComponents';
import { RssSearchEntry, RssModeRow, RssSourceOverview, RssArticleSection,
  RssAllPage, RssOriginalPage, RssRefreshingPage, RssOriginalBrowserPage,
  RssFavoritesUnavailablePage, RssFavoriteGroupsPage, RssSourceGroupsPage,
  RssSourceImportPage, RssSourceEditPage } from './RssComponents';
import { InteractionDebugBadge } from './InteractionDebugComponents';
import { AppShellStructure, MainTabsStructure, SearchHomePage, SearchResultsPage, SearchStatePage, BookTocPreviewPage,
  SourceManagementPage, SourceDetailPage, SourceImportOptionsPage, SourceDisabledState,
  SourceSettingsEntryPage, SourceTestResultPage, SyncSettingsEntryPage, SyncBackupPage,
  SyncErrorPage, SyncProgressPage, RestoreConfirmPage, RestoreProgressPage, RestoreConflictPage, RestoreResultPage,
  RemoteWebDavBooksPage, RssDetailPage, RssEmptyState, RssErrorState, GlobalStatePage,
  OfflineStatePage, PermissionRequiredPage, AboutVersionPage, AboutFeedbackPage, LocalBookImportPage, ReadingSettingsEntryPage,
  GlobalSettingsPage, BackupSettingsPage,
  RssSubscriptionManagementPage, RssSubscriptionDeleteConfirmPage, BookDirectoryPage } from './StructuralPageComponents';
import { BookTitleAuthor, SourceStatus, ReadButton, DirectoryPreview, BookIntro, ConfigEntry,
  SearchEntry, SourceTypeSegment, CurrentSourceCard, SourceCategoryChips, DiscoveryContentCard, SourceStatusBar,
  SubscriptionSummaryCard, FeedStatusChips, FeedSourceChips, RssEntryItem, UnreadIndicator,
  LocalOverviewCard, QuickEntryGrid } from './ContractComponents';
import { Contract25RoutePage } from './Contract25RouteComponents';
import {
  ReaderUiErrorTokens,
  ReaderUiWarmSurfaceTokens,
} from '../../contract/reader_ui/ReaderUiVisualTokenAdapter';
import {
  Slice12AccessibilitySettingsPage,
  Slice12OnboardingCapabilityPage,
  Slice12OnboardingWelcomePage,
  Slice12PermissionRecoveryPage,
} from './Slice12LifecycleComponents';
import { ReaderUIScreenGraphShadowRegistry } from '../router/ReaderUIScreenGraphShadowRegistry';
import {
  ReaderUIScreenGraphStatePrimitiveAdapter,
  ReaderUIScreenGraphStatePrimitiveProjection,
} from '../router/ReaderUIScreenGraphStatePrimitiveAdapter';
import { ReaderUIScreenGraphButtonAdapter } from '../router/ReaderUIScreenGraphButtonAdapter';
import { ReaderCapabilityClosureRouteRegistry } from '../router/ReaderCapabilityClosureRouteRegistry';
import {
  ReaderUIScreenGraphDialogAdapter,
  ReaderUIScreenGraphDialogProjection,
} from '../router/ReaderUIScreenGraphDialogAdapter';
import {
  ReaderUIScreenGraphContentAdapter,
  ReaderUIScreenGraphContentProjection,
} from '../router/ReaderUIScreenGraphContentAdapter';
import {
  ReaderUIScreenGraphEmptyAdapter,
  ReaderUIScreenGraphEmptyProjection,
} from '../router/ReaderUIScreenGraphEmptyAdapter';
import {
  ReaderUIScreenGraphErrorProjection,
  ReaderUIScreenGraphPermissionProjection,
  ReaderUIScreenGraphTerminalStateAdapter,
} from '../router/ReaderUIScreenGraphTerminalStateAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { UiEvent, CoreBookshelfBook } from '../store/ReaderUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import { ReaderUiVisualAdmission } from '../../contract/reader_ui/VisualAdmission';
import { ViewportAdapter } from '../adapters/ViewportAdapter';

@Component
export struct ViewStateRenderer {
  // Read reader.displayedRouteId (the motion-delayed value RouteRenderer uses
  // to pick the shell) — NOT reader.routeId (the immediate target). This keeps
  // shell + body in sync during route transitions (no mis-frame where the old
  // shell renders the new route body).
  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';
  @StorageProp('reader.pageState') pageState: string = 'default';
  @StorageProp('reader.coreSlice10Method') coreSlice10Method: string = '';
  @StorageProp('reader.coreSlice10Loading') coreSlice10Loading: boolean = false;
  @StorageProp('reader.coreSlice10Error') coreSlice10Error: string = '';
  @StorageProp('reader.lastUndoToken') lastUndoToken: ReaderUIJSONPayload | null = null;
  @StorageProp('reader.bookshelfLoaded') bookshelfLoaded: boolean = false;
  @StorageProp('reader.bookshelfBooks') bookshelfBooks: CoreBookshelfBook[] = [];
  @StorageProp('reader.continueReadingLoaded') continueReadingLoaded: boolean = false;
  @StorageProp('reader.continueReadingBook') continueReadingBook: CoreBookshelfBook | null = null;
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  // 'column' (default — scrollable pages) | 'stack' (reader layered body, where
  // components are absolutely positioned over the reading base rather than
  // laid out vertically).
  @Prop layoutMode: string = 'column';

  private statePrimitiveProjection(component: ViewStateComponent): ReaderUIScreenGraphStatePrimitiveProjection {
    const projection: ReaderUIScreenGraphStatePrimitiveProjection | null =
      ReaderUIScreenGraphStatePrimitiveAdapter.project(component);
    // Source gates prove the three canonical leaf shapes. Keep runtime drift
    // visibly inert rather than inventing text or an implicit action.
    return projection ?? new ReaderUIScreenGraphStatePrimitiveProjection('', '');
  }

  private statePrimitiveTitle(component: ViewStateComponent): string {
    return this.statePrimitiveProjection(component).title;
  }

  private statePrimitiveMessage(component: ViewStateComponent): string {
    return this.statePrimitiveProjection(component).message;
  }

  private statePrimitiveRetryEnabled(component: ViewStateComponent): boolean {
    return this.statePrimitiveProjection(component).retryEnabled;
  }

  // ReaderBase is a ScreenGraph 1.2 host-composite. Its children describe the
  // canonical anatomy and action metadata; they must never be recursively
  // instantiated alongside the native ReaderBase layers. Only the explicit
  // TapZones bindings cross this boundary.
  private readerBaseHasTapZones(component: ViewStateComponent): boolean {
    for (let index: number = 0; index < component.children.length; index += 1) {
      if (component.children[index].type === 'TapZones') return true;
    }
    return false;
  }

  private readerBaseTapZoneBindings(component: ViewStateComponent): ViewStateExplicitBinding[] {
    for (let index: number = 0; index < component.children.length; index += 1) {
      const child: ViewStateComponent = component.children[index];
      if (child.type === 'TapZones') return child.bindings;
    }
    return [];
  }

  // The canonical demo's rss-starred fixture reuses its visual article list,
  // but Core does not provide an RSS favorite projection.  Transform only
  // this runtime body node so a regeneration of the read-only Reader UI
  // fixture cannot accidentally display every Core article as a favorite.
  private bodyComponentsForCurrentRoute(): ViewStateComponent[] {
    // The generated Reader-UI visual admission artifact is the sole source of
    // truth for visible route eligibility. `isRouteAdmittedForViewport` returns
    // true ONLY for `implementation-ready` routes; `candidate-backport` routes
    // (source bound but not yet delivered) fail closed here too, mirroring
    // RouteRenderer's execution gate. This stops a body from rendering through
    // the generic ViewState tree before the page family is deliverable.
    if (!ReaderUiVisualAdmission.isRouteAdmittedForViewport(this.routeId, this.viewportClass)) return [];
    // A route master does not authorize arbitrary host page states. The
    // generated table historically falls back from an unknown loading/error
    // variant to the route default body, which can revive a generic local
    // screen above an otherwise current Figma route. `default` is the route
    // master itself; every other state needs an explicit Reader-UI/Figma
    // admission entry or remains visibly inert.
    if (this.pageState !== 'default' &&
      !ReaderUiVisualAdmission.isStateAdmitted(this.routeId, this.pageState)) return [];
    // Execute the canonical registry lookup/parity check at the body entry,
    // while retaining generated ViewStateTable as the native render source.
    ReaderUIScreenGraphShadowRegistry.observeViewState(
      this.routeId,
      this.pageState,
      ViewStateTable.componentsFor(this.routeId, this.pageState),
    );
    const components = ViewStateTable.bodyComponentsFor(this.routeId, this.pageState);
    // The canonical route currently aliases this screen to management. Do not
    // render that alias as a fake confirmation: the runtime has a live Core
    // target and an explicit confirm action for this exact route.
    if (this.routeId === 'rss-source-delete-confirm') {
      return [{
        type: 'RssSubscriptionDeleteConfirmPage',
        id: 'rss-subscription-delete-confirm-page',
        props: {},
        children: [],
        bindings: [],
      }];
    }
    if (this.routeId !== 'rss-starred') return components;
    const resolved: ViewStateComponent[] = [];
    for (const component of components) {
      if (component.type === 'RssArticleSection') {
        resolved.push({
          type: 'RssFavoritesUnavailablePage',
          id: component.id,
          props: component.props,
          children: component.children,
          bindings: component.bindings,
        });
      } else {
        resolved.push(component);
      }
    }
    return resolved;
  }

  build() {
    if (this.layoutMode === 'stack') {
      Stack() {
        ForEach(this.bodyComponentsForCurrentRoute(), (component: ViewStateComponent, idx: number) => {
          this.renderDebuggedComponent(component, true)
        }, (component: ViewStateComponent, idx: number) => `${component.id}-${component.type}-${idx}`)
      }
      .width('100%')
      .height('100%')
    } else {
      // column 模式：不设置 height，让内容 wrap content，这样 Shell 的 Scroll
      // 才能检测到内容溢出并启用滚动（设置 height('100%') 会让内容被限制为
      // 视口高度，无法溢出，Scroll 不滚动）。
      Column() {
        ForEach(this.bodyComponentsForCurrentRoute(), (component: ViewStateComponent, idx: number) => {
          Column() {
            this.renderDebuggedComponent(component, false)
          }
          .margin({ bottom: 8 })
        }, (component: ViewStateComponent, idx: number) => `${component.id}-${component.type}-${idx}`)
      }
      .width('100%')
    }
  }

  private textOr(value: string | undefined, fallback: string): string {
    return value !== undefined && value !== '' ? value : fallback;
  }

  private numOr(value: number | undefined, fallback: number): number {
    return value !== undefined ? value : fallback;
  }

  private capabilityClosureTitle(title: string | undefined, label: string | undefined,
    name: string | undefined, fallback: string): string {
    if (title !== undefined && title.length > 0) return title;
    if (label !== undefined && label.length > 0) return label;
    if (name !== undefined && name.length > 0) return name;
    return fallback;
  }

  private capabilityClosureDetail(summary: string | undefined, state: string | undefined,
    variant: string | undefined): string {
    if (summary !== undefined && summary.length > 0) return summary;
    if (state !== undefined && state.length > 0) return state;
    if (variant !== undefined && variant.length > 0) return variant;
    return 'planned · fail-closed';
  }

  // Button labels are data, not placeholder copy. Missing canonical text is
  // rendered visibly empty and remains inert through the adapter instead of
  // being replaced with an invented action label.
  private canonicalButtonLabel(component: ViewStateComponent): string {
    return component.props.label ?? '';
  }

  // Extract book rows from either a cover-grid or list-mode ViewState subtree.
  private extractBooks(children: ViewStateComponent[]): BookEntry[] {
    const books: BookEntry[] = [];
    for (const child of children) {
      if (child.type === 'BookCard') {
        const entry: BookEntry = {
          bookId: this.textOr(child.props.bookId, ''),
          title: this.textOr(child.props.title, '未命名'),
          author: this.textOr(child.props.author, '未知作者'),
          coverKey: this.textOr(child.props.coverKey, 'threeBody'),
        };
        books.push(entry);
      } else if (child.children.length > 0) {
        // Covers BookGrid -> BookCard and List -> ListRow recursively.
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
      this.renderDebuggedComponent(child, false)
    }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
  }

  // Canonical directory error/offline fixtures contain retry UiEvents whose
  // Host ownership is not proven. Preserve the state evidence, but render
  // action children as explicit read-only rows so this Shadow consumer cannot
  // expose an operation which the production reducer does not own.
  @Builder renderReadOnlyDirectoryState(phase: string, children: ViewStateComponent[]) {
    Column({ space: 12 }) {
      Text(`目录状态 · ${phase}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
        .width('100%')
      ForEach(children, (child: ViewStateComponent, idx: number) => {
        if (child.type === 'Button') {
          this.renderInertCanonicalButton(child)
        } else {
          this.renderDebuggedComponent(child, false)
        }
      }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
    }
    .width('100%')
    .padding(16)
    .borderRadius(18)
    .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
    .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
  }

  // Reader appearance management UiEvents are canonical contract evidence,
  // but the production reducer does not own those operations yet. Consume the
  // composed state recursively while making every tap action visibly read-only.
  @Builder renderReadOnlyAppearanceChildren(children: ViewStateComponent[]) {
    ForEach(children, (child: ViewStateComponent, idx: number) => {
      if (child.type === 'Button') {
        this.renderInertCanonicalButton(child)
      } else if (this.textOr(child.props.uiEventTrigger, '') === 'tap') {
        Text(`只读 · ${this.textOr(child.props.label, this.textOr(child.props.title, '操作未接线'))}`)
          .fontSize(13)
          .fontWeight(650)
          .fontColor(ReaderUiWarmSurfaceTokens.disabledText)
          .width('100%')
          .padding({ left: 12, right: 12, top: 9, bottom: 9 })
          .borderRadius(12)
          .backgroundColor(ReaderUiWarmSurfaceTokens.disabledSurface)
          .enabled(false)
          .hitTestBehavior(HitTestMode.None)
      } else if (child.type === 'Dialog') {
        // Keep all nine canonical Dialogs on the same dedicated renderer.
        // Their Button children still cross the fail-closed Button adapter.
        this.renderDebuggedComponent(child, false)
      } else if (child.children.length > 0) {
        Column({ space: 8 }) {
          Text(this.textOr(child.props.title, child.type))
            .fontSize(14)
            .fontWeight(800)
            .width('100%')
          if (this.textOr(child.props.message, '') !== '') {
            Text(this.textOr(child.props.message, ''))
              .fontSize(12)
              .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
              .width('100%')
          }
          this.renderReadOnlyAppearanceChildren(child.children)
        }
        .width('100%')
        .padding(12)
        .borderRadius(14)
        .backgroundColor(ReaderUiWarmSurfaceTokens.surfaceAlt)
        .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
      } else {
        this.renderDebuggedComponent(child, false)
      }
    }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
  }

  @Builder renderReadOnlyAppearanceState(section: string, children: ViewStateComponent[]) {
    Column({ space: 12 }) {
      Text(`外观状态 · ${section}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
        .width('100%')
      this.renderReadOnlyAppearanceChildren(children)
    }
    .width('100%')
    .padding(16)
    .borderRadius(18)
    .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
    .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
  }

  // Canonical replace flow actions mix pilot-owned and unsupported UiEvents.
  // The Shadow renderer must not guess payload or confirmation semantics, so
  // composed action children remain visible but non-interactive.
  @Builder renderReadOnlyReplaceChildren(children: ViewStateComponent[]) {
    ForEach(children, (child: ViewStateComponent, idx: number) => {
      if (child.type === 'Button') {
        this.renderCanonicalButton(
          child, this.canonicalButtonLabel(child), child.props.destructive === true,
        )
      } else if (this.textOr(child.props.uiEventTrigger, '') === 'tap') {
        Text(`只读 · ${this.textOr(child.props.label, this.textOr(child.props.title, '操作未接线'))}`)
          .fontSize(13)
          .fontWeight(650)
          .fontColor(ReaderUiWarmSurfaceTokens.disabledText)
          .width('100%')
          .padding({ left: 12, right: 12, top: 9, bottom: 9 })
          .borderRadius(12)
          .backgroundColor(ReaderUiWarmSurfaceTokens.disabledSurface)
          .enabled(false)
          .hitTestBehavior(HitTestMode.None)
      } else {
        this.renderDebuggedComponent(child, false)
      }
    }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
  }

  @Builder renderReadOnlyReplaceState(section: string, children: ViewStateComponent[]) {
    Column({ space: 12 }) {
      Text(`替换状态 · ${section}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
        .width('100%')
      this.renderReadOnlyReplaceChildren(children)
      if (section === 'apply') {
        Text(this.coreSlice10Method === 'replace.undo'
          ? (this.coreSlice10Loading ? 'Core 正在撤销…' :
            (this.coreSlice10Error.length > 0 ? this.coreSlice10Error : 'Core 撤销已完成'))
          : (this.lastUndoToken !== null ? 'Core 撤销令牌已就绪' : '尚无可用的 Core 撤销令牌'))
          .fontSize(11)
          .fontWeight(650)
          .fontColor(this.coreSlice10Error.length > 0 ? ReaderUiErrorTokens.errorTextStrong : ReaderUiWarmSurfaceTokens.secondaryText)
          .width('100%')
      }
    }
    .width('100%')
    .padding(16)
    .borderRadius(18)
    .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
    .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
  }

  // Canonical ReadingTextFlow fixtures carry state/font evidence but no
  // chapter paragraphs, content identity, pagination anchor, or TapZones.
  // Observe that evidence without replacing the Core-backed native text flow.
  @Builder renderReadOnlyReadingTextChildren(children: ViewStateComponent[]) {
    ForEach(children, (child: ViewStateComponent, idx: number) => {
      if (child.type === 'Button') {
        this.renderInertCanonicalButton(child)
      } else if (this.textOr(child.props.uiEventTrigger, '') === 'tap') {
        Text(`只读 · ${this.textOr(child.props.label, this.textOr(child.props.title, '操作未接线'))}`)
          .fontSize(13)
          .fontWeight(650)
          .fontColor(ReaderUiWarmSurfaceTokens.disabledText)
          .width('100%')
          .padding({ left: 12, right: 12, top: 9, bottom: 9 })
          .borderRadius(12)
          .backgroundColor(ReaderUiWarmSurfaceTokens.disabledSurface)
          .enabled(false)
          .hitTestBehavior(HitTestMode.None)
      } else {
        Column({ space: 6 }) {
          this.renderDebuggedComponent(child, false)
          if (this.textOr(child.props.uiEventTrigger, '') === 'state-evidence') {
            Text(`状态证据 · ${this.textOr(child.props.uiEvent, '未声明')}`)
              .fontSize(10)
              .fontWeight(650)
              .fontColor(ReaderUiWarmSurfaceTokens.disabledText)
              .width('100%')
              .enabled(false)
              .hitTestBehavior(HitTestMode.None)
          }
        }
        .width('100%')
      }
    }, (child: ViewStateComponent, idx: number) => `${child.id}-${child.type}-${idx}`)
  }

  @Builder renderReadOnlyReadingTextState(phase: string, children: ViewStateComponent[]) {
    Column({ space: 12 }) {
      Text(`正文状态 · ${phase}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
        .width('100%')
      this.renderReadOnlyReadingTextChildren(children)
    }
    .width('100%')
    .padding(16)
    .borderRadius(18)
    .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
    .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
  }

  @Builder renderReadingTextFlowMetadata(state: string, fontFamily: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReadingTextFlow()
      if (state !== '') {
        Text(`正文契约 · ${state}`)
          .fontSize(9)
          .fontWeight(700)
          .fontColor(ReaderUiWarmSurfaceTokens.onAccentText)
          .padding({ left: 6, right: 6, top: 2, bottom: 2 })
          .borderRadius(6)
          .backgroundColor(ReaderUiWarmSurfaceTokens.accent)
          .position({ x: 12, y: 26 })
          .enabled(false)
          .hitTestBehavior(HitTestMode.None)
      }
      if (fontFamily !== '') {
        Text(`字体契约 · ${fontFamily}`)
          .fontSize(9)
          .fontWeight(700)
          .fontColor(ReaderUiWarmSurfaceTokens.onAccentText)
          .padding({ left: 6, right: 6, top: 2, bottom: 2 })
          .borderRadius(6)
          .backgroundColor(ReaderUiWarmSurfaceTokens.accent)
          .position({ x: 12, y: 48 })
          .enabled(false)
          .hitTestBehavior(HitTestMode.None)
      }
    }
    .width('100%')
    .height('100%')
  }

  private debugTone(componentType: string): string {
    if (componentType.indexOf('Panel') >= 0 || componentType.indexOf('Sheet') >= 0 || componentType.indexOf('Overlay') >= 0) {
      return 'sheet';
    }
    if (componentType.indexOf('Button') >= 0 || componentType.indexOf('Nav') >= 0 || componentType.indexOf('Action') >= 0) {
      return 'action';
    }
    if (componentType.indexOf('Page') >= 0 || componentType.indexOf('Shell') >= 0) {
      return 'route';
    }
    return 'module';
  }

  /**
   * Explicit read-only ArkUI structure for Reader UI 3.0 capability closure.
   * Canonical props and child topology stay visible, while every generated
   * binding remains non-executable until a Host/reducer owner is admitted.
   */
  @Builder renderCapabilityClosureNode(component: ViewStateComponent,
    children: ViewStateComponent[], title: string, detail: string) {
    Column({ space: 7 }) {
      Text(title)
        .fontSize(14)
        .fontWeight(750)
        .fontColor(ReaderUiWarmSurfaceTokens.strongText)
        .width('100%')
      Text(`${component.type} · ${detail}`)
        .fontSize(11)
        .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
        .width('100%')
      if (component.bindings.length > 0) {
        Text(`${component.bindings.length} 个 planned action · fail-closed`)
          .fontSize(10)
          .fontWeight(700)
          .fontColor(ReaderUiErrorTokens.errorTextStrong)
          .width('100%')
      }
      if (children.length > 0) {
        this.renderChildren(children)
      }
    }
    .width('100%')
    .padding(12)
    .borderRadius(14)
    .backgroundColor(ReaderUiWarmSurfaceTokens.surfaceAlt)
    .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
    .enabled(false)
    .hitTestBehavior(HitTestMode.None)
  }

  @Builder renderCanonicalButton(component: ViewStateComponent, label: string,
    destructive: boolean) {
    if (ReaderUIScreenGraphButtonAdapter.event(
      this.routeId, this.pageState, component, ReaderUiStore.snapshot(),
    ) !== null) {
      DemoButton({ label: label, destructive: destructive })
        .onClick(() => {
          // Resolve again at tap time so a delayed click cannot reuse an event
          // after the displayed route/page-state or canonical component has changed.
          const event: UiEvent | null = ReaderUIScreenGraphButtonAdapter.event(
            this.routeId, this.pageState, component, ReaderUiStore.snapshot(),
          );
          if (event !== null) ReaderUiStore.dispatch(event);
        })
    } else {
      this.renderInertCanonicalButton(component)
    }
  }

  @Builder renderInertCanonicalButton(component: ViewStateComponent) {
    DemoButton({
      label: this.canonicalButtonLabel(component),
      destructive: component.props.destructive === true,
    })
      .enabled(false)
      .hitTestBehavior(HitTestMode.None)
  }

  @Builder renderCanonicalDialog(component: ViewStateComponent,
    projection: ReaderUIScreenGraphDialogProjection | null) {
    if (projection !== null) {
      Column({ space: 10 }) {
        Text(projection.title)
          .fontSize(20)
          .fontWeight(800)
          .width('100%')
        if (projection.message !== '') {
          Text(projection.message)
            .fontSize(14)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .width('100%')
        }
        if (projection.children.length > 0) {
          this.renderChildren(projection.children)
        }
      }
      .width('100%')
      .padding(16)
      .borderRadius(18)
      .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
      .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
    } else {
      Text(`Dialog 契约漂移 · ${component.id}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiErrorTokens.errorTextStrong)
        .width('100%')
        .padding(12)
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }

  @Builder renderCanonicalContent(component: ViewStateComponent,
    projection: ReaderUIScreenGraphContentProjection | null) {
    if (projection !== null) {
      Column({ space: 6 }) {
        Text(projection.title)
          .fontSize(16)
          .fontWeight(800)
          .fontColor(ReaderUiWarmSurfaceTokens.strongText)
          .width('100%')
        if (projection.message !== projection.title) {
          Text(projection.message)
            .fontSize(13)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .width('100%')
        }
      }
      .width('100%')
      .padding(12)
      .borderRadius(14)
      .backgroundColor(ReaderUiWarmSurfaceTokens.surfaceAlt)
      .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
    } else {
      Text(`Content 契约漂移 · ${component.id}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiErrorTokens.errorTextStrong)
        .width('100%')
        .padding(12)
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }

  @Builder renderCanonicalEmpty(component: ViewStateComponent,
    projection: ReaderUIScreenGraphEmptyProjection | null) {
    if (projection !== null) {
      Column({ space: 6 }) {
        Text(projection.title)
          .fontSize(16)
          .fontWeight(800)
          .fontColor(ReaderUiWarmSurfaceTokens.strongText)
          .textAlign(TextAlign.Center)
        if (projection.message !== projection.title) {
          Text(projection.message)
            .fontSize(13)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .textAlign(TextAlign.Center)
        }
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .padding(24)
    } else {
      Text(`Empty 契约漂移 · ${component.id}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiErrorTokens.errorTextStrong)
        .width('100%')
        .padding(12)
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }

  @Builder renderCanonicalError(component: ViewStateComponent,
    projection: ReaderUIScreenGraphErrorProjection | null) {
    if (projection !== null) {
      Column({ space: 8 }) {
        Text(projection.message)
          .fontSize(16)
          .fontWeight(800)
          .fontColor(ReaderUiWarmSurfaceTokens.strongText)
          .textAlign(TextAlign.Center)
        if (projection.retryable) {
          Text('可重试')
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .enabled(false)
            .hitTestBehavior(HitTestMode.None)
        }
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .padding(24)
    } else {
      Text(`Error 契约漂移 · ${component.id}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiErrorTokens.errorTextStrong)
        .width('100%')
        .padding(12)
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }

  @Builder renderCanonicalPermission(component: ViewStateComponent,
    projection: ReaderUIScreenGraphPermissionProjection | null) {
    if (projection !== null) {
      Column({ space: 8 }) {
        Text(projection.title)
          .fontSize(16)
          .fontWeight(800)
          .fontColor(ReaderUiWarmSurfaceTokens.strongText)
          .textAlign(TextAlign.Center)
        if (projection.message !== projection.title) {
          Text(projection.message)
            .fontSize(13)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .textAlign(TextAlign.Center)
        }
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .padding(24)
    } else {
      Text(`Permission 契约漂移 · ${component.id}`)
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ReaderUiErrorTokens.errorTextStrong)
        .width('100%')
        .padding(12)
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }

  @Builder renderDebuggedComponent(component: ViewStateComponent, fullFrame: boolean) {
    if (fullFrame) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.renderComponent(component)
        InteractionDebugBadge({ label: component.type, tone: this.debugTone(component.type) })
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    } else {
      Stack({ alignContent: Alignment.TopStart }) {
        this.renderComponent(component)
        InteractionDebugBadge({ label: component.type, tone: this.debugTone(component.type) })
      }
      .width('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }

  @Builder renderComponent(component: ViewStateComponent) {
    if (component.type === 'AppTopBar') {
      // The current Figma book-search master owns its header (including the
      // system-safe back affordance, input and submit action). Rendering the
      // generated legacy AppTopBar here would create a second header above it.
      if (this.routeId === 'book-search') {
        Column().width(0).height(0)
      } else {
        AppTopBar({ title: this.textOr(component.props.title, '') })
      }
    } else if (component.type === 'BackTopBar') {
      BackTopBar({ title: this.textOr(component.props.title, '') })
    } else if (component.type === 'BottomNav') {
      BottomNav({ selected: this.textOr(component.props.selected, '') })
    } else if (component.type === 'Loading' || component.type === 'Empty' ||
      component.type === 'ErrorState' || component.type === 'Offline') {
      // These old generated primitives have no component-level Figma master.
      // A route-state binding (for example the current Search five-state
      // master) must render through its dedicated admitted component below,
      // never by promoting a generic native loading, empty, error, or offline
      // card. StateHost likewise stays inert for this legacy primitive branch.
      Column().width(0).height(0)
    } else if (component.type === 'ContinueReadingCard') {
      if (this.bookshelfLoaded && this.bookshelfBooks.length > 0 &&
        this.continueReadingLoaded && this.continueReadingBook !== null) {
        // The Figma node only describes the populated visual. The actual
        // title, cover and resume point come from the Core progress record,
        // never from a fixture carried by the generated ViewState tree.
        ContinueReadingCard()
      }
    } else if (component.type === 'BookshelfShelfSection') {
      if (this.bookshelfLoaded) {
        BookshelfShelfSection({
          title: this.textOr(component.props.title, '我的书架'),
          books: this.extractBooks(component.children),
          viewMode: this.textOr(component.props.viewMode, 'cover'),
        })
      }
    } else if (component.type === 'BookHero') {
      BookHero()
    } else if (component.type === 'BookSummaryCard') {
      BookSummaryCard()
    } else if (component.type === 'BookChapterList') {
      BookChapterList()
    } else if (component.type === 'ReadingBackgroundLayer') {
      ReadingBackgroundLayer({ theme: this.textOr(component.props.theme, '') })
    } else if (component.type === 'ReadingTextFlow') {
      if (component.children.length > 0) {
        this.renderReadOnlyReadingTextState(
          this.textOr(component.props.phase, 'unknown'),
          component.children,
        )
      } else {
        this.renderReadingTextFlowMetadata(
          this.textOr(component.props.state, ''),
          this.textOr(component.props.fontFamily, ''),
        )
      }
    } else if (component.type === 'ReadingInfoLayer') {
      ReadingInfoLayer({
        chapterTitle: this.textOr(component.props.chapterTitle, ''),
        progress: this.numOr(component.props.progress, -1),
      })
    } else if (component.type === 'TapZones') {
      if (ReaderCapabilityClosureRouteRegistry.has(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        TapZones({
          contractBindingsDefined: true,
          contractBindings: component.bindings,
        })
      }
    } else if (component.type === 'ReaderBase') {
      if (ReaderCapabilityClosureRouteRegistry.has(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.documentKind, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.availability,
            component.props.executionOwner),
        )
      } else {
        ReaderBase({
          canonicalReadingSurface: this.textOr(component.props.surfaceContract, '') === 'canonical-reading-surface',
          tapZoneContractBindingsDefined: this.readerBaseHasTapZones(component),
          tapZoneContractBindings: this.readerBaseTapZoneBindings(component),
        })
      }
    } else if (component.type === 'ReaderTopArea') {
      if (ReaderCapabilityClosureRouteRegistry.has(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        ReaderTopArea()
      }
    } else if (component.type === 'ReaderBottomBar') {
      ReaderBottomBar()
    } else if (component.type === 'NightToast') {
      NightToast()
    } else if (component.type === 'SourceSwitchFlowPage') {
      // Source Switch owns its complete canonical window. Retired generated
      // state-matrix children are deliberately not consumed; they are not
      // retained behind a hidden presentation node.
      SourceSwitchFlowPage()
    } else if (component.type === 'SourceImportPreviewPage') {
      SourceImportPreviewPage()
    } else if (component.type === 'SourceGroupsPage') {
      SourceGroupsPage()
    } else if (component.type === 'SourceDetectPage') {
      SourceDetectPage()
    } else if (component.type === 'SourceDebugPage') {
      SourceDebugPage()
    } else if (component.type === 'SourceDebugRunningPage') {
      SourceDebugRunningPage()
    } else if (component.type === 'SourceDebugResultPage') {
      SourceDebugResultPage({ variant: this.textOr(component.props.variant, 'search') })
    } else if (component.type === 'SourceDebugContentLogPage') {
      SourceDebugContentLogPage()
    } else if (component.type === 'SourceCodeViewPage') {
      SourceCodeViewPage()
    } else if (component.type === 'SourceLogsPage') {
      SourceLogsPage()
    } else if (component.type === 'SourceDeleteConfirmPage') {
      SourceDeleteConfirmPage()
    } else if (component.type === 'SourceRuleEditPage') {
      SourceRuleEditPage({
        title: this.textOr(component.props.title, '规则编辑'),
        variant: this.textOr(component.props.variant, 'edit'),
      })
    } else if (component.type === 'SourceBatchPage') {
      SourceBatchPage()
    } else if (component.type === 'DirectoryPanel') {
      if (this.routeId === 'bookmarks-manager' &&
        ReaderCapabilityClosureRouteRegistry.isCoreBacked(this.routeId)) {
        // Ignore the canonical fixture row. The native panel renders only the
        // current book's Core bookmark projection and uses its real Core time
        // key for jump/delete confirmation.
        DirectoryPanel()
      } else if (ReaderCapabilityClosureRouteRegistry.isFailClosed(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else if (component.children.length > 0) {
        this.renderReadOnlyDirectoryState(
          this.textOr(component.props.phase, 'unknown'),
          component.children,
        )
      } else {
        // The normal directory surface stays on the existing native panel.
        DirectoryPanel()
      }
    } else if (component.type === 'AppearancePanel') {
      if (component.children.length > 0) {
        this.renderReadOnlyAppearanceState(
          this.textOr(component.props.section, 'appearance'),
          component.children,
        )
      } else {
        // The default surface remains the live native appearance panel.
        AppearancePanel()
      }
    } else if (component.type === 'ReaderFullDirectoryPage') {
      ReaderFullDirectoryPage()
    } else if (component.type === 'ReaderFullTtsPage') {
      ReaderFullTtsPage()
    } else if (component.type === 'ReaderFullAppearancePage') {
      ReaderFullAppearancePage()
    } else if (component.type === 'ReaderFullSettingsPage') {
      ReaderFullSettingsPage()
    } else if (component.type === 'ReaderBookCachePage') {
      if (component.children.length > 0) {
        // Canonical task/detail children may contain review fixtures. Keep
        // them behind the capability closure until a dedicated live owner
        // projects task state; only the childless reader-book-cache route
        // enters the native Core-backed page below.
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        ReaderBookCachePage()
      }
    } else if (component.type === 'ReaderDebugInfoPage') {
      ReaderDebugInfoPage()
    } else if (component.type === 'ReplacePanel') {
      if (ReaderCapabilityClosureRouteRegistry.has(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else if (component.children.length > 0) {
        this.renderReadOnlyReplaceState(
          this.textOr(component.props.section, 'replace'),
          component.children,
        )
      } else {
        // The default surface retains the production-owned native rule flow.
        ReplacePanel()
      }
    } else if (component.type === 'ReaderAutoScrollPanel') {
      ReaderAutoScrollPanel()
    } else if (component.type === 'SettingsHomeSection') {
      SettingsHomeSection()
    } else if (component.type === 'SettingsHomePage') {
      SettingsHomePage()
    } else if (component.type === 'SettingsGeneralPage') {
      if (this.routeId === 'settings-accessibility' &&
        ReaderCapabilityClosureRouteRegistry.isNativeBacked(this.routeId)) {
        Slice12AccessibilitySettingsPage()
      } else if (component.children.length > 0 &&
        ReaderCapabilityClosureRouteRegistry.isCoreBacked(this.routeId)) {
        Column({ space: 8 }) {
          this.renderChildren(component.children)
        }
        .width('100%')
      } else if (component.children.length > 0) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        SettingsGeneralPage({ variant: this.textOr(component.props.variant, 'general') })
      }
    } else if (component.type === 'BookshelfSearchSettingsPage') {
      BookshelfSearchSettingsPage()
    } else if (component.type === 'ProgressSyncPage') {
      ProgressSyncPage()
    } else if (component.type === 'SettingsSection') {
      if (component.children.length > 0) {
        Column() {
          this.renderChildren(component.children)
        }
        .width('100%')
      } else {
        SettingsSection({ title: this.textOr(component.props.title, '') })
      }
    } else if (component.type === 'SettingsListItem') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
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
    } else if (component.type === 'DiscoverStatePage') {
      DiscoverStatePage({
        variant: this.textOr(component.props.variant, 'empty'),
        title: this.textOr(component.props.title, '当前没有启用发现的书源'),
        message: this.textOr(component.props.message, '启用发现后，可以在这里浏览书源提供的排行榜、分类和书单。'),
        action: this.textOr(component.props.action, ''),
      })
    } else if (component.type === 'DiscoverSourceBulkPage') {
      DiscoverSourceBulkPage()
    } else if (component.type === 'DiscoverSourceLoginPage') {
      DiscoverSourceLoginPage()
    } else if (component.type === 'DiscoverRuleTestPage') {
      DiscoverRuleTestPage()
    } else if (component.type === 'RssSearchEntry') {
      RssSearchEntry()
    } else if (component.type === 'RssModeRow') {
      RssModeRow()
    } else if (component.type === 'RssSourceOverview') {
      RssSourceOverview()
    } else if (component.type === 'RssArticleSection') {
      RssArticleSection()
    } else if (component.type === 'RssFavoritesUnavailablePage') {
      RssFavoritesUnavailablePage()
    } else if (component.type === 'RssAllPage') {
      RssAllPage()
    } else if (component.type === 'RssOriginalPage') {
      RssOriginalPage()
    } else if (component.type === 'RssRefreshingPage') {
      RssRefreshingPage()
    } else if (component.type === 'RssOriginalBrowserPage') {
      RssOriginalBrowserPage()
    } else if (component.type === 'RssFavoriteGroupsPage') {
      RssFavoriteGroupsPage()
    } else if (component.type === 'RssSourceGroupsPage') {
      RssSourceGroupsPage()
    } else if (component.type === 'RssSourceImportPage') {
      RssSourceImportPage({ message: this.textOr(component.props.message, '从 OPML 或 URL 导入。') })
    } else if (component.type === 'RssSourceEditPage') {
      RssSourceEditPage({ mode: this.textOr(component.props.mode, 'edit') })
    } else if (component.type === 'AppShellStructure') {
      if (this.routeId === 'onboarding-welcome' &&
        ReaderCapabilityClosureRouteRegistry.isNativeBacked(this.routeId)) {
        Slice12OnboardingWelcomePage()
      } else if (component.children.length > 0) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        AppShellStructure({
          title: this.textOr(component.props.title, 'Reader for Android'),
          message: this.textOr(component.props.message, '统一承载书架、发现、RSS、设置与阅读页入口。'),
        })
      }
    } else if (component.type === 'MainTabsStructure') {
      MainTabsStructure({
        title: this.textOr(component.props.title, '主导航'),
        message: this.textOr(component.props.message, '底部四项：书架、发现、RSS、设置。'),
      })
    } else if (component.type === 'SearchHomePage') {
      SearchHomePage()
    } else if (component.type === 'SearchResultsPage' &&
      ReaderCapabilityClosureRouteRegistry.isFailClosed(this.routeId)) {
      // Cover search currently shares the visual component type but has no
      // production search/apply contract. Keep that route unavailable before
      // entering the real Core book-search projection below.
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'SearchResultsPage') {
      SearchResultsPage()
    } else if (component.type === 'SearchStatePage') {
      SearchStatePage({ variant: this.textOr(component.props.variant, 'empty') })
    } else if (component.type === 'BookTocPreviewPage') {
      BookTocPreviewPage({ title: this.textOr(component.props.title, '目录预览') })
    } else if (component.type === 'BookshelfEmptyPage') {
      // Current Figma State/BookshelfEmpty (286:31) owns this route. The old
      // generic StatePanel route was a local substitute and is intentionally
      // bypassed in favor of the canonical component.
      BookshelfEmptyState()
    } else if (component.type === 'RssSubscriptionDeleteConfirmPage') {
      RssSubscriptionDeleteConfirmPage()
    } else if (component.type === 'BookDirectoryPage') {
      BookDirectoryPage()
    } else if (component.type === 'SourceManagementPage') {
      SourceManagementPage({ title: this.textOr(component.props.title, '书源管理') })
    } else if (component.type === 'SourceDetailPage') {
      SourceDetailPage({ title: this.textOr(component.props.title, '阅读书源 1') })
    } else if (component.type === 'SourceImportOptionsPage') {
      SourceImportOptionsPage({ title: this.textOr(component.props.title, '导入书源') })
    } else if (component.type === 'SourceDisabledState') {
      SourceDisabledState({
        title: this.textOr(component.props.title, '书源已停用'),
        message: this.textOr(component.props.message, '该书源 disabled / error，请在书源详情中修复。'),
        action: this.textOr(component.props.action, '查看详情'),
      })
    } else if (component.type === 'SourceFormPage') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'SourceSettingsEntryPage') {
      SourceSettingsEntryPage()
    } else if (component.type === 'SourceTestResultPage') {
      SourceTestResultPage({ title: this.textOr(component.props.title, '测试结果') })
    } else if (component.type === 'SyncSettingsEntryPage') {
      SyncSettingsEntryPage({ title: this.textOr(component.props.title, '同步设置') })
    } else if (component.type === 'SyncBackupPage') {
      SyncBackupPage({ variant: this.textOr(component.props.variant, 'default') })
    } else if (component.type === 'GlobalSettingsPage') {
      if (component.children.length > 0) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        GlobalSettingsPage({ title: this.textOr(component.props.title, '设置入口') })
      }
    } else if (component.type === 'BackupSettingsPage') {
      BackupSettingsPage({ title: this.textOr(component.props.title, '备份') })
    } else if (component.type === 'SyncErrorPage') {
      SyncErrorPage({
        title: this.textOr(component.props.title, '同步操作未完成'),
        message: this.textOr(component.props.message, '请返回同步页查看 Core 与 Host 返回的具体错误。'),
      })
    } else if (component.type === 'SyncProgressPage') {
      SyncProgressPage()
    } else if (component.type === 'RestoreConfirmPage') {
      RestoreConfirmPage({ variant: this.textOr(component.props.variant, 'default') })
    } else if (component.type === 'RestoreProgressPage') {
      RestoreProgressPage({ variant: this.textOr(component.props.variant, 'default') })
    } else if (component.type === 'RestoreConflictPage') {
      RestoreConflictPage()
    } else if (component.type === 'RestoreResultPage') {
      RestoreResultPage()
    } else if (component.type === 'RemoteWebDavBooksPage') {
      RemoteWebDavBooksPage({ title: this.textOr(component.props.title, '远端书籍') })
    } else if (component.type === 'RssDetailPage') {
      RssDetailPage()
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
    } else if (component.type === 'RssSubscriptionManagementPage') {
      RssSubscriptionManagementPage({ title: this.textOr(component.props.title, '订阅源') })
    } else if (component.type === 'GlobalStatePage') {
      if (component.children.length > 0) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        GlobalStatePage({
          variant: this.textOr(component.props.variant, 'empty'),
          title: this.textOr(component.props.title, '暂无内容'),
          message: this.textOr(component.props.message, ''),
          action: this.textOr(component.props.action, ''),
        })
      }
    } else if (component.type === 'OfflineStatePage') {
      OfflineStatePage({
        title: this.textOr(component.props.title, '当前离线'),
        message: this.textOr(component.props.message, '检查网络后再继续同步或搜索。'),
      })
    } else if (component.type === 'Permission') {
      this.renderCanonicalPermission(
        component, ReaderUIScreenGraphTerminalStateAdapter.projectPermission(component),
      )
    } else if (component.type === 'PermissionRequiredPage') {
      if (this.routeId === 'onboarding-capability-setup' &&
        ReaderCapabilityClosureRouteRegistry.isNativeBacked(this.routeId)) {
        Slice12OnboardingCapabilityPage()
      } else if (this.routeId === 'permission-recovery' &&
        ReaderCapabilityClosureRouteRegistry.isNativeBacked(this.routeId)) {
        Slice12PermissionRecoveryPage()
      } else if (component.children.length > 0) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        PermissionRequiredPage({
          title: this.textOr(component.props.title, '需要权限'),
          message: this.textOr(component.props.message, '授予存储或通知权限后才能继续。'),
          action: this.textOr(component.props.action, '去授权'),
        })
      }
    } else if (component.type === 'AboutVersionPage') {
      AboutVersionPage()
    } else if (component.type === 'AboutFeedbackPage') {
      AboutFeedbackPage()
    } else if (component.type === 'LocalBookImportPage') {
      // The standalone local-import route was retired in favor of the
      // revision-bound in-place dialog. This historical component remains a
      // contract mapping only for the separate, currently blocked
      // local-format-support capability route.
      if (this.routeId === 'local-format-support') {
        if (component.children.length > 0) {
          this.renderCapabilityClosureNode(
            component,
            component.children,
            this.capabilityClosureTitle(component.props.title, component.props.label,
              component.props.name, component.type),
            this.capabilityClosureDetail(component.props.summary, component.props.state,
              component.props.variant),
          )
        } else {
          LocalBookImportPage({ title: this.textOr(component.props.title, '本地导入') })
        }
      }
    } else if (component.type === 'ReadingSettingsEntryPage') {
      ReadingSettingsEntryPage({ title: this.textOr(component.props.title, '阅读设置') })
    } else if (component.type === 'Contract25RoutePage') {
      Contract25RoutePage({ routeId: this.textOr(component.props.contractRouteId, '') })
    } else if (component.type === 'Dialog') {
      this.renderCanonicalDialog(component, ReaderUIScreenGraphDialogAdapter.project(component))
    } else if (component.type === 'FloatingPageControl') {
      Row() {
        Text(this.textOr(component.props.title, '阅读边界'))
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ReaderUiWarmSurfaceTokens.onAccentText)
      }
      .padding({ left: 14, right: 14, top: 9, bottom: 9 })
      .borderRadius(20)
      .backgroundColor(ReaderUiWarmSurfaceTokens.strongText)
    } else if (component.type === 'Toast') {
      Column({ space: 6 }) {
        Text(this.textOr(component.props.title, '状态提示'))
          .fontSize(14)
          .fontWeight(750)
          .width('100%')
        if (this.textOr(component.props.message, '') !== '') {
          Text(this.textOr(component.props.message, ''))
            .fontSize(12)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .width('100%')
        }
        if (component.children.length > 0) {
          this.renderChildren(component.children)
        }
      }
      .width('100%')
      .padding(12)
      .borderRadius(14)
      .backgroundColor(ReaderUiWarmSurfaceTokens.surfaceAlt)
      .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
    } else if (component.type === 'Button') {
      this.renderCanonicalButton(
        component,
        this.canonicalButtonLabel(component),
        component.props.destructive === true,
      )
    } else if (component.type === 'Input') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'ListRow') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'List') {
      if (ReaderCapabilityClosureRouteRegistry.isFailClosed(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else if (component.children.length > 0) {
        Column() {
          Text(this.textOr(component.props.title, '列表'))
            .fontSize(14)
            .fontWeight(800)
            .width('100%')
          if (this.textOr(component.props.message, '') !== '') {
            Text(this.textOr(component.props.message, ''))
              .fontSize(12)
              .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
              .width('100%')
          }
          this.renderChildren(component.children)
        }
        .width('100%')
      } else {
        Column() {
          Text(this.textOr(component.props.title, '列表'))
            .fontSize(14)
            .fontWeight(800)
            .width('100%')
          if (this.textOr(component.props.message, '') !== '') {
            Text(this.textOr(component.props.message, ''))
              .fontSize(12)
              .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
              .width('100%')
          }
          DemoList()
        }
        .width('100%')
      }
    } else if (component.type === 'Card') {
      Card({ title: this.textOr(component.props.title, '卡片标题'), subtitle: this.textOr(component.props.subtitle, '卡片摘要') })
    } else if (component.type === 'Content') {
      if (ReaderCapabilityClosureRouteRegistry.has(this.routeId)) {
        this.renderCapabilityClosureNode(
          component,
          component.children,
          this.capabilityClosureTitle(component.props.title, component.props.label,
            component.props.name, component.type),
          this.capabilityClosureDetail(component.props.summary, component.props.state,
            component.props.variant),
        )
      } else {
        this.renderCanonicalContent(component, ReaderUIScreenGraphContentAdapter.project(component))
      }
    } else if (component.type === 'FormSection') {
      Column({ space: 8 }) {
        Text(this.textOr(component.props.title, '表单分组'))
          .fontSize(14)
          .fontWeight(800)
          .width('100%')
        if (this.textOr(component.props.message, '') !== '') {
          Text(this.textOr(component.props.message, ''))
            .fontSize(12)
            .fontColor(ReaderUiWarmSurfaceTokens.secondaryText)
            .width('100%')
        }
        if (component.children.length > 0) {
          this.renderChildren(component.children)
        }
      }
      .width('100%')
      .padding(12)
      .borderRadius(14)
      .backgroundColor(ReaderUiWarmSurfaceTokens.surface)
      .border({ width: 1, color: ReaderUiWarmSurfaceTokens.border })
    } else if (component.type === 'FilterBar') {
      FilterBar()
    } else if (component.type === 'Overlay') {
      Overlay()
    } else if (component.type === 'Error') {
      this.renderCanonicalError(component, ReaderUIScreenGraphTerminalStateAdapter.projectError(component))
    } else if (component.type === 'ShelfSectionHeader') {
      ShelfSectionHeader({ title: this.textOr(component.props.title, '我的书架') })
    } else if (component.type === 'BookCard') {
      BookCard({
        bookId: this.textOr(component.props.bookId, ''),
        title: this.textOr(component.props.title, '长夜余火'),
        author: this.textOr(component.props.author, '爱潜水的乌贼'),
        coverKey: this.textOr(component.props.coverKey, 'longNight'),
      })
    } else if (component.type === 'BookCover') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'BookGrid') {
      BookGrid({
        books: this.extractBooks(component.children),
        viewMode: this.textOr(component.props.viewMode, 'cover'),
      })
    } else if (component.type === 'ProgressBar') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'Toggle') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'Slider') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'Dropdown') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
    } else if (component.type === 'WebView') {
      this.renderCapabilityClosureNode(
        component,
        component.children,
        this.capabilityClosureTitle(component.props.title, component.props.label,
          component.props.name, component.type),
        this.capabilityClosureDetail(component.props.summary, component.props.state,
          component.props.variant),
      )
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
      // The generated legacy graph splits one Figma Search page into four
      // generic fragments. Mount the exact current Figma page once, and keep
      // the remaining historical fragments inert below instead of drawing a
      // second visual hierarchy.
      if (this.routeId === 'book-search') {
        SearchHomePage()
      } else {
        Column().width(0).height(0)
      }
    } else if (component.type === 'ScopeSelector' || component.type === 'GroupSelector' ||
      component.type === 'SearchHistoryList') {
      Column().width(0).height(0)
    } else {
      // Unknown component types have no current Figma visual authority. Keep
      // them strictly inert instead of drawing a local diagnostic card into a
      // user-facing page; contract diagnostics belong to developer evidence,
      // not to the shipped visual hierarchy.
      Column().width(0).height(0)
    }
  }
}
