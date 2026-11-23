import { sourceUnknownToggle, sourceUnknownToggleNativeId } from './source-unknown-expand.mjs';
import { EvidenceError, nativeBounds, normalReaderWindowRoots } from '../../lib/native-ui-evidence.mjs';
import { matchesReservedSourceNativeToggle, publicReservedSourceHost } from './source-reserved-typography.mjs';

const TREE_SOURCE = 'native-tree';
const WINDOW_SOURCE = 'window-metrics';
export const sourceFooterToolsButton = {
  id:'reader-source-footer-tools-button',
  ancestors:['reader-source-footer'],
};
export const sourceHeaderToolsButton = {
  id:'reader-source-header-tools-button',
  ancestors:['reader-source-header-tools'],
};
export const sourceGroupOptionsScroll = 'reader-source-group-options-scroll';
export const sourceGroupOptionsReference = 'reader-source-group-scroll-reference';
export const sourceGroupOptionsTail = 'reader-source-group-tail-option';
export const sourceGroupOptionsTextHead = 'reader-source-group-scroll-head-option';
const RECT_KEYS = ['left', 'top', 'width', 'height'];
const INSET_KEYS = ['left', 'top', 'right', 'bottom'];
const MAX_NODES = 20_000;
const stableId = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(value);

const missing = reason => ({ reason });
const boolean = value => value === true || value === 'true' ? true :
  value === false || value === 'false' ? false : null;
const finiteNumber = value => (typeof value === 'number' || (
  typeof value === 'string' && /^-?\d+(?:\.\d+)?$/u.test(value)
)) && Number.isFinite(Number(value)) ? Number(value) : null;
const positive = value => Number.isFinite(value) && value > 0;
const nonNegative = value => Number.isFinite(value) && value >= 0;
const pixelRect = (left, top, width, height) => ({ left, top, width, height });
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const area = rect => rect.width * rect.height;
const searchLabels = new Map([['搜索', 'search'], ['停止搜索', 'stop'], ['停止', 'stop']]);
const searchSheetTitles = ['筛选', '搜索进度'];
export const searchConfirmedEmptyHeading = 'reader-search-confirmed-empty-heading';
export const searchUnconfirmedEmptyHeading = 'reader-search-unconfirmed-empty-heading';
export const searchMismatchedEmptyHeading = 'reader-search-mismatched-empty-heading';
const searchResultPrefix = 'reader-search-result:';
const sourceReadHosts = new Set(['reader-source-empty-state', 'reader-source-filter-block', 'reader-source-pending-recovery']);
const sourceRowActionTitle = 'Reader Phase 1 Row Actions';
const sourceRowActionUrl = 'https://row-actions.reader-phase1.invalid/';
const sourceRowActionHost = new URL(sourceRowActionUrl).hostname;
const sourceOfflineDetectTitle = 'Reader Phase 1 Offline Detect';
const sourceOfflineDetectUrl = 'https://offline-detect.reader-phase1.invalid/';
const sourceOfflineDetectHost = new URL(sourceOfflineDetectUrl).hostname;
const sourceRowActionLabels = [
  ['检测', 'reader-source-row-detect-control'],
  ['登录', 'reader-source-row-login-control'],
];
const layoutKinds = new Set(['gap', 'align', 'contain', 'nonOverlap', 'clip', 'keyboardAvoidance', 'visibleFraction', 'relativeDelta']);
// Book identities are compared only inside replay and never serialized.
const publicSearchResultKeys = new WeakMap();

function addReadingSearchAliases(nodes) {
  for (const node of nodes) {
    const editor = node.type === 'TextInput' && /^reader-content-search-input-[1-9]\d*$/u.test(node.id);
    const firstResult = node.type === 'Button' && /^reader-control-search-result:[1-9]\d*:0$/u.test(node.id);
    if (!editor && !firstResult) continue;
    const parents = ancestorsOf({nodes}, node);
    const container = parents.findIndex(parent => editor ? parent.id === 'reader-control-search-field' :
      parent.type === 'List' && parent.id === 'reader-control-search-results');
    if (container >= 0 && parents.slice(container + 1).some(parent => parent.id === 'reader-control-module-search')) {
      node.alias = editor ? 'reader-control-search-editor' : 'reader-control-search-first-result';
    }
  }
}

export function publicSearchResultContinuity(before, after) {
  const left = publicSearchResultKeys.get(before), right = publicSearchResultKeys.get(after);
  if (!left || !right) return null;
  const [beforePage,beforeQuery,beforeBook] = left;
  const [afterPage,afterQuery,afterBook] = right;
  return {beforePage,beforeQuery,afterPage,afterQuery,sameBook:beforeBook === afterBook};
}

function backgroundAlpha(color) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{8}$/iu.test(color)) return null;
  return Number.parseInt(color.slice(1, 3), 16) / 255;
}

function submitSemantic(node) {
  const button = node.attributes;
  if (button.id !== 'reader-bookshelf-search-submit') return undefined;
  const values = [button.description, button.text, button.originalText, button.accessibilityText, button.contentDescription];
  // UITest may expose the standard button's visible label only as its Text child.
  for (const {attributes: label} of node.children ?? []) {
    if (label?.type === 'Text' && String(label.hostWindowId) === String(button.hostWindowId) && boolean(label.visible) === true) {
      values.push(label.originalText, label.text);
    }
  }
  const semantics = [...new Set(values.map(value => searchLabels.get(value)).filter(Boolean))];
  if (semantics.length === 1) return semantics[0];
  return undefined;
}

function matchesNativeText(attributes, windowId, title) {
  return attributes?.type === 'Text' && String(attributes.hostWindowId) === windowId &&
    boolean(attributes.visible) === true && positive(finiteNumber(attributes.opacity)) &&
    [attributes.originalText, attributes.text].includes(title);
}

function sourceRowButtonLabels(button, windowId) {
  const visibleContainer = (node, type) => node.attributes?.type === type &&
    String(node.attributes.hostWindowId) === windowId && boolean(node.attributes.visible) === true &&
    positive(finiteNumber(node.attributes.opacity));
  const children = button.children ?? [];
  // Compact buttons expose a direct Text. Detect may instead put its label
  // beside the status glyph inside the compact native Stack and Row.
  const compound = children.filter(child => visibleContainer(child,'Stack'))
    .flatMap(child => (child.children ?? []).filter(row => visibleContainer(row,'Row')))
    .flatMap(row => row.children ?? []);
  const directLabels = children.flatMap(child => sourceRowActionLabels.filter(([title]) =>
    matchesNativeText(child.attributes,windowId,title)));
  const detect = sourceRowActionLabels[0];
  return [...directLabels,...compound.filter(child => matchesNativeText(child.attributes,windowId,detect[0])).map(() => detect)];
}

function quickAutoPageSpeedRow(node, path, windowId) {
  const children = node.children ?? [];
  const indexes = predicate => children.flatMap((child,index) => predicate(child) ? [index] : []);
  const current = indexes(child => child.attributes?.id === 'reader-auto-speed-current');
  if (current.length !== 1) return;
  const label = children[current[0]].attributes;
  const seconds = /^([2-9]|1\d|20) 秒$/u.exec(label.text)?.[1];
  if (!seconds || !matchesNativeText(label,windowId,label.text) ||
      label.originalText && label.originalText !== label.text) return;
  const step = mark => indexes(child => child.attributes?.type === 'Button' && child.children?.length === 1 &&
    matchesNativeText(child.children[0].attributes,windowId,mark));
  const plus = step('+');
  const minus = step('−');
  if (plus.length !== 1 || minus.length !== 1) return;
  return {current:path+'/'+current[0],plus:path+'/'+plus[0],minus:path+'/'+minus[0],seconds,
    plusGlyph:children[plus[0]].children[0], siblings:children.filter((_,index) => index !== plus[0]), windowId};
}

function quickAutoPageExposedPoint(row, button) {
  const fullNativeBounds = ({attributes:a}) => {
    const rect = parseNativeBounds(a?.origBounds);
    const visible = parseNativeBounds(a?.bounds);
    return String(a?.hostWindowId) === row.windowId && validRect(rect,positive) &&
      validRect(visible,positive) && sameRect(rect,visible) ? rect : null;
  };
  const glyph = fullNativeBounds(row.plusGlyph);
  const x = Math.floor(button.left + button.width / 2);
  if (!glyph || row.plusGlyph.attributes.originalText !== '+' ||
      ![undefined,'','+'].includes(row.plusGlyph.attributes.text) ||
      !sameRect(glyph,intersect(button,glyph)) || x <= glyph.left || x >= right(glyph)) return;
  const siblings = row.siblings.map(fullNativeBounds);
  if (siblings.some(rect => !rect)) return;
  // Retained transparent Full controls still occupy native hit-test geometry.
  const topObstacles = [glyph,...siblings].filter(rect => rect.left <= x && x <= right(rect) && bottom(rect) > button.top);
  const end = Math.min(bottom(button),...topObstacles.map(rect => rect.top));
  const y = Math.floor((button.top + end) / 2);
  if (y > button.top && y < end) return {x,y};
}

function addQuickAutoPageSpeedAliases(nodes, rows) {
  if (rows.length !== 1) return;
  const row = rows[0];
  const [label,plus,minus] = [row.current,row.plus,row.minus].map(path => nodes.find(node => node.path === path));
  const fullBounds = node => node?.visible === true && positive(node.opacity) && validRect(node.rectPx,positive) &&
    validRect(node.visibleRectPx,positive) && sameRect(node.rectPx,node.visibleRectPx);
  const enabledButton = node => fullBounds(node) && node.type === 'Button' && node.enabled === true &&
    node.clickable === true && node.key && ['HitTestMode.Default','HitTestMode.Block'].includes(node.hitTestMode);
  if (!fullBounds(label) || !enabledButton(plus) || !enabledButton(minus) ||
      right(minus.rectPx) > label.rectPx.left || right(label.rectPx) > plus.rectPx.left ||
      ![plus,minus].every(node => node.rectPx.top <= label.rectPx.top && bottom(node.rectPx) >= bottom(label.rectPx))) return;
  const viewports = nodes.filter(node => node.id === 'reader-control-module-autoPage');
  const quick = nodes.filter(node => node.id === 'reader-session-morph-quickAutoPage');
  const collapse = nodes.filter(node => node.id === 'reader-control-collapse');
  const [viewport] = viewports;
  const parents = ancestorsOf({nodes},label);
  if (viewports.length !== 1 || quick.length !== 1 || collapse.length !== 1 || collapse[0].enabled !== false ||
      viewport.type !== 'Scroll' || viewport.clip !== true || !fullBounds(viewport) || !fullBounds(quick[0]) ||
      !parents.includes(viewport) || !parents.includes(quick[0]) ||
      ![label,plus,minus].every(node => area(intersect(viewport.rectPx,node.rectPx)) === area(node.rectPx))) return;
  label.alias = 'reader-auto-speed-current-' + row.seconds;
  plus.alias = 'reader-auto-speed-increase-from-' + row.seconds;
  const exposedPoint = quickAutoPageExposedPoint(row,plus.rectPx);
  if (exposedPoint) plus.quickAutoPageExposedPoint = exposedPoint;
}

function sourceRowStatusLabel(attributes) {
  const names = [attributes.description,attributes.accessibilityText,attributes.accessibilityLabel,
    attributes.contentDescription,attributes.originalText,attributes.text].filter(value=>typeof value === 'string' && value.trim());
  if (!names.length) return null;
  return names.every(name=>name === '未检查') ? 'unchecked' : 'other';
}

function sourceFocusQueryName(attributes) {
  const names = [attributes.accessibilityText,attributes.accessibilityLabel].filter(value =>
    typeof value === 'string' && value.trim());
  return names.length ? names.every(name => name === '搜索书源名称或域名') : null;
}

function sourceFocusExpansion(attributes) {
  const descriptions = [...new Set([attributes.accessibilityDescription,attributes.description].filter(value =>
    typeof value === 'string' && value.trim()))];
  if (!descriptions.length) return null;
  if (descriptions.length === 1 && descriptions[0] === '已展开') return 'expanded';
  if (descriptions.length === 1 && descriptions[0] === '已收起') return 'collapsed';
  return 'other';
}

function sourceReadAlias(attributes, windowId, host, inAction) {
  if (!host || boolean(attributes.visible) !== true || !positive(finiteNumber(attributes.opacity))) return undefined;
  if (host === 'reader-source-empty-state' && matchesNativeText(attributes, windowId, '书源读取失败'))
    return 'reader-source-read-failure-title';
  if (host === 'reader-source-empty-state' && matchesNativeText(attributes, windowId, '暂无书源'))
    return 'reader-source-empty-library-title';
  if (host !== 'reader-source-pending-recovery' && attributes.type === 'LoadingProgress')
    return 'reader-source-loading-progress';
  if (host === 'reader-source-pending-recovery' && !inAction && attributes.type === 'Text' &&
      [attributes.originalText, attributes.text].some(value => typeof value === 'string' && value.trim().length > 0))
    return 'reader-source-recovery-message';
  return undefined;
}

function validRect(rect, checkSize = nonNegative) {
  return RECT_KEYS.every(key => Number.isFinite(rect?.[key])) &&
    checkSize(rect.width) && checkSize(rect.height);
}

function parseNativeBounds(value) {
  const coordinates = nativeBounds(value);
  if (!coordinates) return null;
  const [left, top, endX, endY] = coordinates;
  const rect = pixelRect(left, top, endX - left, endY - top);
  return validRect(rect) ? rect : null;
}

function sameRect(a, b, tolerance = 0) {
  return RECT_KEYS.every(key => Math.abs(a[key] - b[key]) <= tolerance);
}

function intersect(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  return pixelRect(left, top, Math.max(0, Math.min(right(a), right(b)) - left),
    Math.max(0, Math.min(bottom(a), bottom(b)) - top));
}

function toVp(rect, density, origin) {
  return pixelRect((rect.left - (origin?.left ?? 0)) / density,
    (rect.top - (origin?.top ?? 0)) / density, rect.width / density, rect.height / density);
}

function normalizeKeyboard(metrics, revision) {
  const keyboard = metrics.keyboardArea;
  const insetsVp = metrics.keyboardInsets;
  if (keyboard?.available !== true || typeof keyboard.visible !== 'boolean' ||
      (keyboard.revision !== undefined && keyboard.revision !== revision) ||
      !Array.isArray(keyboard.rects) || keyboard.visible !== (keyboard.rects.length > 0) ||
      !keyboard.rects.every(rect => validRect(rect, positive)) ||
      !INSET_KEYS.every(key => nonNegative(insetsVp?.[key]))) return null;
  return {
    visible: keyboard.visible,
    rectsVp: keyboard.rects.map(rect => pixelRect(rect.left, rect.top, rect.width, rect.height)),
    insetsVp: Object.fromEntries(INSET_KEYS.map(key => [key, insetsVp[key]])),
    revision,
    source: WINDOW_SOURCE,
  };
}

/**
 * Convert one full UITest dump and its bracketed Reader Developer Mode report.
 * Tree boxes stay in display px; the window APIs already report keyboard rects
 * in window-local vp. The evaluator brings both into that latter space once.
 */
export function normalizeHarmonyLayout({
  tree, report, sampleId, state, instanceId, windowId, branch, evidenceRefs = [],
  clipShapes = [], transitionId, continuityId, publicBookTitle, publicBookTitles, publicHistoryWord,
  observeSearchTaskRetry = false, observeSearchTaskSheet = false, observeSourceRead = false, publicOnlineResultTitles,
  observeSearchConfirmedEmpty = false,
  observeSearchUnconfirmedEmpty = false,
  observeSearchHistoryLoading = false,
  observeReadingSearchResults = false,
  observeQuickAutoPageSpeed = false,
  observeSourceRowActions = false,
  observeSourceDefaultFontToggle = false,
  sourceToggleCheckedWrapper,
  observeSourceUnknownWriteToggle = false,
  publicReservedSourceQuery,
  observeSourceGroupOptionsScroll = false,
  observeSourceGroupOptionsText = false,
  observeSourceTransientStatus = false,
  observeSourceOfflineDetect = false,
  observeSourceInlineImportDialog = false,
  observeSourceNativeFocus = false,
  publicSourceToolsQuery,
}) {
  const metrics = report?.metrics;
  const density = metrics?.densityPixels;
  const revision = metrics?.revision;
  if (metrics?.ready !== true || !positive(density) || !Number.isSafeInteger(revision) || revision < 1 ||
      !validRect(metrics.windowRect, positive) || !validRect(metrics.globalRect, positive) ||
      !positive(report.vpPixels) || Math.abs(report.vpPixels - density) > .01) {
    throw new EvidenceError('Window metrics are unavailable, stale, or use conflicting units');
  }
  const horizontalInsets = [metrics.systemInsets?.left, metrics.systemInsets?.right,
    metrics.cutoutInsets?.left, metrics.cutoutInsets?.right];
  const contentSafeHorizontalVp = horizontalInsets.every(nonNegative) ? Math.max(...horizontalInsets) : null;
  const wantedId = windowId ?? report.windowId ?? metrics.windowId;
  if ((windowId !== undefined && report.windowId !== undefined && String(windowId) !== String(report.windowId)) ||
      (wantedId !== undefined && metrics.windowId !== undefined && String(wantedId) !== String(metrics.windowId))) {
    throw new EvidenceError('Reader window IDs disagree');
  }
  const expectedRectPx = pixelRect(Math.round(metrics.globalRect.left * density), Math.round(metrics.globalRect.top * density),
    Math.round(metrics.windowRect.width * density), Math.round(metrics.windowRect.height * density));
  const displayRectPx = parseNativeBounds(tree?.attributes?.bounds);
  const roots = normalReaderWindowRoots(tree).filter(({attributes}) =>
    boolean(attributes.visible) === true && (wantedId === undefined || String(attributes.hostWindowId) === String(wantedId)));
  if (roots.length !== 1) throw new EvidenceError('The normal Reader window is missing or ambiguous in the native tree');
  const root = roots[0];
  const rectPx = parseNativeBounds(root.attributes.origBounds);
  const visibleRectPx = parseNativeBounds(root.attributes.bounds);
  if (!rectPx || !visibleRectPx || !displayRectPx || !sameRect(rectPx, expectedRectPx, 1) ||
      area(intersect(displayRectPx, rectPx)) !== area(rectPx) || area(visibleRectPx) <= 0) {
    throw new EvidenceError('Native tree and metrics do not describe one complete Reader window');
  }

  const id = String(root.attributes.hostWindowId);
  const nodes = [];
  const searchResultKeys = new Map();
  const onlineTitleRoles = new Map(Object.entries(publicOnlineResultTitles ?? {}).map(([role,title]) => [title,role]));
  const taskSheets = [];
  const quickSpeedRows = [];
  const groupOptionCounts = new Map();
  const publicGroupScrollOptions = [];
  const sourceActionRows = [];
  const additionalTitles = new Map(Object.entries(publicBookTitles ?? {}).map(([role, title]) => [title, role]));
  const directoryPrefix = publicBookTitle && `reader-control-directory-query:local:${publicBookTitle}:`;
  const pending = [{ node: root, path: '0', parentPath: null, depth: 0 }];
  while (pending.length > 0) {
    const { node, path, parentPath, depth, parentType, sheet: parentSheet,
      sourceReadHost: parentReadHost, sourceReadAction: parentReadAction,
      sourceList: parentSourceList, sourceActionRow: parentSourceActionRow, groupOptionTitle: parentGroupOptionTitle,
      underSourceToggle: parentSourceToggle } = pending.pop();
    if (nodes.length >= MAX_NODES || depth >= 128) throw new EvidenceError('Reader window native tree is truncated');
    const a = node.attributes;
    if (!a || String(a.hostWindowId) !== id) continue;
    if (observeQuickAutoPageSpeed) {
      const row = quickAutoPageSpeedRow(node,path,id);
      if (row) quickSpeedRows.push(row);
    }
    let sheet = parentSheet;
    const sourceReadHost = observeSourceRead && sourceReadHosts.has(a.id) ? a.id : parentReadHost;
    const sourceReadAction = parentReadAction || a.type === 'Button';
    const underSourceToggle = sourceToggleCheckedWrapper && (parentSourceToggle || a.id === sourceToggleCheckedWrapper);
    const readAlias = sourceReadAlias(a, id, sourceReadHost, sourceReadAction);
    const sourceList = (observeSourceRowActions || observeSourceOfflineDetect) && (a.type === 'List' ?
      a.id === 'reader-source-list' : parentSourceList === true);
    let sourceActionRow = sourceList ? parentSourceActionRow : undefined;
    if (sourceList && a.type === 'Column' && /^reader-source-row-[1-9]\d*$/u.test(a.id ?? '')) {
      sourceActionRow = { titles:0, locators:0, buttons:[] };
      sourceActionRows.push(sourceActionRow);
    }
    if (sourceActionRow) {
      if (matchesNativeText(a,id,observeSourceOfflineDetect ? sourceOfflineDetectTitle : sourceRowActionTitle)) sourceActionRow.titles += 1;
      const locator = observeSourceOfflineDetect ? sourceOfflineDetectUrl : sourceRowActionUrl;
      const hostname = observeSourceOfflineDetect ? sourceOfflineDetectHost : sourceRowActionHost;
      if (matchesNativeText(a,id,locator) || matchesNativeText(a,id,hostname)) sourceActionRow.locators += 1;
      if (a.type === 'Button') {
        const labels = sourceRowButtonLabels(node,id);
        if (labels.length === 1) sourceActionRow.buttons.push({index:nodes.length,alias:labels[0][1]});
      }
    }
    if (a.type === 'SheetPage' && parentType === 'SheetWrapper' &&
        boolean(a.visible) === true && positive(finiteNumber(a.opacity))) {
      sheet = { index:nodes.length, titles:new Map(), buttons:[] };
      taskSheets.push(sheet);
    }
    if (sheet) {
      for (const title of searchSheetTitles.filter(title => matchesNativeText(a, id, title))) {
        sheet.titles.set(title, (sheet.titles.get(title) ?? 0) + 1);
      }
    }
    if (observeSearchTaskRetry && sheet && a.type === 'Button' && boolean(a.visible) === true && boolean(a.enabled) === true &&
        boolean(a.clickable) === true && positive(finiteNumber(a.opacity)) &&
        (node.children ?? []).filter(child => matchesNativeText(child.attributes, id, '重试未完成的书源')).length === 1) {
      sheet.buttons.push(nodes.length);
    }
    const book = shelfBookAction(a.id);
    const bookAction = Boolean(publicBookTitle) && book?.[1] === 'local';
    const possibleEmptyResult = (observeSearchConfirmedEmpty || observeSearchUnconfirmedEmpty) &&
      typeof a.id === 'string' && a.id.startsWith(searchResultPrefix);
    const result = (publicBookTitle || onlineTitleRoles.size || possibleEmptyResult) && searchResultIdentity(a.id);
    const localResult = publicBookTitle && result?.[2].startsWith('local:');
    if (localResult) searchResultKeys.set(path,result);
    const searchResultMount = (onlineTitleRoles.size || possibleEmptyResult) && result && a.type === 'Button' ?
      {page:result[0],queryRevision:result[1],kind:result[2].startsWith('online:') ? 'online' : 'local'} : undefined;
    const titleReadback = onlineTitleRoles.size && searchResultMount ? searchResultTitleReadback(node,id) : undefined;
    const confirmedEmptyTitle = observeSearchConfirmedEmpty && a.type === 'Text' &&
      [a.originalText,a.text].includes('没有找到相关书籍');
    const unconfirmedEmptyTitle = observeSearchUnconfirmedEmpty && matchesNativeText(a,id,'搜索结果未确认');
    const mismatchedEmptyTitle = observeSearchUnconfirmedEmpty &&
      ['没有找到相关书籍','书源搜索失败','本地检索未完成','书源列表加载失败','搜索已停止']
        .some(title => matchesNativeText(a,id,title));
    const publicOnlineRoles = titleReadback ?
      [...new Set(titleReadback.map(text => onlineTitleRoles.get(text)).filter(Boolean))] : [];
    const fixtureTitle = Boolean(publicBookTitle) && [a.originalText, a.text].includes(publicBookTitle);
    const fixtureTitleRole = additionalTitles.get(a.originalText) ?? additionalTitles.get(a.text);
    const fixtureCard = bookAction && [a.originalText, a.text, a.description].some(value =>
      typeof value === 'string' && value.startsWith(`${publicBookTitle}，`));
    const searchSemantic = submitSemantic(node);
    const directoryTab = directoryPrefix && a.type === 'TextInput' && typeof a.id === 'string' &&
      a.id.startsWith(directoryPrefix) ? /^\d+:(directory|bookmarks)$/u.exec(a.id.slice(directoryPrefix.length))?.[1] : null;
    const publicReplaceEditorName = publicBookTitle && a.type === 'TextInput' && typeof a.id === 'string' &&
      /^reader-editable-target:\d+:local:local:[a-f0-9]{64}:\d+:\d+:名称$/u.test(a.id);
    const publicHistoryItem = publicHistoryWord && a.type === 'Button' && a.id === 'reader-search-history-item-0' &&
      (node.children ?? []).some(({attributes: child}) => child?.type === 'Text' &&
        String(child.hostWindowId) === id && boolean(child.visible) === true &&
        [child.originalText, child.text].includes(publicHistoryWord));
    const groupFocus = typeof a.id === 'string' && a.type === 'Button' ?
      /^source-group:([0-9]+):focus:(selected|option:[\s\S]+)$/u.exec(a.id) : null;
    const sourceFocusTrigger = observeSourceNativeFocus && a.type === 'Button' &&
      /^source-back:[0-9]+:group-trigger$/u.test(a.id ?? '');
    const groupTextOption = (observeSourceGroupOptionsText &&
      ['option:Phase1 Scroll 01','option:Phase1 Scroll 12'].includes(groupFocus?.[2])) ||
      (publicSourceToolsQuery && groupFocus?.[2] === 'option:小说 书源');
    const groupOptionTitle = groupTextOption ? groupFocus[2].slice('option:'.length) : parentGroupOptionTitle;
    const probeTransientText = observeSourceTransientStatus && a.type === 'Text' &&
      /^reader-transient-feedback-text-[1-9]\d*$/u.test(a.id ?? '');
    const nativeTransientText = probeTransientText &&
      [a.originalText,a.text].find(value => typeof value === 'string' && value.length > 0);
    const footerToolsButton = a.type === 'Button' && /^source-back:[0-9]+:tools:footer$/u.test(a.id ?? '');
    const headerToolsButton = publicSourceToolsQuery && a.type === 'Button' &&
      /^source-back:[1-9][0-9]*:tools:header$/u.test(a.id ?? '');
    let groupAlias;
    if (groupFocus?.[2] === 'selected') groupAlias = 'reader-source-group-selected';
    else if (groupFocus) {
      // ReaderSelectPanel renders the selected row first, then its real option
      // buttons in owner order. Keep their position without retaining labels.
      const ordinal = (groupOptionCounts.get(groupFocus[1]) ?? 0) + 1;
      groupOptionCounts.set(groupFocus[1], ordinal);
      groupAlias = `reader-source-group-option-${ordinal}`;
      if (observeSourceGroupOptionsScroll &&
          (groupTextOption || ['option:Phase1 Scroll 06','option:Phase1 Scroll 12'].includes(groupFocus[2]))) {
        publicGroupScrollOptions.push({index:nodes.length,generation:Number(groupFocus[1]),
          alias:groupFocus[2].endsWith('06') ? sourceGroupOptionsReference :
            groupFocus[2].endsWith('01') ? sourceGroupOptionsTextHead : sourceGroupOptionsTail});
      }
    }
    const unknownWriteToggle = observeSourceUnknownWriteToggle && a.id === sourceUnknownToggleNativeId &&
      a.type === 'Toggle' && boolean(a.checkable) === true;
    nodes.push({
      ...(unknownWriteToggle ? {alias:sourceUnknownToggle,sourcePublicToggleChecked:boolean(a.checked)} : {}),
      ...(confirmedEmptyTitle ? { alias:searchConfirmedEmptyHeading } : {}),
      ...(unconfirmedEmptyTitle ? { alias:searchUnconfirmedEmptyHeading } : {}),
      ...(mismatchedEmptyTitle ? { alias:searchMismatchedEmptyHeading } : {}),
      ...(fixtureTitle ? { fixtureTitle: true } : {}),
      ...(fixtureTitleRole ? { fixtureTitleRole } : {}),
      ...(publicHistoryItem ? { alias:'reader-search-history-public-item-0' } : {}),
      ...(directoryTab ? { alias:`reader-control-directory-query-${directoryTab}` } : {}),
      ...(publicReplaceEditorName ? { alias:'reader-control-replace-name-editor' } : {}),
      ...(bookAction ? { localBookAction: true, fixtureCard } : {}),
      ...(book ? { bookCard: true } : {}),
      ...(localResult ? { localSearchResult: true } : {}),
      ...(searchResultMount ? { searchResultMount } : {}),
      ...(possibleEmptyResult && !searchResultMount ? { unresolvedSearchResult: true } : {}),
      ...(titleReadback ? { searchTitleObserved:true } : {}),
      ...(observeSourceRowActions && sourceActionRow && a.id === 'reader-source-row-status-unchecked' && a.type === 'Stack' ?
        {sourceRowStatusLabel:sourceRowStatusLabel(a)} : {}),
      ...(observeSourceDefaultFontToggle && a.type === 'Toggle' && boolean(a.checkable) === true ?
        {sourceDefaultFontToggleChecked:boolean(a.checked)} : {}),
      ...(parentSourceToggle && a.type === 'Toggle' && boolean(a.checkable) === true ?
        {sourcePublicToggleChecked:boolean(a.checked)} : {}),
      ...(publicReservedSourceQuery === publicReservedSourceHost && a.type === 'Toggle' && boolean(a.checkable) === true ?
        {publicReservedSourceNativeToggle:matchesReservedSourceNativeToggle(a.id)} : {}),
      ...(publicReservedSourceQuery && a.id === 'reader-source-editor' && a.type === 'TextInput' ?
        {publicReservedSourceQueryMatches:[a.originalText,a.text].includes(publicReservedSourceQuery)} : {}),
      ...(publicReservedSourceQuery && matchesNativeText(a,id,'检测') ? {publicReservedSourceIdleDetect:true} : {}),
      ...(observeSearchHistoryLoading && a.type === 'Text' ? {
        searchHistoryLoadingLabel: [a.originalText,a.text].some(value=>typeof value === 'string' && value.length > 0) ?
          matchesNativeText(a,id,'正在读取搜索历史') : null,
      } : {}),
      ...(observeSourceInlineImportDialog && matchesNativeText(a,id,'导入书源') ? {sourceInlineImportDialogTitle:true} : {}),
      ...(publicOnlineRoles.length ? { publicOnlineRoles } : {}),
      ...(typeof a.id === 'string' && /^reader-search-(?:task|filter):\d+:\d+$/u.test(a.id) ?
        { alias: `${a.id.split(':')[0]}-trigger` } : {}),
      ...(a.type === 'List' && typeof a.id === 'string' && /^reader-search-result-list:\d+:\d+$/u.test(a.id) ?
        { alias: 'reader-search-result-viewport' } : {}),
      ...(groupAlias ? { alias:groupAlias } : {}),
      ...(sourceFocusTrigger ? {alias:'reader-source-group-trigger-button',sourceFocusExpansion:sourceFocusExpansion(a)} : {}),
      ...(observeSourceNativeFocus && groupFocus?.[2] === 'selected' ?
        {sourceFocusSelection:'source-group:' + groupFocus[1]} : {}),
      ...(observeSourceNativeFocus && a.id === 'reader-source-editor' && a.type === 'TextInput' ?
        {sourceFocusQueryName:sourceFocusQueryName(a)} : {}),
      ...(publicSourceToolsQuery && a.id === 'reader-source-editor' && a.type === 'TextInput' ?
        {publicSourceToolsQueryMatches:[a.originalText,a.text].includes(publicSourceToolsQuery)} : {}),
      ...(probeTransientText ? {sourceTransientUtf16Length:nativeTransientText?.length ?? null} : {}),
      ...(observeSourceTransientStatus === 'retained-read-failed' && nativeTransientText && nativeTransientText.length <= 512 ?
        {sourceTransientAsciiSpaceIndexes:[...nativeTransientText.matchAll(/ /gu)].map(space => space.index)} : {}),
      ...(groupOptionTitle && a.type === 'Text' ? {
        publicGroupOptionText: [a.originalText,a.text].some(value=>typeof value === 'string' && value.length > 0) ?
          matchesNativeText(a,id,groupOptionTitle) : null,
      } : {}),
      ...(a.type === 'Row' && /^reader-source-group-backdrop:source-group:[1-9][0-9]*$/u.test(a.id ?? '') ?
        { alias:'reader-source-group-backdrop' } : {}),
      ...(footerToolsButton ? { alias:sourceFooterToolsButton.id } : {}),
      ...(headerToolsButton ? { alias:sourceHeaderToolsButton.id } : {}),
      ...(readAlias ? { alias:readAlias } : {}),
      id: !groupAlias && !possibleEmptyResult && stableId(a.id) ? a.id : null,
      key: typeof a.accessibilityId === 'string' && /^\d+$/u.test(a.accessibilityId) ? a.accessibilityId : null,
      path, parentPath, type: stableId(a.type) ? a.type : null,
      rectPx: parseNativeBounds(a.origBounds),
      visibleRectPx: parseNativeBounds(a.bounds),
      visible: boolean(a.visible),
      focused: boolean(a.focused),
      selected: boolean(a.selected),
      clickable: boolean(a.clickable),
      enabled: boolean(a.enabled),
      opacity: finiteNumber(a.opacity),
      backgroundAlpha: backgroundAlpha(a.backgroundColor),
      hitTestMode: typeof a.hitTestBehavior === 'string' ? a.hitTestBehavior : null,
      clip: boolean(a.clip),
      zIndex: finiteNumber(a.zIndex),
      source: TREE_SOURCE,
      ...(searchSemantic ? { searchSemantic } : {}),
    });
    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) {
      pending.push({ node: node.children[index], path: `${path}/${index}`, parentPath: path,
        depth: depth + 1, parentType:a.type, sheet, sourceReadHost, sourceReadAction, sourceList, sourceActionRow,
        groupOptionTitle, underSourceToggle });
    }
  }
  if (observeSourceGroupOptionsScroll) {
    const panels = nodes.filter(node=>node.id === 'reader-source-group-panel');
    const [panel] = panels;
    const scrolls = panels.length === 1 ? nodes.filter(node=>node.type === 'Scroll' &&
      ancestorsOf({nodes},node).includes(panel)) : [];
    if (scrolls.length === 1) {
      const [scroll] = scrolls;
      scroll.alias = sourceGroupOptionsScroll;
      for (const {index,alias,generation} of publicGroupScrollOptions) {
        const option = nodes[index];
        if (!ancestorsOf({nodes},option).includes(scroll)) continue;
        option.alias = alias;
        option.groupSelectionGeneration = generation;
      }
    }
  }
  if (observeReadingSearchResults) addReadingSearchAliases(nodes);
  if (observeQuickAutoPageSpeed && metrics.keyboardArea?.available === true && metrics.keyboardArea.visible === false)
    addQuickAutoPageSpeedAliases(nodes,quickSpeedRows);
  const actionFixtures = sourceActionRows.filter(row => row.titles === 1 && row.locators === 1);
  if (actionFixtures.length === 1) {
    for (const {index,alias} of actionFixtures[0].buttons) nodes[index].alias = alias;
  }
  for (const sheet of taskSheets) {
    const title = [...sheet.titles.keys()];
    if (title.length === 1 && sheet.titles.get(title[0]) === 1) nodes[sheet.index].sheetTitle = title[0];
  }
  const searchTaskSheets = taskSheets.filter(sheet => sheet.titles.has('搜索进度'));
  if (searchTaskSheets.length === 1 && searchTaskSheets[0].titles.get('搜索进度') === 1) {
    const sheet = searchTaskSheets[0];
    if (observeSearchTaskSheet) nodes[sheet.index].alias = 'reader-search-task-sheet';
    if (observeSearchTaskSheet || sheet.buttons.length === 1) {
      for (const index of sheet.buttons) nodes[index].alias = 'reader-search-task-retry';
    }
  }
  for (const leaf of nodes.filter(node => (node.fixtureTitle || node.fixtureTitleRole) && node.visible)) {
    const result = ancestorsOf({ nodes }, leaf).find(parent => parent.localSearchResult && parent.visible);
    if (result) {
      const alias = leaf.fixtureTitleRole ? `reader-search-public-local-result-${leaf.fixtureTitleRole}` : 'reader-search-public-local-result';
      // Conflicting recognized titles cannot identify a unique public result.
      result.alias = result.alias === undefined || result.alias === alias ? alias : null;
      if (result.alias) publicSearchResultKeys.set(result,searchResultKeys.get(result.path));
      else publicSearchResultKeys.delete(result);
    }
  }
  if (onlineTitleRoles.size) {
    for (const row of nodes.filter(node => node.visible === true && node.publicOnlineRoles?.length === 1 &&
        node.searchResultMount.kind === 'online')) {
      const list = ancestorsOf({nodes},row).find(node => node.visible === true && node.alias === 'reader-search-result-viewport');
      const {page,queryRevision} = row.searchResultMount;
      if (list?.id === `reader-search-result-list:${page}:${queryRevision}`) {
        row.alias = `reader-search-public-online-result-${row.publicOnlineRoles[0]}`;
      }
    }
  }
  const branchIds = ['row', 'stacked'].filter(value =>
    nodes.filter(node => node.visible && node.id === `reader-bookshelf-search-lane-${value}`).length === 1);
  const observedBranch = branchIds.length === 1 && (branch === undefined || branch === branchIds[0])
    ? branchIds[0] : null;
  return {
    sampleId, state, instanceId, branch: observedBranch, transitionId, continuityId, evidenceRefs, nodes,
    ...(observeSearchConfirmedEmpty ? { searchConfirmedEmptyObserved:true } : {}),
    ...(observeSearchUnconfirmedEmpty ? { searchUnconfirmedEmptyObserved:true } : {}),
    ...(observeSourceInlineImportDialog ? {sourceInlineImportDialogObserved:true} : {}),
    ...(publicBookTitle ? { publicBookTitle } : {}),
    clipShapes: clipShapes.map(shape => ({
      path: typeof shape.path === 'string' && /^0(?:\/\d+)*$/u.test(shape.path) ? shape.path : undefined,
      id: stableId(shape.id) ? shape.id : undefined,
      shape: ['rect', 'roundedRect'].includes(shape.shape) ? shape.shape : null,
      radiusVp: nonNegative(shape.radiusVp) ? shape.radiusVp : null,
      source: ['native-tree', 'debug-frame'].includes(shape.source) ? shape.source : null,
    })),
    window: {
      id, rectPx, visibleRectPx, displayRectPx, density, revision,
      contentSafeHorizontalVp,
      orientation: rectPx.width > rectPx.height ? 'landscape' : 'portrait',
      keyboard: normalizeKeyboard(metrics, revision),
      source: WINDOW_SOURCE,
    },
  };
}

export function ancestorsOf(sample, node) {
  const ancestors = [];
  const nodesByPath = new Map(sample.nodes.map(item => [item.path, item]));
  let parent = nodesByPath.get(node.parentPath);
  while (parent && ancestors.length < 128) {
    ancestors.push(parent);
    parent = nodesByPath.get(parent.parentPath);
  }
  return ancestors;
}

function matchesAncestors(sample, node, expected) {
  if (!expected) return true;
  let index = 0;
  for (const ancestor of ancestorsOf(sample, node).reverse()) {
    if (ancestor.id === expected[index]) index += 1;
  }
  return index === expected.length;
}

function shelfBookAction(id) {
  const prefix = 'reader-shelf-book-action:';
  if (typeof id !== 'string' || !id.startsWith(prefix)) return null;
  try {
    const tuple = JSON.parse(id.slice(prefix.length));
    return Array.isArray(tuple) && tuple.length === 4 && Number.isSafeInteger(tuple[0]) &&
      typeof tuple[1] === 'string' && typeof tuple[2] === 'string' && tuple[2].length > 0 && tuple[3] === false ? tuple : null;
  } catch {
    return null;
  }
}

function searchResultIdentity(id) {
  if (typeof id !== 'string' || !id.startsWith(searchResultPrefix)) return null;
  try {
    const tuple = JSON.parse(id.slice(searchResultPrefix.length));
    return Array.isArray(tuple) && tuple.length === 3 && Number.isSafeInteger(tuple[0]) &&
      Number.isSafeInteger(tuple[1]) && typeof tuple[2] === 'string' && /^(?:local|online):.+/u.test(tuple[2]) ? tuple : null;
  } catch {
    return null;
  }
}

function searchResultTitleReadback(row, windowId) {
  const onlyChild = (node,type) => {
    const children = node?.children?.filter(child => child.attributes?.type === type) ?? [];
    return children.length === 1 ? children[0] : undefined;
  };
  // SearchResultCard's title is the first label in the inner metadata column.
  // A structural change or unavailable title leaves incomplete evidence.
  const outer = onlyChild(onlyChild(row,'Row'),'Column');
  const title = onlyChild(outer,'Column')?.children?.[0]?.attributes;
  if (title?.type !== 'Text' || boolean(title.visible) !== true || String(title.hostWindowId) !== windowId ||
      !validRect(parseNativeBounds(title.bounds),positive)) return undefined;
  const texts = [title.originalText,title.text].filter(text => typeof text === 'string' && text.trim().length > 0);
  return texts.length ? texts : undefined;
}

export function fixtureBookCards(sample) {
  const direct = sample.nodes.filter(node => node.fixtureCard === true && node.visible === true);
  const titleLeaves = sample.nodes.filter(node => node.fixtureTitle === true && node.visible === true);
  // A grid and list label can name the same production card.
  const ancestors = titleLeaves.map(node => ancestorsOf(sample, node)
    .find(parent => parent.localBookAction === true && parent.visible === true)).filter(Boolean);
  return [...new Set([...direct, ...ancestors])];
}

/** Return the only current node for a stable ID and optional root-to-leaf anchors. */
export function selectLayoutNode(sample, selector, { visibleOnly = true } = {}) {
  const query = typeof selector === 'string' ? { id: selector } : selector;
  if (!query?.id && !query?.publicBookTitle) throw new Error('Layout selector requires a stable ID or an allowlisted book title');
  let nodes;
  if (query.publicBookTitle && query.publicBookTitle === sample.publicBookTitle) {
    nodes = fixtureBookCards(sample);
  } else {
    nodes = sample.nodes.filter(node => (node.id === query.id || node.alias === query.id) && (!visibleOnly || node.visible === true) &&
      (query.key === undefined || node.key === query.key) && matchesAncestors(sample, node, query.ancestors));
  }
  if (nodes.length !== 1) {
    throw new EvidenceError(`Reader node ${query.id ?? 'for public fixture'} is ${nodes.length === 0 ? 'missing' : 'ambiguous'}`);
  }
  return nodes[0];
}

export function layoutTapPoint(node, { requireClickable = true } = {}) {
  const rect = node?.visibleRectPx;
  if (node?.visible !== true || node.enabled !== true || !positive(node.opacity) ||
      (requireClickable && node.clickable !== true) || !validRect(rect, positive)) {
    throw new EvidenceError('Reader node has no admitted native tap point');
  }
  return { x: Math.floor(rect.left + rect.width / 2), y: Math.floor(rect.top + rect.height / 2) };
}

function nativeNodeBox(node) {
  if (!validRect(node?.rectPx)) throw new EvidenceError(`Missing native bounds for ${node?.id ?? 'an ancestor'}`);
  return node.rectPx;
}

function nodeBox(sample, node) {
  return toVp(nativeNodeBox(node), sample.window.density, sample.window.rectPx);
}

function viewportBox(sample) {
  return toVp(sample.window.rectPx, sample.window.density, sample.window.rectPx);
}

function acceptedSource(assertion, source) {
  return assertion.acceptedSources === undefined || assertion.acceptedSources.includes(source);
}

function toleranceVp(assertion, sample) {
  return (assertion.toleranceVp ?? 0) + (assertion.tolerancePx ?? 0) / sample.window.density;
}

function toleranceArea(assertion) {
  return assertion.toleranceAreaVp2 ?? 0;
}

function compare(actual, ok, reason) {
  return { actual, verdict: ok ? 'PASS' : 'FAIL', reason };
}

function measurePair(assertion, sample, a, b, tolerance) {
  const aBox = nodeBox(sample, a);
  const bBox = nodeBox(sample, b);
  switch (assertion.kind) {
    case 'gap':
    case 'align': {
      const horizontal = assertion.axis === 'x';
      const start = horizontal ? 'left' : 'top';
      const extent = horizontal ? 'width' : 'height';
      const delta = bBox[start] - aBox[start];
      const actual = assertion.kind === 'gap' ? delta - aBox[extent] :
        delta + (bBox[extent] - aBox[extent]) / 2;
      return compare({ valueVp: actual, axis: assertion.axis, toleranceVp: tolerance },
        Math.abs(actual - assertion.expected) <= tolerance, 'Measured window-local positions');
    }
    case 'contain': {
      if (!ancestorsOf(sample, a).includes(b)) {
        return compare({ childPath: a.path, containerPath: b.path }, false,
          'Selected container is absent from the native child ancestor path');
      }
      const overflowVp = {
        left: Math.max(0, bBox.left - aBox.left), top: Math.max(0, bBox.top - aBox.top),
        right: Math.max(0, right(aBox) - right(bBox)), bottom: Math.max(0, bottom(aBox) - bottom(bBox)),
      };
      const maxOverflowVp = Math.max(...Object.values(overflowVp));
      return compare({ overflowVp, maxOverflowVp, toleranceVp: tolerance },
        maxOverflowVp <= assertion.expected.maxOverflowVp + tolerance, 'Measured child overflow on all four sides');
    }
    case 'nonOverlap': {
      const overlap = intersect(aBox, bBox);
      const overlapAreaVp2 = area(overlap);
      return compare({ widthVp: overlap.width, heightVp: overlap.height, overlapAreaVp2 },
        overlapAreaVp2 <= assertion.expected.maxOverlapAreaVp2 + toleranceArea(assertion), 'Measured joint area');
    }
  }
  throw new Error(`Unknown pair relationship ${assertion.kind}`);
}

function subtract(rect, obstruction) {
  const cut = intersect(rect, obstruction);
  if (area(cut) === 0) return [rect];
  return [
    pixelRect(rect.left, rect.top, rect.width, cut.top - rect.top),
    pixelRect(rect.left, bottom(cut), rect.width, bottom(rect) - bottom(cut)),
    pixelRect(rect.left, cut.top, cut.left - rect.left, cut.height),
    pixelRect(right(cut), cut.top, right(rect) - right(cut), cut.height),
  ].filter(part => area(part) > 0);
}

function subtractAll(rect, occluders) {
  return occluders.reduce((pieces, occluder) => pieces.flatMap(piece => subtract(piece, occluder)), [rect]);
}

function keyboardFor(assertion, sample) {
  const keyboard = sample.window.keyboard;
  if (!keyboard || keyboard.revision !== sample.window.revision ||
      !acceptedSource(assertion, WINDOW_SOURCE)) throw new EvidenceError('Keyboard rectangles are unavailable for this window revision');
  return keyboard;
}

function measureKeyboard(assertion, sample, node) {
  const keyboard = keyboardFor(assertion, sample);
  if (keyboard.visible !== true) return missing('The selected state does not show the IME');
  const box = nodeBox(sample, node);
  const viewport = viewportBox(sample);
  const visibleAreaVp2 = subtractAll(box, keyboard.rectsVp).reduce((sum, piece) => sum + area(piece), 0);
  const overlapAreaVp2 = Math.max(0, area(box) - visibleAreaVp2);
  const bottomGapsVp = keyboard.rectsVp.filter(rect => bottom(rect) >= viewport.height &&
    rect.left < right(box) && right(rect) > box.left).map(rect => rect.top - bottom(box));
  return compare({ overlapAreaVp2, bottomGapVp: bottomGapsVp.length ? Math.min(...bottomGapsVp) : null,
    keyboardRectsVp: keyboard.rectsVp, keyboardInsetsVp: keyboard.insetsVp, revision: keyboard.revision },
  overlapAreaVp2 <= assertion.expected.maxOverlapAreaVp2 + toleranceArea(assertion),
  'Measured two-dimensional overlap with the window IME');
}

function getClipShape(assertion, sample, node, rectangle) {
  const shapes = sample.clipShapes.filter(shape => shape.path === node.path ||
    (shape.path === undefined && shape.id === node.id && selectLayoutNode(sample, shape.id) === node));
  if (shapes.length !== 1) return null;
  const shape = shapes[0];
  if (!['native-tree', 'debug-frame'].includes(shape.source) || !acceptedSource(assertion, shape.source)) return null;
  if (shape.shape === 'rect') return { ...rectangle, path: node.path, shape: 'rect', source: shape.source };
  if (shape.shape === 'roundedRect' && nonNegative(shape.radiusVp) &&
      shape.radiusVp <= Math.min(rectangle.width, rectangle.height) / 2) {
    return { ...rectangle, path: node.path, shape: 'roundedRect', source: shape.source, radiusVp: shape.radiusVp };
  }
  return null;
}

function clippedBox(sample, node, exclude) {
  let box = intersect(viewportBox(sample), nodeBox(sample, node));
  const clips = [];
  for (const ancestor of ancestorsOf(sample, node)) {
    if (ancestor === exclude) continue;
    if (ancestor.clip === null) throw new EvidenceError(`Ancestor clip is unavailable at ${ancestor.path}`);
    if (ancestor.clip) {
      const rect = nodeBox(sample, ancestor);
      clips.push({ ancestor, rect });
      box = intersect(box, rect);
    }
  }
  return { box, clips };
}

function quarterDiskArea(x, y, r) {
  const crossing = Math.min(x, Math.sqrt(Math.max(0, r ** 2 - y ** 2)));
  const integral = t => (t * Math.sqrt(Math.max(0, r ** 2 - t ** 2)) +
    r ** 2 * Math.asin(Math.min(1, t / r))) / 2;
  return crossing * y + integral(x) - integral(crossing);
}

function roundedCutArea(rect, clip) {
  const r = clip.radiusVp;
  if (r === 0) return 0;
  let cut = 0;
  // In each corner of the clip box the area outside the quarter disc is cut.
  for (const cornerX of [clip.left, right(clip) - r]) {
    for (const cornerY of [clip.top, bottom(clip) - r]) {
      const corner = intersect(rect, pixelRect(cornerX, cornerY, r, r));
      if (area(corner) === 0) continue;
      const x = cornerX === clip.left ? cornerX + r - right(corner) : corner.left - cornerX;
      const y = cornerY === clip.top ? cornerY + r - bottom(corner) : corner.top - cornerY;
      const upperX = Math.min(r, Math.max(x, 0) + corner.width);
      const upperY = Math.min(r, Math.max(y, 0) + corner.height);
      const lowerX = Math.max(x, 0);
      const lowerY = Math.max(y, 0);
      const inside = quarterDiskArea(upperX, upperY, r) - quarterDiskArea(lowerX, upperY, r) -
        quarterDiskArea(upperX, lowerY, r) + quarterDiskArea(lowerX, lowerY, r);
      cut += Math.max(0, area(corner) - inside);
    }
  }
  return cut;
}

function measureVisible(assertion, sample, node) {
  const box = nodeBox(sample, node);
  const sourceAreaVp2 = area(box);
  if (sourceAreaVp2 <= 0) return missing('The original layout box has zero area');
  if (!['rounded', 'rectangular'].includes(assertion.basis)) return missing('No visibility geometry basis was declared');
  if (assertion.expected.enabled !== undefined && typeof node.enabled !== 'boolean') {
    return missing('Native enabled state is unavailable');
  }
  if (node.visible === null) return missing('Native visibility state is unavailable');
  if (node.visible && (!validRect(node.visibleRectPx) || !validRect(sample.window.visibleRectPx))) {
    return missing('Native visible bounds are unavailable');
  }
  const { box: clipped, clips } = clippedBox(sample, node);
  const visibleReadbackVp = node.visible ?
    toVp(intersect(node.visibleRectPx, sample.window.visibleRectPx), sample.window.density, sample.window.rectPx) : null;
  const named = (assertion.occluders ?? []).map(selector => {
    const occluder = selectLayoutNode(sample, selector);
    if (occluder.opacity !== 1) throw new EvidenceError('The declared opaque occluder lacks opaque native readback');
    if (!validRect(occluder.visibleRectPx, positive)) throw new EvidenceError('The declared occluder has no visible native box');
    return toVp(occluder.visibleRectPx, sample.window.density, sample.window.rectPx);
  });
  const occluders = assertion.includeKeyboard ? [...named, ...keyboardFor(assertion, sample).rectsVp] : named;
  const pieces = visibleReadbackVp ? subtractAll(intersect(clipped, visibleReadbackVp), occluders) : [];
  let visibleAreaVp2 = pieces.reduce((sum, piece) => sum + area(piece), 0);
  if (assertion.basis === 'rounded' && visibleAreaVp2 > 0) {
    let roundedConstraints = 0;
    for (const { ancestor, rect } of clips) {
      const shape = getClipShape(assertion, sample, ancestor, rect);
      if (!shape) return missing(`Native clip shape is unavailable at ${ancestor.path}`);
      if (shape.shape !== 'roundedRect') continue;
      const cut = pieces.reduce((sum, piece) => sum + roundedCutArea(piece, shape), 0);
      if (cut <= 1e-9) continue;
      roundedConstraints += 1;
      if (roundedConstraints > 1) return missing('Multiple overlapping rounded clip constraints need an exact visible-shape readback');
      visibleAreaVp2 -= cut;
    }
  }
  // Two equivalent intersections can differ by floating point roundoff after px -> vp.
  if (Math.abs(visibleAreaVp2 - sourceAreaVp2) <= sourceAreaVp2 * 1e-12) visibleAreaVp2 = sourceAreaVp2;
  visibleAreaVp2 = Math.max(0, Math.min(visibleAreaVp2, sourceAreaVp2));
  const fraction = visibleAreaVp2 / sourceAreaVp2;
  return compare({ fraction, visibleAreaVp2, sourceAreaVp2, visibleReadbackVp, opacity: node.opacity, basis: assertion.basis,
    includedOccluders: assertion.occluders ?? [], includedKeyboard: assertion.includeKeyboard === true,
    ...(assertion.expected.enabled !== undefined ? { enabled: node.enabled } : {}) },
  fraction >= assertion.expected.minFraction && (assertion.expected.enabled === undefined || node.enabled === assertion.expected.enabled),
  assertion.expected.enabled === undefined ? 'Measured geometric visibility under the declared clipping and occlusions' :
    'Measured geometric visibility and declared enabled state under the clipping and occlusions');
}

function measureClip(assertion, sample, node, clipNode) {
  if (!ancestorsOf(sample, node).includes(clipNode)) {
    return compare({ targetPath: node.path, ancestorPath: clipNode.path }, false,
      'The selected clip is absent from the native ancestor path');
  }
  if (clipNode.clip === null) return missing('Native clipping state is unavailable');
  const clipBox = nodeBox(sample, clipNode);
  const shape = getClipShape(assertion, sample, clipNode, clipBox);
  const childBox = nodeBox(sample, node);
  const clipCap = clipNode.clip ? intersect(childBox, clipBox) : childBox;
  const actual = { enabled: clipNode.clip, ancestorPath: clipNode.path, targetPath: node.path,
    shape: shape?.shape ?? null, radiusVp: shape?.radiusVp ?? null, source: shape?.source ?? TREE_SOURCE,
    clipRectVp: clipBox, clipCapVp: clipCap };
  if (assertion.mode === 'configuration') {
    if (actual.enabled !== assertion.expected.enabled) return compare(actual, false, 'Native clipping declaration differs');
    if (assertion.expected.shape && !shape) return { ...missing('Exact native clip shape is unavailable'), actual };
    return compare(actual, assertion.expected.shape === undefined || assertion.expected.shape === actual.shape,
      'Observed native ancestor clipping declaration');
  }
  if (assertion.mode !== 'effect') return missing('No clipping assertion mode was declared');
  if (!sample.transitionId) return { ...missing('Actual clipping requires a sample linked to the same control transition'), actual };
  const before = clippedBox(sample, node, clipNode).box;
  const after = intersect(before, clipBox);
  const clippedAreaVp2 = area(before) - area(after);
  actual.clippedAreaVp2 = clippedAreaVp2;
  actual.effectiveRectVp = after;
  if (clippedAreaVp2 <= assertion.expected.minClippedAreaVp2) {
    return { ...missing('The sampled child did not overrun the clip edge'), actual };
  }
  if (!validRect(node.visibleRectPx)) return { ...missing('Clipped native readback bounds are unavailable'), actual };
  const observedRectVp = toVp(node.visibleRectPx, sample.window.density, sample.window.rectPx);
  return compare({ ...actual, observedRectVp },
    clipNode.clip && ((area(observedRectVp) === 0 && area(after) === 0) ||
      sameRect(observedRectVp, after, toleranceVp(assertion, sample))),
    'Compared the observed and geometrically clipped bounds of the overrun');
}

function measureRelative(assertion, sample, baseline, node, tolerance) {
  if (!baseline || sample.instanceId !== baseline.instanceId || !sample.instanceId ||
      sample.window.id !== baseline.window.id || !sameRect(sample.window.rectPx, baseline.window.rectPx) ||
      sample.window.orientation !== baseline.window.orientation || sample.window.density !== baseline.window.density ||
      !sample.branch || sample.branch !== baseline.branch) {
    return missing('Comparison does not retain the same Reader instance, window and layout branch');
  }
  const baselineNode = selectLayoutNode(baseline, assertion.a);
  const anchor = selectLayoutNode(sample, assertion.anchor);
  const baselineAnchor = selectLayoutNode(baseline, assertion.anchor);
  const sameNodeInstances = node.key !== null && anchor.key !== null &&
    node.key === baselineNode.key && anchor.key === baselineAnchor.key;
  const sameContinuity = assertion.sameContinuity === true && sample.continuityId &&
    sample.continuityId === baseline.continuityId;
  if (!sameNodeInstances && !sameContinuity) return missing('The native layout-node instances are not continuous');
  const current = nativeNodeBox(node);
  const reference = nativeNodeBox(baselineNode);
  const currentAnchor = nativeNodeBox(anchor);
  const previousAnchor = nativeNodeBox(baselineAnchor);
  const density = sample.window.density;
  // Both samples share a pixel space and density. Subtract before converting
  // so an exact one-pixel displacement also matches a one-pixel tolerance.
  const actual = {
    dx: ((current.left - currentAnchor.left) - (reference.left - previousAnchor.left)) / density,
    dy: ((current.top - currentAnchor.top) - (reference.top - previousAnchor.top)) / density,
    dw: (current.width - reference.width) / density,
    dh: (current.height - reference.height) / density,
  };
  return compare({ ...actual, toleranceVp: tolerance },
    Object.entries(assertion.expected).every(([key, value]) => Math.abs(actual[key] - value) <= tolerance),
    'Measured change in position relative to the same search-bar anchor');
}

function getSample(samples, key) {
  return samples instanceof Map ? samples.get(key) : samples?.[key];
}

export function evaluateLayout(assertion, samples) {
  if (!layoutKinds.has(assertion.kind)) throw new Error(`Unknown layout relationship ${assertion.kind}`);
  const sample = getSample(samples, assertion.sample);
  const baseline = getSample(samples, assertion.baseline);
  const expected = assertion.expected;
  const evidenceRefs = [...new Set([...(sample?.evidenceRefs ?? []), ...(baseline?.evidenceRefs ?? [])])];
  const result = (actual, verdict, reason) => ({ actual, expected, verdict, reason, evidenceRefs });
  if (!sample?.window || !acceptedSource(assertion, TREE_SOURCE)) {
    return result(null, 'NOT_RUN', 'A stable Reader native layout sample is unavailable');
  }
  if (assertion.branch && sample.branch !== assertion.branch) {
    return result(null, 'NOT_RUN', `Selected layout branch ${assertion.branch} is unavailable in the sample`);
  }
  try {
    const a = selectLayoutNode(sample, assertion.a, { visibleOnly: assertion.kind !== 'visibleFraction' });
    const tolerance = toleranceVp(assertion, sample);
    let check;
    switch (assertion.kind) {
      case 'gap':
      case 'align':
      case 'contain':
      case 'nonOverlap':
        check = measurePair(assertion, sample, a, selectLayoutNode(sample, assertion.b), tolerance);
        break;
      case 'clip':
        check = measureClip(assertion, sample, a, selectLayoutNode(sample, assertion.b));
        break;
      case 'keyboardAvoidance':
        check = measureKeyboard(assertion, sample, a);
        break;
      case 'visibleFraction':
        check = measureVisible(assertion, sample, a);
        break;
      case 'relativeDelta':
        check = measureRelative(assertion, sample, baseline, a, tolerance);
        break;
    }
    return result(check.actual ?? null, check.verdict ?? 'NOT_RUN', check.reason);
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return result(null, 'NOT_RUN', error.message);
  }
}
