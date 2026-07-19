// Machine-executable coverage for the native ViewState renderer while the
// generated ScreenGraph remains Shadow-only.  "Explicit dispatch" is not the
// same as faithful rendering: partial entries have a real ArkUI branch but
// currently drop canonical props or children before reaching that branch.
import { ComponentType } from '../../contract/reader_ui/ViewState';
import {
  ScreenGraphComponentCatalogEntry,
  ScreenGraphComponentNode,
  ScreenGraphRegistry,
} from '../../contract/reader_ui/ScreenGraph';
import { ReaderUIScreenGraphAuthority } from './ReaderUIScreenGraphShadowRegistry';

export interface ReaderUIScreenGraphPartialEntry {
  type: ComponentType;
  reason: string;
}

export interface ReaderUIScreenGraphComponentCoverage {
  authority: ReaderUIScreenGraphAuthority;
  canonicalComponentCount: number;
  canonicalInstanceCount: number;
  referencedTypes: ComponentType[];
  explicitGapTypes: ComponentType[];
  explicitDispatchTypes: ComponentType[];
  hostCompositeTypes: ComponentType[];
  faithfulTypes: ComponentType[];
  genericUsableTypes: ComponentType[];
  partialTypes: ComponentType[];
  insufficientTypes: ComponentType[];
  visibleFailureTypes: ComponentType[];
  faithfulInstanceCount: number;
  hostCompositeInstanceCount: number;
  genericUsableInstanceCount: number;
  partialInstanceCount: number;
  insufficientInstanceCount: number;
  explicitTargetBindingCount: number;
  tapZoneExplicitTargetBindingCount: number;
  isAdapterRegistryClosed: boolean;
  isFullRenderer: boolean;
}

// Keep this list independent from the canonical referenced set. The
// check:screen-graph source gate verifies it against ViewStateRenderer.ets, so
// a new renderer branch or a removed branch cannot silently change coverage.
export const READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES: ComponentType[] = [
  'AppTopBar',
  'BackTopBar',
  'DiscoverSourceBar',
  'DiscoverEntryRow',
  'DiscoverFilterTrigger',
  'DiscoverListHead',
  'DiscoverBookList',
  'DiscoverStatePage',
  'DiscoverSourceBulkPage',
  'DiscoverSourceLoginPage',
  'DiscoverRuleTestPage',
  'BottomNav',
  'ContinueReadingCard',
  'BookshelfShelfSection',
  'ShelfSectionHeader',
  'BookGrid',
  'BookCard',
  'ProgressBar',
  'RssSearchEntry',
  'RssModeRow',
  'RssSourceOverview',
  'RssArticleSection',
  'RssAllPage',
  'RssOriginalPage',
  'RssRefreshingPage',
  'RssOriginalBrowserPage',
  'RssFavoriteGroupsPage',
  'RssSourceGroupsPage',
  'RssSourceImportPage',
  'RssSourceEditPage',
  'SettingsHomePage',
  'SettingsGeneralPage',
  'BookshelfSearchSettingsPage',
  'ProgressSyncPage',
  'SettingsListItem',
  'SearchInputBox',
  'ScopeSelector',
  'GroupSelector',
  'SearchHistoryList',
  'BookCover',
  'BookHero',
  'BookSummaryCard',
  'BookChapterList',
  'ReadingBackgroundLayer',
  'ReadingTextFlow',
  'ReadingInfoLayer',
  'TapZones',
  'Loading',
  'Empty',
  'Error',
  'ErrorState',
  'Offline',
  'Permission',
  'Toast',
  'Dialog',
  'List',
  'ListRow',
  'Button',
  'Toggle',
  'Slider',
  'Dropdown',
  'Input',
  'FormSection',
  'Content',
  'WebView',
  'ReaderBase',
  'ReaderTopArea',
  'ReaderControlSheet',
  'ReaderBottomBar',
  'ReaderDirectoryPanel',
  'ReaderAppearancePanel',
  'ReaderTtsPanel',
  'ReaderSettingsPanel',
  'ReaderFullDirectoryPage',
  'ReaderFullTtsPage',
  'ReaderFullAppearancePage',
  'ReaderFullSettingsPage',
  'ReaderBookCachePage',
  'ReaderDebugInfoPage',
  'ReaderSearchPanel',
  'ReaderReplacePanel',
  'ReaderAutoScrollPanel',
  'FloatingPageControl',
  'NightToast',
  'SourceSwitchResultsPanel',
  'SourceSwitchFlowPage',
  'SourceImportPreviewPage',
  'SourceGroupsPage',
  'SourceDetectPage',
  'SourceDebugPage',
  'SourceDebugRunningPage',
  'SourceDebugResultPage',
  'SourceDebugContentLogPage',
  'SourceCodeViewPage',
  'SourceLogsPage',
  'SourceDeleteConfirmPage',
  'SourceRuleEditPage',
  'SourceBatchPage',
  'AppShellStructure',
  'MainTabsStructure',
  'SearchHomePage',
  'SearchResultsPage',
  'SearchStatePage',
  'BookTocPreviewPage',
  'BookshelfEmptyPage',
  'SourceManagementPage',
  'SourceDetailPage',
  'SourceImportOptionsPage',
  'SourceDisabledState',
  'SourceTestResultPage',
  'SyncSettingsEntryPage',
  'SyncBackupPage',
  'SyncErrorPage',
  'SyncProgressPage',
  'RestoreConfirmPage',
  'RestoreProgressPage',
  'RestoreConflictPage',
  'RestoreResultPage',
  'RemoteWebDavBooksPage',
  'RssDetailPage',
  'RssEmptyState',
  'RssErrorState',
  'GlobalStatePage',
  'OfflineStatePage',
  'PermissionRequiredPage',
  'AboutVersionPage',
  'LocalBookImportPage',
  'ReadingSettingsEntryPage',
  'BookMoreMenuPage',
  'BookGroupManagementPage',
  'GroupManagementPage',
  'BookBatchManagementPage',
  'BookDirectoryPage',
  'AboutFeedbackPage',
  'SourceFormPage',
  'GlobalSettingsPage',
  'BackupSettingsPage',
  'RssSubscriptionManagementPage',
];

// Dialog is data-complete and has a dedicated renderer, but five canonical
// nested Button bindings still lack exact Host/reducer/runtime ownership.
// Rendering those actions inert is safe generic usability, not faithful
// interaction parity.
export const READER_SCREEN_GRAPH_DIALOG_GENERIC_BLOCKER: string =
  '5 executable nested Button bindings remain inert: reader.font.import, reader.font.delete, reader.theme.delete, reader.typography.reset, reader.progress.restore';

// These page types deliberately reject fixture display values and project
// only live Store/Core/Host state (or an explicit unavailable state). They are
// generic usable surfaces, not partial adapters: consuming the canonical
// title/query/progress placeholder would make the native page less truthful.
// The screen-graph gate verifies that their direct renderer branches pass no
// canonical props or children into the production component.
export const READER_SCREEN_GRAPH_LIVE_STATE_PROJECTION_TYPES: ComponentType[] = [
  'SearchResultsPage',
  'SyncProgressPage',
  'RssDetailPage',
  'AboutVersionPage',
  'BookMoreMenuPage',
];

// Conservative generic surfaces which consume their canonical data but do
// not yet claim one-to-one visual and interaction parity with Reader UI. The
// live-state projection list above is also generic, but intentionally rejects
// fixture display props instead of treating them as runtime facts.
export const READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES: ComponentType[] = [
  'Toast',
  'Dialog',
  'Button',
  'ProgressBar',
  'SettingsListItem',
  'BookCover',
  'ListRow',
  'Toggle',
  'Slider',
  'Dropdown',
  'Input',
  'WebView',
  'SourceFormPage',
  'ReaderBookCachePage',
  'Content',
  'ReaderTopArea',
  'FormSection',
  'FloatingPageControl',
  'SourceRuleEditPage',
  'SettingsGeneralPage',
  'SourceManagementPage',
  'RssSourceImportPage',
  'List',
  'SourceSwitchResultsPanel',
  'SearchResultsPage',
  'BookTocPreviewPage',
  'SourceTestResultPage',
  'SyncSettingsEntryPage',
  'SyncProgressPage',
  'RemoteWebDavBooksPage',
  'RssDetailPage',
  'AboutVersionPage',
  'LocalBookImportPage',
  'ReadingSettingsEntryPage',
  'BookMoreMenuPage',
  'BookGroupManagementPage',
  'GroupManagementPage',
  'GlobalSettingsPage',
  'BackupSettingsPage',
  'RssSubscriptionManagementPage',
  'AppShellStructure',
  'MainTabsStructure',
  'SearchStatePage',
  'BookshelfEmptyPage',
  'SourceDisabledState',
  'SyncErrorPage',
  'RssEmptyState',
  'RssErrorState',
  'GlobalStatePage',
  'OfflineStatePage',
  'PermissionRequiredPage',
  'ReaderDirectoryPanel',
  'ReaderAppearancePanel',
  'ReaderReplacePanel',
  'SourceSwitchFlowPage',
  'ReadingTextFlow',
];

export const READER_SCREEN_GRAPH_PARTIAL_ENTRIES: ReaderUIScreenGraphPartialEntry[] = [
  { type: 'ReaderBase', reason: '49 host-composite instances retain Core/Host authority for live theme, text/info, pagination/anchor, and composite controls; 2 planned document formats stay fail-closed' },
];

function typeSet(types: ComponentType[]): Set<string> {
  const result: Set<string> = new Set<string>();
  for (let index: number = 0; index < types.length; index += 1) result.add(types[index]);
  return result;
}

function partialTypeSet(): Set<string> {
  const result: Set<string> = new Set<string>();
  for (let index: number = 0; index < READER_SCREEN_GRAPH_PARTIAL_ENTRIES.length; index += 1) {
    result.add(READER_SCREEN_GRAPH_PARTIAL_ENTRIES[index].type);
  }
  return result;
}

function instanceCount(entries: ScreenGraphComponentCatalogEntry[], types: ComponentType[]): number {
  const included: Set<string> = typeSet(types);
  let total: number = 0;
  for (let index: number = 0; index < entries.length; index += 1) {
    if (included.has(entries[index].type)) total += entries[index].instanceCount;
  }
  return total;
}

interface ReaderUIScreenGraphTargetBindingCounts {
  total: number;
  tapZones: number;
}

function targetBindingCounts(nodes: ScreenGraphComponentNode[]): ReaderUIScreenGraphTargetBindingCounts {
  let total: number = 0;
  let tapZones: number = 0;
  for (let index: number = 0; index < nodes.length; index += 1) {
    const node: ScreenGraphComponentNode = nodes[index];
    for (let bindingIndex: number = 0; bindingIndex < node.bindings.length; bindingIndex += 1) {
      if (node.bindings[bindingIndex].target.length === 0) continue;
      total += 1;
      if (node.type === 'TapZones') tapZones += 1;
    }
    const childCounts: ReaderUIScreenGraphTargetBindingCounts = targetBindingCounts(node.children);
    total += childCounts.total;
    tapZones += childCounts.tapZones;
  }
  return { total: total, tapZones: tapZones };
}

export class ReaderUIScreenGraphCoverageRegistry {
  static partialReason(type: ComponentType): string | undefined {
    for (let index: number = 0; index < READER_SCREEN_GRAPH_PARTIAL_ENTRIES.length; index += 1) {
      const entry: ReaderUIScreenGraphPartialEntry = READER_SCREEN_GRAPH_PARTIAL_ENTRIES[index];
      if (entry.type === type) return entry.reason;
    }
    return undefined;
  }

  static loadCanonical(): ReaderUIScreenGraphComponentCoverage {
    const registry: ScreenGraphRegistry = ScreenGraphRegistry.loadCanonical();
    const catalog: ScreenGraphComponentCatalogEntry[] = registry.document.componentCatalog;
    const referenced: ComponentType[] = [];
    const explicitGaps: ComponentType[] = [];
    const hostComposites: ComponentType[] = [];
    for (let index: number = 0; index < catalog.length; index += 1) {
      if (catalog[index].status === 'referenced') referenced.push(catalog[index].type);
      if (catalog[index].status === 'explicit-gap') explicitGaps.push(catalog[index].type);
      if (catalog[index].status === 'referenced' && catalog[index].compositionMode === 'host-composite') {
        hostComposites.push(catalog[index].type);
      }
    }

    let explicitTargetBindingCount: number = 0;
    let tapZoneExplicitTargetBindingCount: number = 0;
    for (let routeIndex: number = 0; routeIndex < registry.document.routes.length; routeIndex += 1) {
      const variants = registry.document.routes[routeIndex].variants;
      for (let variantIndex: number = 0; variantIndex < variants.length; variantIndex += 1) {
        const counts: ReaderUIScreenGraphTargetBindingCounts = targetBindingCounts(variants[variantIndex].components);
        explicitTargetBindingCount += counts.total;
        tapZoneExplicitTargetBindingCount += counts.tapZones;
      }
    }

    const referencedSet: Set<string> = typeSet(referenced);
    const dispatchSet: Set<string> = typeSet(READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES);
    const genericSet: Set<string> = typeSet(READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES);
    const partialSet: Set<string> = partialTypeSet();
    const faithful: ComponentType[] = [];
    const generic: ComponentType[] = [];
    const partial: ComponentType[] = [];
    const insufficient: ComponentType[] = [];

    for (let index: number = 0; index < referenced.length; index += 1) {
      const type: ComponentType = referenced[index];
      if (!dispatchSet.has(type)) {
        insufficient.push(type);
      } else if (partialSet.has(type)) {
        partial.push(type);
      } else if (genericSet.has(type)) {
        generic.push(type);
      } else {
        faithful.push(type);
      }
    }

    for (let index: number = 0; index < READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES.length; index += 1) {
      if (!referencedSet.has(READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES[index])) {
        throw new Error('Harmony ScreenGraph dispatch type is not canonical referenced');
      }
    }
    for (let index: number = 0; index < READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES.length; index += 1) {
      if (partialSet.has(READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES[index])) {
        throw new Error('Harmony ScreenGraph type cannot be both generic and partial');
      }
    }

    const visibleFailures: ComponentType[] = partial.concat(insufficient);
    const canonicalInstanceCount: number = instanceCount(catalog, referenced);
    const faithfulInstanceCount: number = instanceCount(catalog, faithful);
    const hostCompositeInstanceCount: number = instanceCount(catalog, hostComposites);
    const genericUsableInstanceCount: number = instanceCount(catalog, generic);
    const partialInstanceCount: number = instanceCount(catalog, partial);
    const insufficientInstanceCount: number = instanceCount(catalog, insufficient);

    if (faithfulInstanceCount + genericUsableInstanceCount + partialInstanceCount +
      insufficientInstanceCount !== canonicalInstanceCount) {
      throw new Error('Harmony ScreenGraph instance coverage must partition canonical instances');
    }

    return {
      authority: ReaderUIScreenGraphAuthority.Shadow,
      canonicalComponentCount: catalog.length,
      canonicalInstanceCount,
      referencedTypes: referenced,
      explicitGapTypes: explicitGaps,
      explicitDispatchTypes: READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES,
      hostCompositeTypes: hostComposites,
      faithfulTypes: faithful,
      genericUsableTypes: generic,
      partialTypes: partial,
      insufficientTypes: insufficient,
      visibleFailureTypes: visibleFailures,
      faithfulInstanceCount,
      hostCompositeInstanceCount,
      genericUsableInstanceCount,
      partialInstanceCount,
      insufficientInstanceCount,
      explicitTargetBindingCount,
      tapZoneExplicitTargetBindingCount,
      isAdapterRegistryClosed: visibleFailures.length === 0,
      isFullRenderer: visibleFailures.length === 0 && generic.length === 0,
    };
  }
}
