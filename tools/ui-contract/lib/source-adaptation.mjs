import { sourceReadObservation } from './source-read.mjs';
import { publicReservedSourceHost, reservedSourceToggle, reservedStatusReady, reservedStatusReveal,
  sourceReservedTypographyNarrowFixture, usesReservedNativeToggle } from './source-reserved-typography.mjs';

const blockId = 'reader-source-filter-block';
const regionIds = {
  query:'reader-source-search',
  editor:'reader-source-editor',
  stats:'reader-source-stats',
  status:'reader-source-status-filter',
  group:'reader-source-group-filter',
  category:'reader-source-category-filter',
  statusHead:'reader-source-status-all',
  categoryHead:'source-category-all',
  groupTrigger:'reader-source-group-trigger',
};
const requiredParents = {
  query:'block',editor:'query',stats:'block',status:'block',group:'block',category:'block',
  statusHead:'status',categoryHead:'category',groupTrigger:'group',
};
const containedBy = (node, host) => node.path.startsWith(host.path + '/');
const insideRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const rectKeys = ['left','top','width','height'];
const hasBounds = rect => rect && rectKeys.every(key => Number.isFinite(rect[key]));
const areaAvailable = rect => rect.width > 0 && rect.height > 0;
const endX = rect => rect.left + rect.width;
const endY = rect => rect.top + rect.height;

function contains(outer, inner, tolerance) {
  return inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance &&
    endX(inner) <= endX(outer) + tolerance && endY(inner) <= endY(outer) + tolerance;
}

function defaultSourceProjection(state) {
  return state.projected === state.count && state.queryLength === 0 && state.status === 'all';
}

function reservedSourceProjection(state) {
  return state.count > 1 && state.projected === 1 && state.queryLength === publicReservedSourceHost.length &&
    state.status === 'unchecked';
}

function sourceAdaptationSample(assertion, context, projectionMatches = defaultSourceProjection) {
  const {expected} = assertion;
  const opening = sourceReadObservation({...assertion,expected:{state:'rows'}},context);
  const sample = opening?.sample;
  const window = sample?.window;
  const projection = opening?.current;
  const state = projection?.payload;
  const geometry = sample && context.events.findLast(event => event.kind === 'source.geometry' &&
    event.channel === 'business' && event.instanceId === sample.instanceId && event.eventSeq <= sample.beforeSeq);
  const facts = geometry?.payload;
  const evidenceRefs = [sample, opening?.entry, projection, geometry, context.actions?.[assertion.action]]
    .flatMap(item => item?.evidenceRefs ?? []);
  if (sample?.captureComplete !== true || window?.keyboard?.visible !== false ||
      !Number.isFinite(window.density) || window.density <= 0 ||
      !sample.evidenceRefs?.some(ref => ref.path.endsWith('.png')) ||
      !sample.evidenceRefs?.some(ref => ref.path.endsWith('.json')) ||
      state?.state !== 'rows' || state.readFact !== 'current' ||
      !Number.isSafeInteger(state.count) || state.count <= 0 || !projectionMatches(state) ||
      state.groupIndex !== 0 || state.allGroups !== true || state.category !== 'all' ||
      !geometry || geometry.eventSeq <= opening.entry.eventSeq || geometry.windowRevision !== window.revision ||
      facts?.owner?.generation !== state.owner.generation || facts.owner.mounting !== state.owner.mounting) {
    return {evidenceRefs,gap:projectionMatches === defaultSourceProjection ?
      'A complete normal Source opening with the default populated projection and current layout is required' :
      'A complete native Source sample with the current reserved-row filter is required'};
  }
  const widthVp = window.rectPx?.width / window.density;
  const scale = window.fontScale;
  if (!insideRange(widthVp,expected.minWidthVp,expected.maxWidthVp) ||
      !insideRange(scale,expected.minFontScale,expected.maxFontScale) ||
      !insideRange(facts.fontScale,expected.minFontScale,expected.maxFontScale) ||
      Math.abs(scale - facts.fontScale) > .01 || facts.expanded !== expected.expanded) {
    return {evidenceRefs,gap:'The verified window and Source owner do not prove the selected width, font scale and branch'};
  }
  return {opening,sample,window,state,facts,widthVp,scale,evidenceRefs};
}

export function evaluateSourceAdaptationSurface(assertion, context) {
  const {expected} = assertion;
  const {sample,window,facts,widthVp,scale,evidenceRefs,gap} = sourceAdaptationSample(assertion,context);
  const report = (verdict, reason, actual = null) => ({verdict,reason,actual,expected,evidenceRefs});
  if (gap) return report('NOT_RUN',gap);
  const regions = {};
  const failures = [];
  const gaps = [];
  const record = (name, candidates, parent) => {
    const [node] = candidates;
    if (candidates.length > 1) { gaps.push(`${name} is ambiguous`); return; }
    if (!node) { failures.push(`${name} is absent`); return; }
    regions[name] = node;
    if (parent && !containedBy(node,parent)) failures.push(`${name} is outside its native host`);
  };
  record('block',sample.nodes.filter(node => node.id === blockId));
  for (const [role,id] of Object.entries(regionIds)) {
    record(role,sample.nodes.filter(node => node.id === id),regions[requiredParents[role]]);
  }
  const measureButton = role => {
    const host = regions[role];
    if (!host) return;
    const buttons = sample.nodes.filter(node => node.type === 'Button' && (node === host || containedBy(node,host)));
    record(`${role}Button`,buttons);
    if (buttons.length === 1) record(`${role}Label`,
      sample.nodes.filter(node => node.type === 'Text' && containedBy(node,buttons[0])),buttons[0]);
  };
  for (const role of ['statusHead','categoryHead','groupTrigger']) measureButton(role);
  if (regions.group && regions.groupTrigger) record('groupLabel',sample.nodes.filter(node =>
    node.type === 'Text' && containedBy(node,regions.group) && !containedBy(node,regions.groupTrigger)),regions.group);
  const witnesses = {};
  for (const [role,node] of Object.entries(regions)) {
    if (!hasBounds(node.rectPx) || !hasBounds(node.visibleRectPx) ||
        typeof node.visible !== 'boolean' || !Number.isFinite(node.opacity)) {
      gaps.push(`${role} lacks native visibility or bounds`);
      continue;
    }
    const visible = node.visible && node.opacity > 0 && areaAvailable(node.rectPx) && areaAvailable(node.visibleRectPx);
    const complete = visible && contains(node.visibleRectPx,node.rectPx,expected.tolerancePx);
    witnesses[role] = {path:node.path,widthVp:node.rectPx.width / window.density,
      heightVp:node.rectPx.height / window.density,fullyVisible:complete};
    if (!complete) failures.push(`${role} is clipped or not visible`);
  }
  const containment = (child, parent) => {
    if (witnesses[child] && witnesses[parent] &&
        !contains(regions[parent].rectPx,regions[child].rectPx,expected.tolerancePx))
      failures.push(`${child} exceeds the measured ${parent} layout budget`);
  };
  for (const [child,parent] of Object.entries(requiredParents)) containment(child,parent);
  for (const role of ['statusHead','categoryHead','groupTrigger']) {
    containment(`${role}Button`,role);
    containment(`${role}Label`,`${role}Button`);
  }
  containment('groupLabel','group');
  const statsMinimumVp = expected.statsLineHeightFp * scale;
  if (witnesses.stats && (regions.stats.type !== 'Text' ||
      regions.stats.rectPx.height + expected.tolerancePx < statsMinimumVp * window.density)) {
    failures.push('The statistics line does not reserve its scaled typography height');
  }
  const follows = (prior, next, axis) => {
    if (!witnesses[prior] || !witnesses[next]) return;
    const a = regions[prior].rectPx;
    const b = regions[next].rectPx;
    if ((axis === 'x' ? endX(a)-b.left : endY(a)-b.top) > expected.tolerancePx)
      failures.push(`${next} overlaps or precedes ${prior}`);
  };
  follows('query','stats','y');
  follows('stats','status','y');
  follows('stats','group','y');
  follows('status','group',facts.expanded ? 'x' : 'y');
  follows('groupLabel','groupTrigger','x');
  follows('status','category','y');
  follows('group','category','y');
  const actual = {sampleId:assertion.sample,widthVp,scale,expanded:facts.expanded,statsMinimumVp,witnesses,failures,gaps};
  // Only the selected first button is required inside each horizontal Scroll.
  // Off-screen tail chips are covered by the separate scroll/selection cases.
  if (failures.length) return {...report('FAIL',failures[0],actual),observationsComplete:gaps.length === 0};
  if (gaps.length) return report('NOT_RUN',gaps[0],actual);
  return report('PASS','',actual);
}

const textRoles = {
  'stats': {id:regionIds.stats,hostId:blockId},
  'status/all': {id:regionIds.statusHead,hostId:regionIds.status,button:true},
  'category/all': {id:regionIds.categoryHead,hostId:regionIds.category,button:true},
  'group/label': {id:'reader-source-text-group-label',hostId:regionIds.group},
  'footer/manage': {id:'reader-source-text-footer-manage',hostId:'reader-source-footer',button:true},
  'footer/add': {id:'reader-source-text-footer-add',hostId:'reader-source-footer',button:true},
};
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const near = (a,b,tolerance) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance;
const witness = (verdict,reason,actual = null) => ({verdict,reason,actual});
const missing = reason => witness('NOT_RUN',reason);

export function nativeSourceText(sample, role, selector, requireNative = false) {
  const host = sample.nodes.filter(node => node.id === selector.hostId);
  const target = sample.nodes.filter(node => (selector.alias === true ? node.alias : node.id) === selector.id);
  const absent = reason => requireNative ? witness('FAIL',reason) : missing(reason);
  if (host.length > 1 || target.length > 1) return missing(`${role} does not identify one exact native host and target`);
  if (!host.length || !target.length) return requireNative
    ? witness('FAIL',`${role} is absent from the current native surface`)
    : missing(`${role} does not identify one exact native host and target`);
  if (!containedBy(target[0],host[0])) return witness('FAIL',`${role} is outside its native host`);
  if (!selector.button) return target[0].type === 'Text' ? {node:target[0]} : absent(`${role} has no exact native Text node`);
  const buttons = sample.nodes.filter(node => node.type === 'Button' &&
    (node === target[0] || containedBy(node,target[0])));
  const labels = buttons.length === 1 ? sample.nodes.filter(node => node.type === 'Text' && containedBy(node,buttons[0])) : [];
  if (labels.length === 1) return {node:labels[0]};
  const failure = buttons.length <= 1 && !labels.length ? absent : missing;
  return failure(`${role} does not identify one native Text inside its action`);
}

function currentPublicRowActions(state) {
  const row = state?.rowActions;
  return state?.state === 'rows' && state.readFact === 'current' && state.count === 1 && state.projected === 1 &&
    positiveInteger(row?.anchor) && row.anchor === state.firstAnchor ? row : null;
}

export function evaluateSourceRowStatusBadge(assertion,context) {
  const opening = sourceReadObservation({...assertion,expected:{state:'rows'}},context);
  const sample = opening?.sample;
  const window = sample?.window;
  const check = currentPublicRowActions(opening?.current.payload);
  const report = (verdict,reason,actual = null)=>({verdict,reason,actual,expected:assertion.expected,
    observationsComplete:verdict !== 'NOT_RUN',evidenceRefs:[
      sample,opening?.entry,opening?.current,context.actions?.[assertion.action],
    ].flatMap(item=>item?.evidenceRefs ?? [])});
  if (!check || check.checkState !== assertion.expected.state || sample?.captureComplete !== true ||
      window?.source !== 'window-metrics' || window.keyboard?.visible !== false || !hasBounds(window.visibleRectPx) ||
      !Number.isFinite(window.density) || window.density <= 0 ||
      !sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) || !sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'))) {
    return report('NOT_RUN','No complete current native sample of the unchecked public Source row');
  }
  const nodes = sample.nodes.filter(node=>node.source === 'native-tree');
  const lists = nodes.filter(node=>node.id === 'reader-source-list' && node.type === 'List');
  const rows = nodes.filter(node=>node.id === `reader-source-row-${check.anchor}` && node.type === 'Column');
  const carriers = nodes.filter(node=>node.id === 'reader-source-row-status-' + assertion.expected.state);
  if (lists.length !== 1 || rows.length !== 1 || carriers.length > 1)
    return report('NOT_RUN','The current native source list, row or status carrier is unavailable or ambiguous');
  const [list] = lists;
  const [row] = rows, [carrier] = carriers;
  if (!carrier || carrier.type !== 'Stack' || !containedBy(row,list) || !containedBy(carrier,row)) {
    return report('FAIL','The visible status is absent from its current native Source row');
  }
  const paths = nodes.filter(node=>node.type === 'Path' && containedBy(node,carrier));
  if (paths.length !== 1) return report('FAIL','The current status carrier does not contain one native vector');
  const [vector] = paths;
  if (![row,carrier,vector].every(node=>hasBounds(node.rectPx) && hasBounds(node.visibleRectPx) &&
    typeof node.visible === 'boolean' && Number.isFinite(node.opacity))) {
    return report('NOT_RUN','The native same-row status carrier or vector bounds are unavailable');
  }
  const actual = {sampleId:assertion.sample,rowAnchor:check.anchor,state:check.checkState,
    carrierPath:carrier.path,vectorPath:vector.path,carrierPx:carrier.rectPx,vectorPx:vector.rectPx,
    nativeAccessibilityState:carrier.sourceRowStatusLabel ?? null};
  const visible = [carrier,vector].every(node=>node.visible && node.opacity > 0 && areaAvailable(node.visibleRectPx) &&
    contains(node.visibleRectPx,node.rectPx,1) && contains(window.visibleRectPx,node.rectPx,1));
  const size = (node,width,height)=>near(node.rectPx.width,width*window.density,1) &&
    near(node.rectPx.height,height*window.density,1);
  const placed = visible && row.visible && row.opacity > 0 && size(carrier,24,18) && size(vector,12,12) &&
    contains(row.visibleRectPx,carrier.rectPx,1) && contains(carrier.visibleRectPx,vector.rectPx,1);
  const matches = placed && (actual.nativeAccessibilityState === null || actual.nativeAccessibilityState === check.checkState);
  return report(matches ? 'PASS' : 'FAIL',matches ? '' : 'The status vector is clipped or conflicts with the current Source row status',actual);
}

function textLineBounds(line) {
  if (!line || ![line.leftPx,line.topPx,line.widthPx,line.heightPx,line.baselinePx].every(Number.isFinite) ||
      line.widthPx <= 0 || line.heightPx <= 0) return null;
  return {left:line.leftPx,top:line.topPx,width:line.widthPx,height:line.heightPx};
}

function textRangeBounds(rect) {
  if (!rect || ![rect.leftPx,rect.topPx,rect.rightPx,rect.bottomPx].every(Number.isFinite) ||
      rect.rightPx <= rect.leftPx || rect.bottomPx <= rect.topPx) return null;
  return {left:rect.leftPx,top:rect.topPx,width:rect.rightPx-rect.leftPx,height:rect.bottomPx-rect.topPx};
}

function textRangeSet(rects) {
  if (!Array.isArray(rects) || !rects.length || rects.length > 12) return null;
  const bounds = rects.map(textRangeBounds);
  return bounds.every(Boolean) ? bounds : null;
}

function rangeOnLine(bounds,line) {
  const bottom = bounds.top + bounds.height;
  const middle = bounds.top + bounds.height / 2;
  return bounds.top <= line.baselinePx && bottom >= line.baselinePx &&
    middle >= line.topPx && middle < line.topPx + line.heightPx;
}

export function sourceTextPlacement(role,label,node,window,expected) {
  if (!hasBounds(node.rectPx) || !hasBounds(node.visibleRectPx) || !hasBounds(window.visibleRectPx) ||
      typeof node.visible !== 'boolean' || !Number.isFinite(node.opacity)) return missing(`${role} lacks native visibility or bounds`);
  const actual = {path:node.path,nodePx:node.rectPx,visiblePx:node.visibleRectPx,
    utf16Length:label?.utf16Length,startUtf16:label?.startUtf16,endUtf16:label?.endUtf16};
  const failure = reason => witness('FAIL',reason,actual);
  if (!node.visible || node.opacity <= 0 || !areaAvailable(node.visibleRectPx) || !areaAvailable(node.rectPx)) {
    return failure(`${role} is not visible in the current Reader window`);
  }
  const tolerance = expected.tolerancePx;
  if (role === 'stats' && node.rectPx.height + tolerance < expected.statsLineHeightFp * window.fontScale * window.density) {
    return failure('The statistics line does not reserve its scaled typography height');
  }
  const {utf16Length,startUtf16,endUtf16,complete,lines,rangeRects,tailRects} = label ?? {};
  if (!positiveInteger(utf16Length) || utf16Length > 512 || !Array.isArray(lines) || !lines.length || lines.length > (expected.lineLimit ?? 4) ||
      !lines.every(line => line && Number.isSafeInteger(line.start) && Number.isSafeInteger(line.end) &&
        line.start >= 0 && line.start < line.end && line.end <= utf16Length) ||
      startUtf16 !== lines[0].start || endUtf16 !== lines.at(-1).end) return missing(`${role} has no bounded native text range`);
  const lineBounds = lines.map(textLineBounds);
  if (lineBounds.some(box => !box)) return missing(`${role} native line coordinates are unavailable`);
  const breaks = lines.slice(1).map((line,index) => ({start:lines[index].end,end:line.start}));
  const hasOverlap = breaks.some(gap => gap.end < gap.start);
  const skippedIndexes = breaks.flatMap(gap => Array.from({length:gap.end-gap.start}, (_,index) => gap.start+index));
  const wrapSpaces = expected.nativeWrapSpaceIndexes;
  const spacesCoverBreaks = skippedIndexes.length > 0 && Array.isArray(wrapSpaces) &&
    skippedIndexes.every(index => wrapSpaces.includes(index));
  if (startUtf16 !== 0 || endUtf16 !== utf16Length || hasOverlap || skippedIndexes.length > 0 && !spacesCoverBreaks) {
    return failure(`${role} native lines do not cover the complete label`);
  }
  const inDisplay = box => ({...box,left:box.left + node.rectPx.left,top:box.top + node.rectPx.top});
  if (lineBounds.some(box => !contains(node.rectPx,inDisplay(box),tolerance))) {
    return failure(`${role} native lines exceed the actual Text layout box`);
  }
  const full = textRangeSet(rangeRects);
  const tail = textRangeSet(tailRects);
  // A native layout may omit spaces at soft wraps and mark its ranges
  // incomplete. Require independent coverage of each glyph run and the tail.
  const completeRanges = full !== null && tail !== null && (spacesCoverBreaks ?
    lines.every(line => full.some(bounds => rangeOnLine(bounds,line))) &&
      tail.every(bounds => rangeOnLine(bounds,lines.at(-1))) : complete === true);
  const displayRects = [...full ?? [], ...tail ?? []].map(inDisplay);
  const leavesText = displayRects.some(box => [node.rectPx,node.visibleRectPx].some(outer => !contains(outer,box,tolerance)));
  const clipAncestors = expected.clipAncestors;
  const fitsObservedClips = clipAncestors?.length > 0 && displayRects.every(box =>
    box.left >= node.rectPx.left - tolerance && endX(box) <= endX(node.rectPx) + tolerance &&
    clipAncestors.every(({rectPx}) => contains(rectPx,box,tolerance)));
  if (displayRects.some(box => !contains(window.visibleRectPx,box,tolerance)) || leavesText && !fitsObservedClips) {
    const clipped = failure(`${role} native text ranges are clipped`);
    return completeRanges ? clipped : {...clipped,observationsComplete:false};
  }
  if (!completeRanges) return missing(`${role} lacks complete native full and trailing range rectangles`);
  return witness('PASS','',{...actual,lineCount:lines.length,rangeCount:full.length,tailCount:tail.length,
    ...(spacesCoverBreaks ? {wrappedSpaceIndexes:skippedIndexes} : {}),
    ...(leavesText ? {clipAncestors} : {})});
}

export function evaluateSourceAdaptationText(assertion, context) {
  const {expected} = assertion;
  const reserved = assertion.kind === 'reserved-row-typography';
  const nativeReservedToggle = reserved && usesReservedNativeToggle(context.fixture?.id);
  const {opening,sample,window,state,facts,widthVp,scale,evidenceRefs,gap} =
    sourceAdaptationSample(assertion,context,reserved ? reservedSourceProjection : defaultSourceProjection);
  const text = sample && context.events.findLast(event => event.kind === 'source.text-layout' &&
    event.channel === 'business' && event.instanceId === sample.instanceId && event.eventSeq <= sample.beforeSeq);
  const report = (verdict,reason,actual = null,observationsComplete = verdict !== 'NOT_RUN') => ({verdict,reason,actual,expected,
    evidenceRefs:[...evidenceRefs,...text?.evidenceRefs ?? []],observationsComplete});
  if (gap) return report('NOT_RUN',gap);
  const rowActions = expected.textScope === 'row-actions';
  const publicRow = rowActions ? currentPublicRowActions(state) : null;
  if (rowActions && publicRow?.checkState !== 'unchecked')
    return report('NOT_RUN','No currently unchecked reserved public row for the mounted Login and Detect labels');
  const nativeFont = window.nativeFont;
  if (expected.requireNativeFontReadback === true) {
    if (window.source !== 'window-metrics' || !nativeFont)
      return report('NOT_RUN','No stable native font readback for the selected Source window');
    const readback = {widthVp,scale,nativeFont};
    if (nativeFont.followsSystemFontScale !== true)
      return report('NOT_RUN','The current native Source window does not follow the system font scale',readback);
    if (!insideRange(nativeFont.effectiveScale,expected.minFontScale,expected.maxFontScale) ||
        !near(nativeFont.effectiveScale,scale,.01) || !near(nativeFont.effectiveScale,facts.fontScale,.01) ||
        (Number.isFinite(nativeFont.maxFontScale) && nativeFont.maxFontScale + .01 < nativeFont.effectiveScale))
      return report('NOT_RUN','The effective native font scale does not match the selected Source system font condition',readback);
  }
  const data = text?.payload;
  if (!data || window.source !== 'window-metrics' || text.eventSeq <= opening.entry.eventSeq ||
      text.windowRevision !== window.revision || data.windowRevision !== window.revision ||
      data.owner?.mounting !== state.owner.mounting || data.owner?.generation !== state.owner.generation ||
      !positiveInteger(state.readGeneration) || !positiveInteger(state.filterRevision) ||
      data.readGeneration !== state.readGeneration || data.filterRevision !== state.filterRevision ||
      !positiveInteger(state.firstAnchor) || data.rowAnchor !== state.firstAnchor ||
      !near(data.density,window.density,.01) || !near(data.systemFontScale,scale,.01) || !near(data.fontScale,facts.fontScale,.01) ||
      !near(data.widthVp,widthVp,1 / window.density) || !near(data.heightVp,window.rectPx.height / window.density,1 / window.density) ||
      !Array.isArray(data.labels) || data.labels.length > (rowActions ? 10 : 9) ||
      nativeReservedToggle && data.labels.length !== 2)
    return report('NOT_RUN','No matching native text layout from the current Source opening, read and window');
  const textProjectionRevision = state.textProjectionRevision;
  if (expected.requireCurrentTextProjection === true && (!positiveInteger(textProjectionRevision) ||
      data.textProjectionRevision !== textProjectionRevision || text.eventSeq <= opening.current.eventSeq)) {
    return report('NOT_RUN','No native text measurement from the current Source text projection',{
      projectionSeq:opening.current.eventSeq,textSeq:text.eventSeq,
      textProjectionRevision:textProjectionRevision ?? null,observedTextProjectionRevision:data.textProjectionRevision ?? null,
    });
  }
  const row = `reader-source-row-${state.firstAnchor}`;
  const reservedProof = reserved ? reservedTypographyObservation(assertion,context,opening,row,
    nativeReservedToggle ? text : undefined) : null;
  if (reservedProof?.reason) return report(reservedProof.verdict,reservedProof.reason);
  if (reservedProof) evidenceRefs.push(...reservedProof.evidenceRefs);
  let firstRowToggle;
  if (expected.requireFirstRowToggleOff === true) {
    const firstRows = sample.nodes.filter(node=>node.id === row && node.visible === true && node.source === 'native-tree');
    const [first] = firstRows;
    const switches = firstRows.length !== 1 ? [] : sample.nodes.filter(node=>node.type === 'Toggle' &&
      node.source === 'native-tree' && node.visible === true && node.opacity > 0 && containedBy(node,first));
    const [toggle] = switches;
    if (switches.length !== 1 || typeof toggle.sourceDefaultFontToggleChecked !== 'boolean')
      return report('NOT_RUN','No unique checked-state readback on the current first native Source row');
    firstRowToggle = {rowAnchor:state.firstAnchor,checked:toggle.sourceDefaultFontToggleChecked};
    if (firstRowToggle.checked)
      return report('FAIL','The current first native Source row has its switch on',firstRowToggle);
  }
  const fixedRowRoles = {
    'row/category': {id:'reader-source-text-row-category',hostId:row},
    'row/detect': {id:'reader-source-text-row-detect',hostId:row,button:true},
  };
  const selectedRoles = rowActions ? {
    ...fixedRowRoles,
    'row/detect': {id:'reader-source-row-detect-control',hostId:row,alias:true,button:true},
    'row/login': {id:'reader-source-row-login-control',hostId:row,alias:true,button:true},
  } : reserved ? fixedRowRoles : expected.rowLabels === true ? {
    ...textRoles,
    ...fixedRowRoles,
  } : textRoles;
  const roles = {};
  for (const [role,selector] of Object.entries(selectedRoles)) {
    const candidate = nativeSourceText(sample,role,selector);
    const measurements = data.labels.filter(label => label?.role === role);
    let proof = !candidate.node ? candidate : measurements.length !== 1 ?
      missing(`${role} has no unique native text layout measurement`) : sourceTextPlacement(role,measurements[0],candidate.node,window,expected);
    if (rowActions && proof.verdict === 'PASS') {
      proof = proof.actual.utf16Length === 2 ? {...proof,actual:{...proof.actual,sampleId:assertion.sample}} :
        witness('FAIL',`${role} has the wrong character range for the public Source row`,proof.actual);
    }
    if (reserved && role === 'row/detect' && proof.verdict === 'PASS' &&
        (candidate.node.publicReservedSourceIdleDetect !== true || proof.actual.utf16Length !== 2)) {
      proof = witness('FAIL','The reserved row does not expose the actual idle Detect label',proof.actual);
    }
    roles[role] = proof;
  }
  const observations = Object.values(roles);
  const failure = observations.find(result => result.verdict === 'FAIL');
  const missingRole = observations.find(result => result.verdict === 'NOT_RUN');
  const observationsComplete = !missingRole && observations.every(result => result.observationsComplete !== false);
  return report(failure ? 'FAIL' : missingRole ? 'NOT_RUN' : 'PASS',failure?.reason ?? missingRole?.reason ?? '',
    {sampleId:assertion.sample,widthVp,scale,filterRevision:state.filterRevision,readGeneration:state.readGeneration,roles,
      ...(firstRowToggle ? {firstRowToggle} : {}),
      ...(reservedProof ? {reservedRow:reservedProof.actual} : {}),
      ...(rowActions ? {textScope:'row-actions',rowAnchor:publicRow.anchor} : {}),
      ...(expected.requireCurrentTextProjection === true ? {textProjectionRevision} : {}),
      ...(expected.requireNativeFontReadback === true ? {nativeFont} : {})},observationsComplete);
}

function reservedTypographyObservation(assertion, context, opening, rowId, afterImeGlyphs) {
  const baseline = sourceAdaptationSample({...assertion,sample:assertion.baseline},context);
  const {sample,current} = opening;
  const state = current.payload;
  const status = context.actions?.['select-unchecked'];
  const input = context.actions?.['input-reserved-host'];
  const back = context.actions?.['hide-reserved-ime'];
  const keyboard = context.samples?.['reserved-query-edited'];
  const narrow = context.fixture?.id === sourceReservedTypographyNarrowFixture;
  const reveal = narrow ? context.actions?.[reservedStatusReveal] : undefined;
  const sameWindow = (a,b) => a?.id === b.id && a.orientation === b.orientation &&
    a.density === b.density && a.fontScale === b.fontScale &&
    rectKeys.every(key => a.rectPx?.[key] === b.rectPx?.[key]);
  if (baseline.gap || baseline.opening.entry.eventSeq !== opening.entry.eventSeq ||
      baseline.state.count !== state.count || baseline.state.readGeneration !== state.readGeneration ||
      baseline.state.filterRevision >= state.filterRevision || !sameWindow(baseline.window,sample.window) ||
      ![status,input,back,keyboard].every(item => item?.instanceId === sample.instanceId) ||
      status.op !== 'click' || status.targetId !== 'reader-source-status-unchecked' ||
      status.from !== (narrow ? reservedStatusReady : assertion.baseline) ||
      input.op !== 'inputText' || input.targetId !== 'reader-source-editor' || input.from !== 'reserved-query-ime' ||
      input.inputLength !== publicReservedSourceHost.length || back.op !== 'keyEvent' || back.key !== 'Back' ||
      back.from !== 'reserved-query-edited' || keyboard.window.keyboard?.visible !== true ||
      !(baseline.sample.afterSeq <= status.beforeSeq && status.afterSeq <= input.beforeSeq &&
        input.afterSeq <= keyboard.beforeSeq && keyboard.afterSeq <= back.beforeSeq && back.afterSeq <= sample.beforeSeq)) {
    return missing('No same-window default-to-filtered Source opening with the exact status, query and IME Back');
  }
  if (narrow && (reveal?.instanceId !== sample.instanceId || reveal.op !== 'swipe' ||
      reveal.targetId !== regionIds.status || reveal.from !== assertion.baseline ||
      !(baseline.sample.afterSeq <= reveal.beforeSeq && reveal.afterSeq <= status.beforeSeq) ||
      !(reveal.filterLaneSwipe?.fromX > reveal.filterLaneSwipe?.toX))) {
    return missing('No verified leftward swipe in the current narrow Source status lane before clicking the unchecked filter');
  }
  const events = context.events.filter(event => event.channel === 'business' && event.instanceId === sample.instanceId &&
    event.eventSeq > status.beforeSeq && event.eventSeq <= sample.beforeSeq &&
    event.payload.owner?.mounting === state.owner.mounting && event.payload.owner?.generation === state.owner.generation);
  const statusProjection = events.find(event => event.kind === 'source.projection' && event.eventSeq <= status.afterSeq &&
    event.payload.status === 'unchecked' && event.payload.queryLength === 0 &&
    event.payload.readGeneration === state.readGeneration && event.payload.count === state.count);
  const edit = events.findLast(event => event.kind === 'source.projection' && event.eventSeq > input.beforeSeq &&
    event.eventSeq <= input.afterSeq && event.payload.trigger === 'edit' && reservedSourceProjection(event.payload) &&
    event.payload.filterRevision === state.filterRevision && event.payload.readGeneration === state.readGeneration &&
    event.payload.firstAnchor === state.firstAnchor);
  const toggle = events.findLast(event => event.kind === 'source.toggle' &&
    event.payload.anchor === state.firstAnchor && event.payload.filterRevision === state.filterRevision &&
    event.payload.readGeneration === state.readGeneration && event.eventSeq > (edit?.eventSeq ?? sample.beforeSeq));
  if (!statusProjection || !edit || toggle?.payload.phase !== 'ready' || typeof toggle.payload.enabled !== 'boolean') {
    return missing('The current Source owner did not observe the accepted query and identify the exact reserved row');
  }
  if (afterImeGlyphs && (!positiveInteger(keyboard.window.revision) || sample.window.revision <= keyboard.window.revision ||
      afterImeGlyphs.eventSeq <= back.beforeSeq)) {
    return missing('The reserved glyphs were not observed after the native IME Back on its next window revision');
  }
  const native = sample.nodes.filter(node => node.source === 'native-tree' && node.visible === true && node.opacity > 0);
  const rows = native.filter(node => node.id === rowId);
  const [row] = rows;
  const holders = row ? native.filter(node => node.id === reservedSourceToggle && containedBy(node,row)) : [];
  const [holder] = holders;
  const switches = afterImeGlyphs && row ? native.filter(node => node.type === 'Toggle' && containedBy(node,row)) :
    holder ? native.filter(node => node.type === 'Toggle' && (node === holder || containedBy(node,holder))) : [];
  const editors = native.filter(node => node.id === 'reader-source-editor' && node.type === 'TextInput');
  if (rows.length !== 1 || switches.length !== 1 || editors.length !== 1 ||
      (afterImeGlyphs ? switches[0].publicReservedSourceNativeToggle !== true : holders.length !== 1) ||
      typeof switches[0].sourceDefaultFontToggleChecked !== 'boolean' ||
      typeof editors[0].publicReservedSourceQueryMatches !== 'boolean') {
    return missing('No unique current native editor and reserved Toggle within the projected row');
  }
  if (toggle.payload.enabled || switches[0].sourceDefaultFontToggleChecked || !editors[0].publicReservedSourceQueryMatches) {
    return witness('FAIL','The reserved source is enabled or the native query does not match the fixed public hostname');
  }
  return {
    actual:{catalogCount:state.count,projected:state.projected,rowAnchor:state.firstAnchor,status:state.status,checked:false},
    evidenceRefs:[...baseline.evidenceRefs,...[...(reveal ? [reveal] : []),status,input,back,keyboard,statusProjection,edit,toggle]
      .flatMap(item => item.evidenceRefs ?? [])],
  };
}
