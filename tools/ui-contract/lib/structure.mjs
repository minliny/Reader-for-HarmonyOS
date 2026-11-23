import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, fixtureBookCards } from './layout.mjs';

const kinds = new Set(['present', 'absent', 'descendant', 'inFrontOf', 'opacity', 'backgroundAlpha', 'enabled']);
const edges = ['left', 'top', 'width', 'height'];
const hasRect = rect => edges.every(key => Number.isFinite(rect?.[key]));
const positiveRect = rect => hasRect(rect) && rect.width > 0 && rect.height > 0;
const sameRect = (a, b) => hasRect(a) && hasRect(b) && edges.every(key => a[key] === b[key]);
const unitValue = value => Number.isFinite(value) && value >= 0 && value <= 1;
const result = (actual, verdict, reason) => ({actual, verdict, reason});
const unavailable = reason => new EvidenceError(reason);

export function effectiveAppearance(sample, node) {
  const path = [node, ...ancestorsOf(sample, node)];
  if (path.some(item => item.visible === false || item.opacity === 0) ||
      hasRect(node.visibleRectPx) && !positiveRect(node.visibleRectPx)) {
    return {visible: false, opacity: 0};
  }
  if (!positiveRect(node.visibleRectPx) || path.some(item => typeof item.visible !== 'boolean' || !unitValue(item.opacity))) {
    return {visible: null, opacity: null};
  }
  return {visible: true, opacity: path.reduce((opacity, item) => opacity * item.opacity, 1)};
}

function describe(node) {
  return {path:node.path, id:node.id ?? node.alias ?? null, bounds:node.visibleRectPx ?? null};
}

function singleNode(nodes, key) {
  if (nodes.length > 1) throw unavailable(`The native mapping for ${key} is ambiguous`);
  return nodes[0];
}

function scrimNodes(sample, host, key, paintId) {
  if (!host) return [];
  if (!positiveRect(host.visibleRectPx)) throw unavailable(`The scrim host bounds for ${key} are unavailable`);
  const parents = new Set(sample.nodes.map(node => node.parentPath));
  const matching = sample.nodes.filter(node => !parents.has(node.path) && node.visible === true &&
    sameRect(node.visibleRectPx, host.visibleRectPx) && ancestorsOf(sample, node).includes(host));
  // The full-host input-capturing leaf is also the painter in older captures.
  if (matching.some(node => !node.hitTestMode)) throw unavailable(`Native scrim hit testing for ${key} is unavailable`);
  const scrims = matching.filter(node => node.hitTestMode === 'HitTestMode.Default');
  if (scrims.length !== 1) throw unavailable(`The native tree cannot identify one scrim for ${key}`);
  if (paintId !== undefined) {
    const paint = singleNode(sample.nodes.filter(node => node.id === paintId || node.alias === paintId), key);
    if (paint) {
      if (!matching.includes(paint) || paint.hitTestMode !== 'HitTestMode.None') {
        throw unavailable(`The dedicated scrim paint for ${key} is not a full-host, non-hit-testing leaf`);
      }
      if (scrims[0].backgroundAlpha !== 0) {
        throw unavailable(`Native readback does not establish a transparent scrim dismissal target for ${key}`);
      }
      return [paint];
    }
  }
  return scrims;
}

function popupNodes(sample, anchor, key) {
  if (!anchor) return [];
  if (!positiveRect(anchor.visibleRectPx)) throw unavailable(`The popup anchor bounds for ${key} are unavailable`);
  // The legacy tree identifies the anonymous panel by its own clipping
  // boundary. Choose it before reading paint, including when its alpha is zero.
  const candidates = [];
  for (const node of ancestorsOf(sample, anchor)) {
    if (!positiveRect(node.visibleRectPx)) throw unavailable(`A popup ancestor bound for ${key} is unavailable`);
    const rect = node.visibleRectPx;
    if (rect.width >= sample.window.visibleRectPx.width) break;
    if (rect.width > anchor.visibleRectPx.width && rect.height >= anchor.visibleRectPx.height) {
      candidates.push(node);
    }
  }
  if (candidates.some(node => typeof node.clip !== 'boolean')) {
    throw unavailable(`Native popup clipping for ${key} is unavailable`);
  }
  const panels = candidates.filter(node => node.clip);
  if (panels.length !== 1) throw unavailable(`The native tree cannot identify one popup panel for ${key}`);
  return panels;
}

function roleNodes(sample, selectors, key, visiting = new Set()) {
  const selector = selectors[key];
  if (!selector) throw new Error(`Unknown structure selector ${key}`);
  if (visiting.has(key)) throw new Error(`Cyclic structure selector ${key}`);
  if (selector.ids) {
    return sample.nodes.filter(node => selector.ids.includes(node.id) || selector.ids.includes(node.alias));
  }
  if (selector.prefix) {
    return sample.nodes.filter(node => (node.id ?? '').startsWith(selector.prefix));
  }
  if (selector.fixtureCard === true) {
    if (!sample.publicBookTitle) throw unavailable('The sample does not identify the public fixture book');
    return fixtureBookCards(sample);
  }
  if (selector.bookCard === true) return sample.nodes.filter(node => node.bookCard === true);
  if (selector.sheetTitle) return sample.nodes.filter(node => node.sheetTitle === selector.sheetTitle);
  const next = new Set([...visiting, key]);
  if (selector.role === 'scrim' && selector.under) {
    return scrimNodes(sample, singleNode(roleNodes(sample, selectors, selector.under, next), selector.under), key,
      selector.paintId);
  }
  if (selector.role === 'opaqueSurface' && selector.ancestorOf) {
    return popupNodes(sample, singleNode(roleNodes(sample, selectors, selector.ancestorOf, next), selector.ancestorOf), key);
  }
  throw new Error(`Unknown native structure mapping for ${key}`);
}

function compareForeground(sample, node, behind) {
  const frontPath = [node, ...ancestorsOf(sample, node)].reverse();
  const behindPath = [behind, ...ancestorsOf(sample, behind)].reverse();
  let branch = 0;
  while (branch < frontPath.length && branch < behindPath.length && frontPath[branch] === behindPath[branch]) {
    branch += 1;
  }
  if (branch === 0 || branch === frontPath.length || branch === behindPath.length) {
    return result({front:describe(node), behind:describe(behind)}, 'FAIL',
      'The foreground and background are not separate branches of one native host');
  }
  const frontBranch = frontPath[branch];
  const behindBranch = behindPath[branch];
  const actual = {hostPath:frontPath[branch - 1].path,
    front:{...describe(frontBranch), zIndex:frontBranch.zIndex ?? null},
    behind:{...describe(behindBranch), zIndex:behindBranch.zIndex ?? null}};
  if (!Number.isFinite(frontBranch.zIndex) || !Number.isFinite(behindBranch.zIndex) ||
      frontBranch.zIndex === behindBranch.zIndex) {
    return result(actual, 'NOT_RUN', 'Native branch readback does not establish their draw order');
  }
  return result(actual, frontBranch.zIndex > behindBranch.zIndex ? 'PASS' : 'FAIL',
    'Compared native z-order of the two branches in their common host');
}

function assessCheck(sample, selectors, check) {
  const nodes = roleNodes(sample, selectors, check.node);
  if (check.kind === 'present' || check.kind === 'absent') {
    const observations = nodes.map(node => ({...describe(node), ...effectiveAppearance(sample, node)}));
    const visible = observations.some(node => node.visible === true);
    if (!visible && observations.some(node => node.visible === null)) {
      return result(observations, 'NOT_RUN', `Native visibility or opacity for ${check.node} is unavailable`);
    }
    const expectedPresent = check.kind === 'present';
    return result(observations, visible === expectedPresent ? 'PASS' : 'FAIL',
      visible ? `${check.node} is visible in the admitted Reader window` : `${check.node} has no visible native instance`);
  }
  if (check.kind === 'enabled') {
    const node = singleNode(nodes, check.node);
    const appearance = node ? effectiveAppearance(sample, node) : {visible:false};
    const value = appearance.visible === false || node?.enabled === false ? false :
      appearance.visible === true && node.enabled === true ? true : null;
    const actual = {node:node ? describe(node) : null, value};
    if (value === null) return result(actual, 'NOT_RUN', `Native enabled visibility for ${check.node} is unavailable`);
    return result(actual, value === check.value ? 'PASS' : 'FAIL',
      `Observed whether ${check.node} is both visible and enabled`);
  }
  if (!nodes.length) {
    return check.optional === true ? result({applicable:false}, 'PASS', `${check.node} has no mounted instance`) :
      result(null, 'FAIL', `Required native region ${check.node} is absent`);
  }
  if (check.kind === 'descendant') {
    const host = singleNode(roleNodes(sample, selectors, check.ancestor), check.ancestor);
    const actual = {host:host ? describe(host) : null, nodes:nodes.map(describe)};
    const inside = host && nodes.every(node => ancestorsOf(sample, node).includes(host));
    return result(actual, inside ? 'PASS' : 'FAIL', `${check.node} must be hosted by ${check.ancestor}`);
  }
  const node = singleNode(nodes, check.node);
  if (check.kind === 'inFrontOf') {
    const behind = singleNode(roleNodes(sample, selectors, check.behind), check.behind);
    if (!behind) {
      return check.optionalBehind === true ? result({applicable:false}, 'PASS', `${check.behind} has no mounted instance`) :
        result(null, 'FAIL', `Required native region ${check.behind} is absent`);
    }
    if (check.optionalBehind === true) {
      const visibility = effectiveAppearance(sample, behind).visible;
      if (visibility === false) return result({applicable:false}, 'PASS', `${check.behind} is not visible`);
      if (visibility === null) return result(describe(behind), 'NOT_RUN', `Native visibility for ${check.behind} is unavailable`);
    }
    return compareForeground(sample, node, behind);
  }
  const appearance = effectiveAppearance(sample, node);
  const value = check.kind === 'backgroundAlpha' ?
    (unitValue(node.backgroundAlpha) && unitValue(appearance.opacity) ? node.backgroundAlpha * appearance.opacity : null) :
    appearance.opacity;
  if (!unitValue(value)) return result(describe(node), 'NOT_RUN', `Native ${check.kind} for ${check.node} is unavailable`);
  return result({...describe(node), value}, value >= check.min && value <= check.max ? 'PASS' : 'FAIL',
    `Measured effective native ${check.kind} for ${check.node}`);
}

export function evaluateStructure(rule, sample, selectors) {
  for (const check of rule.checks) {
    if (!kinds.has(check.kind)) throw new Error(`Unknown structure relationship ${check.kind}`);
    const roles = [check.node];
    if (check.kind === 'inFrontOf') roles.push(check.behind);
    if (check.kind === 'descendant') roles.push(check.ancestor);
    for (const key of roles) {
      if (!Object.hasOwn(selectors, key)) throw new Error(`Unknown structure selector ${key}`);
    }
    if ((check.kind === 'opacity' || check.kind === 'backgroundAlpha') &&
        (!unitValue(check.min) || !unitValue(check.max) || check.min > check.max)) {
      throw new Error(`Invalid ${check.kind} range for ${check.node}`);
    }
    if (check.kind === 'enabled' && typeof check.value !== 'boolean') {
      throw new Error(`Invalid enabled expectation for ${check.node}`);
    }
  }
  const evidenceRefs = sample?.evidenceRefs ?? [];
  if (!sample?.captureComplete || sample.window?.source !== 'window-metrics') {
    return {...result(null, 'NOT_RUN', 'A complete, stable Reader window capture is unavailable'),
      observationsComplete:false, evidenceRefs};
  }
  const checks = rule.checks.map(check => {
    try {
      return {specification:check, ...assessCheck(sample, selectors, check)};
    } catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      return {specification:check, ...result(null, 'NOT_RUN', error.message)};
    }
  });
  const firstFailure = checks.find(check => check.verdict === 'FAIL');
  const firstGap = checks.find(check => check.verdict === 'NOT_RUN');
  const issue = firstFailure ?? firstGap;
  return {...result({checks}, issue?.verdict ?? 'PASS', issue?.reason ?? 'Native scene structure met the declared requirements'),
    observationsComplete:!firstGap, evidenceRefs};
}
