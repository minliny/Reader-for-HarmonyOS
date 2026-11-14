// Component-only DEBUG fixture. It never creates a Runtime/Host, opens a
// picker/Web surface or consumes user records. Bundled production fonts and
// real WindowCoordinator metrics are deliberately shared with the actor.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { SourceManagementPage } from '../features/source/ui/SourceManagementPage';
import type { BookSource } from '../features/source/application/SourceGateway';
import type { SourceManagementProjection } from '../features/source/application/SourceOrchestrator';
import type { SourceManagementViewState } from '../features/source/presentation/SourceJourneyPresentation';
import { prepareReaderFonts } from '../ui/foundation/ReaderFonts';
import { ReaderPageState } from '../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import { readerWindowMetrics } from '../ui/foundation/ReaderWindowEnvironment';
import { readerContentSafeTop, readerInteractiveSafeBottom } from '../ui/foundation/ReaderWindowMetrics';
import { projectPersistedReceipt } from '../app/ReaderPersistedReceiptProjection';
import { projectCommitReadback, projectOperationFacts } from '../app/ReaderOperationFacts';
import { ReaderDirectoryStructureFixture } from './ReaderDirectoryStructureFixture';
import { ReaderDownloadStructureFixture } from './ReaderDownloadStructureFixture';
import { ReaderSourceToolsStructureFixture } from './ReaderSourceToolsStructureFixture';
import { ReaderGroupRecoveryStructureFixture } from './ReaderGroupRecoveryStructureFixture';
import { ReaderFrameworkGeometryStructureFixture } from './ReaderFrameworkGeometryStructureFixture';
import { ReaderLegacyBookmarkRecoveryStructureFixture } from './ReaderLegacyBookmarkRecoveryStructureFixture';

interface SourceManagementFilterState {
  searchQuery: string;
  statusValue: string;
  categoryValue: string;
  groupValue: string;
}

function defaultSourceManagementFilters(): SourceManagementFilterState {
  return { searchQuery: '', statusValue: '全部', categoryValue: 'all', groupValue: '全部分组' };
}

type PageStructureFixtureScene = 'menu' | 'default' | 'empty' | 'recovery' | 'busy' |
  'read-error' | 'read-empty-error' | 'original-unknown' | 'original-cleanup' |
  'directory-detail' | 'directory-reader' | 'directory-manga' | 'directory-control-expanded' | 'directory-control-compact' | 'directory-control-flat-expanded' | 'directory-control-flat-compact' |
  'directory-control-short-122' | 'directory-control-short-168' | 'directory-control-short-190' |
  'downloads' | 'downloads-short' | 'source-tools' | 'group-recovery' | 'framework-geometry' | 'legacy-recovery';
interface PageStructureFixtureObservation {
  kind: string;
  scene: string;
  presentation: number;
  requestedWidthVp: number;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  contentTopInsetVp: number;
  nativeFontObservationStatus: 'ready' | 'unavailable';
  nativeFontFollowing?: boolean;
  nativeFontMaxScale?: number;
  nativeFontScaleVp?: number;
  sourceId: string;
  sourceVersion?: string;
  intentCount: number;
  filterObservation: string;
  queryLength: number;
  statusFilter: string;
  categoryFilter: string;
  groupFilter: string;
}

@Entry
@Component
struct ReaderPageStructureVerification {
  @StorageLink('readerWindowMetricsRevision') @Watch('onMetricsChanged') private windowMetricsRevision: number = 0;
  @State private admitted: boolean = false;
  @State private scene: PageStructureFixtureScene = 'menu';
  @State private fontState: string = 'loading';
  @State private requestedWidth: number = 366;
  @State private actualWidth: number = 0;
  @State private actualHeight: number = 0;
  @State private sources: BookSource[] = [];
  @State private operation: SourceManagementProjection = { action: 'fixture', sourceId: '' };
  @State private lastIntent: string = '尚未操作';
  @State private intentCount: number = 0;
  private filters: SourceManagementFilterState = defaultSourceManagementFilters();
  private mounted: boolean = false;
  private fontAttempt: number = 0;
  private presentation: number = 0;
  private operationRevision: number = 0;
  private temporaryBack: (() => boolean) | undefined;
  private temporaryBackIdentity: string = '';

  aboutToAppear(): void {
    this.mounted = true;
    this.admitted = this.debugBuild();
    if (!this.admitted) {
      this.fontState = 'denied';
      void this.getUIContext().getRouter().replaceUrl({ url: 'pages/Index' });
      return;
    }
    void this.loadFonts();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.admitted = false;
    this.fontAttempt += 1;
    this.presentation += 1;
    this.temporaryBack = undefined;
    this.temporaryBackIdentity = '';
  }

  onBackPress(): boolean {
    if (!this.admitted || this.scene === 'menu') return false;
    this.leaveScene(this.presentation);
    return true;
  }

  private debugBuild(): boolean { return DEBUG === true && BUILD_MODE_NAME === 'debug'; }

  private async loadFonts(): Promise<void> {
    if (!this.mounted || !this.admitted || !this.debugBuild()) return;
    const attempt = ++this.fontAttempt;
    this.fontState = 'loading';
    try {
      await prepareReaderFonts();
      if (!this.mounted || !this.admitted || !this.debugBuild() || attempt !== this.fontAttempt) return;
      this.fontState = 'ready';
      this.record('fonts-checked');
    } catch (error) {
      if (!this.mounted || !this.admitted || attempt !== this.fontAttempt) return;
      this.fontState = 'failed';
      hilog.error(0x5244, 'ReaderPageStructure', 'font-checked-failed %{public}s', (error as Error).message);
    }
  }

  private current(presentation: number): boolean {
    return this.mounted && this.admitted && this.debugBuild() && this.fontState === 'ready' &&
      this.scene !== 'menu' && presentation === this.presentation;
  }

  private selectWidth(width: number, menuPresentation: number): void {
    if (!this.mounted || !this.admitted || this.scene !== 'menu' || menuPresentation !== this.presentation ||
      (width !== 320 && width !== 366)) return;
    this.requestedWidth = width;
  }

  private returnToPilot(menuPresentation: number): void {
    if (this.mounted && this.admitted && this.scene === 'menu' && menuPresentation === this.presentation) this.getUIContext().getRouter().back();
  }

  private createSources(scene: PageStructureFixtureScene): BookSource[] {
    const sources: BookSource[] = [];
    if (scene === 'empty' || scene === 'read-empty-error') return sources;
    for (let index = 0; index < 24; index++) {
      const id = `https://fixture-${index + 1}.example.invalid`;
      const source: BookSource = { sourceId: id, name: `夹具书源${index + 1} · 中文 English`,
        baseUrl: id, enabled: index % 3 !== 1, enabledExplore: false,
        // Opaque memory versions exercise accepted-value changes independently of Core I/O.
        sourceVersion: `memory-source-${index + 1}-revision-0`,
        category: index % 3 === 0 ? 'novel' : index % 3 === 1 ? 'comic' : 'music',
        group: index % 2 === 0 ? '科幻样本' : '纪实样本',
        loginUrl: index % 2 === 0 ? `${id}/fixture-login` : undefined,
        checkState: scene === 'busy' && index === 0 ? 'checking' : index % 4 === 1 ? 'passed' : index % 4 === 2 ? 'failed' : 'unchecked',
        checkMessage: scene === 'busy' && index === 0 ? '等待登录 / 验证（内存夹具）' :
          index % 4 === 1 ? '检测通过（内存样本）' : index % 4 === 2 ? '检测失败（内存样本）' : undefined };
      sources.push(source);
    }
    return sources;
  }

  private fixtureOperation(scene: PageStructureFixtureScene): SourceManagementProjection {
    if (scene === 'read-error' || scene === 'read-empty-error') {
      return { action: 'fixture-read', sourceId: '', readFacts: projectOperationFacts<BookSource[]>({
        phase: scene === 'read-error' ? 'refreshFailed' : 'failed',
        value: scene === 'read-error' ? this.sources : undefined, canRetry: true,
        generation: ++this.operationRevision, message: '内存夹具：读取失败；已有样本保持可用，重试只记录夹具意图。' }) };
    }
    if (scene === 'original-unknown' || scene === 'original-cleanup') {
      return { action: 'fixture-original', sourceId: this.sources[0]?.sourceId ?? '', original: {
        generation: ++this.operationRevision, busy: false,
        confirmation: scene === 'original-cleanup' ? 'confirmed' : 'unknown',
        label: '夹具原操作', method: 'fixture.memory', operationId: `fixture-${this.presentation}`,
        blocked: true, canRetryOriginal: true, writeStage: scene === 'original-cleanup' ? 'cleanup' : 'core',
        message: '内存夹具：原操作仍需核对，继续按钮只记录当前身份与世代，不调用原业务。'.repeat(8) } };
    }
    if (scene !== 'recovery' && scene !== 'busy') return { action: 'fixture', sourceId: '' };
    return { action: 'fixture-toggle', sourceId: this.sources[0]?.sourceId ?? '',
      receipt: projectPersistedReceipt<BookSource[]>({
        confirmation: scene === 'recovery' ? 'unknown' : 'confirmed',
        readback: scene === 'recovery' ? 'failed' : 'reading',
        value: this.sources, canRetry: scene === 'recovery', generation: ++this.operationRevision,
        message: scene === 'recovery' ? projectCommitReadback('unknown', 'failed').message +
          '：内存夹具：回执待核对，不会操作用户数据。'.repeat(12) : '内存夹具：正在刷新' }) };
  }

  private launchSource(scene: PageStructureFixtureScene, menuPresentation: number): void {
    if (!this.mounted || !this.admitted || !this.debugBuild() || this.fontState !== 'ready' ||
      this.scene !== 'menu' || menuPresentation !== this.presentation ||
      !this.isSourceScene(scene)) return;
    this.presentation += 1;
    this.temporaryBack = undefined;
    this.temporaryBackIdentity = '';
    this.filters = defaultSourceManagementFilters();
    this.sources = this.createSources(scene);
    this.operation = this.fixtureOperation(scene);
    this.actualWidth = 0;
    this.actualHeight = 0;
    this.scene = scene;
    this.record('launch');
  }

  private launchFixture(scene: PageStructureFixtureScene, menuPresentation: number): void {
    if (!this.mounted || !this.admitted || !this.debugBuild() || this.fontState !== 'ready' || this.scene !== 'menu' ||
      menuPresentation !== this.presentation ||
      (scene !== 'directory-detail' && scene !== 'directory-reader' && scene !== 'directory-manga' &&
        scene !== 'directory-control-expanded' && scene !== 'directory-control-compact' &&
        scene !== 'directory-control-flat-expanded' && scene !== 'directory-control-flat-compact' &&
        scene !== 'directory-control-short-122' && scene !== 'directory-control-short-168' && scene !== 'directory-control-short-190' &&
        scene !== 'downloads' && scene !== 'downloads-short' && scene !== 'source-tools' && scene !== 'group-recovery' && scene !== 'framework-geometry' && scene !== 'legacy-recovery')) return;
    this.presentation += 1;
    this.temporaryBack = undefined;
    this.temporaryBackIdentity = '';
    this.actualWidth = 0; this.actualHeight = 0;
    this.scene = scene;
    this.record('launch');
  }

  private sourceScene(): boolean {
    return this.isSourceScene(this.scene);
  }

  private isSourceScene(scene: PageStructureFixtureScene): boolean {
    return scene === 'default' || scene === 'empty' || scene === 'recovery' || scene === 'busy' ||
      scene === 'read-error' || scene === 'read-empty-error' || scene === 'original-unknown' || scene === 'original-cleanup';
  }

  private shortControlHeight(): number {
    if (this.scene === 'directory-control-short-122') return 122;
    if (this.scene === 'directory-control-short-168') return 168;
    if (this.scene === 'directory-control-short-190') return 190;
    return 0;
  }

  private leaveScene(presentation: number): void {
    if (!this.current(presentation)) return;
    if (this.temporaryBack?.() === true) { this.record('temporary-back'); return; }
    this.temporaryBack = undefined;
    this.temporaryBackIdentity = '';
    this.scene = 'menu';
  }

  private bindTemporaryBack(presentation: number, handler: (() => boolean) | undefined, identity: string): void {
    if (handler !== undefined) {
      if (!this.current(presentation) || identity.length === 0) return;
      this.temporaryBack = handler; this.temporaryBackIdentity = identity;
    } else if (presentation === this.presentation && identity === this.temporaryBackIdentity) {
      this.temporaryBack = undefined; this.temporaryBackIdentity = '';
    }
  }

  private fixtureIntent(presentation: number, kind: string, sourceId: string = '', enabled: boolean = false): void {
    if (!this.current(presentation) || !this.sourceScene() ||
      (sourceId.length > 0 && !this.sources.some((source: BookSource): boolean => source.sourceId === sourceId))) return;
    this.intentCount += 1;
    this.lastIntent = `${kind}${sourceId.length > 0 ? ` · ${sourceId}` : ''}`;
    if (kind === 'toggle' || kind === 'login' || kind === 'detect') {
      this.sources = this.sources.map((source: BookSource): BookSource => {
        if (source.sourceId !== sourceId) return source;
        const next: BookSource = { sourceId: source.sourceId, name: source.name, baseUrl: source.baseUrl,
          enabled: kind === 'toggle' ? enabled : source.enabled, enabledExplore: source.enabledExplore,
          sourceVersion: kind === 'toggle' ? `memory-source-revision-${this.intentCount}` : source.sourceVersion,
          category: source.category, group: source.group, loginUrl: source.loginUrl,
          checkState: kind === 'toggle' ? source.checkState : 'checking',
          checkMessage: kind === 'toggle' ? source.checkMessage : kind === 'login' ?
            '等待登录 / 验证（内存夹具，无平台登录）' : '检测中（内存夹具，无网络）' };
        return next;
      });
    }
    this.record(`intent-${kind}`, sourceId);
  }

  private reconcileFixture(presentation: number, revision: number): void {
    const generation = this.operation.original?.generation ?? this.operation.receipt?.facts.generation ?? this.operation.readFacts?.generation;
    if (!this.current(presentation) || !this.sourceScene() || generation !== revision || this.operation.original?.busy === true) return;
    this.fixtureIntent(presentation, 'reconcile');
    this.operation = { action: 'fixture-toggle', sourceId: this.operation.sourceId,
      receipt: projectPersistedReceipt<BookSource[]>({ confirmation: 'confirmed', readback: 'succeeded',
        value: this.sources, canRetry: false, generation: ++this.operationRevision }) };
  }

  private continueFixture(presentation: number, revision: number): void {
    const original = this.operation.original;
    if (!this.current(presentation) || !this.sourceScene() || original?.generation !== revision ||
      !original.blocked || !original.canRetryOriginal || original.busy) return;
    this.fixtureIntent(presentation, original.confirmation === 'confirmed' && original.writeStage === 'cleanup' ?
      'continue-cleanup' : 'continue-original');
    this.operation = { action: 'fixture-continued', sourceId: '', readFacts: projectOperationFacts<BookSource[]>({
      phase: 'succeeded', value: this.sources, generation: ++this.operationRevision }) };
  }

  private statusFixture(presentation: number, revision: number): void {
    if (!this.current(presentation) || this.scene !== 'read-error' || this.operation.readFacts?.generation !== revision) return;
    this.fixtureIntent(presentation, 'status-action');
  }

  private observeArea(presentation: number, area: Area): void {
    if (!this.current(presentation)) return;
    const width = readerPageAreaLength(area.width), height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      (width === this.actualWidth && height === this.actualHeight)) return;
    this.actualWidth = width; this.actualHeight = height;
    this.record('actual-area');
  }

  private fixtureAction(presentation: number, kind: string, chapterIndex: number = -1): void {
    if (!this.current(presentation) || this.sourceScene()) return;
    this.intentCount += 1;
    this.lastIntent = `${kind}${chapterIndex >= 0 ? ` · 章节 ${chapterIndex}` : ''}`;
    this.record(`fixture-action-${kind}`);
  }

  private readerOwnsWindowEdges(): boolean {
    return this.scene === 'directory-reader' || this.scene === 'directory-manga' ||
      this.scene === 'directory-control-expanded' || this.scene === 'directory-control-compact' ||
      this.scene === 'directory-control-flat-expanded' || this.scene === 'directory-control-flat-compact' ||
      this.scene === 'directory-control-short-122' || this.scene === 'directory-control-short-168' ||
      this.scene === 'directory-control-short-190';
  }

  private appContentTopInset(): number {
    // Like Index, observe the revision while leaving metric ownership in the coordinator.
    if (this.windowMetricsRevision < 0 || this.readerOwnsWindowEdges()) return 0;
    return readerContentSafeTop(readerWindowMetrics());
  }

  private onMetricsChanged(): void {
    if (this.mounted && this.admitted) this.record('window-metrics');
  }

  private menuBottomInset(): number {
    if (this.windowMetricsRevision < 0) return 0;
    return readerInteractiveSafeBottom(readerWindowMetrics());
  }

  private retryFonts(attempt: number, menuPresentation: number): void {
    if (!this.mounted || !this.admitted || !this.debugBuild() || this.scene !== 'menu' || this.fontState !== 'failed' ||
      attempt !== this.fontAttempt || menuPresentation !== this.presentation) return;
    void this.loadFonts();
  }

  private record(kind: string, sourceId: string = ''): void {
    const observation: PageStructureFixtureObservation = { kind, scene: this.scene, presentation: this.presentation,
      requestedWidthVp: this.requestedWidth, actualWidthVp: this.actualWidth, actualHeightVp: this.actualHeight,
      systemFontScale: readerWindowMetrics().systemFontScale, contentTopInsetVp: this.appContentTopInset(),
      sourceId, sourceVersion: this.sources.find((source: BookSource): boolean => source.sourceId === sourceId)?.sourceVersion,
      intentCount: this.intentCount, nativeFontObservationStatus: 'unavailable',
      filterObservation: 'initial-or-tools-capture', queryLength: this.filters.searchQuery.length, statusFilter: this.filters.statusValue,
      categoryFilter: this.filters.categoryValue, groupFilter: this.filters.groupValue };
    try {
      // This component is mounted after loadContent. Observe its actual native
      // conversion/policy; it never writes the Coordinator's configuration fact.
      const context = this.getUIContext();
      const following = context.isFollowingSystemFontScale(), maxScale = context.getMaxFontScale();
      const vpPx = context.vp2px(1), fpPx = context.fp2px(1);
      const scaleVp = fpPx / vpPx;
      if (typeof following === 'boolean' && Number.isFinite(maxScale) && maxScale > 0 &&
        Number.isFinite(vpPx) && vpPx > 0 && Number.isFinite(fpPx) && fpPx > 0 &&
        Number.isFinite(scaleVp) && scaleVp > 0) {
        observation.nativeFontObservationStatus = 'ready'; observation.nativeFontFollowing = following;
        observation.nativeFontMaxScale = maxScale; observation.nativeFontScaleVp = scaleVp;
      }
    } catch (_error) { /* Older/unready UI contexts remain explicitly unobserved. */ }
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_PAGE_STRUCTURE %{public}s', JSON.stringify(observation));
  }

  @Builder
  private fontPreparationState(attempt: number, menuPresentation: number) {
    ReaderPageState({ title: this.fontState === 'denied' ? '当前构建不提供组件验证' :
      this.fontState === 'failed' ? '生产字体准备失败' : '生产字体准备中',
      message: '字体checked完成前不挂载被测页面；失败详见诊断记录。',
      loading: this.fontState === 'loading',
      actionLabel: this.fontState === 'failed' ? '重试字体准备' : '',
      onAction: (): void => this.retryFonts(attempt, menuPresentation) });
  }

  @Builder
  private menu() {
    ForEach([this.presentation], (menuPresentation: number): void => {
    Scroll() {
    Column({ space: 12 }) {
      Text('页面结构 · 原生组件夹具').fontSize(20).fontWeight(FontWeight.Bold);
      Text('仅内存样本；所有操作只记录意图。字号跟随系统，不替换生产字体。').fontSize(14);
      Text(`外层请求 ${this.requestedWidth}vp；上次实测 ${this.actualWidth}×${this.actualHeight}vp；系统字号 ${readerWindowMetrics().systemFontScale}`)
        .fontSize(12).id('reader-page-structure-metrics');
      Row({ space: 12 }) {
        Button('宽度 320').id('reader-page-structure-width-320').onClick((): void => this.selectWidth(320, menuPresentation));
        Button('宽度 366').id('reader-page-structure-width-366').onClick((): void => this.selectWidth(366, menuPresentation));
      }
      if (this.fontState !== 'ready') { this.fontPreparationState(this.fontAttempt, menuPresentation); }
      Button('书源 · 默认').enabled(this.fontState === 'ready').id('reader-page-structure-source-default')
        .onClick((): void => this.launchSource('default', menuPresentation));
      Button('书源 · 空').enabled(this.fontState === 'ready').id('reader-page-structure-source-empty')
        .onClick((): void => this.launchSource('empty', menuPresentation));
      Button('书源 · 回执待核对').enabled(this.fontState === 'ready').id('reader-page-structure-source-recovery')
        .onClick((): void => this.launchSource('recovery', menuPresentation));
      Button('书源 · 忙碌').enabled(this.fontState === 'ready').id('reader-page-structure-source-busy')
        .onClick((): void => this.launchSource('busy', menuPresentation));
      Button('书源 · 保留列表读取失败').enabled(this.fontState === 'ready').id('reader-page-structure-source-read-error')
        .onClick((): void => this.launchSource('read-error', menuPresentation));
      Button('书源 · 空列表读取失败').enabled(this.fontState === 'ready').id('reader-page-structure-source-read-empty-error')
        .onClick((): void => this.launchSource('read-empty-error', menuPresentation));
      Button('书源 · 原操作未确认可继续').enabled(this.fontState === 'ready').id('reader-page-structure-source-original-unknown')
        .onClick((): void => this.launchSource('original-unknown', menuPresentation));
      Button('书源 · 原操作已确认待清理').enabled(this.fontState === 'ready').id('reader-page-structure-source-original-cleanup')
        .onClick((): void => this.launchSource('original-cleanup', menuPresentation));
      Button('目录 · 详情完整目录').enabled(this.fontState === 'ready').id('reader-page-structure-directory-detail')
        .onClick((): void => this.launchFixture('directory-detail', menuPresentation));
      Button('目录 · 阅读中完整目录').enabled(this.fontState === 'ready').id('reader-page-structure-directory-reader')
        .onClick((): void => this.launchFixture('directory-reader', menuPresentation));
      Button('目录 · 漫画').enabled(this.fontState === 'ready').id('reader-page-structure-directory-manga')
        .onClick((): void => this.launchFixture('directory-manga', menuPresentation));
      Button('目录 · 控制内容展开').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-expanded')
        .onClick((): void => this.launchFixture('directory-control-expanded', menuPresentation));
      Button('目录 · 控制内容收拢').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-compact')
        .onClick((): void => this.launchFixture('directory-control-compact', menuPresentation));
      Button('目录 · 平面内容展开').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-flat-expanded')
        .onClick((): void => this.launchFixture('directory-control-flat-expanded', menuPresentation));
      Button('目录 · 平面内容收拢').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-flat-compact')
        .onClick((): void => this.launchFixture('directory-control-flat-compact', menuPresentation));
      Button('目录 · 短视口 122').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-short-122')
        .onClick((): void => this.launchFixture('directory-control-short-122', menuPresentation));
      Button('目录 · 短视口 168').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-short-168')
        .onClick((): void => this.launchFixture('directory-control-short-168', menuPresentation));
      Button('目录 · 短视口 190').enabled(this.fontState === 'ready').id('reader-page-structure-directory-control-short-190')
        .onClick((): void => this.launchFixture('directory-control-short-190', menuPresentation));
      Button('下载 · 常态列表').enabled(this.fontState === 'ready').id('reader-page-structure-downloads')
        .onClick((): void => this.launchFixture('downloads', menuPresentation));
      Button('下载 · 真实短视口 168').enabled(this.fontState === 'ready').id('reader-page-structure-downloads-short')
        .onClick((): void => this.launchFixture('downloads-short', menuPresentation));
      Button('书源 · 批量管理与工具').enabled(this.fontState === 'ready').id('reader-page-structure-source-tools')
        .onClick((): void => this.launchFixture('source-tools', menuPresentation));
      Button('分组 · 长恢复提示').enabled(this.fontState === 'ready').id('reader-page-structure-group-recovery')
        .onClick((): void => this.launchFixture('group-recovery', menuPresentation));
      Button('框架 · 页头与移除确认').enabled(this.fontState === 'ready').id('reader-page-structure-framework-geometry')
        .onClick((): void => this.launchFixture('framework-geometry', menuPresentation));
      Button('旧版原书签 · 恢复入口').enabled(this.fontState === 'ready').id('reader-page-structure-legacy-recovery')
        .onClick((): void => this.launchFixture('legacy-recovery', menuPresentation));
      Text(`夹具意图 ${this.intentCount} · ${this.lastIntent}`).fontSize(12);
      Button('返回诊断菜单').id('reader-page-structure-back-pilot').onClick((): void => this.returnToPilot(menuPresentation));
    }.width('100%').padding(20);
    }.width('100%').height(`calc(100% - ${this.menuBottomInset()}vp)`)
      .align(Alignment.Top).clip(true).id('reader-page-structure-menu-scroll');
    }, (menuPresentation: number): string => `fixture-menu-${menuPresentation}`);
  }

  private initialSourceView(): SourceManagementViewState {
    return { searchQuery: this.filters.searchQuery, status: this.filters.statusValue,
      category: this.filters.categoryValue, group: this.filters.groupValue, anchorSourceId: '' };
  }

  @Builder
  private sourceStage() {
    ForEach([this.presentation], (presentation: number): void => {
      Stack() {
        SourceManagementPage({ sources: this.sources, expandedLayout: false, initialViewState: this.initialSourceView(),
          operation: this.operation, statusKind: 'idle',
          statusActionLabel: this.scene === 'read-error' ? '夹具状态动作' : '',
          statusActionGeneration: this.operation.readFacts?.generation ?? 0,
          onStatusAction: (revision: number): void => this.statusFixture(presentation, revision),
          onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity),
          onBack: (): void => this.leaveScene(presentation),
          onToggleSource: (id: string, enabled: boolean): void => this.fixtureIntent(presentation, 'toggle', id, enabled),
          onDetectSource: (id: string): void => this.fixtureIntent(presentation, 'detect', id),
          onLoginSource: (id: string): void => this.fixtureIntent(presentation, 'login', id),
          onAddSource: (): void => this.fixtureIntent(presentation, 'add'),
          onOpenTools: (viewState: SourceManagementViewState): void => {
            if (!this.current(presentation)) return;
            this.filters = { searchQuery: viewState.searchQuery, statusValue: viewState.status,
              categoryValue: viewState.category, groupValue: viewState.group };
            this.fixtureIntent(presentation, 'tools');
          },
          onRetryLoad: (): void => this.fixtureIntent(presentation, 'refresh'),
          onReconcile: (revision: number): void => this.reconcileFixture(presentation, revision),
          onContinueOriginal: (revision: number): void => this.continueFixture(presentation, revision),
        });
      }.width(this.requestedWidth).constraintSize({ maxWidth: '100%' }).height('100%')
        .id('reader-page-structure-source-stage')
        .onAreaChange((_oldArea: Area, area: Area): void => this.observeArea(presentation, area));
    }, (presentation: number): string => presentation.toString());
  }

  @Builder
  private fixtureStage() {
    ForEach([this.presentation], (presentation: number): void => {
      Stack() {
        if (this.scene === 'directory-detail' || this.scene === 'directory-reader') {
          ReaderDirectoryStructureFixture({ mode: 'text', fontsReady: this.fontState === 'ready',
            catalogContext: this.scene === 'directory-reader' ? 'reader' : 'detail',
            onBack: (): void => this.leaveScene(presentation),
            onAction: (kind: string, index: number): void => this.fixtureAction(presentation, kind, index) });
        } else if (this.scene === 'directory-manga') {
          ReaderDirectoryStructureFixture({ mode: 'manga', fontsReady: this.fontState === 'ready', catalogContext: 'detail',
            onBack: (): void => this.leaveScene(presentation),
            onAction: (kind: string, index: number): void => this.fixtureAction(presentation, kind, index) });
        } else if (this.scene === 'directory-control-expanded' || this.scene === 'directory-control-compact' ||
          this.scene === 'directory-control-flat-expanded' || this.scene === 'directory-control-flat-compact' || this.shortControlHeight() > 0) {
          ReaderDirectoryStructureFixture({ mode: 'control', fontsReady: this.fontState === 'ready', catalogContext: 'reader',
            controlExpanded: this.scene !== 'directory-control-compact' && this.scene !== 'directory-control-flat-compact',
            flatCatalog: this.scene === 'directory-control-flat-expanded' || this.scene === 'directory-control-flat-compact', controlViewportHeight: this.shortControlHeight(),
            onBack: (): void => this.leaveScene(presentation),
            onAction: (kind: string, index: number): void => this.fixtureAction(presentation, kind, index) });
        } else if (this.scene === 'downloads') {
          ReaderDownloadStructureFixture({ fontsReady: this.fontState === 'ready',
            onBack: (): void => this.leaveScene(presentation),
            onAction: (kind: string): void => this.fixtureAction(presentation, kind),
            onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
        } else if (this.scene === 'downloads-short') {
          // A real constrained Native viewport; no injected window/page metric.
          Stack({ alignContent: Alignment.TopStart }) {
            ReaderDownloadStructureFixture({ fontsReady: this.fontState === 'ready',
              onBack: (): void => this.leaveScene(presentation),
              onAction: (kind: string): void => this.fixtureAction(presentation, kind),
              onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
          }.width('100%').height(168).align(Alignment.Top).clip(true).id('reader-download-short-viewport');
        } else if (this.scene === 'framework-geometry') {
          ReaderFrameworkGeometryStructureFixture({ fontsReady: this.fontState === 'ready',
            onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
        } else if (this.scene === 'legacy-recovery') {
          ReaderLegacyBookmarkRecoveryStructureFixture({ fontsReady: this.fontState === 'ready',
            onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
        } else if (this.scene === 'group-recovery') {
          ReaderGroupRecoveryStructureFixture({ fontsReady: this.fontState === 'ready',
            onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
        } else if (this.scene === 'source-tools') {
          ReaderSourceToolsStructureFixture({ fontsReady: this.fontState === 'ready',
            onBack: (): void => this.leaveScene(presentation),
            onAction: (kind: string): void => this.fixtureAction(presentation, kind),
            onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindTemporaryBack(presentation, handler, identity) });
        }
      }.width(this.requestedWidth).constraintSize({ maxWidth: '100%' }).height('100%')
        .id('reader-page-structure-fixture-stage')
        .onAreaChange((_old: Area, area: Area): void => this.observeArea(presentation, area));
    }, (presentation: number): string => `fixture-${presentation}`);
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      if (!this.admitted) { this.fontPreparationState(this.fontAttempt, this.presentation); }
      else if (this.scene === 'menu') { this.menu(); }
      else if (this.fontState === 'ready' && this.sourceScene()) { this.sourceStage(); }
      else if (this.fontState === 'ready') { this.fixtureStage(); }
      else { this.fontPreparationState(this.fontAttempt, this.presentation); }
    }.width('100%').height('100%')
      .padding({ top: this.appContentTopInset() })
      .expandSafeArea(this.scene === 'directory-manga' ? [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT] : [SafeAreaType.SYSTEM],
        this.scene === 'directory-manga' ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] :
          this.readerOwnsWindowEdges() ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM] : [SafeAreaEdge.BOTTOM])
      .ignoreLayoutSafeArea(this.scene === 'directory-manga' ? [LayoutSafeAreaType.SYSTEM] : [],
        this.scene === 'directory-manga' ? [LayoutSafeAreaEdge.ALL] : []);
  }
}
