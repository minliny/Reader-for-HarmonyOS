// Thin browser adaptation of the shared visual contract. This module owns
// viewport/profile wiring only; source discovery and interaction remain in the
// selected demo model and renderer, and no production transaction is simulated.
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value, fallback) => Math.max(Number.EPSILON, finite(value, fallback));

export function calculateReferenceProfile(input, visual) {
  const width = positive(input.width, visual.baseViewportWidth);
  const height = positive(input.height, visual.baseViewportHeight);
  const scale = positive(input.scale, 1);
  const safeTop = Math.max(0, finite(input.safeTop, 0));
  const safeBottom = Math.max(0, finite(input.safeBottom, 0));
  const safeLeft = Math.max(0, finite(input.safeLeft, 0));
  const safeRight = Math.max(0, finite(input.safeRight, 0));
  const drawerWidth = Math.min(width, visual.drawerMaxWidth);
  const centeredInset = (width - drawerWidth) / 2;
  const drawerSafeLeft = Math.max(0, safeLeft - centeredInset);
  const drawerSafeRight = Math.max(0, safeRight - centeredInset);
  const narrow = drawerWidth - drawerSafeLeft - drawerSafeRight < visual.narrowWidthThreshold;
  const compact = height < visual.shortHeightThreshold;
  const drawerHeight = Math.max(0, height - Math.max(safeTop, compact ? 0 : visual.drawerTopReserve));
  const headingHeight = Math.max(visual.headingHeight, visual.titleLineHeight * scale);
  // The selected CSS container is the drawer, before its content side inset.
  // Scale changes trigger the same compact controls without shrinking the number
  // or dropping the action. Hit/visible heights are independent and retained.
  const drawerContentWidth = drawerWidth - drawerSafeLeft - drawerSafeRight;
  const discoveryAdaptiveWidth = drawerContentWidth / Math.max(1, scale);
  const discoveryCompact = discoveryAdaptiveWidth <= visual.discoveryCompactWidthThreshold;
  const hideDiscoveryPrefix = discoveryAdaptiveWidth <= visual.discoveryPrefixWidthThreshold;
  const discoveryActionFontSize = discoveryCompact ? visual.compactDiscoveryActionFontSize : visual.discoveryActionFontSize;
  const discoveryActionPaddingX = discoveryCompact ? visual.compactDiscoveryActionPaddingX : visual.discoveryActionPaddingX;
  const discoveryActionWidth = Math.max(discoveryCompact ? visual.compactDiscoveryActionWidth : visual.discoveryActionWidth,
    4 * discoveryActionFontSize * scale + visual.discoveryActionIconSize + visual.discoveryActionGap + 2 * discoveryActionPaddingX);
  const discoveryActionVisibleHeight = Math.max(visual.discoveryActionVisibleHeight,
    visual.discoveryActionLineHeight * scale + 2 * visual.discoveryActionPaddingY);
  const discoveryActionHitHeight = Math.max(visual.discoveryActionMinHeight,
    discoveryActionVisibleHeight + 2 * visual.discoveryActionInsetY);
  const discoveryHeight = Math.max(visual.discoveryHeight,
    (visual.discoveryCountLineHeight + visual.discoveryPhaseLineHeight) * scale, discoveryActionHitHeight);
  const discoveryBlockHeight = discoveryHeight + visual.discoveryBottomGap;
  const toolbarContentWidth = Math.max(0, drawerContentWidth - 2 * (narrow ? visual.narrowSideInset : visual.normalSideInset));
  const columnHeight = Math.max(compact ? visual.compactColumnHeight : visual.columnHeight,
    visual.columnLineHeight * scale + visual.columnTextPaddingY);
  const footerHeight = Math.max(compact ? visual.compactFooterHeight : visual.footerHeight,
    visual.footerLineHeight * scale + visual.footerTextPaddingY);
  const rowHeight = visual.rowHeight * scale;
  const gripHeight = compact ? 0 : visual.gripMarginTop + visual.gripHeight + visual.gripMarginBottom;
  const flowChrome = drawerHeight - safeBottom < headingHeight + discoveryBlockHeight + columnHeight + footerHeight + gripHeight + rowHeight;
  const scrollBook = flowChrome || compact || scale !== 1;
  const bookHeight = scale === 1 ? visual.bookHeight : Math.max(visual.bookHeight,
    visual.bookPaddingY * 2 + visual.bookMetadataLineBoxes * scale);
  return { width, height, scale, safeTop, safeBottom, safeLeft, safeRight, drawerSafeLeft, drawerSafeRight,
    drawerWidth, drawerHeight, drawerContentWidth, narrow, compact, headingHeight, discoveryHeight, discoveryBlockHeight,
    toolbarContentWidth, discoveryAdaptiveWidth, discoveryCompact, hideDiscoveryPrefix, discoveryActionFontSize,
    discoveryActionPaddingX, discoveryActionWidth, discoveryActionVisibleHeight, discoveryActionHitHeight, columnHeight, footerHeight,
    rowHeight, gripHeight: flowChrome ? 0 : gripHeight, flowChrome, scrollBook, bookHeight };
}

export function readReferenceProfile(visual) {
  const value = (name, fallback) => document.getElementById(`reference-${name}`)?.value ?? fallback;
  return calculateReferenceProfile({ width: value('width', visual.baseViewportWidth),
    height: value('height', visual.baseViewportHeight), scale: value('scale', 1), safeTop: value('safe-top', 0),
    safeBottom: value('safe-bottom', 0), safeLeft: value('safe-left', 0), safeRight: value('safe-right', 0) }, visual);
}

export function setReferenceViewport(visual) {
  const profile = readReferenceProfile(visual);
  const viewport = document.getElementById('viewport');
  viewport.style.width = `${profile.width}px`;
  viewport.style.height = `${profile.height}px`;
  viewport.style.flex = `0 0 ${profile.width}px`;
  viewport.style.maxWidth = 'none';
  viewport.style.setProperty('--source-switch-font-scale', String(profile.scale));
  viewport.style.setProperty('--window-w', `${profile.width}px`);
  viewport.style.setProperty('--window-h', `${profile.height}px`);
  viewport.style.setProperty('--safe-top', `${profile.safeTop}px`);
  viewport.style.setProperty('--safe-bottom', `${profile.safeBottom}px`);
  viewport.style.setProperty('--safe-left', `${profile.safeLeft}px`);
  viewport.style.setProperty('--safe-right', `${profile.safeRight}px`);
  return profile;
}

export function applyReferenceProfile(visual) {
  const profile = readReferenceProfile(visual);
  const modal = document.querySelector('.source-flow-modal');
  if (!modal) return profile;
  modal.dataset.widthProfile = profile.narrow ? 'narrow' : 'normal';
  modal.dataset.heightProfile = profile.compact ? 'short' : 'normal';
  modal.dataset.contentProfile = profile.scrollBook ? 'scrollable' : 'fixed';
  modal.dataset.flowChrome = String(profile.flowChrome);
  modal.dataset.discoveryProfile = profile.discoveryCompact ? 'compact' : 'normal';
  modal.dataset.discoveryPrefix = profile.hideDiscoveryPrefix ? 'hidden' : 'visible';
  modal.style.setProperty('--source-switch-discovery-height', `${profile.discoveryHeight}px`);
  modal.style.setProperty('--source-switch-action-font-size', `${profile.discoveryActionFontSize}px`);
  modal.style.setProperty('--source-switch-action-padding-x', `${profile.discoveryActionPaddingX}px`);
  modal.style.setProperty('--source-switch-action-width', `${profile.discoveryActionWidth}px`);
  modal.style.setProperty('--source-switch-action-visible-height', `${profile.discoveryActionVisibleHeight}px`);
  modal.style.setProperty('--source-switch-action-hit-height', `${profile.discoveryActionHitHeight}px`);
  modal.style.setProperty('--source-switch-book-height', `${profile.bookHeight}px`);
  const drawer = modal.querySelector('.source-flow-drawer');
  drawer.style.height = `${profile.drawerHeight}px`;
  drawer.style.paddingBottom = `${profile.safeBottom}px`;
  const inset = profile.narrow ? visual.narrowSideInset : visual.normalSideInset;
  for (const node of modal.querySelectorAll('.source-flow-heading,.source-flow-book,.source-flow-discovery,.source-flow-columns,.source-flow-results,.source-flow-footer')) {
    node.style.marginLeft = `${inset + profile.drawerSafeLeft}px`;
    node.style.marginRight = `${inset + profile.drawerSafeRight}px`;
  }
  const grip = modal.querySelector('.source-flow-grip');
  grip.hidden = profile.compact || profile.flowChrome;
  const book = modal.querySelector('.source-flow-book');
  const results = modal.querySelector('[data-source-results]');
  // Flow chrome keeps heading/book/discovery/columns in their selected order;
  // the outer drawer scrolls as one surface. Compact/large-font fixed chrome
  // instead puts only book context at the beginning of the result scroller.
  if (profile.scrollBook && !profile.flowChrome) {
    if (book.parentElement !== results) results.prepend(book);
    book.style.marginLeft = '0';
    book.style.marginRight = '0';
  } else {
    const discovery = modal.querySelector('.source-flow-discovery');
    if (book.parentElement === results) discovery.before(book);
  }
  document.getElementById('reference-profile-status').textContent =
    `${profile.width} × ${profile.height} · 字体 ${profile.scale} · ${profile.narrow ? '窄宽' : '标准宽'} · ${profile.flowChrome ? '整页滚动' : profile.scrollBook ? '书籍随列表滚动' : '固定书籍区'}`;
  return profile;
}

export function bindReferenceProfile(visual, onChange) {
  const preset = document.getElementById('reference-preset');
  const presets = {
    selected: [visual.baseViewportWidth, visual.baseViewportHeight, 1, 0, 0],
    vm: [365.714, 809.143, 1, 39.143, 28],
    narrow: [320, 640, 1, 0, 0],
    short: [320, 480, 1, 0, 0],
    tiny: [270, 240, 2, 0, 0],
  };
  const refresh = () => { setReferenceViewport(visual); onChange(); };
  preset.addEventListener('change', () => {
    const values = presets[preset.value];
    for (const [index, name] of ['width', 'height', 'scale', 'safe-top', 'safe-bottom'].entries()) {
      document.getElementById(`reference-${name}`).value = values[index];
    }
    refresh();
  });
  for (const node of document.querySelectorAll('[data-reference-profile-input]')) node.addEventListener('change', refresh);
  setReferenceViewport(visual);
}
