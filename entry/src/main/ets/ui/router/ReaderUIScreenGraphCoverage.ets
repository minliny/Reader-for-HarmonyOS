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
import {
  READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES,
} from './ReaderUIScreenGraphRetirementRegistry';

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
  retiredOnlyTypes: ComponentType[];
  faithfulTypes: ComponentType[];
  genericUsableTypes: ComponentType[];
  partialTypes: ComponentType[];
  insufficientTypes: ComponentType[];
  figmaUnboundStateTypes: ComponentType[];
  visibleFailureTypes: ComponentType[];
  runtimeActiveInstanceCount: number;
  retiredInstanceCount: number;
  faithfulInstanceCount: number;
  hostCompositeInstanceCount: number;
  genericUsableInstanceCount: number;
  partialInstanceCount: number;
  insufficientInstanceCount: number;
  figmaUnboundStateInstanceCount: number;
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
  'ReaderBottomBar',
  'DirectoryPanel',
  'AppearancePanel',
  'ReaderFullDirectoryPage',
  'ReaderFullTtsPage',
  'ReaderFullAppearancePage',
  'ReaderFullSettingsPage',
  'ReaderBookCachePage',
  'ReaderDebugInfoPage',
  'ReplacePanel',
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

// These surfaces deliberately reject fixture display values and project
// only live Store/Core/Host state (or an explicit unavailable state). They are
// generic usable surfaces, not partial adapters: consuming the canonical
// title/query/progress placeholder would make the native page less truthful.
// The screen-graph gate verifies that their direct renderer branches pass no
// canonical props or children into the production component.
export const READER_SCREEN_GRAPH_LIVE_STATE_PROJECTION_TYPES: ComponentType[] = [
  'ContinueReadingCard',
  'SearchResultsPage',
  'SyncProgressPage',
  'RssDetailPage',
  'AboutVersionPage',
];

// Conservative generic surfaces which consume their canonical data but do
// not yet claim one-to-one visual and interaction parity with Reader UI. The
// live-state projection list above is also generic, but intentionally rejects
// fixture display props instead of treating them as runtime facts.
export const READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES: ComponentType[] = [
  'ContinueReadingCard',
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
  'SearchResultsPage',
  'BookTocPreviewPage',
  'SourceTestResultPage',
  'SyncSettingsEntryPage',
  'SyncProgressPage',
  'RestoreConfirmPage',
  'RestoreProgressPage',
  'RestoreConflictPage',
  'RestoreResultPage',
  'RemoteWebDavBooksPage',
  'RssDetailPage',
  'AboutVersionPage',
  'LocalBookImportPage',
  'ReadingSettingsEntryPage',
  'GlobalSettingsPage',
  'BackupSettingsPage',
  'RssSubscriptionManagementPage',
  'AppShellStructure',
  'MainTabsStructure',
  'SearchStatePage',
  'SourceDisabledState',
  'SyncErrorPage',
  'RssEmptyState',
  'RssErrorState',
  'GlobalStatePage',
  'OfflineStatePage',
  'PermissionRequiredPage',
  'DirectoryPanel',
  'AppearancePanel',
  'ReplacePanel',
  'SourceSwitchFlowPage',
  'ReadingTextFlow',
];

// The current revision-bound Figma registry intentionally has no generic
// route-state master. These ScreenGraph leaves remain semantic/Core evidence
// but must stay visually inert: Search and Local Import own their separately
// admitted state components. Adding a visual implementation requires a Figma
// STATE_ADMISSIONS entry first; it must not be promoted by this local list.
export const READER_SCREEN_GRAPH_FIGMA_UNBOUND_STATE_TYPES: ComponentType[] = [
  'Loading',
  'Empty',
  'ErrorState',
  'Offline',
];

export const READER_SCREEN_GRAPH_PARTIAL_ENTRIES: ReaderUIScreenGraphPartialEntry[] = [
  { type: 'ReaderBase', reason: '49 host-composite instances retain Core/Host authority for live theme, text/info, pagination/anchor, and composite controls; 2 planned document formats stay fail-closed' },
  { type: 'SearchInputBox', reason: 'the historical generated SearchInputBox props are intentionally not rendered; current Figma Search owns the one composed header/input and the fragment remains inert to prevent a duplicate visual hierarchy' },
  { type: 'BookshelfEmptyPage', reason: 'the historical generated title/message fixture is intentionally not projected; current Figma State/BookshelfEmpty owns the exact visible component and its two crosswalk-bound actions' },
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

function componentInstanceKey(routeId: string, componentId: string): string {
  return routeId + '\u0000' + componentId;
}

function retiredComponentInstanceKeys(): Set<string> {
  const result: Set<string> = new Set<string>();
  for (let index: number = 0; index < READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES.length; index += 1) {
    result.add(componentInstanceKey(
      READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES[index].routeId,
      READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES[index].componentId,
    ));
  }
  return result;
}

function collectActiveComponentTypes(
  routeId: string,
  nodes: ScreenGraphComponentNode[],
  retiredKeys: Set<string>,
  activeTypes: Set<string>,
): void {
  for (let index: number = 0; index < nodes.length; index += 1) {
    const node: ScreenGraphComponentNode = nodes[index];
    if (!retiredKeys.has(componentInstanceKey(routeId, node.id))) {
      activeTypes.add(node.type);
    }
    collectActiveComponentTypes(routeId, node.children, retiredKeys, activeTypes);
  }
}

function activeInstanceCountForNodes(
  routeId: string,
  nodes: ScreenGraphComponentNode[],
  includedTypes: Set<string>,
  retiredKeys: Set<string>,
): number {
  let total: number = 0;
  for (let index: number = 0; index < nodes.length; index += 1) {
    const node: ScreenGraphComponentNode = nodes[index];
    if (includedTypes.has(node.type) &&
      !retiredKeys.has(componentInstanceKey(routeId, node.id))) {
      total += 1;
    }
    total += activeInstanceCountForNodes(routeId, node.children, includedTypes, retiredKeys);
  }
  return total;
}

function activeInstanceCount(
  registry: ScreenGraphRegistry,
  types: ComponentType[],
  retiredKeys: Set<string>,
): number {
  const includedTypes: Set<string> = typeSet(types);
  let total: number = 0;
  for (let routeIndex: number = 0; routeIndex < registry.document.routes.length; routeIndex += 1) {
    const routeId: string = registry.document.routes[routeIndex].routeId;
    const variants = registry.document.routes[routeIndex].variants;
    for (let variantIndex: number = 0; variantIndex < variants.length; variantIndex += 1) {
      total += activeInstanceCountForNodes(routeId, variants[variantIndex].components, includedTypes, retiredKeys);
    }
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
    const retiredKeys: Set<string> = retiredComponentInstanceKeys();
    const activeTypes: Set<string> = new Set<string>();
    for (let routeIndex: number = 0; routeIndex < registry.document.routes.length; routeIndex += 1) {
      const routeId: string = registry.document.routes[routeIndex].routeId;
      const variants = registry.document.routes[routeIndex].variants;
      for (let variantIndex: number = 0; variantIndex < variants.length; variantIndex += 1) {
        collectActiveComponentTypes(routeId, variants[variantIndex].components, retiredKeys, activeTypes);
      }
    }
    const dispatchSet: Set<string> = typeSet(READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES);
    const genericSet: Set<string> = typeSet(READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES);
    const partialSet: Set<string> = partialTypeSet();
    const figmaUnboundStateSet: Set<string> = typeSet(READER_SCREEN_GRAPH_FIGMA_UNBOUND_STATE_TYPES);
    const faithful: ComponentType[] = [];
    const generic: ComponentType[] = [];
    const partial: ComponentType[] = [];
    const insufficient: ComponentType[] = [];
    const figmaUnboundStates: ComponentType[] = [];
    const retiredOnly: ComponentType[] = [];

    for (let index: number = 0; index < referenced.length; index += 1) {
      const type: ComponentType = referenced[index];
      if (!activeTypes.has(type)) {
        retiredOnly.push(type);
      } else if (!dispatchSet.has(type)) {
        insufficient.push(type);
      } else if (figmaUnboundStateSet.has(type)) {
        figmaUnboundStates.push(type);
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
    const runtimeActiveInstanceCount: number = activeInstanceCount(registry, referenced, retiredKeys);
    const retiredInstanceCount: number = canonicalInstanceCount - runtimeActiveInstanceCount;
    const faithfulInstanceCount: number = activeInstanceCount(registry, faithful, retiredKeys);
    const hostCompositeInstanceCount: number = activeInstanceCount(registry, hostComposites, retiredKeys);
    const genericUsableInstanceCount: number = activeInstanceCount(registry, generic, retiredKeys);
    const partialInstanceCount: number = activeInstanceCount(registry, partial, retiredKeys);
    const insufficientInstanceCount: number = activeInstanceCount(registry, insufficient, retiredKeys);
    const figmaUnboundStateInstanceCount: number = activeInstanceCount(
      registry,
      figmaUnboundStates,
      retiredKeys,
    );

    if (faithfulInstanceCount + genericUsableInstanceCount + partialInstanceCount +
      insufficientInstanceCount + figmaUnboundStateInstanceCount !== runtimeActiveInstanceCount) {
      throw new Error('Harmony ScreenGraph instance coverage must partition runtime-active instances');
    }
    if (runtimeActiveInstanceCount + retiredInstanceCount !== canonicalInstanceCount) {
      throw new Error('Harmony ScreenGraph active and retired instances must partition canonical instances');
    }
    if (faithful.length + generic.length + partial.length + insufficient.length +
      figmaUnboundStates.length + retiredOnly.length !== referenced.length) {
      throw new Error('Harmony ScreenGraph type coverage must partition canonical referenced types');
    }

    return {
      authority: ReaderUIScreenGraphAuthority.Shadow,
      canonicalComponentCount: catalog.length,
      canonicalInstanceCount,
      referencedTypes: referenced,
      explicitGapTypes: explicitGaps,
      explicitDispatchTypes: READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES,
      hostCompositeTypes: hostComposites,
      retiredOnlyTypes: retiredOnly,
      faithfulTypes: faithful,
      genericUsableTypes: generic,
      partialTypes: partial,
      insufficientTypes: insufficient,
      figmaUnboundStateTypes: figmaUnboundStates,
      visibleFailureTypes: visibleFailures,
      runtimeActiveInstanceCount,
      retiredInstanceCount,
      faithfulInstanceCount,
      hostCompositeInstanceCount,
      genericUsableInstanceCount,
      partialInstanceCount,
      insufficientInstanceCount,
      figmaUnboundStateInstanceCount,
      explicitTargetBindingCount,
      tapZoneExplicitTargetBindingCount,
      // A state leaf with no Figma state admission is intentionally inert, not
      // a successful visual adapter. Keep it separate from visible failures so
      // product routing can remain fail-closed, but never claim the registry
      // or renderer is complete until Figma supplies the master.
      isAdapterRegistryClosed: visibleFailures.length === 0 && figmaUnboundStates.length === 0,
      isFullRenderer: visibleFailures.length === 0 && generic.length === 0 &&
        figmaUnboundStates.length === 0,
    };
  }
}
