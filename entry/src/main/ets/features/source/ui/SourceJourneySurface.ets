import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import type { AnimatorResult } from '@ohos.animator';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { motionSpecGet, readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { SourceManagementPage } from './SourceManagementPage';
import { SourceToolsPage } from './SourceToolsPage';
import { SourceV9TransferPage } from './SourceV9TransferPage';
import { SourceV9GroupsPage } from './SourceV9GroupsPage';
import { SourceV9CheckDialog } from './SourceV9CheckDialog';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { DialogActionView, ReaderDialogSurface, readerDialogCardTransition,
  readerDialogScrimTransition } from '../../../ui/surfaces/ReaderDialogSurface';
import { ReaderDialogViewport } from '../../../ui/surfaces/ReaderDialogViewport';
import { readerDetailSceneOpacity, readerRouteMotionPose } from '../../../app/navigation/ReaderRouteMotionModel';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { BookSource, SourceCheckOutcome, SourceGroupCatalogData,
  SourceGroupMutateParams, SourceGroupRecord } from '../application/SourceGateway';
import type { SourceV9CheckOptions } from '../application/SourceOrchestrator';
import type { SourceV9ImportedReport } from '../application/SourceV9TransferState';
import type { SourceV9ConfirmedImport } from '../application/SourceV9TransferOwner';
import { sourceV9BlocksOuterBackPreview, sourceV9ForegroundPane, sourceV9GroupRows, sourceV9PaneTransition,
  sourceV9ParentView, sourceV9Supports, type SourceV9ForegroundPane, type SourceV9ListAction,
  type SourceV9View } from '../presentation/SourceManagementV9';
import type { SourceToolsSelection } from '../application/SourceToolsOrchestrator';
import { EMPTY_SOURCE_JOURNEY, SourceJourneyPresentation, type SourceJourneySnapshot } from '../presentation/SourceJourneyPresentation';

interface SourceJourneyPaneOpening {
  readonly pane: SourceV9ForegroundPane;
  readonly generation: number;
  readonly importSearchAction?: () => void;
}

interface SourceJourneyPaneMotion {
  readonly actor: SourceV9View;
  readonly popping: boolean;
  readonly coverage: number;
  readonly width: number;
  readonly reduced: boolean;
}

@Component
export struct SourceJourneySurface {
  @StorageProp('readerNavigationAppearancePreferences')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop expandedLayout: boolean = false;
  @Prop embeddedWide: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop inputEnabled: boolean = true;
  presentation: SourceJourneyPresentation = new SourceJourneyPresentation();
  /** Captured by the opening's keyed root builder. Stale nodes keep the old lease. */
  identity: string = '';
  showingTools: boolean = false;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onBackPreviewBlocked: (blocked: boolean) => void = (): void => {};
  captureImportSearchAction: (() => (() => void) | undefined) | undefined = undefined;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  onToolsTemporaryBackBridge: ((handler: (() => boolean) | undefined, identity: string) => void) | undefined = undefined;
  onShowDeleteAlert: (options: ReaderNativeAlertOptions, current: () => boolean) => void =
    (_options: ReaderNativeAlertOptions, _current: () => boolean): void => {};
  @State private view: SourceJourneySnapshot = EMPTY_SOURCE_JOURNEY;
  @State @Watch('publishBackPreviewOwnership') private pane: SourceV9View = 'list';
  @State private paneOpening: SourceJourneyPaneOpening | undefined = undefined;
  @State private paneMotion: SourceJourneyPaneMotion | undefined = undefined;
  @State private catalog: SourceGroupCatalogData | undefined = undefined;
  @State private catalogError: string = '';
  @State private projectedRows: BookSource[] = [];
  @State private detailGroupId: string | undefined = undefined;
  @State @Watch('publishBackPreviewOwnership') private moveSourceIds: string[] = [];
  @State private moveCatalogLoading: boolean = false;
  @State private moveCatalogError: boolean = false;
  @State @Watch('publishBackPreviewOwnership') private deleteSourceIds: string[] = [];
  @State private listDialogGeneration: number = 0;
  @State private paneRect: ReaderRectVp | undefined = undefined;
  @State @Watch('publishBackPreviewOwnership') private checkSourceIds: string[] = [];
  @State private checkTitle: string = '';
  @State private checkBatch: boolean = false;
  @State private batchApplied: number = 0;
  @State private ungroupedBatchIds: string[] = [];
  private catalogGeneration: number = 0;
  private listBack: (() => boolean) | undefined = undefined;
  private listOwnsBackPreview: boolean = false;
  private paneBack: (() => boolean) | undefined = undefined;
  private moveBack: (() => boolean) | undefined = undefined;
  private paneGeneration: number = 0;
  private motionGeneration: number = 0;
  private paneAnimator: AnimatorResult | undefined = undefined;
  private paneMotionDeadline: number = -1;
  private checkBack: (() => boolean) | undefined = undefined;
  private unsubscribe: (() => void) | undefined;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.unsubscribe = this.presentation.observe((view: SourceJourneySnapshot): void => {
      if (this.showingTools ? this.presentation.tools(this.identity) !== undefined : this.presentation.isManagementCurrent(this.identity)) {
        const original = this.view.operation.original;
        this.view = view;
        this.projectedRows = sourceV9GroupRows(view.sources, this.catalog);
        if (!this.showingTools && original?.method === 'source.group.mutate' && original.blocked &&
          view.operation.original?.blocked !== true) void this.refreshCatalog();
      }
    });
    if (!this.showingTools) {
      this.onTemporaryBackBridge((): boolean => this.consumeBack(), this.identity);
      this.publishBackPreviewOwnership();
      void this.refreshCatalog();
    }
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.stopPaneAnimation();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (!this.showingTools) {
      this.onTemporaryBackBridge(undefined, this.identity);
      this.onBackPreviewBlocked(false);
    }
  }

  private publishBackPreviewOwnership(): void {
    if (!this.mounted || this.showingTools) return;
    this.onBackPreviewBlocked(sourceV9BlocksOuterBackPreview(this.pane,
      this.listOwnsBackPreview || this.checkSourceIds.length > 0 || this.moveSourceIds.length > 0 || this.deleteSourceIds.length > 0));
  }

  private async refreshCatalog(): Promise<void> {
    const generation = ++this.catalogGeneration;
    const host = this.presentation.management(this.identity);
    if (host === undefined) return;
    try {
      const catalog = await host.loadGroups(this.identity);
      if (!this.mounted || generation !== this.catalogGeneration) return;
      this.catalogError = '';
      this.publishCatalog(catalog);
    } catch (error) {
      if (this.mounted && generation === this.catalogGeneration) this.catalogError = errorMessageOf(error);
    } finally {
      if (this.mounted && generation === this.catalogGeneration && this.moveCatalogLoading) {
        this.moveCatalogError = this.catalogError.length > 0 || this.catalog === undefined;
        this.moveCatalogLoading = false;
      }
    }
  }

  private publishCatalog(catalog: SourceGroupCatalogData): void {
    if (this.catalog !== undefined && catalog.revision < this.catalog.revision) return;
    this.catalog = catalog;
    this.projectedRows = sourceV9GroupRows(this.view.sources, catalog);
  }

  private async mutateGroup(params: SourceGroupMutateParams): Promise<void> {
    const host = this.presentation.management(this.identity);
    if (!this.managementInputIsCurrent() || host === undefined) throw new Error('书源页面已关闭');
    try {
      const catalog = await host.mutateGroup(params, this.identity);
      if (!this.mounted || this.presentation.management(this.identity) !== host) return;
      this.catalogError = '';
      this.publishCatalog(catalog);
    } catch (error) {
      if (this.mounted && this.presentation.management(this.identity) === host) await this.refreshCatalog();
      throw error as Error;
    }
  }

  private consumeBack(): boolean {
    if (!this.managementInputIsCurrent()) return false;
    if (this.paneMotion?.popping === true) return true;
    if (this.checkSourceIds.length > 0) {
      if (this.checkBack?.() !== true) this.checkSourceIds = [];
      return true;
    }
    if (this.listDialogVisible()) {
      this.chooseListDialog(this.listDialogGeneration, 'cancel');
      return true;
    }
    if (this.moveSourceIds.length > 0) {
      if (this.moveBack?.() === true) return true;
      this.moveSourceIds = [];
      return true;
    }
    if (this.paneBack?.() === true) return true;
    const parent = sourceV9ParentView(this.pane);
    if (parent !== undefined) {
      this.openPane(parent);
      return true;
    }
    return this.listBack?.() === true;
  }

  private openPane(pane: SourceV9View, groupId?: string): void {
    if (!this.managementInputIsCurrent() || pane === this.pane || this.paneMotion?.popping === true) return;
    const routeMotion = sourceV9PaneTransition(this.pane, pane);
    const prior = this.paneMotion;
    this.stopPaneAnimation();
    if (routeMotion === undefined) { this.paneMotion = undefined; this.applyPane(pane, groupId); return; }
    const popping = routeMotion.popping;
    const width = routeMotion.actor === 'group-detail' ? 12 : this.paneRect?.width ?? 0;
    const from = popping ? (prior?.actor === routeMotion.actor ? prior.coverage : 1) : 0;
    if (width <= 0 || (popping && from <= .001)) { this.paneMotion = undefined; this.applyPane(pane, groupId); return; }
    const motion: SourceJourneyPaneMotion = { actor: routeMotion.actor, popping, width, coverage: from, reduced: this.reduceMotion };
    const generation = this.motionGeneration;
    this.paneMotion = motion;
    // A pop keeps its actual foreground mounted until the last painted frame.
    if (!popping) this.applyPane(pane, groupId);
    const context = this.getUIContext();
    const current = (): boolean => this.mounted && generation === this.motionGeneration;
    const finish = (): void => {
      if (!current()) return;
      this.stopPaneAnimation();
      if (popping) this.applyPane(pane, groupId);
      this.paneMotion = undefined;
    };
    const spec = motion.reduced ? 'app.motion.reduced.fade' : popping ? 'app.navigation.pop' : 'app.navigation.push';
    const duration = Math.max(1, Math.round((motionSpecGet(spec)?.durationMs ?? 200) * (popping ? from : 1)));
    this.paneMotionDeadline = setTimeout(finish, duration + 300);
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!current()) return;
        if (readerTransitionsEnabled()) readerBeginTransition({ kind: 'route', action: popping ? 'pop' : 'push',
          subject: `source-${motion.actor}`, scope: `source-${this.identity}`,
          nodes: [routeMotion.nodeId], staticMotion: motion.reduced });
        try {
          const animator = context.createAnimator({ duration, easing: motion.reduced ? 'ease-out' : 'linear',
            delay: 0, fill: 'forwards', direction: 'normal', iterations: 1, begin: 0, end: 1 });
          this.paneAnimator = animator;
          animator.onFrame = (fraction: number): void => {
            if (!current() || this.paneAnimator !== animator) return;
            const progress = motion.reduced ? fraction : readerMotionStandardCurve().interpolate(fraction);
            this.paneMotion = { actor: motion.actor, popping, width, reduced: motion.reduced,
              coverage: popping ? from * (1 - progress) : progress };
          };
          animator.onFinish = (): void => { if (this.paneAnimator === animator) finish(); };
          animator.play();
        } catch (_) { finish(); }
      }));
    } catch (_) { finish(); }
  }

  private stopPaneAnimation(): void {
    this.motionGeneration += 1;
    if (this.paneMotionDeadline >= 0) clearTimeout(this.paneMotionDeadline);
    this.paneMotionDeadline = -1;
    const animator = this.paneAnimator;
    this.paneAnimator = undefined;
    try { animator?.cancel(); } catch (_) { /* The finished animator may already be retired. */ }
  }

  private paneTranslation(actor: SourceV9View): number {
    const motion = this.paneMotion;
    return motion?.actor === actor ? readerRouteMotionPose('push', 'child', motion.width, motion.coverage, motion.reduced) : 0;
  }

  private paneOpacity(actor: SourceV9View): number {
    const motion = this.paneMotion;
    return motion?.actor === actor ? readerDetailSceneOpacity(motion.coverage, motion.reduced) : 1;
  }

  private applyPane(pane: SourceV9View, groupId?: string): void {
    if (pane === 'groups') this.detailGroupId = undefined;
    else if (pane === 'group-detail') this.detailGroupId = groupId;
    const scene = sourceV9ForegroundPane(pane);
    if (scene !== this.paneOpening?.pane) {
      let importSearchAction: (() => void) | undefined;
      if (scene === 'import') {
        this.presentation.retireImportSearchAction(this.identity);
        importSearchAction = this.captureImportSearchAction?.();
      }
      this.paneBack = undefined;
      this.paneOpening = scene === undefined ? undefined : { pane: scene, generation: ++this.paneGeneration, importSearchAction };
    }
    this.pane = pane;
    if (pane === 'groups' || pane === 'import') void this.refreshCatalog();
  }

  private openCheck(ids: string[], title: string, batch: boolean): void {
    if (!this.managementInputIsCurrent()) return;
    const selected = new Set(ids);
    this.checkTitle = title;
    this.checkBatch = batch;
    this.checkSourceIds = this.projectedRows.filter((source: BookSource): boolean =>
      sourceV9Supports(source) && selected.has(source.sourceId)).map((source: BookSource): string => source.sourceId);
  }

  private listAction(action: SourceV9ListAction, ids: string[]): void {
    if (!this.managementInputIsCurrent() || !this.listIsInteractive()) return;
    const host = this.presentation.management(this.identity);
    if (action === 'subscriptions' || action === 'groups') this.openPane(action);
    else if (action === 'detect') this.openCheck(ids, '批量检测', true);
    else if (action === 'export') host?.exportAll(this.identity);
    else if (action === 'enable' || action === 'disable') host?.toggleSources(ids, action === 'enable', this.identity);
    else if (action === 'move') {
      if (ids.length === 0) return;
      this.listDialogGeneration += 1;
      this.moveBack = undefined;
      this.moveCatalogError = false;
      this.moveCatalogLoading = true;
      this.moveSourceIds = ids.slice();
      void this.refreshCatalog();
    } else if (action === 'delete') {
      this.confirmSourceDeletion(ids);
    }
  }

  private confirmSourceDeletion(ids: string[]): void {
    if (ids.length === 0) return;
    this.listDialogGeneration += 1;
    this.deleteSourceIds = ids.slice();
  }

  private moveCatalogDialogVisible(): boolean {
    return this.moveSourceIds.length > 0 && (this.moveCatalogLoading || this.moveCatalogError);
  }

  private listDialogVisible(): boolean {
    return this.pane === 'list' && (this.deleteSourceIds.length > 0 || this.moveCatalogDialogVisible());
  }

  private listDialogActions(): DialogActionView[] {
    const actions = [new DialogActionView('cancel', '取消', 'default', this.inputEnabled, true)];
    if (this.deleteSourceIds.length > 0) {
      actions.push(new DialogActionView('delete', '删除', 'danger', this.inputEnabled));
    } else if (!this.moveCatalogLoading) {
      actions.push(new DialogActionView('retry', '重试', 'primary', this.inputEnabled));
    }
    return actions;
  }

  private chooseListDialog(generation: number, action: string): void {
    if (!this.managementInputIsCurrent() || generation !== this.listDialogGeneration || !this.listDialogVisible()) return;
    if (this.deleteSourceIds.length > 0) {
      if (action !== 'cancel' && action !== 'delete') return;
      const ids = this.deleteSourceIds.slice();
      this.deleteSourceIds = [];
      if (action === 'delete') this.presentation.management(this.identity)?.deleteSources(ids, this.identity);
    } else if (action === 'cancel') {
      this.moveSourceIds = [];
      this.moveCatalogLoading = false;
      this.moveCatalogError = false;
    } else if (action === 'retry' && !this.moveCatalogLoading) {
      this.moveCatalogLoading = true;
      void this.refreshCatalog();
    }
  }

  private listIsInteractive(): boolean {
    return this.pane === 'list' && this.checkSourceIds.length === 0 && this.moveSourceIds.length === 0 &&
      this.deleteSourceIds.length === 0;
  }

  private managementInputIsCurrent(): boolean {
    return this.mounted && this.inputEnabled && (this.isInputAllowed?.() ?? true) && this.presentation.isManagementCurrent(this.identity);
  }

  private toolsInputIsCurrent(): boolean {
    return this.mounted && (this.isInputAllowed?.() ?? true) && this.presentation.tools(this.identity) !== undefined;
  }

  private paneInputCurrent(opening: SourceJourneyPaneOpening): boolean {
    return this.managementInputIsCurrent() && this.checkSourceIds.length === 0 &&
      this.paneOpening?.generation === opening.generation && this.paneMotion?.popping !== true;
  }

  private moveInputCurrent(generation: number): boolean {
    return this.managementInputIsCurrent() && this.pane === 'list' && this.moveSourceIds.length > 0 &&
      generation === this.listDialogGeneration;
  }

  private groupsInputCurrent(opening: SourceJourneyPaneOpening | undefined, moveGeneration: number): boolean {
    return opening === undefined ? this.moveInputCurrent(moveGeneration) : this.paneInputCurrent(opening);
  }

  build() {
    if (this.showingTools) {
      this.toolsPage();
    } else {
      this.managementJourney();
    }
  }

  @Builder
  private managementJourney() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.managementPage();
      ForEach(this.paneOpening === undefined ? [] : [this.paneOpening], (opening: SourceJourneyPaneOpening): void => {
        Stack({ alignContent: Alignment.TopStart }) {
          if (opening.pane === 'groups') this.groupsPage(opening, -1);
          else this.transferPage(opening);
        }.id(readerTransitionsEnabled() ? `reader-source-v9-${opening.pane}-motion` : undefined).width('100%').height('100%')
          .translate({ x: this.paneTranslation(opening.pane) }).opacity(this.paneOpacity(opening.pane))
          .enabled(this.paneMotion?.popping !== true);
      }, (opening: SourceJourneyPaneOpening): string => `${opening.pane}:${opening.generation}`);
      if (this.pane === 'list' && this.moveSourceIds.length > 0 && !this.moveCatalogDialogVisible()) {
        ForEach([this.listDialogGeneration], (generation: number): void => {
          this.groupsPage(undefined, generation);
        }, (generation: number): string => generation.toString());
      }
      if (this.listDialogVisible()) {
        ForEach([this.listDialogGeneration], (generation: number): void => {
          Stack({ alignContent: Alignment.TopStart }) {
            Stack().width('100%').height('100%')
              .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
                readerAppColor('app.scrim.warmModal', this.scheme)))
              .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
              .accessibilityLevel('no').onClick((): void => this.chooseListDialog(generation, 'cancel'));
            ReaderDialogViewport({ host: this.paneRect,
              content: (width: number): void => { this.listDialogCard(width, generation); },
            }).transition(readerDialogCardTransition(this.reduceMotion));
          }.width('100%').height('100%').transition(readerDialogScrimTransition(this.reduceMotion));
        }, (generation: number): string => generation.toString());
      }
      if (this.checkSourceIds.length > 0) {
        SourceV9CheckDialog({
          sources: this.checkRows(), title: this.checkTitle, batch: this.checkBatch,
          inputEnabled: this.inputEnabled, modalHost: this.paneRect,
          onCheck: (id: string, options: SourceV9CheckOptions, current: () => boolean,
            onStage: (stage: string) => void): Promise<SourceCheckOutcome | undefined> =>
            this.presentation.management(this.identity)?.runSourceCheck(id, options,
              (): boolean => this.mounted && current(), onStage, this.identity) ?? Promise.resolve(undefined),
          onClose: (): void => { this.checkSourceIds = []; },
          onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => { this.checkBack = handler; },
        });
      }
    }.width('100%').height('100%').clip(true)
      .onAreaChange((_previous: Area, next: Area): void => {
        if (this.mounted) this.recordPane(next);
      });
  }

  @Builder
  private listDialogCard(width: number, generation: number) {
    ReaderDialogSurface({ specId: 'source-v9-check', containerWidthVp: width,
      title: this.deleteSourceIds.length > 0 ? '删除书源' : '移动书源', actions: this.listDialogActions(),
      onAction: (action: string): void => this.chooseListDialog(generation, action),
      body: (): void => {
        if (this.deleteSourceIds.length > 0) {
          this.deleteDialogBody();
        } else {
          ReaderPageState({ variant: 'inline', padded: false, loading: this.moveCatalogLoading,
            loadingActive: this.inputEnabled,
            message: this.moveCatalogLoading ? '正在读取书源分组' : '无法读取书源分组，请重试。' });
        }
      },
    });
  }

  private recordPane(area: Area): void {
    const left = readerPageAreaLength(area.globalPosition.x);
    const top = readerPageAreaLength(area.globalPosition.y);
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0) return;
    const old = this.paneRect;
    if (old === undefined || old.left !== left || old.top !== top || old.width !== width || old.height !== height) {
      this.paneRect = new ReaderRectVp(left, top, width, height);
    }
  }

  @Builder
  private deleteDialogBody() {
    Scroll() {
      Text(`确定删除所选 ${this.deleteSourceIds.length} 个书源吗？将同时清除相关登录会话，删除后无法恢复。`)
        .width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
        .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.scheme));
    }.width('100%').constraintSize({ maxHeight: '45%' }).scrollBar(BarState.Auto);
  }

  private checkRows(): BookSource[] {
    return this.projectedRows.filter((row: BookSource): boolean => this.checkSourceIds.includes(row.sourceId));
  }

  private catalogGroupNames(): string[] {
    return (this.catalog?.groups ?? []).map((group: SourceGroupRecord): string => group.name);
  }

  @Builder
  private transferPage(opening: SourceJourneyPaneOpening) {
    SourceV9TransferPage({
      pane: opening.pane === 'import' ? 'import' : 'subscriptions', embeddedWide: this.embeddedWide,
      modalHost: this.paneRect, owner: this.presentation.runtime(this.identity),
      isInputAllowed: (): boolean => this.paneInputCurrent(opening),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => {
        if (this.paneOpening?.generation === opening.generation) this.paneBack = handler;
      },
      onBack: (): void => { if (this.paneInputCurrent(opening)) this.openPane('list'); },
      onReadBack: (reports: SourceV9ImportedReport[], imported?: SourceV9ConfirmedImport): void => {
        void this.presentation.readBackTransfer(this.identity, reports, imported,
          imported === undefined ? undefined : opening.importSearchAction);
        void this.refreshCatalog();
      },
    });
  }

  @Builder
  private groupsPage(opening: SourceJourneyPaneOpening | undefined, moveGeneration: number) {
    SourceV9GroupsPage({
      catalog: this.catalog, sources: this.projectedRows, detailGroupId: opening === undefined ? undefined : this.detailGroupId,
      detailTransitionActive: opening !== undefined && this.paneMotion?.actor === 'group-detail',
      detailTranslation: this.paneTranslation('group-detail'), detailOpacity: this.paneOpacity('group-detail'),
      modalHost: this.paneRect,
      catalogError: this.catalogError, onRetryCatalog: (): void => {
        if (this.groupsInputCurrent(opening, moveGeneration)) void this.refreshCatalog();
      },
      embeddedWide: this.embeddedWide, moveOnly: opening === undefined,
      moveSourceIds: opening === undefined ? this.moveSourceIds : [],
      // The group list can mount underneath the outgoing detail. Publish pop
      // completion as an observed prop so retained buttons regain input.
      inputEnabled: this.inputEnabled && this.checkSourceIds.length === 0 && this.paneMotion?.popping !== true,
      isInputAllowed: (): boolean => this.groupsInputCurrent(opening, moveGeneration),
      onBack: (): void => { if (this.groupsInputCurrent(opening, moveGeneration)) this.consumeBack(); },
      onOpenGroup: (groupId: string): void => {
        if (this.groupsInputCurrent(opening, moveGeneration)) {
          this.openPane('group-detail', groupId);
        }
      },
      onCloseMove: (applied?: boolean): void => {
        if (!this.moveInputCurrent(moveGeneration)) return;
        this.moveSourceIds = [];
        if (applied === true) this.batchApplied += 1;
      },
      operation: this.view.operation, statusKind: this.view.statusKind, statusMessage: this.view.statusMessage,
      onReconcile: (generation: number): void => {
        if (this.groupsInputCurrent(opening, moveGeneration)) this.presentation.management(this.identity)?.reconcile(generation, this.identity);
      },
      onContinueOriginal: (generation: number): void => {
        if (this.groupsInputCurrent(opening, moveGeneration)) this.presentation.management(this.identity)?.continueOriginal(generation, this.identity);
      },
      onMutate: (params: SourceGroupMutateParams): Promise<void> => this.mutateGroup(params),
      onToggle: (ids: string[], enabled: boolean): void => {
        if (this.groupsInputCurrent(opening, moveGeneration))
          this.presentation.management(this.identity)?.toggleSources(ids, enabled, this.identity);
      },
      onCheck: (ids: string[], group?: boolean): void => {
        if (this.groupsInputCurrent(opening, moveGeneration))
          this.openCheck(ids, group === true ? '整组检测' : '书源检测报告', group === true);
      },
      onBatchUngrouped: (ids: string[]): void => {
        if (!this.groupsInputCurrent(opening, moveGeneration)) return;
        this.ungroupedBatchIds = ids.slice();
        this.openPane('list');
      },
      onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => {
        if (opening !== undefined && this.paneOpening?.generation === opening.generation) this.paneBack = handler;
        if (opening === undefined && moveGeneration === this.listDialogGeneration) this.moveBack = handler;
      },
    });
  }

  @Builder
  private managementPage() {
    SourceManagementPage({
      embeddedWide: this.embeddedWide,
      v9Pane: this.pane,
      verificationOpening: this.identity,
      inputEnabled: this.inputEnabled && this.listIsInteractive(),
      isOpeningCurrent: (): boolean => this.presentation.isManagementCurrent(this.identity),
      isInputAllowed: (): boolean => this.managementInputIsCurrent() && this.listIsInteractive(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, _identity: string): void => { this.listBack = handler; },
      onBackPreviewBlocked: (blocked: boolean): void => {
        this.listOwnsBackPreview = blocked;
        this.publishBackPreviewOwnership();
      },
      sources: this.projectedRows, catalogGroupNames: this.catalogGroupNames(), ungroupedBatchIds: this.ungroupedBatchIds, batchApplied: this.batchApplied,
      initialViewState: this.presentation.initialManagementViewState(this.identity),
      operation: this.view.operation,
      statusKind: this.view.statusKind,
      statusMessage: this.view.statusMessage,
      statusActionLabel: this.view.searchActionLabel,
      statusActionGeneration: this.view.searchActionRevision,
      expandedLayout: this.expandedLayout,
      reduceMotion: this.reduceMotion,
      onReconcile: (expected: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.reconcile(expected, this.identity);
      },
      onContinueOriginal: (expected: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.continueOriginal(expected, this.identity);
      },
      onStatusAction: (revision: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.runSearchAction(this.identity, revision);
      },
      onBack: (): void => { if (this.managementInputIsCurrent() && this.listIsInteractive()) this.onBack(); },
      onToggleSource: (id: string, enabled: boolean): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.toggleSource(id, enabled, this.identity);
      },
      onDetectSource: (id: string): void => {
        this.openCheck([id], '书源检测报告', false);
      },
      onLoginSource: (id: string, loginUrl: string): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.loginSource(id, loginUrl, this.identity);
      },
      onAddSource: (): void => this.openPane('import'),
      onV9Action: (action: SourceV9ListAction, ids: string[]): void => this.listAction(action, ids),
      onRetryLoad: (): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.retryLoad(this.identity);
      },
    }).enabled(this.listIsInteractive()).hitTestBehavior(this.listIsInteractive() ? HitTestMode.Default : HitTestMode.None)
      .customProperty('readerLayoutDebugExcluded', this.pane !== 'list')
      .accessibilityLevel(this.listIsInteractive() ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private toolsPage() {
    SourceToolsPage({ reduceMotion: this.reduceMotion, embeddedWide: this.embeddedWide,
      snapshot: this.view.tools,
      isOpeningCurrent: (): boolean => this.presentation.tools(this.identity) !== undefined,
      isInputAllowed: (): boolean => this.toolsInputIsCurrent(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => {
        if (handler === undefined || this.presentation.tools(this.identity) !== undefined)
          this.onToolsTemporaryBackBridge?.(handler, identity);
      },
      onReconcile: (expected: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.reconcile(expected);
      },
      onContinueOriginal: (expected: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.continueOriginal(expected);
      },
      onSetVisibleSelection: (query: string, selected: boolean): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.setVisibleSelection(query, selected);
      },
      onToggleSelection: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.toggleSelection(sourceId);
      },
      onBack: (): void => { if (this.toolsInputIsCurrent()) this.onBack(); },
      onExportAll: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.exportAll(); },
      onExportSelected: (selection: SourceToolsSelection): void => {
        if (!this.toolsInputIsCurrent()) return;
        const host = this.presentation.toolsForSelection(this.identity, selection);
        host?.exportSelected(host.consumeSelection(selection.sourceIds));
      },
      onCheckSelected: (selection: SourceToolsSelection): void => {
        if (this.toolsInputIsCurrent()) this.presentation.toolsForSelection(this.identity, selection)?.checkSelected(selection.sourceIds);
      },
      onStopCheck: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.stopCheckSelected(); },
      onSetSelectedEnabled: (selection: SourceToolsSelection, enabled: boolean): void => {
        if (!this.toolsInputIsCurrent()) return;
        const host = this.presentation.toolsForSelection(this.identity, selection);
        host?.setSelectedEnabled(host.consumeSelection(selection.sourceIds), enabled);
      },
      onDeleteSelected: (selection: SourceToolsSelection): void => {
        if (this.toolsInputIsCurrent()) this.presentation.requestDelete(this.identity, selection,
          (count: number, confirm: () => void, current: () => boolean): void => this.confirmDeletion(count, confirm, current));
      },
      onOpenEditor: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.openEditor(sourceId);
      },
      onEditorDraftChanged: (value: string, revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateEditorDraft(value, revision);
      },
      onSaveEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.saveEditor(revision);
      },
      onReconcileEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.reconcileEditor(revision);
      },
      onCancelEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.cancelEditor(revision);
      },
      onDebugKeyChanged: (value: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateDebugKey(value);
      },
      onCheckSelectionChanged: (mode: 'search' | 'explore', depth: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateCheckSelection(mode, depth);
      },
      onDebugSource: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.debugSource(sourceId);
      },
    });
  }

  private confirmDeletion(count: number, confirm: () => void, current: () => boolean): void {
    const inputCurrent = (): boolean => this.toolsInputIsCurrent() && current();
    if (!inputCurrent()) return;
    this.onShowDeleteAlert({
      title: '删除书源',
      message: `确定删除所选 ${count} 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。`,
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '删除', fontColor: readerAppColor('app.action.nativeDestructive', this.scheme),
        action: (): void => { if (inputCurrent()) confirm(); } },
    }, inputCurrent);
  }
}
