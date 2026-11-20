/**
 * Pure parser and assertion evaluator for `uitest dumpLayout` JSON.
 * No HDC, device, filesystem or app imports. Bounds are compared in vp using
 * the density reported by the same READER_VERIFY run; a missing density is an
 * explicit failure, never an assumed default.
 */

const BOUNDS_TEXT = /^\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]$/;
const BOUNDS_CSV = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function invalid(message) {
  throw new Error(`layout snapshot: ${message}`);
}

function boundsFrom(value) {
  if (Array.isArray(value) && value.length === 4 && value.every(item => Number.isFinite(Number(item)))) {
    const [left, top, right, bottom] = value.map(Number);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  if (typeof value === 'string') {
    const match = BOUNDS_TEXT.exec(value.trim()) ?? BOUNDS_CSV.exec(value.trim());
    if (match) {
      const [left, top, right, bottom] = match.slice(1).map(Number);
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(Number(value[key])))) {
      const left = Number(value.left), top = Number(value.top);
      const right = Number(value.right), bottom = Number(value.bottom);
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    }
    if (['x', 'y', 'width', 'height'].every(key => Number.isFinite(Number(value[key])))) {
      const left = Number(value.x), top = Number(value.y);
      const width = Number(value.width), height = Number(value.height);
      return { left, top, right: left + width, bottom: top + height, width, height };
    }
  }
  return undefined;
}

function attributeObject(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) invalid('node is not an object');
  const attributes = node.attributes ?? node.$attributes ?? {};
  if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) invalid('attributes is not an object');
  return attributes;
}

function normalizeNode(node, depth) {
  if (depth > 512) invalid('tree depth exceeds 512');
  const attributes = attributeObject(node);
  const childrenSource = node.children ?? node.$children ?? [];
  if (!Array.isArray(childrenSource)) invalid('children is not an array');
  const id = typeof attributes.id === 'string' ? attributes.id : '';
  const type = typeof attributes.type === 'string' ? attributes.type : '';
  const text = typeof attributes.text === 'string' ? attributes.text : '';
  const bounds = boundsFrom(attributes.bounds) ?? boundsFrom(attributes.rect) ?? boundsFrom(attributes.$rect) ??
    boundsFrom(node.bounds);
  const visible = attributes.visible === undefined ? undefined : attributes.visible === true || attributes.visible === 'true';
  const enabled = attributes.enabled === undefined ? undefined : attributes.enabled === true || attributes.enabled === 'true';
  const opacity = attributes.opacity === undefined || attributes.opacity === '' ? undefined : Number(attributes.opacity);
  if (opacity !== undefined && !Number.isFinite(opacity)) invalid('opacity is not a number');
  return {
    id, type, text, bounds, visible, enabled, opacity, attributes,
    children: childrenSource.map(child => normalizeNode(child, depth + 1)),
  };
}

/** A node drawn inside a transparent or hidden container is not on screen even
 * when its own attributes say visible; the control chrome keeps its ids while
 * animating opacity 0. */
function applyChainVisibility(node, parentVisible = true, parentOpacity = 1) {
  const opacity = node.opacity ?? 1;
  node.chainOpacity = Math.min(parentOpacity, opacity);
  node.chainVisible = parentVisible && node.visible !== false && node.chainOpacity > 0;
  for (const child of node.children) applyChainVisibility(child, node.chainVisible, node.chainOpacity);
}

export function effectivelyVisible(node) {
  return node.chainVisible !== undefined ? node.chainVisible : node.visible !== false;
}

export function parseLayout(text) {
  if (typeof text !== 'string' || text.trim().length === 0) invalid('empty input');
  let value;
  try { value = JSON.parse(text); }
  catch (error) { invalid(`invalid JSON (${error.message})`); }
  if (Array.isArray(value)) {
    if (value.length !== 1) invalid('array root must contain exactly one node');
    value = value[0];
  }
  const root = normalizeNode(value, 0);
  applyChainVisibility(root);
  return root;
}

export function flattenLayout(root) {
  const nodes = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    nodes.push(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) stack.push(node.children[index]);
  }
  return nodes;
}

export function indexLayout(root) {
  const nodes = new Map();
  const duplicates = new Map();
  for (const node of flattenLayout(root)) {
    if (node.id.length === 0) continue;
    const previous = nodes.get(node.id);
    if (previous === undefined) nodes.set(node.id, node);
    else duplicates.set(node.id, (duplicates.get(node.id) ?? 1) + 1);
  }
  return { nodes, duplicates };
}

/** Production IDs can embed a process generation or book key. A selector
 * narrows that identity without inventing a second test-only node. */
export function selectLayoutNodes(root, selector) {
  return flattenLayout(root).filter(node => node.id.length > 0 &&
    (selector.id === undefined || node.id === selector.id) &&
    (selector.idPrefix === undefined || node.id.startsWith(selector.idPrefix)) &&
    (selector.idIncludes === undefined || node.id.includes(selector.idIncludes)) &&
    (selector.idExcludes === undefined || !node.id.includes(selector.idExcludes)));
}

export function boundsVp(bounds, density) {
  if (bounds === undefined) return undefined;
  if (!Number.isFinite(density) || density <= 0) return undefined;
  return {
    left: bounds.left / density, top: bounds.top / density,
    right: bounds.right / density, bottom: bounds.bottom / density,
    width: bounds.width / density, height: bounds.height / density,
  };
}

function near(actual, expected, tolerance) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function check(checks, id, field, expected, actual, ok) {
  checks.push({ id, field, expected, actual, ok: ok === true });
}

export function evaluateLayout(root, expectations, options = {}) {
  if (expectations === null || typeof expectations !== 'object' || Array.isArray(expectations)) {
    invalid('expectations must be an object');
  }
  const allowed = ['nodes', 'order'];
  if (Object.keys(expectations).some(key => !allowed.includes(key))) invalid('unknown expectation field');
  const nodes = expectations.nodes ?? [];
  const order = expectations.order ?? [];
  if (!Array.isArray(nodes) || !Array.isArray(order)) invalid('nodes/order must be arrays');
  const density = options.density;
  const tolerance = options.toleranceVp ?? 1;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 8) invalid('toleranceVp must be 0..8');
  const index = indexLayout(root);
  const checks = [];
  for (const expectation of nodes) {
    if (expectation === null || typeof expectation !== 'object' || Array.isArray(expectation)) invalid('node expectation is not an object');
    const id = expectation.id;
    if (typeof id !== 'string' || id.length === 0 || id.length > 128) invalid('node expectation id is invalid');
    const match = index.nodes.get(id);
    const duplicateCount = index.duplicates.get(id) ?? (match === undefined ? 0 : 1);
    const exists = expectation.exists !== false;
    const expectedCount = exists ? (expectation.count ?? 1) : 0;
    const actualCount = match === undefined ? 0 : duplicateCount;
    check(checks, id, 'count', expectedCount, actualCount, actualCount === expectedCount);
    if (!exists || match === undefined) continue;
    if (expectation.visible !== undefined) {
      const actual = effectivelyVisible(match);
      check(checks, id, 'visible', expectation.visible, actual, actual === expectation.visible);
    }
    if (expectation.enabled !== undefined) {
      check(checks, id, 'enabled', expectation.enabled, match.enabled, match.enabled === expectation.enabled);
    }
    if (expectation.textIncludes !== undefined) {
      const expected = expectation.textIncludes;
      check(checks, id, 'textIncludes', expected, match.text,
        typeof expected === 'string' && expected.length > 0 && match.text.includes(expected));
    }
    if (expectation.textNonEmpty !== undefined) {
      check(checks, id, 'textNonEmpty', expectation.textNonEmpty, match.text,
        expectation.textNonEmpty !== true || match.text.length > 0);
    }
    const captures = options.captures ?? {};
    if (expectation.textEqualsCapture !== undefined) {
      const expected = captures[expectation.textEqualsCapture];
      check(checks, id, 'textEqualsCapture', expected, match.text,
        typeof expected === 'string' && match.text === expected);
    }
    if (expectation.textNotEqualsCapture !== undefined) {
      const expected = captures[expectation.textNotEqualsCapture];
      check(checks, id, 'textNotEqualsCapture', expected, match.text,
        typeof expected === 'string' && match.text !== expected);
    }
    const vp = boundsVp(match.bounds, density);
    const numeric = [
      ['heightVp', value => near(value, expectation.heightVp, tolerance)],
      ['widthVp', value => near(value, expectation.widthVp, tolerance)],
      ['minHeightVp', value => Number.isFinite(value) && value + tolerance >= expectation.minHeightVp],
      ['maxHeightVp', value => Number.isFinite(value) && value - tolerance <= expectation.maxHeightVp],
      ['minWidthVp', value => Number.isFinite(value) && value + tolerance >= expectation.minWidthVp],
      ['maxWidthVp', value => Number.isFinite(value) && value - tolerance <= expectation.maxWidthVp],
      ['topAtLeastVp', value => Number.isFinite(value) && value + tolerance >= expectation.topAtLeastVp],
      ['topAtMostVp', value => Number.isFinite(value) && value - tolerance <= expectation.topAtMostVp],
      ['leftAtLeastVp', value => Number.isFinite(value) && value + tolerance >= expectation.leftAtLeastVp],
      ['leftAtMostVp', value => Number.isFinite(value) && value - tolerance <= expectation.leftAtMostVp],
    ];
    for (const [field, predicate] of numeric) {
      if (expectation[field] === undefined) continue;
      if (!Number.isFinite(expectation[field])) invalid(`${field} must be a finite number`);
      const actual = vp?.[field === 'minHeightVp' || field === 'maxHeightVp' || field === 'heightVp' ? 'height' :
        field === 'minWidthVp' || field === 'maxWidthVp' || field === 'widthVp' ? 'width' :
          field === 'topAtLeastVp' || field === 'topAtMostVp' ? 'top' : 'left'];
      check(checks, id, field, expectation[field], actual ?? null, vp !== undefined && predicate(actual));
    }
  }
  for (const pair of order) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string')) {
      invalid('order entry must be [aboveId, belowId]');
    }
    const above = index.nodes.get(pair[0]);
    const below = index.nodes.get(pair[1]);
    const ok = above !== undefined && below !== undefined && above.bounds !== undefined && below.bounds !== undefined &&
      above.bounds.top <= below.bounds.top;
    checks.push({ id: `${pair[0]}<${pair[1]}`, field: 'order', expected: pair, ok,
      actual: above?.bounds && below?.bounds ? { aboveTop: above.bounds.top, belowTop: below.bounds.top } : null });
  }
  return { ok: checks.every(item => item.ok), checks };
}

export function assertionSummary(result) {
  const failed = result.checks.filter(item => !item.ok);
  return failed.length === 0 ? 'all assertions passed' :
    failed.map(item => `${item.id}.${item.field} expected ${JSON.stringify(item.expected)} actual ${JSON.stringify(item.actual)}`).join('; ');
}
