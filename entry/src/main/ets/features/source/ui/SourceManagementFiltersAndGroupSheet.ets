import type { SourceToolsEntry } from '../presentation/SourceJourneyPresentation';
import type { SourceV9ListReturnView } from './SourceManagementVerification';
import type { SourceV9View } from '../presentation/SourceManagementV9';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import type { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import type { ReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import type { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import type { ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerOverlayListHeight, readerOverlayPanel } from '../../../ui/layout/ReaderOverlayGeometry';
import { projectSourceManagementV9, sourceV9Supports, type SourceV9Counts, type SourceV9ListAction, type SourceV9Projection } from '../presentation/SourceManagementV9';
import type { SourceManagementViewState } from '../presentation/SourceJourneyPresentation';
import { TYPE_SELECT_SOURCE_GROUP_VALUE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { type BookSource } from '../application/SourceGateway';
import { readerSourceCategoryLabel, type ReaderSourceCategory } from '../application/ReaderSourceCategory';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { ReaderSourceTextMetrics } from '../../../pages/ReaderSourceTextMetrics';
import { readerSurfaceElevation, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderImmersiveMaterialModifier, readerNativeSurfaceOutline, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderSelect } from '../../../ui/controls/ReaderSelect';
import { ReaderSelectPanel } from '../../../ui/controls/ReaderSelectPanel';
import { TOK_BORDER_W, TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import type { SourceTextLayoutScope } from './SourceManagementListRow';
import type { SourceProjectionTrigger } from './SourceManagementVerification';

type SourceFilterTextLane = 'status' | 'category';

interface SourceManagementFilterResults {
  readonly visibleIds: () => string[];
  readonly hasReadableSources: () => boolean;
  readonly projectedSourceCount: () => number;
  readonly statusCounts: () => SourceV9Counts;
  readonly filterHeight: () => number;
  readonly changed: (trigger: SourceProjectionTrigger) => void;
}

interface SourceManagementFilterTypography {
  readonly hasProbe: () => boolean;
  readonly scope: (scope?: 'default' | 'group') => SourceTextLayoutScope | undefined;
  readonly options: (role: string, label: string) => TextOptions | undefined;
}

interface SourceManagementFiltersNativePort {
  readonly getUIContext: () => UIContext;
  readonly contentFrame: () => SurfaceHorizontalFrame;
  readonly fontScale: () => number;
  readonly geometry: () => ReaderPageGeometry;
  readonly originX: () => number;
  readonly originY: () => number;
  readonly viewportWidth: () => number;
  readonly overlayBottom: () => number;
  readonly overlayTop: () => number;
  readonly overlayLeft: () => number;
  readonly overlayRight: () => number;
  readonly editingHost: () => ReaderEditingVisibility;
  readonly numericAreaLength: (value: Length | undefined) => number;
}

interface SourceManagementFiltersPresentationPort {
  readonly appThemeScheme: () => string;
  readonly systemScheme: () => string;
  readonly appearancePreferences: () => ReaderNavigationPreferences;
  readonly expandedLayout: () => boolean;
  readonly reduceMotion: () => boolean;
  readonly appForeground: () => boolean;
  readonly groupOpen: () => boolean;
  readonly moreMenuOpen: () => boolean;
  readonly batchMode: () => boolean;
  readonly setGroupOpen: (open: boolean) => void;
  readonly setMoreMenuOpen: (open: boolean) => void;
}

interface SourceManagementFiltersOpeningPort {
  readonly mounted: () => boolean;
  readonly temporaryBackIdentity: () => string;
  readonly managementBackIsCurrent: (identity: string) => boolean;
  readonly managementOpeningIsCurrent: () => boolean;
  readonly managementInputIsCurrent: () => boolean;
  readonly isInputAllowed: () => boolean;
  readonly hideManagementKeyboard: (identity: string) => boolean;
  readonly observeVerificationOverlay: (phase: string, overlay: 'group' | 'ime', selectionId?: string) => void;
  readonly nextTemporaryGeneration: () => number;
}

interface SourceManagementFiltersViewPort {
  readonly v9Pane: () => SourceV9View;
  readonly sources: () => BookSource[];
  readonly catalogGroupNames: () => string[];
}

interface SourceManagementFiltersActionsPort {
  readonly onV9Action: (action: SourceV9ListAction, sourceIds: string[]) => void;
}

interface SourceManagementFiltersFocusPort {
  readonly cancelToolsReturnFocus: (phase: string) => void;
  readonly prepareV9ListReturn: (view: SourceV9ListReturnView) => void;
  readonly onToolsEntryLayout: (identity: string, entry: SourceToolsEntry, area: Area) => void;
  readonly toolsFocusId: (entry: SourceToolsEntry) => string;
}

export interface SourceManagementFiltersHost {
  readonly native: SourceManagementFiltersNativePort;
  readonly presentation: SourceManagementFiltersPresentationPort;
  readonly opening: SourceManagementFiltersOpeningPort;
  readonly view: SourceManagementFiltersViewPort;
  readonly actions: SourceManagementFiltersActionsPort;
  readonly focus: SourceManagementFiltersFocusPort;
}

export interface SourceManagementFiltersView {
  readonly host: SourceManagementFiltersHost;
  readonly paint: () => SourceManagementFilterPaint;
  readonly results: SourceManagementFilterResults;
  readonly typography: SourceManagementFilterTypography;
  readonly paintGroupSearch: (identity: string) => void;
  readonly paintGroupFooter: (identity: string) => void;
}

@Observed
export class SourceManagementFilterPaint {
  @Track searchQuery: string = '';
  @Track searchInputRevision: number = 0;
  @Track statusValue: string = '全部';
  @Track categoryValue: string = 'all';
  @Track groupValue: string = '全部分组';
  @Track moreAnchor: ReaderRectVp | undefined = undefined;
  @Track groupClosing: boolean = false;
  @Track groupSearchQuery: string = '';
  @Track groupSelectionId: string = '';
  @Track groupX: number = 0;
  @Track groupY: number = 0;
  @Track groupTriggerWidth: number = 0;
  @Track groupTriggerHeight: number = 0;
  @Track groupClosingAnchor: ReaderRectVp | undefined = undefined;
}

/** Owns search and the filter values across the native group sheet and More menu. */
export class SourceManagementFiltersOwner {
  private moreFocusRevision: number = 0;
  private groupOptionsCache: string[] = [];
  private groupOptionsCacheSource: BookSource[] | undefined = undefined;
  private pendingGroupFocus: string = '';
  private groupFocusRevision: number = 0;
  private readonly verificationFilterTextMetrics: Map<SourceFilterTextLane, ReaderSourceTextMetrics> = new Map();
  private readonly verificationFilterTextRevisions: Map<SourceFilterTextLane, number> = new Map();
  private verificationGroupTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationGroupTextRevision: number = 0;

  readonly host: SourceManagementFiltersHost;
  readonly results: SourceManagementFilterResults;
  readonly typography: SourceManagementFilterTypography;
  private readonly view: SourceManagementFiltersView;

  constructor(view: SourceManagementFiltersView) {
    this.view = view;
    this.host = view.host;
    this.results = view.results;
    this.typography = view.typography;
  }

  paint(): SourceManagementFilterPaint { return this.view.paint(); }

  searchQuery(): string { return this.paint().searchQuery; }
  statusValue(): string { return this.paint().statusValue; }
  categoryValue(): string { return this.paint().categoryValue; }
  groupValue(): string { return this.paint().groupValue; }
  groupClosing(): boolean { return this.paint().groupClosing; }

  filtersInDefaultState(): boolean {
    return this.searchQuery().length === 0 && this.statusValue() === '全部' &&
      this.categoryValue() === 'all' && this.groupValue() === '全部分组';
  }
  paintGroupSearch(identity: string): void { this.view.paintGroupSearch(identity); }
  paintGroupFooter(identity: string): void { this.view.paintGroupFooter(identity); }

  startTypography(): void {
    this.verificationFilterTextMetrics.set('status', new ReaderSourceTextMetrics(''));
    this.verificationFilterTextMetrics.set('category', new ReaderSourceTextMetrics(''));
  }

  retireTypography(): void {
    this.verificationFilterTextMetrics.clear();
    this.verificationFilterTextRevisions.clear();
  }

  restore(view: SourceManagementViewState | undefined): void {
    this.paint().searchQuery = view?.searchQuery ?? '';
    this.paint().statusValue = view?.status ?? '全部';
    this.paint().categoryValue = view?.category ?? 'all';
    this.paint().groupValue = view?.group ?? '全部分组';
  }

  selectUngrouped(): void {
    this.paint().searchQuery = '';
    this.paint().searchInputRevision += 1;
    this.paint().statusValue = '全部';
    this.paint().categoryValue = 'all';
    this.paint().groupValue = '未分组';
  }

  retireMoreMenu(): void {
    this.closeMoreMenu();
    this.paint().moreAnchor = undefined;
  }

  invalidateGroupChoices(): void { this.groupOptionsCacheSource = undefined; }

  currentSelection(): string { return this.paint().groupSelectionId; }

  typographyPrepared(): boolean { return this.verificationFilterTextMetrics.size > 0; }

  hasGroupTypographyProbe(): boolean { return this.verificationGroupTextMetrics !== undefined; }

  retireGroupSelection(): void {
    this.cancelGroupFocus();
    this.verificationGroupTextMetrics = undefined;
    this.host.presentation.setGroupOpen(false);
    this.paint().groupClosing = false;
    this.paint().groupSearchQuery = '';
    this.paint().groupClosingAnchor = undefined;
    this.paint().groupSelectionId = '';
  }

  private ownsGroupSelection(identity: string): boolean {
    return this.host.opening.managementOpeningIsCurrent() && this.host.presentation.groupOpen() && identity.length > 0 && identity === this.paint().groupSelectionId;
  }

  toggleGroupSelection(): void {
    if (!this.host.opening.managementInputIsCurrent()) return;
    this.closeMoreMenu();
    if (this.requestGroupClose(this.paint().groupSelectionId) || this.groupOptions().length <= 1 ||
      this.paint().groupTriggerWidth <= 0 || this.paint().groupTriggerHeight <= 0) return;
    if (this.host.native.overlayBottom() - this.groupOverlayTop() < this.paint().groupTriggerHeight + 44 * 2 + 2 * TOK_BORDER_W ||
      this.paint().groupX - this.host.native.originX() >= this.host.native.overlayRight()) return;
    this.cancelGroupFocus();
    this.host.focus.cancelToolsReturnFocus('group');
    this.paint().groupSelectionId = `source-group:${this.host.opening.nextTemporaryGeneration()}`;
    this.pendingGroupFocus = this.paint().groupSelectionId;
    this.paint().groupClosing = false;
    this.host.presentation.setGroupOpen(true);
    this.prepareVerificationGroupText();
    this.host.opening.observeVerificationOverlay('open', 'group', this.paint().groupSelectionId);
  }

  requestGroupClose(identity: string, outside: boolean = false): boolean {
    if (!this.ownsGroupSelection(identity)) return false;
    if (outside && !this.paint().groupClosing) this.host.opening.observeVerificationOverlay('outside', 'group', identity);
    // The collapsing panel continues to consume Back until it dismisses.
    this.cancelGroupFocus();
    this.paint().groupClosing = true;
    if (outside) this.host.opening.hideManagementKeyboard(this.host.opening.temporaryBackIdentity());
    return true;
  }

  groupCloseAction(identity: string): () => void {
    return (): void => { if (this.host.opening.managementInputIsCurrent()) this.requestGroupClose(identity, true); };
  }

  commitGroupSelection(option: string, identity: string): void {
    if (!this.groupSearchIsCurrent(identity) || this.visibleGroupOptions().indexOf(option) < 0) return;
    this.cancelGroupFocus();
    // Applying a group can scroll the list to its top before the panel finishes closing.
    this.paint().groupClosingAnchor = this.groupTriggerAnchor();
    this.paint().groupClosing = true;
    this.host.opening.hideManagementKeyboard(this.host.opening.temporaryBackIdentity());
    this.paint().groupValue = option;
    this.results.changed('group');
  }

  groupSearchIsCurrent(identity: string): boolean {
    return this.host.opening.managementInputIsCurrent() && this.ownsGroupSelection(identity) && !this.paint().groupClosing;
  }

  changeGroupSearch(identity: string, value: string): void {
    if (this.groupSearchIsCurrent(identity)) this.paint().groupSearchQuery = value;
  }

  collapseGroupSearch(identity: string): void {
    if (this.groupSearchIsCurrent(identity) && this.requestGroupClose(identity)) {
      this.host.opening.hideManagementKeyboard(this.host.opening.temporaryBackIdentity());
    }
  }

  dismissGroupSelection(identity: string): void {
    if (!this.ownsGroupSelection(identity)) return;
    this.retireGroupSelection();
    this.host.opening.observeVerificationOverlay('dismiss', 'group', identity);
    const fallback = this.host.focus.toolsFocusId('header');
    this.scheduleGroupFocus(this.groupOptions().length > 1 ? [this.groupTriggerFocusId(), fallback] : [fallback]);
  }

  cancelGroupFocus(): void {
    this.pendingGroupFocus = '';
    this.groupFocusRevision += 1;
  }

  groupTriggerFocusId(): string { return `${this.host.opening.temporaryBackIdentity()}:group-trigger`; }

  groupPanelFocusPrefix(identity: string): string { return `${identity}:focus`; }

  groupPanelLayoutAction(identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (identity !== this.pendingGroupFocus || !this.ownsGroupSelection(identity) || this.paint().groupClosing ||
        readerPageAreaLength(next.width) <= 0 || readerPageAreaLength(next.height) <= 0) return;
      this.pendingGroupFocus = '';
      this.scheduleGroupFocus([`${this.groupPanelFocusPrefix(identity)}:selected`], identity);
      if (this.verificationGroupTextMetrics !== undefined) this.scheduleVerificationGroupText(identity, 'initial');
    };
  }

  private scheduleGroupFocus(targets: string[], selection: string = ''): void {
    if (!this.host.opening.managementOpeningIsCurrent() || !this.host.presentation.appForeground()) return;
    const mount = this.host.opening.temporaryBackIdentity();
    const revision = ++this.groupFocusRevision;
    try {
      this.host.native.getUIContext().postFrameCallback(new ReaderPostLayoutFrame(this.host.native.getUIContext(), (): void => {
        if (!this.host.opening.managementOpeningIsCurrent() || !this.host.presentation.appForeground() || mount !== this.host.opening.temporaryBackIdentity() ||
          revision !== this.groupFocusRevision || (selection.length > 0 ?
            !this.ownsGroupSelection(selection) || this.paint().groupClosing : this.host.presentation.groupOpen())) return;
        const controller = this.host.native.getUIContext().getFocusController();
        for (const target of targets) {
          try { controller.requestFocus(target); return; } catch (_unavailableTarget) {}
        }
      }));
    } catch (_unmounted) {}
  }

  recordMoreAnchor(identity: string, area: Area): void {
    this.host.focus.onToolsEntryLayout(identity, 'header', area);
    if (identity !== this.host.opening.temporaryBackIdentity()) return;
    this.paint().moreAnchor = new ReaderRectVp(this.host.native.numericAreaLength(area.globalPosition.x),
      this.host.native.numericAreaLength(area.globalPosition.y), readerPageAreaLength(area.width), readerPageAreaLength(area.height));
  }

  toggleMoreMenu(): void {
    if (!this.host.opening.managementInputIsCurrent() || this.host.presentation.groupOpen() || this.host.presentation.batchMode() || this.host.view.v9Pane() !== 'list') return;
    if (this.host.presentation.moreMenuOpen()) {
      this.closeMoreMenu(true);
      return;
    }
    this.host.opening.hideManagementKeyboard(this.host.opening.temporaryBackIdentity());
    this.host.focus.cancelToolsReturnFocus('more');
    this.host.presentation.setMoreMenuOpen(true);
    this.scheduleMoreFocus('reader-source-v9-open-subscriptions');
  }

  closeMoreMenu(restoreFocus: boolean = false): void {
    this.moreFocusRevision += 1;
    if (!this.host.presentation.moreMenuOpen()) return;
    this.host.presentation.setMoreMenuOpen(false);
    if (restoreFocus) this.scheduleMoreFocus(this.host.focus.toolsFocusId('header'));
  }

  private scheduleMoreFocus(id: string): void {
    const revision = ++this.moreFocusRevision;
    const identity = this.host.opening.temporaryBackIdentity();
    const context = this.host.native.getUIContext();
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.host.opening.managementBackIsCurrent(identity) || !this.host.opening.managementInputIsCurrent() || this.host.presentation.groupOpen() ||
          this.host.presentation.batchMode() || this.host.view.v9Pane() !== 'list' || revision !== this.moreFocusRevision) return;
        try { context.getFocusController().requestFocus(id); } catch (_unbound) {}
      }));
    } catch (_unmounted) {}
  }

  moreActions(): ReaderMenuActionView[] {
    return [
      new ReaderMenuActionView('subscriptions', '书源订阅', true, $r('app.media.source_v9_cloud')),
      new ReaderMenuActionView('groups', '分组管理', true, readerActionIcon('folder', this.host.presentation.appThemeScheme())),
      new ReaderMenuActionView('detect', '批量检测', this.results.projectedSourceCount() > 0, $r('app.media.source_v9_wave')),
      new ReaderMenuActionView('export', '导出全部书源', this.results.hasReadableSources(), $r('app.media.source_v9_upload')),
    ];
  }

  chooseMoreAction(id: string): void {
    if (!this.host.presentation.moreMenuOpen() || !this.host.opening.managementInputIsCurrent()) return;
    const action = this.moreActions().find((item: ReaderMenuActionView): boolean => item.id === id && item.enabled);
    if (action === undefined) return;
    this.closeMoreMenu(id === 'export');
    if (id === 'groups') this.host.focus.prepareV9ListReturn('groups');
    this.host.actions.onV9Action(id as SourceV9ListAction, id === 'detect' ? this.results.visibleIds() : []);
  }

  moreAnchorInPane(): ReaderRectVp {
    const anchor = this.paint().moreAnchor;
    return anchor === undefined ? new ReaderRectVp(this.host.native.viewportWidth() - this.host.native.geometry().header.insetRight - 44,
      this.host.native.geometry().content.startInset - 50, 44, 44) :
      new ReaderRectVp(anchor.left - this.host.native.originX(), anchor.top - this.host.native.originY(), anchor.width, anchor.height);
  }

  moreMenuRect(): ReaderRectVp {
    const spec = resolvePopupSpec('source-v9-more-menu');
    const rowHeight = readerScaledControlHeight(spec.actionHeight, spec.actionLineHeight, this.host.native.fontScale());
    const height = readerOverlayListHeight(0, rowHeight, this.moreActions().length, 0, 6, 6, 1, 0);
    const left = this.host.native.overlayLeft();
    const top = this.host.native.overlayTop() + 6;
    const viewport = new ReaderRectVp(left, top, this.host.native.overlayRight() - left, this.host.native.overlayBottom() - top - 6);
    return readerOverlayPanel(viewport, spec.width, height, 'anchor-end', this.moreAnchorInPane(), 8);
  }

  morePointerX(): number {
    const anchor = this.moreAnchorInPane();
    const panel = this.moreMenuRect();
    return Math.max(6, Math.min(panel.width - 18, anchor.left + anchor.width / 2 - panel.left - 6));
  }

  moreTransition(): TransitionEffect {
    if (this.host.presentation.reduceMotion()) return TransitionEffect.OPACITY.animation(readerMotionAnimateParam('dropdown.menu.expand', true));
    return TransitionEffect.asymmetric(
      TransitionEffect.scale({ x: 0.96, y: 0.92, centerX: '100%', centerY: 0 })
        .combine(TransitionEffect.OPACITY).animation(readerMotionAnimateParam('dropdown.menu.expand', false)),
      TransitionEffect.OPACITY.animation(readerMotionAnimateParam('dropdown.menu.collapse', false)));
  }

  moreMenuMaterial(): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision('popoverMenu', this.host.presentation.appearancePreferences(), this.host.presentation.appThemeScheme(), this.host.presentation.systemScheme());
  }

  sourceSearchInputIdentity(): string {
    return `${this.host.opening.temporaryBackIdentity()}:search:${this.paint().searchInputRevision}`;
  }

  applySourceSearchInput(identity: string, value?: string): void {
    if (identity !== this.sourceSearchInputIdentity() || !this.host.opening.managementOpeningIsCurrent()) return;
    if (!this.host.presentation.appForeground() || this.host.opening.isInputAllowed() === false || this.host.presentation.groupOpen()) {
      // A queued native edit may already have changed the control's buffer.
      // Rebind the field to the accepted draft while its foreground is suspended.
      if (value !== undefined && value !== this.paint().searchQuery) this.paint().searchInputRevision += 1;
      return;
    }
    if (value !== undefined) {
      if (value === this.paint().searchQuery) return;
      this.host.focus.cancelToolsReturnFocus('edit');
      this.paint().searchQuery = value;
    }
    this.results.changed('edit');
  }

  statusCount(id: string): number {
    if (id === 'enabled') return this.results.statusCounts().enabled;
    if (id === 'disabled') return this.results.statusCounts().disabled;
    return id === 'error' ? this.results.statusCounts().abnormal : this.results.statusCounts().all;
  }

  filterTextLayoutOptions(lane: SourceFilterTextLane, role: string, label: string): TextOptions | undefined {
    try { return this.verificationFilterTextMetrics.get(lane)?.track(`${lane}/${role}`, label); }
    catch (_unavailable) { return undefined; }
  }

  scheduleVerificationFilterText(lane: SourceFilterTextLane, phase: 'initial' | 'settled'): void {
    const metrics = this.verificationFilterTextMetrics.get(lane);
    if (metrics === undefined) return;
    try {
      const scope = this.typography.scope();
      if (scope === undefined || scope.fontScale < 1.99 || scope.fontScale > 2.01 ||
        (Math.abs(scope.widthVp - 320) > 0.4 && Math.abs(scope.widthVp - 366) > 0.4)) return;
      const revision = (this.verificationFilterTextRevisions.get(lane) ?? 0) + 1;
      this.verificationFilterTextRevisions.set(lane, revision);
      const key = JSON.stringify(scope);
      const context = this.host.native.getUIContext();
      const expectedRoles = lane === 'status' ? 4 : 6;
      const initiallyVisible = lane === 'status' ? 'status/enabled' : 'category/novel';
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationFilterTextMetrics.get(lane) !== metrics || this.verificationFilterTextRevisions.get(lane) !== revision ||
            JSON.stringify(this.typography.scope()) !== key) return;
          const labels = metrics.readTracked();
          if (allowNextFrame && (labels.length !== expectedRoles ||
            phase === 'initial' && !labels.some(label => label.role === initiallyVisible && label.lines.length > 0))) {
            allowNextFrame = false;
            context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.filter-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, lane, phase, revision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
    } catch (_detached) {}
  }

  private prepareVerificationGroupText(): void {
    if (!this.typography.hasProbe() || this.host.view.sources().length !== 12) return;
    const options = this.groupOptions();
    if (options.length !== 14 || !options.slice(2).every((option: string, index: number): boolean =>
      option === `Phase1 Scroll ${String(index + 1).padStart(2, '0')}`)) return;
    this.verificationGroupTextMetrics = new ReaderSourceTextMetrics('');
  }

  verificationGroupTextOptions(option: string, identity: string): TextOptions | undefined {
    if (!this.ownsGroupSelection(identity) || this.paint().groupClosing || !ReaderUIVerificationProbe.enabled()) return undefined;
    const role = option === 'Phase1 Scroll 01' ? 'group/option-head' :
      option === 'Phase1 Scroll 12' ? 'group/option-tail' : '';
    if (role.length === 0) return undefined;
    try { return this.verificationGroupTextMetrics?.track(role, option); }
    catch (_unavailable) { return undefined; }
  }

  scheduleVerificationGroupText(identity: string, phase: 'initial' | 'settled'): void {
    const metrics = this.verificationGroupTextMetrics;
    if (metrics === undefined || !this.ownsGroupSelection(identity) || this.paint().groupClosing) return;
    try {
      const scope = this.typography.scope('group');
      if (scope === undefined || this.host.presentation.expandedLayout() || Math.abs(scope.fontScale - 1) > 0.01) return;
      const key = JSON.stringify(scope);
      const revision = ++this.verificationGroupTextRevision;
      const role = phase === 'initial' ? 'group/option-head' : 'group/option-tail';
      const context = this.host.native.getUIContext();
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationGroupTextMetrics !== metrics || this.verificationGroupTextRevision !== revision ||
            !this.ownsGroupSelection(identity) || this.paint().groupClosing || JSON.stringify(this.typography.scope('group')) !== key) return;
          const labels = metrics.readTracked().filter(label => label.role === role);
          if (allowNextFrame && !labels.some(label => label.lines.length > 0)) {
            allowNextFrame = false;
            context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.surface-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, scope: 'group-menu', phase, selectionId: identity,
            revision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
    } catch (_detached) {}
  }

  private normalizedSourceGroup(source: BookSource): string {
    return source.group?.trim() ?? '';
  }

  groupOptions(): string[] {
    // 每次渲染都遍历全部书源并用 indexOf 去重是 O(n^2)；结果只在书源集合变化时失效。
    if (this.groupOptionsCacheSource === this.host.view.sources()) return this.groupOptionsCache;
    const options: string[] = ['全部分组', '未分组'];
    const seen: Set<string> = new Set<string>(options);
    for (const name of this.host.view.catalogGroupNames()) {
      if (!seen.has(name) && name.trim().length > 0) { options.push(name); seen.add(name); }
    }
    for (const source of this.host.view.sources()) {
      if (!sourceV9Supports(source)) continue;
      const group = this.normalizedSourceGroup(source);
      if (group === '' || group === '全部分组' || seen.has(group)) continue;
      seen.add(group);
      options.push(group);
    }
    this.groupOptionsCache = options;
    this.groupOptionsCacheSource = this.host.view.sources();
    return options;
  }

  visibleGroupOptions(): string[] {
    const options = this.groupOptions();
    const query = this.paint().groupSearchQuery.trim().toLowerCase();
    return query.length === 0 ? options : options.filter((option: string): boolean => option.toLowerCase().includes(query));
  }

  clearFilters(): void {
    if (!this.host.opening.managementInputIsCurrent() || this.host.presentation.groupOpen()) return;
    this.paint().searchQuery = '';
    this.paint().statusValue = '全部';
    this.paint().categoryValue = 'all';
    this.paint().groupValue = '全部分组';
    this.results.changed('clear');
  }

  recordGroupTrigger(area: Area): void {
    const width = this.host.native.numericAreaLength(area.width);
    const height = this.host.native.numericAreaLength(area.height);
    if (!this.host.opening.mounted() || width <= 0 || height <= 0) return;
    // Area already reports vp. Use the actual trigger box in the overlay's coordinates.
    this.paint().groupX = this.host.native.numericAreaLength(area.globalPosition.x);
    this.paint().groupY = this.host.native.numericAreaLength(area.globalPosition.y);
    this.paint().groupTriggerWidth = width;
    this.paint().groupTriggerHeight = height;
  }

  groupTriggerAnchor(): ReaderRectVp {
    const paint = this.paint();
    return paint.groupClosingAnchor ??
      new ReaderRectVp(paint.groupX, paint.groupY, paint.groupTriggerWidth, paint.groupTriggerHeight);
  }

  groupOverlayTop(): number {
    const anchor = this.paint().groupClosingAnchor?.top ?? this.paint().groupY;
    return Math.max(this.host.native.overlayTop(), Math.min(anchor - this.host.native.originY(), this.host.native.overlayBottom()));
  }

  groupSelectWidth(): number {
    const available = this.host.native.contentFrame().width;
    const text = this.paint().groupValue.length > 4 ? this.paint().groupValue : '全部分组';
    const style = TYPE_SELECT_SOURCE_GROUP_VALUE;
    const fallback = Math.ceil(style.fontSizeFp * text.length * this.host.native.fontScale());
    const context = this.host.native.getUIContext();
    const measured = context.px2vp(context.getMeasureUtils().measureText({ textContent: text,
      fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
    const label = Number.isFinite(measured) && measured > 0 ? Math.ceil(measured) : fallback;
    return Math.min(Math.max(96, label + 42), Math.max(0, Math.min(Math.round(132 * this.host.native.fontScale()), available * 0.42)));
  }

  filterProjection(): SourceV9Projection {
    return projectSourceManagementV9(this.host.view.sources(), { keyword: this.paint().searchQuery,
      group: this.paint().groupValue === '全部分组' ? undefined : this.paint().groupValue === '未分组' ? '' : this.paint().groupValue,
      category: this.paint().categoryValue, status: this.paint().statusValue });
  }
}

export interface SourceManagementFiltersOwnerSlot { readonly owner: SourceManagementFiltersOwner; }

@Builder
export function SourceManagementGroupSheet($$: SourceManagementFiltersOwnerSlot) {
  if ($$.owner.host.presentation.groupOpen()) {
    Row().width('100%').height('100%').backgroundColor(Color.Transparent)
      .id(`reader-source-group-backdrop:${$$.owner.paint().groupSelectionId}`)
      .hitTestBehavior(HitTestMode.Default).accessibilityLevel('no')
      .onClick($$.owner.groupCloseAction($$.owner.paint().groupSelectionId));
    ReaderSelectPanel({
      inputCurrent: (): boolean => $$.owner.host.opening.managementInputIsCurrent(),
      value: $$.owner.paint().groupValue,
      options: $$.owner.visibleGroupOptions(),
      variant: 'sourceGroup',
      controlWidth: Math.max(148, $$.owner.paint().groupClosingAnchor?.width ?? $$.owner.paint().groupTriggerWidth),
      menuHeaderHeight: $$.owner.paint().groupClosingAnchor?.height ?? $$.owner.paint().groupTriggerHeight,
      emptyOptionsText: '没有匹配的分组',
      menuHeader: (): void => { $$.owner.paintGroupSearch($$.owner.paint().groupSelectionId); },
      menuFooter: (): void => { $$.owner.paintGroupFooter($$.owner.paint().groupSelectionId); },
      menuFooterHeight: 44,
      onMenuHeaderCollapse: (identity: string): void => $$.owner.collapseGroupSearch(identity),
      reduceMotion: $$.owner.host.presentation.reduceMotion(),
      closing: $$.owner.paint().groupClosing,
      selectionId: $$.owner.paint().groupSelectionId,
      focusIdPrefix: $$.owner.groupPanelFocusPrefix($$.owner.paint().groupSelectionId),
      nativeAnchorId: 'reader-source-group-panel',
      auditOverlayAnchor: $$.owner.groupTriggerAnchor(),
      x: ($$.owner.paint().groupClosingAnchor?.left ?? $$.owner.paint().groupX) - $$.owner.host.native.originX(),
      y: ($$.owner.paint().groupClosingAnchor?.top ?? $$.owner.paint().groupY) - $$.owner.host.native.originY(),
      hostTopVp: $$.owner.groupOverlayTop(), hostBottomVp: $$.owner.host.native.overlayBottom(),
      hostLeftVp: $$.owner.host.native.overlayLeft(), hostRightVp: $$.owner.host.native.overlayRight(),
      optionTextLayoutOptions: !$$.owner.hasGroupTypographyProbe() ? undefined :
        (opt: string, identity: string): TextOptions | undefined => $$.owner.verificationGroupTextOptions(opt, identity),
      onOptionsScrollStop: !$$.owner.hasGroupTypographyProbe() ? undefined :
        (identity: string): void => $$.owner.scheduleVerificationGroupText(identity, 'settled'),
      onCommit: (opt: string, identity: string): void => $$.owner.commitGroupSelection(opt, identity),
      onDismiss: (identity: string): void => $$.owner.dismissGroupSelection(identity),
    }).onAreaChange($$.owner.groupPanelLayoutAction($$.owner.paint().groupSelectionId));
  }
}

@Builder
export function SourceManagementGroupFooter($$: SourceManagementFiltersOwnerSlot, identity: string) {
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Row({ space: 7 }) {
      Image($r('app.media.bookshelf_more_settings')).width(15).height(15)
        .fillColor(readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme())).accessibilityLevel('no');
      Text('管理分组').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13).maxLines(1)
        .fontColor(readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme()));
    }.width('100%').padding({ left: 14, right: 14 });
  }.id('reader-source-v9-manage-groups').width('100%').height(44).padding(0).borderRadius(0)
    .attributeModifier(new ReaderPressFeedback(readerAppColor('app.surface.menuSolid', $$.owner.host.presentation.appThemeScheme()),
      $$.owner.host.presentation.appThemeScheme(), 0, 0, !$$.owner.paint().groupClosing))
    .border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', $$.owner.host.presentation.appThemeScheme()) })
    .enabled(!$$.owner.paint().groupClosing).onClick((): void => {
      if (!$$.owner.groupSearchIsCurrent(identity)) return;
      $$.owner.host.opening.hideManagementKeyboard($$.owner.host.opening.temporaryBackIdentity());
      $$.owner.retireGroupSelection();
      $$.owner.host.focus.prepareV9ListReturn('groups');
      $$.owner.host.actions.onV9Action('groups', []);
    });
}

@Builder
export function SourceManagementGroupSearch($$: SourceManagementFiltersOwnerSlot, identity: string) {
  ReaderSearchField({
    variant: 'sourceGroup',
    sourceV9Chrome: true,
    mode: 'live',
    editingFocusId: `${identity}:search`,
    naturalFieldHeightVp: $$.owner.paint().groupClosingAnchor?.height ?? $$.owner.paint().groupTriggerHeight,
    text: $$.owner.paint().groupSearchQuery,
    placeholder: '搜索分组',
    editingCurrent: (): boolean => $$.owner.groupSearchIsCurrent(identity),
    onTextChange: (value: string): void => $$.owner.changeGroupSearch(identity, value),
  }).id('reader-source-group-search').enabled(!$$.owner.paint().groupClosing);
}

@Builder
export function SourceManagementMoreMenu($$: SourceManagementFiltersOwnerSlot) {
  if ($$.owner.host.presentation.moreMenuOpen()) {
    Row().width('100%').height('100%')
      .backgroundColor(Color.Transparent).hitTestBehavior(HitTestMode.Default)
      .accessibilityLevel('no').onClick((): void => $$.owner.closeMoreMenu(true));
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        ReaderActionMenuSurface({ specId: 'source-v9-more-menu', nativeId: 'reader-source-v9-more-menu',
          actionIdPrefix: 'reader-source-v9-open-', scheme: $$.owner.host.presentation.appThemeScheme(), availableWidth: $$.owner.moreMenuRect().width,
          viewportHeight: Math.max(0, $$.owner.moreMenuRect().height - 14),
          reduceMotion: $$.owner.host.presentation.reduceMotion(), actions: $$.owner.moreActions(),
          onAction: (id: string): void => $$.owner.chooseMoreAction(id) });
      }.width('100%').padding({ top: 6, bottom: 6 })
        .borderRadius(resolvePopupSpec('source-v9-more-menu').borderRadius).clip(true)
        .backgroundEffect(undefined)
        .backgroundColor($$.owner.moreMenuMaterial().native ? Color.Transparent : readerAppColor('app.surface.menuSolid', $$.owner.host.presentation.appThemeScheme()))
        .border($$.owner.moreMenuMaterial().native ? { width: 0, color: Color.Transparent } :
          { width: 1, color: readerAppColor('app.border.menu', $$.owner.host.presentation.appThemeScheme()) })
        .shadow($$.owner.moreMenuMaterial().native ? undefined : readerSurfaceElevation('popover', $$.owner.host.presentation.appThemeScheme()))
        .attributeModifier(new ReaderImmersiveMaterialModifier($$.owner.moreMenuMaterial(),
          readerNativeSurfaceOutline($$.owner.host.presentation.appThemeScheme(), resolvePopupSpec('source-v9-more-menu').borderRadius)));
      if (!$$.owner.moreMenuMaterial().native) {
        Row().width(12).height(12).rotate({ angle: 45 })
          .backgroundColor(readerAppColor('app.surface.menuSolid', $$.owner.host.presentation.appThemeScheme()))
          .border({ width: { top: 1, left: 1 }, color: readerAppColor('app.border.menu', $$.owner.host.presentation.appThemeScheme()) })
          .position({ x: $$.owner.morePointerX(), y: $$.owner.moreMenuRect().top < $$.owner.moreAnchorInPane().top ?
            $$.owner.moreMenuRect().height - 6 : -6 }).zIndex(1)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
      }
    }.width($$.owner.moreMenuRect().width).clip(false)
      .position({ x: $$.owner.moreMenuRect().left, y: $$.owner.moreMenuRect().top })
      .transition($$.owner.moreTransition());
  }
}

@Builder
export function SourceManagementSearchField($$: SourceManagementFiltersOwnerSlot) {
  Row({ space: TOK_SPACE_XS }) {
    Row() {
      ForEach([$$.owner.sourceSearchInputIdentity()], (identity: string): void => {
        ReaderSearchField({ editingHost: $$.owner.host.native.editingHost(),
          variant: 'sourceManagement', sourceV9Chrome: true,
          editingFocusId: 'reader-source-editor',
          mode: 'live',
          text: $$.owner.paint().searchQuery,
          placeholder: '搜索书源',
          accessibilityLabel: '搜索书源名称或域名',
          editingCurrent: (): boolean => identity === $$.owner.sourceSearchInputIdentity() &&
            $$.owner.host.opening.managementInputIsCurrent() && !$$.owner.host.presentation.groupOpen(),
          onTextChange: (value: string): void => $$.owner.applySourceSearchInput(identity, value),
          onSubmit: (): void => $$.owner.applySourceSearchInput(identity),
        });
      }, (identity: string): string => identity);
    }
    .layoutWeight(1)
    .height($$.owner.results.filterHeight());

    SourceFilterGroupFilter({ owner: $$.owner });
  }
  .id('reader-source-search')
  .width($$.owner.host.native.contentFrame().width)
  .constraintSize({ minHeight: $$.owner.results.filterHeight() })
  .alignItems(VerticalAlign.Center)
  .margin({ top: TOK_SPACE_XS });
}

@Builder
export function SourceManagementFilters($$: SourceManagementFiltersOwnerSlot) {
  SourceFilterStatusFilter({ owner: $$.owner });
}

@Builder
export function SourceManagementCategoryFilter($$: SourceManagementFiltersOwnerSlot) {
  Row({ space: 2 }) {
    ForEach(['all', 'novel', 'comic'], (category: string): void => {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(category === 'all' ? '全部' : readerSourceCategoryLabel(category as ReaderSourceCategory),
          category === 'all' ? $$.owner.typography.options('category/all', '全部') : undefined)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontSize(12).maxLines(1)
          .fontColor(readerAppColor($$.owner.paint().categoryValue === category ? 'app.sourceUi.primary' : 'app.sourceUi.muted', $$.owner.host.presentation.appThemeScheme()));
      }.layoutWeight(1).height('100%').padding(2).borderRadius(8)
        .attributeModifier(new ReaderPressFeedback($$.owner.paint().categoryValue === category ?
          readerAppColor('TOK_CARD_BG', $$.owner.host.presentation.appThemeScheme()) : Color.Transparent, $$.owner.host.presentation.appThemeScheme(), 8))
        .shadow(readerSurfaceElevation($$.owner.paint().categoryValue === category ? 'card' : 'embedded', $$.owner.host.presentation.appThemeScheme()))
        .animation($$.owner.host.presentation.reduceMotion() ? undefined : readerMotionAnimateParam('app.control.press', false))
        .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
        .accessibilityText(`书源类型，${category === 'all' ? '全部' : readerSourceCategoryLabel(category as ReaderSourceCategory)}`)
        .accessibilitySelected($$.owner.paint().categoryValue === category)
        .id(`source-category-${category}`)
        .onClick((): void => {
          if (!$$.owner.host.opening.managementInputIsCurrent() || $$.owner.host.presentation.groupOpen()) return;
          $$.owner.host.focus.cancelToolsReturnFocus('selection');
          $$.owner.paint().categoryValue = category;
          $$.owner.results.changed('category');
        });
    }, (category: string): string => category);
  }.id('reader-source-category-filter').width($$.owner.host.native.contentFrame().width)
    .height(32).padding(2).borderRadius(10).margin({ top: 12 })
    .backgroundColor(readerAppColor('app.sourceUi.field', $$.owner.host.presentation.appThemeScheme()));
}

@Builder
function SourceFilterStatusFilter($$: SourceManagementFiltersOwnerSlot) {
  Row({ space: 5 }) {
    SourceFilterChip({ owner: $$.owner }, '全部', 'all');
    SourceFilterChip({ owner: $$.owner }, '已启用', 'enabled');
    SourceFilterChip({ owner: $$.owner }, '已停用', 'disabled');
    SourceFilterChip({ owner: $$.owner }, '异常', 'error');
  }.id('reader-source-status-filter').width($$.owner.host.native.contentFrame().width).margin({ top: 8 });
}

@Builder
function SourceFilterChip($$: SourceManagementFiltersOwnerSlot, label: string, verificationId: string) {
  Button({ type: ButtonType.Capsule, stateEffect: false }) {
    Text(`${label} ${$$.owner.statusCount(verificationId)}`, verificationId === 'all' ? $$.owner.typography.options('status/all', `${label} ${$$.owner.statusCount(verificationId)}`) :
      $$.owner.filterTextLayoutOptions('status', verificationId, `${label} ${$$.owner.statusCount(verificationId)}`))
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
      .fontSize(11).textAlign(TextAlign.Center).maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .fontColor(readerAppColor($$.owner.paint().statusValue === label ? 'app.sourceUi.onPrimary' : 'app.sourceUi.muted', $$.owner.host.presentation.appThemeScheme()));
  }.id(`reader-source-status-${verificationId}`).layoutWeight(1)
    .height(28).padding({ left: 2, right: 2 })
    .attributeModifier(new ReaderPressFeedback(readerAppColor($$.owner.paint().statusValue === label ? 'app.sourceUi.primary' :
      'TOK_CARD_BG', $$.owner.host.presentation.appThemeScheme()), $$.owner.host.presentation.appThemeScheme(), 14))
    .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
    .border({ width: TOK_BORDER_W, color: $$.owner.paint().statusValue === label ?
      readerAppColor('app.sourceUi.primary', $$.owner.host.presentation.appThemeScheme()) : readerAppColor('app.sourceUi.border', $$.owner.host.presentation.appThemeScheme()) })
    .accessibilityText(`书源状态，${label}，${$$.owner.statusCount(verificationId)} 项`).accessibilitySelected($$.owner.paint().statusValue === label)
    .onClick((): void => {
      if (!$$.owner.host.opening.managementInputIsCurrent() || $$.owner.host.presentation.groupOpen()) return;
      $$.owner.host.focus.cancelToolsReturnFocus('selection');
      $$.owner.paint().statusValue = label;
      $$.owner.results.changed('status');
    });
}

@Builder
function SourceFilterGroupFilter($$: SourceManagementFiltersOwnerSlot) {
  Row() {
    ReaderSelect({
      value: $$.owner.paint().groupValue,
      options: $$.owner.groupOptions(),
      controlWidth: $$.owner.groupSelectWidth(),
      isOpen: $$.owner.host.presentation.groupOpen(),
      variant: 'sourceGroup',
      reduceMotion: $$.owner.host.presentation.reduceMotion(),
      focusId: $$.owner.groupTriggerFocusId(),
      onToggle: (): void => $$.owner.toggleGroupSelection(),
    })
    .id('reader-source-group-trigger')
    .visibility($$.owner.host.presentation.groupOpen() ? Visibility.Hidden : Visibility.Visible)
    .onAreaChange((_oldValue: Area, newValue: Area): void => $$.owner.recordGroupTrigger(newValue));
  }
  .id('reader-source-group-filter')
  .width($$.owner.groupSelectWidth())
  .height(40)
  .alignItems(VerticalAlign.Center);
}
