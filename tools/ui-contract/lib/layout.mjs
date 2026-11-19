import { nativeBounds, normalReaderWindowRoots } from '../../lib/native-ui-evidence.mjs';

const TREE_SOURCE = 'native-tree';
const WINDOW_SOURCE = 'window-metrics';
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
  clipShapes = [], transitionId, continuityId, publicBookTitle,
}) {
  const metrics = report?.metrics;
  const density = metrics?.densityPixels;
  const revision = metrics?.revision;
  if (metrics?.ready !== true || !positive(density) || !Number.isSafeInteger(revision) || revision < 1 ||
      !validRect(metrics.windowRect, positive) || !validRect(metrics.globalRect, positive) ||
      !positive(report.vpPixels) || Math.abs(report.vpPixels - density) > .01) {
    throw new Error('Window metrics are unavailable, stale, or use conflicting units');
  }
  const wantedId = windowId ?? report.windowId ?? metrics.windowId;
  if ((windowId !== undefined && report.windowId !== undefined && String(windowId) !== String(report.windowId)) ||
      (wantedId !== undefined && metrics.windowId !== undefined && String(wantedId) !== String(metrics.windowId))) {
    throw new Error('Reader window IDs disagree');
  }
  const expectedRectPx = pixelRect(Math.round(metrics.globalRect.left * density), Math.round(metrics.globalRect.top * density),
    Math.round(metrics.windowRect.width * density), Math.round(metrics.windowRect.height * density));
  const displayRectPx = parseNativeBounds(tree?.attributes?.bounds);
  const roots = normalReaderWindowRoots(tree).filter(({attributes}) =>
    boolean(attributes.visible) === true && (wantedId === undefined || String(attributes.hostWindowId) === String(wantedId)));
  if (roots.length !== 1) throw new Error('The normal Reader window is missing or ambiguous in the native tree');
  const root = roots[0];
  const rectPx = parseNativeBounds(root.attributes.origBounds);
  const visibleRectPx = parseNativeBounds(root.attributes.bounds);
  if (!rectPx || !visibleRectPx || !displayRectPx || !sameRect(rectPx, expectedRectPx, 1) ||
      area(intersect(displayRectPx, rectPx)) !== area(rectPx) || area(visibleRectPx) <= 0) {
    throw new Error('Native tree and metrics do not describe one complete Reader window');
  }

  const id = String(root.attributes.hostWindowId);
  const nodes = [];
  const pending = [{ node: root, path: '0', parentPath: null, depth: 0 }];
  while (pending.length > 0) {
    const { node, path, parentPath, depth } = pending.pop();
    if (nodes.length >= MAX_NODES || depth >= 128) throw new Error('Reader window native tree is truncated');
    const a = node.attributes;
    if (!a || String(a.hostWindowId) !== id) continue;
    const bookAction = Boolean(publicBookTitle) && localBookAction(a.id);
    const fixtureTitle = Boolean(publicBookTitle) && [a.originalText, a.text].includes(publicBookTitle);
    const fixtureCard = bookAction && [a.originalText, a.text, a.description].some(value =>
      typeof value === 'string' && value.startsWith(`${publicBookTitle}，`));
    const searchSemantic = a.id === 'reader-bookshelf-search-submit' ?
      [a.text, a.originalText, a.accessibilityText, a.contentDescription].find(value => value === '搜索' || value === '停止搜索') : undefined;
    nodes.push({
      ...(fixtureTitle ? { fixtureTitle: true } : {}),
      ...(bookAction ? { localBookAction: true, fixtureCard } : {}),
      id: stableId(a.id) ? a.id : null,
      key: typeof a.accessibilityId === 'string' && /^\d+$/u.test(a.accessibilityId) ? a.accessibilityId : null,
      path, parentPath, type: stableId(a.type) ? a.type : null,
      rectPx: parseNativeBounds(a.origBounds),
      visibleRectPx: parseNativeBounds(a.bounds),
      visible: boolean(a.visible),
      focused: boolean(a.focused),
      clickable: boolean(a.clickable),
      enabled: boolean(a.enabled),
      opacity: finiteNumber(a.opacity),
      clip: boolean(a.clip),
      zIndex: finiteNumber(a.zIndex),
      source: TREE_SOURCE,
      ...(searchSemantic ? { searchSemantic: searchSemantic === '搜索' ? 'search' : 'stop' } : {}),
    });
    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) {
      pending.push({ node: node.children[index], path: `${path}/${index}`, parentPath: path, depth: depth + 1 });
    }
  }
  const branchIds = ['row', 'stacked'].filter(value =>
    nodes.filter(node => node.visible && node.id === `reader-bookshelf-search-lane-${value}`).length === 1);
  const observedBranch = branchIds.length === 1 && (branch === undefined || branch === branchIds[0])
    ? branchIds[0] : null;
  return {
    sampleId, state, instanceId, branch: observedBranch, transitionId, continuityId, evidenceRefs, nodes,
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
      orientation: rectPx.width > rectPx.height ? 'landscape' : 'portrait',
      keyboard: normalizeKeyboard(metrics, revision),
      source: WINDOW_SOURCE,
    },
  };
}

function ancestorsOf(sample, node) {
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

function localBookAction(id) {
  const prefix = 'reader-shelf-book-action:';
  if (typeof id !== 'string' || !id.startsWith(prefix)) return false;
  try {
    const tuple = JSON.parse(id.slice(prefix.length));
    return Array.isArray(tuple) && tuple.length === 4 && Number.isSafeInteger(tuple[0]) &&
      tuple[1] === 'local' && typeof tuple[2] === 'string' && tuple[2].length > 0 && tuple[3] === false;
  } catch {
    return false;
  }
}

/** Return the only current node for a stable ID and optional root-to-leaf anchors. */
export function selectLayoutNode(sample, selector, { visibleOnly = true } = {}) {
  const query = typeof selector === 'string' ? { id: selector } : selector;
  if (!query?.id && !query?.publicBookTitle) throw new Error('Layout selector requires a stable ID or an allowlisted book title');
  let nodes;
  if (query.publicBookTitle && query.publicBookTitle === sample.publicBookTitle) {
    const direct = sample.nodes.filter(node => node.fixtureCard === true && node.visible === true);
    const titleLeaves = sample.nodes.filter(node => node.fixtureTitle === true && node.visible === true);
    // A grid and list label can name the same production card.
    const ancestors = titleLeaves.map(node => ancestorsOf(sample, node)
      .find(parent => parent.localBookAction === true && parent.visible === true)).filter(Boolean);
    nodes = [...new Set([...direct, ...ancestors])];
  } else {
    nodes = sample.nodes.filter(node => node.id === query.id && (!visibleOnly || node.visible === true) &&
      (query.key === undefined || node.key === query.key) && matchesAncestors(sample, node, query.ancestors));
  }
  if (nodes.length !== 1) {
    throw new Error(`Reader node ${query.id ?? 'for public fixture'} is ${nodes.length === 0 ? 'missing' : 'ambiguous'}`);
  }
  return nodes[0];
}

export function layoutTapPoint(node, { requireClickable = true } = {}) {
  const rect = node?.visibleRectPx;
  if (node?.visible !== true || node.enabled !== true || !positive(node.opacity) ||
      (requireClickable && node.clickable !== true) || !validRect(rect, positive)) {
    throw new Error('Reader node has no admitted native tap point');
  }
  return { x: Math.floor(rect.left + rect.width / 2), y: Math.floor(rect.top + rect.height / 2) };
}

function nodeBox(sample, node) {
  if (!validRect(node?.rectPx)) throw new Error(`Missing native bounds for ${node?.id ?? 'an ancestor'}`);
  return toVp(node.rectPx, sample.window.density, sample.window.rectPx);
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
      !acceptedSource(assertion, WINDOW_SOURCE)) throw new Error('Keyboard rectangles are unavailable for this window revision');
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
    if (ancestor.clip === null) throw new Error(`Ancestor clip is unavailable at ${ancestor.path}`);
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
  if (node.visible === null) return missing('Native visibility state is unavailable');
  const { box: clipped, clips } = clippedBox(sample, node);
  const named = (assertion.occluders ?? []).map(selector => {
    const occluder = selectLayoutNode(sample, selector);
    if (occluder.opacity !== 1) throw new Error('The declared opaque occluder lacks opaque native readback');
    if (!validRect(occluder.visibleRectPx, positive)) throw new Error('The declared occluder has no visible native box');
    return toVp(occluder.visibleRectPx, sample.window.density, sample.window.rectPx);
  });
  const occluders = assertion.includeKeyboard ? [...named, ...keyboardFor(assertion, sample).rectsVp] : named;
  const pieces = node.visible ? subtractAll(clipped, occluders) : [];
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
  return compare({ fraction, visibleAreaVp2, sourceAreaVp2, opacity: node.opacity, basis: assertion.basis,
    includedOccluders: assertion.occluders ?? [], includedKeyboard: assertion.includeKeyboard === true },
  fraction >= assertion.expected.minFraction, 'Measured geometric visibility under the declared clipping and occlusions');
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
  const current = nodeBox(sample, node);
  const reference = nodeBox(baseline, baselineNode);
  const currentAnchor = nodeBox(sample, anchor);
  const previousAnchor = nodeBox(baseline, baselineAnchor);
  const actual = {
    dx: (current.left - currentAnchor.left) - (reference.left - previousAnchor.left),
    dy: (current.top - currentAnchor.top) - (reference.top - previousAnchor.top),
    dw: current.width - reference.width,
    dh: current.height - reference.height,
  };
  return compare({ ...actual, toleranceVp: tolerance },
    Object.entries(assertion.expected).every(([key, value]) => Math.abs(actual[key] - value) <= tolerance),
    'Measured change in position relative to the same search-bar anchor');
}

function getSample(samples, key) {
  return samples instanceof Map ? samples.get(key) : samples?.[key];
}

export function evaluateLayout(assertion, samples) {
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
      default:
        check = missing('Unsupported layout relationship');
    }
    return result(check.actual ?? null, check.verdict ?? 'NOT_RUN', check.reason);
  } catch (error) {
    return result(null, 'NOT_RUN', error.message);
  }
}
