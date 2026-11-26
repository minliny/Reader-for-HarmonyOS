import { readFileSync } from 'node:fs';
import { canonicalAppJson } from '../../scripts/lib/app-build-identity.mjs';
import { requireEvidence, sha256 } from '../lib/native-ui-evidence.mjs';
import { sourceGestureAssertion } from '../ui-contract/lib/source-gesture-assertion.mjs';
import { sourceNativeCenterAssertion } from '../ui-contract/lib/source-native-center.mjs';
import { sourceFilterNativeAssertion } from '../ui-contract/lib/source-filter-edge.mjs';
import { sourceRecoveryExpandEdgeAssertion } from '../ui-contract/lib/source-recovery-body.mjs';
import { sourceReadRetryTouchAssertion } from '../ui-contract/lib/source-read-retry-touch.mjs';
import { sourceControlTouchAssertion } from '../ui-contract/lib/source-control-touch.mjs';

export const isSourceE2Claim = (page, claim) => page.pageId === 'source-management' && claim === 'invariants.E2';
export const sourceE2InventoryPath = 'tools/page-structure/source-interaction-inventory.json';
const standardWidths = [320, 366];
const standardScales = [1, 1.3, 1.6, 2];
const edges = ['top', 'right', 'bottom', 'left'];
const expandedTargetEdges = new Map([
  ['search-import', edges],
  ['query-input', ['top','bottom']],
  ['row-toggle', ['top','bottom']],
]);
const disabled = 'status-custom';
const outside = 'group-outside-dismiss';
const nativeTargets = new Map([
  ['header-back','reader-source-back'], ['header-tools','reader-source-header-tools-button'],
  ['query-input','reader-source-editor'], ['search-import','reader-source-search-import-button'],
  ['group-trigger','reader-source-group-trigger'], ['group-search-input','reader-source-group-search'],
  ['group-selected-option','reader-source-group-selected'],
  ['group-other-option','reader-source-group-option-1'],
  ['row-login','reader-source-row-login-control'], ['row-detect','reader-source-row-detect-control'],
  ['row-toggle','reader-source-public-toggle-fixture'], ['footer-manage','reader-source-footer-tools-button'],
  ['footer-add','reader-source-footer-add-button'], ['status-action','reader-source-status-action'],
  ['read-refresh','reader-source-retained-read-retry'], ['empty-read-retry','reader-source-read-retry'],
  ['filter-empty-clear','reader-source-clear-filters'], ['original-reconcile','reader-source-original-reconcile'],
  ['original-continue','reader-source-original-continue'], ['original-expand-collapse','reader-source-original-expand'],
  ['unknown-reconcile','reader-source-unknown-reconcile'], ['unknown-expand-collapse','reader-source-unknown-expand'],
]);
const gestureAxes = new Map([['main-list','y'],['status-scroll','x'],['category-scroll','x'],['group-options-scroll','y']]);
const nativeSources = ['native-tree','window-metrics','app-owner'];
const same = (a,b) => canonicalAppJson(a) === canonicalAppJson(b);
const number = value => Number.isFinite(value) && value > 0;
const integer = value => Number.isSafeInteger(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const pair = (a,b) => JSON.stringify([a,b]);
const activeKinds = ['target-area','center',...edges];
const visibleWindow = value => ['portrait','landscape'].includes(value?.orientation) &&
  [value.widthPx,value.heightPx,value.density,value.fontScale].every(number);
const windowFields = ['widthPx','heightPx','density','fontScale','orientation'];
const sameWindow = (left,right) => windowFields.every(field=>left[field] === right[field]);

function e2(condition, message) {
  requireEvidence(condition, `Source E2 complete native interaction evidence: ${message}`);
}

export function readSourceE2Inventory() {
  const bytes = readFileSync(new URL('./source-interaction-inventory.json',import.meta.url));
  return {definition:JSON.parse(bytes.toString('utf8')), sha256:sha256(bytes)};
}

export function sourceE2TargetSelector(id) {
  if (id.startsWith('status-') && id !== 'status-action') return `reader-source-${id}`;
  if (id.startsWith('category-')) return `source-${id}`;
  return nativeTargets.get(id);
}

const declaredTouches = new Map([
  ['source-chrome-dispatch',{caseId:'source-management.chrome-touch-delivery',minimumVersion:1}],
  ['source-query-touch',{caseId:'source-management.query-editor-touch-edges',minimumVersion:2}],
  ['source-inline-import-edge',{caseId:'source-management.inline-import-touch-edges',minimumVersion:2}],
  ['source-inline-import-center',{caseId:'source-management.inline-import-touch-edges',minimumVersion:2}],
  ['toggle-touch',{caseId:'source-management.row-toggle-touch-edge',minimumVersion:3}],
  ['source-offline-detect',{caseId:'source-management.row-detect-offline-edge',minimumVersion:1}],
  ['source-filter-clear-touch',{caseId:'source-management.filter-empty-clear-edge',minimumVersion:1}],
  ['import-research-status-action',{caseId:'source-management.import-research-status-action-edge',minimumVersion:1}],
]);

export function sourceE2TouchAssertion(contract, assertion) {
  const derived = sourceFilterNativeAssertion(contract,assertion) ?? sourceNativeCenterAssertion(contract,assertion) ??
    sourceRecoveryExpandEdgeAssertion(contract,assertion) ?? sourceReadRetryTouchAssertion(contract,assertion) ??
    sourceControlTouchAssertion(contract,assertion);
  if (derived) return derived;
  const policy = declaredTouches.get(assertion?.kind);
  if (!policy || contract?.id !== policy.caseId || contract.version < policy.minimumVersion ||
      assertion.evaluator !== 'source' || assertion.required !== true) return undefined;
  const target = assertion.expected?.target;
  const subject = [...nativeTargets].find(([,id])=>id === target)?.[0];
  const position = assertion.expected?.position ?? assertion.expected?.tapEdge ?? 'center';
  if (subject && (position === 'center' || edges.includes(position)) &&
      contract.steps.some(step=>step.id === assertion.action && step.kind === 'action' &&
        step.op === 'click' && step.target === target && step.from === assertion.baseline)) {
    return {subject,target,position};
  }
}

export function sourceE2MissingTouchReferences(inventoryIds, observedPositions) {
  return inventoryIds.flatMap(id=>{
    if (id === disabled || id === outside) return [];
    const positions = observedPositions.get(id) ?? new Set();
    const missing = positions.has('center') ? [] : ['center'];
    const required = expandedTargetEdges.get(id);
    if (required) missing.push(...required.filter(position=>!positions.has(position)));
    else if (!edges.some(position=>positions.has(position))) missing.push('edge');
    return missing.length ? [{id,missing}] : [];
  });
}

/** Prepare a model mapping from released case references for later measured enrollment. */
export function planSourceE2Admission(coverage, loadCase, inventory = readSourceE2Inventory()) {
  e2(coverage && isSourceE2Claim(coverage, coverage.claim) && coverage.routeContractRef === 'nav.source',
    'no current Source E2 coverage references');
  const {definition,sha256:inventorySha256} = inventory;
  const controls = definition.targets.map(target => target.id);
  const configuredDemands = controls.flatMap(subject => {
    if (subject === outside) return [];
    if (subject === disabled) return [{subject,kinds:['disabled']}];
    const edgeDemands = expandedTargetEdges.get(subject)?.map(edge => [edge]) ?? [edges];
    return [['target-area'],['center'],...edgeDemands].map(kinds => ({subject,kinds}));
  });
  const globalDemands = [
    ...definition.gestures.map(({id:subject}) => ({subject,kinds:['gesture']})),
    {subject:outside,kinds:['outside-dismiss']}, {subject:'query-input',kinds:['focus']},
  ];
  const options = coverage.cases.map(part => {
    const contract = loadCase(part.caseId);
    e2(contract.id === part.caseId && contract.phase === 1 && contract.pageId === coverage.pageId &&
      part.ownerSources.every(path => contract.ownerSources.includes(path)), `wrong case or owner for ${part.caseId}`);
    const checks = [];
    for (const {id:assertionId,sampleId} of part.assertions) {
      const assertion = contract.assertions.find(item => item.id === assertionId);
      e2(assertion?.sample === sampleId && Object.values(contract.structure).includes(sampleId),
        `unresolved sample for ${part.caseId}/${assertionId}`);
      if (assertion.evaluator !== 'source' || !nativeSources.every(source => assertion.sources.includes(source))) continue;
      const add = (subject,kind) => checks.push({caseId:part.caseId,assertionId,subject,kind});
      const touch = sourceE2TouchAssertion(contract,assertion);
      if (touch && part.targetIds?.includes(touch.subject)) {
        add(touch.subject,touch.position);
        add(touch.subject,'target-area');
        if (touch.subject === 'query-input' && assertion.kind === 'source-query-touch' && touch.position === 'center') {
          add(touch.subject,'focus');
        }
      }
      for (const subject of part.targetIds ?? []) {
        const {kind,expected} = assertion;
        const area = kind === 'native-control-target' ||
          kind === 'filter-touch-target' && expected.requireFullContainment === true ||
          kind === 'recovery-native-control' && expected.requireNativeTouchTarget === true;
        if (area && expected.target === sourceE2TargetSelector(subject)) add(subject,subject === disabled ? 'disabled' : 'target-area');
        if (subject === outside && kind === 'group-outside-dismiss') add(subject,'outside-dismiss');
        if (subject === 'query-input' && kind === 'source-native-focus' && expected.stage === 'query') add(subject,'focus');
      }
      for (const subject of part.gestureIds ?? []) {
        if (sourceGestureAssertion(subject,contract,assertion)) add(subject,'gesture');
      }
    }
    return checks;
  });
  const used = new Map();
  const cells = standardWidths.flatMap(widthVp => standardScales.map(fontScale => {
    const id = `compact-${widthVp}-${fontScale}`;
    const demands = new Set(widthVp === 366 && fontScale === 1 ? [...configuredDemands,...globalDemands] : configuredDemands);
    const checks = [];
    while (demands.size) {
      let selected = [];
      for (const option of options) {
        const applicable = [...demands].map(demand => [demand,option.find(check =>
          check.subject === demand.subject && demand.kinds.includes(check.kind))]).filter(([,check]) => check);
        if (applicable.length > selected.length) selected = applicable;
      }
      e2(selected.length > 0, `no released assertion for ${id}: ${[...demands].map(({subject,kinds}) => `${subject}/${kinds.join('|')}`).join(', ')}`);
      for (const [demand,check] of selected) {
        demands.delete(demand);
        checks.push(check);
        if (!used.has(check.caseId)) used.set(check.caseId,new Set());
        used.get(check.caseId).add(check.assertionId);
      }
    }
    return {id,widthVp,fontScale,checks};
  }));
  const cases = coverage.cases.filter(part => used.has(part.caseId)).map(({caseId,assertions,ownerSources}) =>
    ({caseId,ownerSources,assertions:assertions.filter(({id}) => used.get(caseId).has(id))}));
  const mapping = {pageId:coverage.pageId,routeContractRef:coverage.routeContractRef,claim:coverage.claim,
    cases,interactions:{inventorySha256,cells}};
  requireSourceE2InteractionPlan(mapping,inventory);
  return mapping;
}

/** The inventory owns the denominator. The model only locates the exact captures that can pay it. */
export function requireSourceE2InteractionPlan(mapping, inventory = readSourceE2Inventory()) {
  const plan = mapping?.interactions;
  const {definition,sha256:inventorySha256} = inventory;
  e2(mapping && isSourceE2Claim(mapping,mapping.claim) && mapping.routeContractRef === 'nav.source' &&
    definition?.pageId === 'source-management' && definition.schemaVersion === '1.0' &&
    plan?.inventorySha256 === inventorySha256 && Array.isArray(mapping.cases) && mapping.cases.length > 1 &&
    Array.isArray(plan.cells) && plan.cells.length > 0, 'no complete model-owned interaction plan pinned to the live inventory');
  const targets = new Set(definition.targets.map(target=>target.id));
  const gestures = new Set(definition.gestures.map(gesture=>gesture.id));
  const excluded = new Set(definition.excluded.map(item=>item.id));
  e2(targets.size === definition.targets.length && gestures.size === definition.gestures.length &&
    targets.has(disabled) && targets.has(outside) && [...gestures].every(id=>gestureAxes.has(id)) &&
    [...targets].every(id=>!excluded.has(id) && (id === outside || nonempty(sourceE2TargetSelector(id)))),
  'inventory entries or exclusions cannot be matched to exact native scopes');
  const parts = new Map(mapping.cases.map(part=>[part.caseId,part]));
  e2(parts.size === mapping.cases.length, 'mapped case definitions must be distinct');
  const active = [...targets].filter(id=>id !== disabled && id !== outside);
  const cells = new Map();
  const widths = new Set();
  const allChecks = new Set();
  const usedAssertions = new Set();
  for (const cell of plan.cells) {
    e2(nonempty(cell?.id) && !cells.has(cell.id) && number(cell.widthVp) && number(cell.fontScale) &&
      Array.isArray(cell.checks) && cell.checks.length > 0, 'invalid or duplicate measured window cell');
    const obligations = new Set();
    cells.set(cell.id,cell);
    for (const check of cell.checks) {
      const part = parts.get(check.caseId);
      const obligation = pair(check.subject,check.kind);
      const permitted = check.kind === 'gesture' ? gestures.has(check.subject) :
        check.kind === 'disabled' ? check.subject === disabled :
        check.kind === 'outside-dismiss' ? check.subject === outside :
        check.kind === 'focus' ? check.subject === 'query-input' :
        active.includes(check.subject) && activeKinds.includes(check.kind);
      e2(permitted && !obligations.has(obligation) &&
        part?.assertions?.some(assertion=>assertion.id === check.assertionId),
      `unknown, duplicate or unmapped ${check.subject}/${check.kind} in ${cell.id}`);
      obligations.add(obligation);
      allChecks.add(obligation);
      usedAssertions.add(pair(check.caseId,check.assertionId));
    }
    if (standardWidths.includes(cell.widthVp) && standardScales.includes(cell.fontScale)) {
      const key = pair(cell.widthVp,cell.fontScale);
      e2(!widths.has(key), `duplicate compact width/scale cell ${key}`);
      widths.add(key);
      for (const id of active) {
        const has = kind => obligations.has(pair(id,kind));
        const requiredEdges = expandedTargetEdges.get(id);
        e2(has('target-area') && has('center') &&
          (requiredEdges ? requiredEdges.every(has) : edges.some(has)),
        `missing native area, center or edge evidence for ${id} in ${cell.id}`);
      }
      e2(obligations.has(pair(disabled,'disabled')), `missing disabled placeholder evidence in ${cell.id}`);
    }
  }
  for (const width of standardWidths) for (const scale of standardScales) {
    e2(widths.has(pair(width,scale)), `missing measured ${width}vp / ${scale}× plan cell`);
  }
  for (const id of gestures) e2(allChecks.has(pair(id,'gesture')), `missing native gesture ${id}`);
  e2(allChecks.has(pair(outside,'outside-dismiss')) && allChecks.has(pair('query-input','focus')),
    'missing actual modal outside dismissal or native query focus');
  e2(mapping.cases.every(part=>part.assertions.length && part.assertions.every(assertion=>
    usedAssertions.has(pair(part.caseId,assertion.id)))), 'mapped assertion has no interaction obligation');
  return {parts,cells};
}

export function sourceE2Runs(mapping,inventory = readSourceE2Inventory()) {
  const {cells,parts} = requireSourceE2InteractionPlan(mapping,inventory);
  return [...cells.values()].flatMap(cell=>[...new Set(cell.checks.map(check=>check.caseId))].map(caseId=>{
    const part = parts.get(caseId);
    const ids = new Set(cell.checks.filter(check=>check.caseId === caseId).map(check=>check.assertionId));
    return {cellId:cell.id,part:{...part,assertions:part.assertions.filter(assertion=>ids.has(assertion.id))}};
  }));
}

function capturedWindow(member, record, sampleId, cell) {
  const {receipt,session} = member;
  const window = receipt.measurement?.sampleWindows?.[sampleId];
  const raw = session?.chain.find(item=>item.entry.kind === 'sample' && item.entry.id === sampleId)?.entry;
  const references = [receipt.session,session?.commands,raw?.screenshot,raw?.layout];
  e2(visibleWindow(window) && Math.abs(window.widthPx-cell.widthVp*window.density) <= 1.01 &&
    Math.abs(window.fontScale-cell.fontScale) <= .010001 &&
    references.every(ref=>ref && record.evidenceRefs?.some(found=>same(found,ref))),
  `no same-window raw screenshot, tree and command evidence for ${receipt.caseId}/${sampleId}`);
  return window;
}

function gestureProof(check, definition, actual, member, record, before, cell) {
  const planned = sourceGestureAssertion(check.subject,member.contract,definition);
  const {dispatch,distancePx} = actual;
  const coordinates = [dispatch?.fromX,dispatch?.fromY,dispatch?.toX,dispatch?.toY];
  const vertical = gestureAxes.get(check.subject) === 'y';
  e2(planned && actual.gestureId === check.subject && actual.baselineSampleId === planned.baselineId &&
    actual.gestureSampleId === planned.sampleId && actual.actionId === planned.actionId &&
    coordinates.every(integer) && integer(dispatch?.probeSeq) && dispatch.probeSeq > 0 && number(dispatch.velocity) &&
    (vertical ? dispatch.fromX === dispatch.toX && dispatch.fromY > dispatch.toY :
      dispatch.fromY === dispatch.toY && dispatch.fromX > dispatch.toX) && distancePx > 1,
  `missing exact native routed gesture ${check.subject}`);
  const start = capturedWindow(member,record,actual.baselineSampleId,cell);
  const end = capturedWindow(member,record,actual.gestureSampleId,cell);
  e2(sameWindow(start,end) && sameWindow(end,before),
    `native gesture ${check.subject} changed its measured window`);
}

const rect = value => [value?.left,value?.top,value?.width,value?.height].every(integer) && value.width > 0 && value.height > 0;
const pointInside = (area, x, y) => x >= area.left && x < area.left+area.width && y >= area.top && y < area.top+area.height;
function exactPosition(bounds, {x,y}, kind) {
  const {left,top,width,height} = bounds;
  const centerX = left + Math.floor(width/2), centerY = top + Math.floor(height/2);
  if (!pointInside(bounds,x,y)) return false;
  if (kind === 'center') return Math.abs(x-centerX) <= 1 && Math.abs(y-centerY) <= 1;
  if (kind === 'top') return y-top <= 2;
  if (kind === 'right') return left+width-x <= 2;
  if (kind === 'bottom') return top+height-y <= 2;
  return x-left <= 2;
}

function targetProof(check, definition, actual, member, record, window, cell) {
  const target = sourceE2TargetSelector(check.subject);
  const queryTouch = check.subject === 'query-input' && definition.kind === 'source-query-touch';
  const kind = check.kind === 'focus' && queryTouch ? definition.expected.position : check.kind;
  if (queryTouch) e2(actual.focused === true && actual.keyboardVisible === true, 'query touch lacks actual editor focus and native IME');
  if (kind === 'disabled') {
    e2(definition.kind === 'filter-touch-target' && definition.expected.target === target &&
      definition.expected.requireFullContainment === true && actual.target === target && nonempty(actual.carrierPath) &&
      rect(actual.bounds) && actual.enabled === false && actual.clickable === false,
      'disabled 自定义 must be measured visibly disabled and non-clickable in its own native lane');
    return;
  }
  if (kind === 'focus') {
    e2(definition.kind === 'source-native-focus' && definition.expected.stage === 'query' && actual.stage === 'query',
      'query focus requires the native editor/IME result');
    return;
  }
  if (kind === 'outside-dismiss') {
    const step = member.contract.steps.find(step=>step.id === definition.action);
    e2(definition.kind === 'group-outside-dismiss' && step?.op === 'click' && step.from === definition.baseline &&
      actual.released === true && actual.stableProjection === true &&
      integer(actual.dispatch?.probeSeq) && actual.dispatch.probeSeq > 0 && actual.routeChanges === 0 && actual.groupCommits === 0,
    'outside dismiss requires one actual scoped backdrop click and retained owner');
    e2(sameWindow(capturedWindow(member,record,definition.baseline,cell),window),
      'outside dismissal starts in another measured window');
    return;
  }
  const releasedArea = kind === 'target-area' && ['native-control-target','filter-touch-target'].includes(definition.kind) &&
    definition.expected.target === target && (definition.kind !== 'filter-touch-target' || definition.expected.requireFullContainment === true);
  const recoveryArea = kind === 'target-area' && definition.kind === 'recovery-native-control' &&
    definition.expected.target === target && definition.expected.requireNativeTouchTarget === true && actual.applicability === 'APPLIES';
  const interaction = actual.nativeInteraction;
  const derived = sourceE2TouchAssertion(member.contract,definition);
  const declaredTarget = derived?.target ?? definition.expected?.target;
  const dynamic = check.subject === 'group-other-option' && /^reader-source-group-option-[1-9]\d*$/u.test(interaction?.target ?? '');
  const native = releasedArea ? actual : recoveryArea ? actual.nativeTouchTarget : interaction;
  e2((releasedArea || recoveryArea || native?.subject === check.subject && native.target === declaredTarget &&
      (!derived || derived.subject === check.subject)) &&
    (native?.target === target || dynamic) && nonempty(native?.carrierPath) && rect(native.bounds) &&
    native.bounds.width+1 >= 44*window.density && native.bounds.height+1 >= 44*window.density,
  `no actual unclipped response area for ${check.subject}`);
  if (kind === 'target-area') {
    e2(releasedArea || recoveryArea || native.visible === true && native.clipped === false && native.enabled === true,
      `no verified visible active carrier for ${check.subject}`);
    if (releasedArea || recoveryArea || native.accepted !== true) return;
  }
  const {dispatch,baselineSampleId,accepted,position,actionId} = native;
  const definedPosition = derived?.position ?? definition.expected?.position ?? definition.expected?.tapEdge ?? 'center';
  const measuredPosition = kind === 'target-area' ? definedPosition : kind;
  const queryPaint = queryTouch && rect(native.painted) && native.bounds.left === native.painted.left &&
    native.bounds.width === native.painted.width;
  const fullQueryPaint = queryPaint && native.painted.height+1 >= 44*window.density;
  const validEdgePaint = !expandedTargetEdges.has(check.subject) || measuredPosition === 'center' ||
    rect(native.painted) && (!queryTouch || queryPaint) && (fullQueryPaint ? same(native.bounds,native.painted) :
      !pointInside(native.painted,dispatch?.x,dispatch?.y));
  const step = member.contract.steps.find(step=>step.id === actionId);
  const stepTarget = typeof step?.target === 'string' ? step.target : derived && step?.target?.id;
  e2(native.visible === true && native.clipped === false && native.enabled === true && accepted === true &&
    position === measuredPosition && definedPosition === measuredPosition &&
    definition.action === actionId && definition.baseline === baselineSampleId &&
    step?.kind === 'action' && step.op === 'click' && step.from === baselineSampleId && stepTarget === native.target &&
    [dispatch?.probeSeq,dispatch?.x,dispatch?.y].every(integer) && dispatch.probeSeq > 0 &&
    exactPosition(native.bounds,dispatch,measuredPosition) && validEdgePaint,
  `missing causally accepted real native ${kind} click for ${check.subject}`);
  const start = capturedWindow(member,record,baselineSampleId,cell);
  // A native IME may resize the visible height of the same resolved window.
  const compatible = queryTouch ? windowFields.filter(field=>field !== 'heightPx').every(field=>start[field] === window[field])
    : sameWindow(start,window);
  e2(compatible,
    `native ${kind} proof for ${check.subject} starts in another measured window`);
}

/** Validate the named obligations of one independently replayed member in its measured cell. */
export function requireSourceE2MeasuredCellMember(member, cell) {
  const {part,receipt,contract,targetRef} = member;
  const candidate = receipt?.candidate?.identity;
  e2(cell.id === member.cellId && receipt.caseId === part.caseId && contract.id === part.caseId &&
    completeSourceE2Member(receipt, candidate, targetRef),
  `wrong candidate, target, cell or incomplete native replay for ${part?.caseId}`);
  const checks = cell.checks.filter(check => check.caseId === part.caseId);
  e2(checks.length > 0, `no configured checks for ${part.caseId} in ${cell.id}`);
  for (const check of checks) {
    const assertion = part.assertions.find(assertion => assertion.id === check.assertionId);
    const definitions = contract.assertions.filter(item => item.id === check.assertionId);
    const recorded = receipt.assertions.filter(item => item.id === check.assertionId);
    const [definition] = definitions, [record] = recorded;
    const actual = record?.actual;
    e2(definitions.length === 1 && recorded.length === 1 && definition.evaluator === 'source' &&
      nativeSources.every(source => definition.sources?.includes(source)) && record.verdict === 'PASS' &&
      definition.sample === assertion?.sampleId && actual?.sampleId === assertion?.sampleId,
    `no exact current native assertion ${check.assertionId} in ${cell.id}`);
    const window = capturedWindow(member,record,assertion.sampleId,cell);
    if (check.kind === 'gesture') gestureProof(check,definition,actual,member,record,window,cell);
    else targetProof(check,definition,actual,member,record,window,cell);
  }
  return checks;
}

function completeSourceE2Member(receipt, candidate, targetRef) {
  return receipt.observations === 'COMPLETE' && receipt.execution === 'PASS' && receipt.behavior === 'PASS' &&
    /^[a-f0-9]{12}$/u.test(targetRef ?? '') && candidate?.targetRef === targetRef;
}

/** Every member has independently replayed against its frozen case, candidate, route and owners. */
export function requireSourceE2InteractionReceipts(mapping, inventory, members) {
  const {cells} = requireSourceE2InteractionPlan(mapping,inventory);
  const runs = sourceE2Runs(mapping,inventory);
  const expected = new Map(runs.map(({cellId,part})=>[pair(cellId,part.caseId),part]));
  e2(members.length === expected.size,'missing or additional independently replayed case-window roots');
  let build;
  for (const member of members) {
    const {cellId,part,receipt} = member;
    const candidate = receipt?.candidate?.identity;
    const identity = candidate && ['appBuildId','appContentHash','buildRunId','hapSha256','sourceFingerprint']
      .map(key=>candidate[key]);
    const key = pair(cellId,part?.caseId);
    e2(expected.has(key) && same(part,expected.get(key)) && identity?.every(nonempty) && (!build || same(build,identity)),
    `wrong candidate, target, cell or incomplete native replay for ${part?.caseId}`);
    expected.delete(key);
    build = identity;
    requireSourceE2MeasuredCellMember(member,cells.get(cellId));
  }
}
