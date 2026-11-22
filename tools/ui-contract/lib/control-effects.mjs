import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, layoutTapPoint, selectLayoutNode } from './layout.mjs';
import { checkCapsuleLaunch, checkCapsulePause } from './control-capsule.mjs';
import { checkLaunchInterruption, checkCapsuleHandoff } from './control-capsule-handoff.mjs';
import { popupRenderPath } from './popup-render.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const finite = Number.isFinite;
const diagnostic = value => {
  if (value === undefined || typeof value === 'number' && !finite(value)) return null;
  if (Array.isArray(value)) return value.map(diagnostic);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, diagnostic(item)]));
  return value;
};
const near = (a, b, tolerance) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;
const position = actor => actor?.mounted && finite(actor.windowOriginVp?.x) && finite(actor.windowOriginVp?.y) ?
  [actor.windowOriginVp.x, actor.windowOriginVp.y] : null;
const supportedEffects = new Set(['directory-scroll', 'keyboard-back', 'more-popup', 'font-reorder',
  'capsule-launch', 'temporary-overlay', 'appearance-selector', 'search-results', 'directory-selection']);

function node(sample, id, options) {
  try {
    return sample && selectLayoutNode(sample, id, options);
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
}

function sameWindow(first, last) {
  return first?.instanceId && first.instanceId === last?.instanceId &&
    first.window?.id && first.window.id === last.window?.id;
}

function directoryList(sample, id) {
  const body = node(sample,id);
  const lists = body ? sample.nodes.filter(candidate => candidate.type === 'List' &&
    candidate.visible === true && ancestorsOf(sample,candidate).includes(body)) : [];
  return lists.length === 1 ? lists[0] : null;
}

function chapterRowUsability(row, list, window) {
  const flags = [row.visible,row.enabled,row.clickable];
  if (flags.includes(false) || (finite(row.opacity) && row.opacity <= 0) || row.hitTestMode === 'HitTestMode.None') return false;
  const boxes = [row.visibleRectPx,list.visibleRectPx,window.visibleRectPx];
  if (!flags.every(value => value === true) || !finite(row.opacity) ||
      !boxes.every(box => ['left','top','width','height'].every(field => finite(box?.[field])))) return null;
  const left = Math.max(...boxes.map(box => box.left));
  const right = Math.min(...boxes.map(box => box.left + box.width));
  const top = Math.max(...boxes.map(box => box.top));
  const bottom = Math.min(...boxes.map(box => box.top + box.height));
  return right > left && bottom > top;
}

function chapterSelectionCarrier(node, outer, item, list) {
  const treeTarget = node?.type === 'Text' && /^reader-control-directory-chapter:\d+$/u.test(node.id ?? '');
  return (node?.type === 'Row' || treeTarget) && outer?.type === 'Row' &&
    item?.type === 'ListItem' && list !== null && item.parentPath === list.path;
}

function checkDirectoryImeRows({before,after,expected,check}) {
  const complete = before.captureComplete === true && after.captureComplete === true;
  const [first,last] = complete ? [before,after].map(sample => directoryList(sample,expected.nativeId)) : [];
  const listKeys = [first?.key,last?.key];
  const retained = !complete ? null : !first || !last ? false :
    listKeys.every(key => typeof key === 'string') ? first.key === last.key : null;
  check('native-directory-ime-list-continuity',listKeys,
    'one visible native List retains its mount through the IME height change',retained);
  if (retained !== true) return;

  // The flat list binds selection on the inner Row. The Core-backed list
  // binds it on its Text. Bookmark and download buttons are separate.
  const byPath = new Map(after.nodes.map(candidate => [candidate.path,candidate]));
  const rows = after.nodes.filter(candidate => {
    const outer = byPath.get(candidate.parentPath);
    const item = byPath.get(outer?.parentPath);
    return chapterSelectionCarrier(candidate,outer,item,last);
  }).map(row => ({ key:row.key,usable:chapterRowUsability(row,last,after.window) }));
  check('native-directory-selectable-chapter-row',rows,
    'a visible enabled chapter-selection row has a tap region within the retained List and Reader window',
    rows.some(row => row.usable === true) ? true : rows.some(row => row.usable === null) ? null : false);
}

function checkDirectorySelection({before,after,expected,events,activity,check}, action, baseline) {
  const actionBound = action.from === baseline && action.targetId === expected.nativeId;
  check('directory-selection-action', [action.from,action.targetId], [baseline,expected.nativeId],actionBound);
  const list = directoryList(before,'reader-control-directory-body-directory');
  const module = node(before,'reader-control-module-directory');
  const row = node(before,expected.nativeId);
  const [outer,item,...ancestors] = row ? ancestorsOf(before,row) : [];
  const rowBound = before.captureComplete === true && before.window.source === 'window-metrics' &&
    before.window.keyboard?.visible === false ? chapterSelectionCarrier(row,outer,item,list) && module !== null &&
    ancestors.includes(list) && ancestors.includes(module) && chapterRowUsability(row,list,before.window) : null;
  const point = rowBound === true ? layoutTapPoint(row) : null;
  const regions = [list?.visibleRectPx,module?.visibleRectPx,before.window.visibleRectPx];
  const scoped = point && regions.every(region=>['left','top','width','height'].every(field=>finite(region?.[field]))) ?
    regions.every(region=>region.left <= point.x && point.x < region.left+region.width &&
      region.top <= point.y && point.y < region.top+region.height) : null;
  check('directory-native-chapter-row',row?.path,'actual selectable chapter carrier within the current Directory List',
    rowBound === true ? scoped : rowBound);

  const admitted = events.filter(event=>event.channel === 'business' && event.payload.phase === 'selection-admitted');
  const committed = events.filter(event=>event.channel === 'business' && event.payload.phase === 'selection-committed');
  const [entry] = admitted, [done] = committed;
  const opened = entry?.payload.facts, stored = done?.payload.facts;
  const selectionFields = ['fromChapterIndex','chapterIndex','selectionToken','openRevision','epoch'];
  const validEntry = opened && selectionFields.every(field=>Number.isSafeInteger(opened[field])) &&
    opened.fromChapterIndex === 0 && opened.fromChapterIndex !== opened.chapterIndex &&
    opened.chapterIndex === expected.chapterIndex && opened.selectionToken > 0 && opened.openRevision > 0 &&
    opened.epoch > 0 && entry.eventSeq <= action.afterSeq;
  check('directory-chapter-admitted',opened,'one fresh selection for the bound noncurrent chapter during the native click',
    admitted.length > 1 ? false : entry ? validEntry : null);
  check('directory-chapter-committed',stored,'one matching selection ticket, committed chapter, and start of the visible page',
    committed.length > 1 ? false : done && entry ? done.eventSeq > entry.eventSeq && Boolean(stored) &&
      selectionFields.every(field=>opened?.[field] === stored[field]) && stored.matchingChapter === true &&
      stored.chapterStart === true : null);

  const transitions = activity.filter(event=>event.channel === 'business');
  const dismissals = transitions.filter(event=>event.kind === 'reading.control-transition-requested');
  const finishes = transitions.filter(event=>event.kind === 'reading.control-transition-committed');
  const [dismissal] = dismissals, [finish] = finishes;
  const request = dismissal?.payload, end = finish?.payload;
  const location = request?.source;
  check('directory-dismissal-request',request,'one normal dismiss from the admitted Full Directory opening',
    dismissals.length > 1 ? false : request && opened ? request.direction === 'dismiss' &&
      request.origin === 'host-dismiss' && location?.level === 'secondary' && location.module === 'directory' &&
      location.form === 'full' && location.directoryTab === 'directory' && request.target?.level === 'hidden' &&
      request.before?.epoch === opened.epoch && request.before.openRevision === opened.openRevision &&
      request.accepted?.openRevision === opened.openRevision && Number.isSafeInteger(request.accepted.epoch) &&
      request.accepted.epoch > opened.epoch && typeof request.transitionId === 'string' &&
      dismissal.eventSeq <= action.afterSeq : null);
  check('directory-dismissal-commit',end,'the same dismiss transition commits Hidden',
    finishes.length > 1 ? false : end && request && opened ? end.transitionId === request.transitionId &&
      end.direction === 'dismiss' && end.origin === 'host-dismiss' && end.target?.level === 'hidden' &&
      end.state?.epoch === request.accepted?.epoch && end.state?.openRevision === opened.openRevision &&
      end.state?.level === 'hidden' && finish.eventSeq > dismissal.eventSeq : null);

  const stage = node(after,'reader-reading-stage');
  const {panels, released} = controlPanelRelease(after,'reader-control-module-directory');
  check('directory-reader-return',{stage:stage?.path,panels},
    'visible Reader stage with Directory released and IME hidden',
    after?.captureComplete === true && after.window?.keyboard?.visible === false ?
      (stage ? released : false) : null);
}

function controlPanelRelease(sample, nativeId) {
  const panels = (sample?.nodes ?? []).filter(candidate=>candidate.id === nativeId)
    .map(panel=>retainedControlPanelRelease(sample,panel));
  const released = panels.some(panel=>panel.released === false) ? false :
    panels.every(panel=>panel.released === true) ? true : null;
  return {panels,released};
}

function retainedControlPanelRelease(sample, panel) {
  const docks = ancestorsOf(sample,panel).filter(parent=>parent.id === 'reader-control-motion-dock');
  const dock = docks.length === 1 ? docks[0] : null;
  const readback = {path:panel.path,visible:panel.visible,opacity:panel.opacity,
    dock:dock && {path:dock.path,opacity:dock.opacity,enabled:dock.enabled,hitTestMode:dock.hitTestMode}};
  if (panel.visible === false) return {...readback,released:true};
  if (!dock) {
    const visible = panel.visible === true && finite(panel.opacity) && panel.opacity > 0;
    return {...readback,released:visible ? false : null};
  }
  // ArkUI reports local opacity for retained descendants. Match the Hidden
  // transition's endpoint tolerance on the actual dock and verify it cannot take input.
  const hidden = finite(dock.opacity) ? dock.opacity >= 0 && dock.opacity <= 0.02 : null;
  const inputDisabled = typeof dock.enabled === 'boolean' ? !dock.enabled : null;
  const hitTestDisabled = typeof dock.hitTestMode === 'string' ? dock.hitTestMode === 'HitTestMode.None' : null;
  const checks = [hidden,inputDisabled,hitTestDisabled];
  return {...readback,released:checks.includes(false) ? false : checks.every(value=>value === true) ? true : null};
}

function directoryRowOffsets(sample, list) {
  const density = sample?.window?.density;
  if (sample?.captureComplete !== true || !finite(list?.rectPx?.top) || !finite(density) || density <= 0) return new Map();
  const measured = new Map();
  const ambiguous = new Set();
  for (const candidate of sample.nodes) {
    if (candidate.type !== 'ListItem' || candidate.visible !== true || typeof candidate.key !== 'string' ||
        !finite(candidate.rectPx?.top) || !(candidate.visibleRectPx?.width > 0 && candidate.visibleRectPx?.height > 0) ||
        ancestorsOf(sample,candidate).find(parent => parent.type === 'List') !== list) continue;
    if (measured.has(candidate.key)) ambiguous.add(candidate.key);
    measured.set(candidate.key,(candidate.rectPx.top - list.rectPx.top) / density);
  }
  for (const key of ambiguous) measured.delete(key);
  return measured;
}

function checkDirectoryMovement(before, after, lists, offsetVp, expected, check) {
  const [first, last] = lists;
  const sameList = typeof first?.key === 'string' && first.key === last?.key;
  const sameDensity = finite(before?.window?.density) && before.window.density === after?.window?.density;
  const density = before?.window?.density;
  const boxes = lists.map(list => list?.rectPx ?? null);
  const dimensions = ['left','top','width','height'];
  const viewportKnown = sameList && sameDensity && density > 0 &&
    before.captureComplete === true && after.captureComplete === true &&
    boxes.every(box => dimensions.every(key => finite(box?.[key])) && box.width > 0 && box.height > 0);
  const stableViewport = viewportKnown && dimensions.every(key =>
    near((boxes[0][key] - boxes[1][key]) / density,0,expected.layoutToleranceVp));
  check('native-directory-scroll-viewport',boxes,'the same List viewport remains stable during the normal swipe',
    viewportKnown ? stableViewport : null);
  const prior = stableViewport ? directoryRowOffsets(before,first) : new Map();
  const next = stableViewport ? directoryRowOffsets(after,last) : new Map();
  const comparisons = [...prior].filter(([key]) => next.has(key)).map(([key,y]) =>
    ({key,beforeRelativeYVp:y,afterRelativeYVp:next.get(key),movedVp:y - next.get(key)}));
  check('native-directory-row-displacement',comparisons,{offsetVp,toleranceVp:expected.layoutToleranceVp},
    comparisons.length && finite(offsetVp) ?
      comparisons.every(({movedVp}) => movedVp > 0 && near(movedVp,offsetVp,expected.layoutToleranceVp)) : null);
}

function checkScroll({ before, after, expected, events, check }, action, baseline) {
  const from = { sample:action.from, target:action.targetId };
  check('directory-swipe-target', from, { sample:baseline, target:expected.nativeId },
    typeof from.sample === 'string' && typeof from.target === 'string' ?
      from.sample === baseline && from.target === expected.nativeId : null);

  // The body Stack can retain its accessibility key while the List is rebuilt.
  const lists = [before, after].map(sample => directoryList(sample,expected.nativeId));
  const listKeys = lists.map(list => list?.key ?? null);
  check('directory-list-mount', listKeys, 'one visible native List with the same accessibility key',
    listKeys.every(key => typeof key === 'string') ? listKeys[0] === listKeys[1] : null);

  const trace = events.filter(event => event.channel === 'business' && event.eventSeq <= action.afterSeq);
  const starts = trace.filter(event => event.payload.phase === 'started');
  const stops = trace.filter(event => event.payload.phase === 'settled');
  const [start] = starts;
  const [stop] = stops;
  const ordered = starts.length === 1 && stops.length === 1 && start.eventSeq < stop.eventSeq;
  check('directory-scroll-sequence', trace.map(event => ({ phase:event.payload.phase, seq:event.eventSeq })),
    'one started event followed by one settled event in the swipe action',
    starts.length > 1 || stops.length > 1 ? false : start && stop ? ordered : null);
  if (!ordered) return;

  const started = start.payload.facts;
  const settled = stop.payload.facts;
  const presentations = [started?.presentation, settled?.presentation];
  const samePresentation = presentations.every(value => Number.isSafeInteger(value) && value > 0) &&
    presentations[0] === presentations[1] && started?.tab === expected.tab && settled?.tab === expected.tab;
  check('directory-scroll-presentation', { presentations, tabs:[started?.tab, settled?.tab] }, expected.tab,
    samePresentation ? true : null);
  if (!samePresentation) return;

  const offsets = [started?.offsetVp, settled?.beforeOffsetVp, settled?.offsetVp];
  check('native-vertical-offset', offsets, { minimumIncreaseVp: expected.minimumIncreaseVp },
    offsets.every(finite) ? near(offsets[0], offsets[1], expected.layoutToleranceVp) &&
      offsets[2] - offsets[0] >= expected.minimumIncreaseVp : null);
  if (expected.requireNativeRowDisplacement) {
    checkDirectoryMovement(before,after,lists,offsets.every(finite) ? offsets[2] - offsets[0] : null,expected,check);
  }
}

function checkModalEditorKeyboard({ before, after, expected, activity, earlier, check }) {
  const { field, overlay, owner } = expected.modalEditor;
  const scopedField = { id:field, ancestors:[overlay] };
  const first = node(before,scopedField);
  const last = node(after,scopedField);
  const firstOverlay = node(before,overlay);
  const lastOverlay = node(after,overlay);
  const sameMount = (initial, final) => typeof initial?.key === 'string' && typeof final?.key === 'string' ?
    initial.key === final.key : null;
  const fieldRetained = sameMount(first,last);
  const overlayRetained = sameMount(firstOverlay,lastOverlay);
  check('modal-editor-mount', { before:first?.key, after:last?.key, focused:first?.focused,
    overlayBefore:firstOverlay?.key, overlayAfter:lastOverlay?.key },
  'focused input and the same native modal and field after keyboard Back',
  fieldRetained === null || overlayRetained === null ? null :
    fieldRetained && overlayRetained && first.focused === true && first.enabled === true && last.enabled === true);
  const ownsModal = event => event.channel === 'business' && event.kind === 'reading.control-layer' &&
    event.payload.origin === owner && event.payload.inputKind === 'modal';
  const openings = earlier.filter(event => ownsModal(event) && event.payload.active === true);
  const admission = openings.length === 1 ? openings[0].payload : undefined;
  const replacements = activity.filter(ownsModal);
  const consumers = activity.filter(event => event.channel === 'business' && event.kind === 'reading.control-back-consumer');
  check('modal-editor-kept-open', { admission, ownerChanges:replacements.map(event => event.eventSeq),
    explicitConsumers:consumers.map(event => event.payload.consumer) },
  'one existing Full modal generation, no modal request or dismissal, only keyboard consumption if reported',
  openings.length > 1 || replacements.length > 0 ? false : admission ?
    admission.location?.module === owner && admission.location?.form === 'full' && Number.isSafeInteger(admission.epoch) &&
      Number.isSafeInteger(admission.generation) && consumers.length <= 1 &&
      consumers.every(event => event.payload.consumer === 'keyboard' && event.payload.epoch === admission.epoch) : null);
}

const searchEditorField = 'reader-control-search-field';

function nativeSearchEditor(sample, moduleId) {
  if (sample.captureComplete !== true) return null;
  const body = node(sample,moduleId);
  const field = node(sample,{id:searchEditorField,ancestors:[moduleId]});
  const inputs = sample.nodes.filter(item => item.type === 'TextInput' && item.visible === true &&
    /^reader-content-search-input-[1-9]\d*$/u.test(item.id ?? '') && ancestorsOf(sample,item).includes(field));
  return {body,field,input:inputs.length === 1 ? inputs[0] : null,inputCount:inputs.length};
}

function checkSearchEditorKeyboard({before,after,expected,activity,check}, {action,baseline,focus,prior}) {
  const commandsKnown = typeof action.from === 'string' && typeof action.key === 'string' && typeof focus?.targetId === 'string' &&
    typeof focus.op === 'string' && finite(focus.beforeSeq) && finite(focus.afterSeq);
  check('search-editor-dispatch',{backFrom:action.from,key:action.key,focusTarget:focus?.targetId},
    'normal focus click on the Search field, then system Back from its IME sample',
    commandsKnown ? action.from === baseline && action.key === 'Back' && focus.targetId === searchEditorField &&
      focus.op === 'click' && focus.instanceId === action.instanceId && focus.beforeSeq < focus.afterSeq &&
      focus.afterSeq <= before.beforeSeq : null);

  const first = nativeSearchEditor(before,expected.nativeId);
  const last = nativeSearchEditor(after,expected.nativeId);
  const measured = [first,last].map(sample => sample && ({moduleKey:sample.body?.key ?? null,
    field:sample.field?.path, id:sample.input?.id, key:sample.input?.key, count:sample.inputCount,
    focused:sample.input?.focused, enabled:sample.input?.enabled}));
  const mounted = first && last && [first,last].every(sample => sample.body && sample.field && sample.input);
  const known = mounted && measured.every(sample => typeof sample.moduleKey === 'string' && typeof sample.key === 'string' &&
    typeof sample.enabled === 'boolean') && typeof first.input.focused === 'boolean';
  check('search-inline-editor-continuity',measured,'the same enabled native Search body and TextInput, focused before Back',
    !first || !last ? null : !mounted ? false : known ? measured[0].moduleKey === measured[1].moduleKey &&
      measured[0].id === measured[1].id && measured[0].key === measured[1].key &&
      measured[0].focused === true && measured.every(sample => sample.enabled) : null);

  const inline = event => event.kind === 'reading.control-layer' && event.channel === 'business' &&
    event.payload.origin === 'search' && event.payload.inputKind === 'inlineEditor';
  const admitted = prior.filter(inline).map(event => event.payload);
  const updates = activity.filter(inline).map(event => event.payload);
  const consumers = activity.filter(event => event.channel === 'business' && event.kind === 'reading.control-back-consumer')
    .map(event => event.payload);
  const [admission] = admitted;
  const [consumer] = consumers;
  const [release] = updates;
  const keyboardBefore = before.window?.keyboard?.visible;
  const keyboardAfter = after.window?.keyboard?.visible;
  const systemKeyboardBack = keyboardBefore === true && keyboardAfter === false &&
    first?.input?.focused === true && last?.input?.focused === false;
  const fullSearch = fact => fact?.location && ['level','module','form'].every(key => typeof fact.location[key] === 'string') ?
    fact.location.level === 'secondary' && fact.location.module === 'search' && fact.location.form === 'full' : null;
  const sameOwner = fact => Number.isSafeInteger(fact?.epoch) && Number.isSafeInteger(admission?.epoch) && fullSearch(fact) !== null ?
    fact.epoch === admission.epoch && fullSearch(fact) : null;
  let verdict = null;
  if (admitted.length > 1 || consumers.length > 1 || updates.length > 1 || admission?.active === false ||
      release?.active === true || fullSearch(admission) === false || sameOwner(consumer) === false || sameOwner(release) === false) {
    verdict = false;
  } else if (admission?.active === true && fullSearch(admission) === true && Number.isSafeInteger(admission.generation) &&
      ((consumer?.consumer === 'keyboard' && sameOwner(consumer) === true) ||
        (consumer === undefined && systemKeyboardBack))) {
    if (release?.active === false && sameOwner(release) === true && Number.isSafeInteger(release.generation)) {
      verdict = release.generation === admission.generation;
    } else if (!release && last?.input?.focused === true) verdict = true;
  }
  check('search-inline-editor-owner',{admitted,updates,consumers,focusAfter:last?.input?.focused,keyboardBefore,keyboardAfter,systemKeyboardBack},
    'one Full Search editor admission, matching keyboard Back, and retained focus or same-generation release',verdict);
}

const quickSearchList = 'reader-control-search-results';
const quickSearchFirstResult = 'reader-control-search-first-result';
const quickSearchSubmit = 'reader-control-search-submit';
const resultIdentity = /^reader-control-search-result:([1-9]\d*):(0|[1-9]\d*)$/u;

function quickSearchNative(sample, moduleId) {
  const view = sample && nativeSearchEditor(sample,moduleId);
  if (!view) return null;
  const list = node(sample,{id:quickSearchList,ancestors:[moduleId]},{visibleOnly:false});
  const rows = list?.type === 'List' ? sample.nodes.flatMap(item => {
    const identity = resultIdentity.exec(item.id ?? '');
    if (!identity || !ancestorsOf(sample,item).includes(list)) return [];
    return [{item,scope:Number(identity[1]),ordinal:Number(identity[2])}];
  }) : [];
  return {...view,list,rows};
}

function retainedSearchMount(first, last, field) {
  if (!first || !last) return null;
  const a = first[field], b = last[field];
  if (!a || !b) return false;
  return [a.key,b.key].every(key => typeof key === 'string') ? a.key === b.key && a.id === b.id : null;
}

function quickSearchRowHit(item, list, window) {
  if (list.visible === false || (finite(list.opacity) && list.opacity <= 0)) return false;
  if (list.visible !== true || !finite(list.opacity)) return null;
  const usable = chapterRowUsability(item,list,window);
  if (usable !== true) return usable;
  const {x,y} = layoutTapPoint(item);
  return [list.visibleRectPx,window.visibleRectPx].every(rect =>
    x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height);
}

function quickSearchAction(action, before, after, instanceId) {
  if (!action || !before || !after || ![before.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(Number.isSafeInteger))
    return null;
  return action.instanceId === instanceId && sameWindow(before,after) && before.instanceId === instanceId &&
    before.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq;
}

function checkQuickSearchResults(assertion, context, check, refs) {
  const {expected} = assertion;
  const click = context.actions[assertion.action];
  const submit = context.actions[expected.submitAction];
  const refocus = context.actions['refocus-with-results'];
  const back = context.actions[expected.backAction];
  const ready = context.samples['results-ready'];
  const ime = context.samples[back?.from];
  const retained = context.samples[assertion.baseline];
  const selected = context.samples[assertion.sample];
  const query = context.samples[submit?.from];
  const enter = context.actions['enter-reading'];
  const remember = values => {
    for (const value of values) for (const ref of value?.evidenceRefs ?? []) refs.set(ref.path,ref);
  };
  remember([enter,submit,refocus,back,click,query,ready,ime,retained,selected]);
  const reading = context.events?.filter(event => enter && event.instanceId === enter.instanceId &&
    event.kind === 'reading.ready' && event.channel === 'business' && event.payload.localBook === true &&
    event.eventSeq > enter.beforeSeq && event.eventSeq <= enter.afterSeq) ?? [];
  const readingId = reading.length === 1 && reading[0].payload.readingId;
  check('quick-search-reading-owner',readingId,'one normal public local reading opening',readingId ? true : null);
  if (!readingId) return;
  const instanceId = enter.instanceId;
  const activity = context.events.filter(event => event.instanceId === instanceId && event.channel === 'business' &&
    event.payload?.readingId === readingId);
  const interval = (action, end = action?.afterSeq) => activity.filter(event => action?.instanceId === instanceId &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= end);
  const effect = (events, phase) => events.filter(event => event.kind === 'reading.control-effect' &&
    event.payload.kind === 'search-results' && event.payload.phase === phase);
  const publicFacts = facts => facts && ({scope:facts.scope,form:['quick','full'].includes(facts.form) ? facts.form : null,
    epoch:facts.epoch,rowCount:facts.rowCount,ordinal:facts.ordinal,matchingChapter:facts.matchingChapter,containsTarget:facts.containsTarget});

  const submitBound = quickSearchAction(submit,query,ready,instanceId);
  const submitButton = query?.captureComplete === true ? node(query,{id:quickSearchSubmit,ancestors:[expected.nativeId]}) : null;
  check('quick-search-native-submit',submit?.targetId,'real Search Button in the current Query sample',submitBound === true ?
    submit.op === 'click' && submit.targetId === quickSearchSubmit ?
      submitButton?.type ? submitButton.type === 'Button' : null : false : submitBound);
  const publications = effect(interval(submit),'published');
  const published = publications[0]?.payload.facts;
  const wellFormedOwner = facts => typeof facts?.form === 'string' && Number.isSafeInteger(facts.scope) && Number.isSafeInteger(facts.epoch);
  const ownerKnown = wellFormedOwner(published);
  const ownerMatches = facts => ownerKnown && wellFormedOwner(facts) ?
    facts.form === 'quick' && facts.scope === published.scope && facts.epoch === published.epoch : null;
  const publicationMatches = facts => ownerMatches(facts) === true && Number.isSafeInteger(facts.rowCount) ? facts.rowCount === 1 :
    ownerMatches(facts) === false ? false : null;
  check('quick-search-publication',publicFacts(published),'one current successful Quick Search publication containing the unique fixture row',
    publications.length > 1 ? false : ownerKnown ? (published.scope > 0 && published.epoch >= 0 ? publicationMatches(published) : false) : null);

  const refocusBound = quickSearchAction(refocus,ready,ime,instanceId);
  check('quick-search-refocus',refocus?.targetId,'refocus the real Search field after results publish',refocusBound === true ?
    refocus.op === 'click' && refocus.targetId === searchEditorField && refocus.from === 'results-ready' : refocusBound);
  const backBound = quickSearchAction(back,ime,retained,instanceId);
  check('quick-search-system-back',back?.key,'ordered native system Back from the keyboard-visible results',backBound === true ?
    back.op === 'keyEvent' && back.key === 'Back' : backBound);
  const keyboard = [ime,retained].map(sample => sample?.captureComplete === true && sample.window?.source === 'window-metrics' ?
    sample.window.keyboard?.visible : undefined);
  check('quick-search-keyboard',keyboard,[true,false],keyboard.every(value => typeof value === 'boolean') ? keyboard[0] && !keyboard[1] : null);

  const [beforeIme,withIme,afterIme] = [ready,ime,retained].map(sample => quickSearchNative(sample,expected.nativeId));
  const nativePair = field => [retainedSearchMount(beforeIme,afterIme,field),
    field === 'list' && withIme && !withIme.list ? true : retainedSearchMount(withIme,afterIme,field)];
  for (const field of ['body','input','list']) {
    const continuity = nativePair(field);
    check(`quick-search-${field}-continuity`,continuity,'retain the same native Search module, TextInput and result List',
      continuity.includes(false) ? false : continuity.every(value => value === true) ? true : null);
  }
  const focus = withIme?.input?.focused;
  check('quick-search-ime-editor-focus',focus,true,typeof focus === 'boolean' ? focus : null);
  const editorEnabled = [beforeIme,withIme,afterIme].map(view => view?.input?.enabled);
  check('quick-search-editor-enabled',editorEnabled,'the current native editor remains enabled',editorEnabled.includes(false) ?
    false : editorEnabled.every(value => value === true) ? true : null);
  const terminalList = afterIme?.list;
  const listTypes = [beforeIme?.list,withIme?.list,terminalList].filter(Boolean).map(list => list.type);
  check('quick-search-native-list-type',listTypes,'real native List under the retained Search module',
    listTypes.some(type => type && type !== 'List') ? false : listTypes.length && listTypes.every(type => type === 'List') ? true : null);
  const nativeRows = [beforeIme,withIme,afterIme].flatMap(view => view?.rows ?? []);
  const unexpectedRows = nativeRows.filter(({item,scope,ordinal}) => item.type === 'Button' && item.visible === true &&
    item.opacity !== 0 && ownerKnown && (scope !== published.scope || ordinal !== 0));
  check('quick-search-native-result-scope',unexpectedRows.map(({scope,ordinal}) => ({scope,ordinal})),
    'no visible native result outside the unique published scope and ordinal',unexpectedRows.length === 0);
  const scopedFirst = view => {
    if (!view || !ownerKnown) return null;
    const candidates = view.rows.filter(({scope,ordinal}) => scope === published.scope && ordinal === 0);
    return candidates.some(({item}) => !item.type) ? null : candidates.filter(({item}) => item.type === 'Button');
  };
  const firstPublished = scopedFirst(beforeIme);
  check('quick-search-first-published-row',firstPublished?.length,1,firstPublished ? firstPublished.length === 1 : null);
  const firstRetained = scopedFirst(afterIme);
  const result = firstRetained?.[0]?.item;
  const hit = result && quickSearchRowHit(result,terminalList,retained.window);
  const usable = firstRetained ? firstRetained.length !== 1 || hit === false ? false :
    result.alias === quickSearchFirstResult ? hit : null : null;
  check('quick-search-retained-first-button',result?.id,'one correctly scoped native Button with a safe hit in the retained List',usable);

  const throughBack = interval(back,retained?.beforeSeq);
  const transitions = interval(refocus ?? back,retained?.beforeSeq).filter(event => event.kind === 'reading.control-transition-requested');
  const consumers = throughBack.filter(event => event.kind === 'reading.control-back-consumer');
  const consumer = consumers[0]?.payload;
  const consumerMatches = consumer?.consumer && consumer.consumer !== 'keyboard' ? false :
    consumer?.consumer === 'keyboard' && typeof consumer.location?.module === 'string' &&
      typeof consumer.location.form === 'string' && typeof consumer.location.level === 'string' ?
      consumer.location.module === 'search' && consumer.location.form === 'quick' && consumer.location.level === 'secondary' : null;
  check('quick-search-back-consumer',consumer?.consumer ?? null,'OS-first IME Back or one same-epoch Quick Search keyboard consumer',
    transitions.length || consumers.length > 1 || consumerMatches === false ? false :
      consumer ? consumerMatches === true && ownerKnown && Number.isSafeInteger(consumer.epoch) ?
        consumer.epoch === published.epoch : null : backBound);
  const laterPublications = effect(interval(submit,retained?.beforeSeq),'published').slice(publications.length);
  const laterOwners = laterPublications.map(item => publicationMatches(item.payload.facts));
  check('quick-search-retained-publication',laterPublications.map(item => item.payload.facts?.scope),'no successor publication through Back',
    laterOwners.includes(false) ? false : laterOwners.every(value => value === true) ? true : null);

  const clickBound = quickSearchAction(click,retained,selected,instanceId);
  const clickKnown = click?.instanceId === instanceId && retained?.instanceId === instanceId &&
    [retained?.afterSeq,click?.beforeSeq,click?.afterSeq].every(Number.isSafeInteger) &&
    retained.afterSeq <= click.beforeSeq && click.beforeSeq < click.afterSeq;
  check('quick-search-native-selection',click?.targetId,'normal click of the actual retained native result Button',clickKnown ?
    click.op === expected.op && click.from === assertion.baseline && click.targetId === quickSearchFirstResult && (clickBound ?? true) : null);
  const admissions = clickKnown ? effect(interval(click,selected?.beforeSeq),'selection-admitted') : [];
  const commits = clickKnown ? effect(interval(click,selected?.beforeSeq),'selection-committed') : [];
  const admitted = admissions[0]?.payload.facts;
  const committed = commits[0]?.payload.facts;
  const resultMatches = facts => ownerMatches(facts) === true && Number.isSafeInteger(facts.ordinal) ? facts.ordinal === 0 :
    ownerMatches(facts) === false ? false : null;
  check('quick-search-selection-admission',publicFacts(admitted),'exactly one actual click admission for the current first result',
    admissions.length > 1 ? false : admissions[0]?.eventSeq <= click?.afterSeq ? resultMatches(admitted) : null);
  check('quick-search-selection-position',publicFacts(committed),'the same actual result commits its matching chapter and target position',
    commits.length > 1 || committed?.matchingChapter === false || committed?.containsTarget === false ? false :
      admitted && committed && Number.isSafeInteger(commits[0].eventSeq) && commits[0].eventSeq > admissions[0].eventSeq &&
      typeof committed.matchingChapter === 'boolean' && typeof committed.containsTarget === 'boolean' ? resultMatches(committed) : null);
  const stage = node(selected,'reader-reading-stage');
  const {panels,released} = controlPanelRelease(selected,expected.nativeId);
  const selectedKeyboard = selected?.window?.source === 'window-metrics' ? selected.window.keyboard?.visible : undefined;
  let returned = null;
  if (selected?.captureComplete === true && clickBound === true) {
    if (!stage || selectedKeyboard === true || released === false) returned = false;
    else if (selectedKeyboard === false) returned = released;
  }
  check('quick-search-reader-return',{stage:stage?.path,panels,keyboardVisible:selectedKeyboard},
    'the normal Reader stage with the Search surface released',returned);
  remember([...reading,...publications,...transitions,...consumers,...laterPublications,...admissions,...commits]);
}

function checkKeyboard({ before, after, expected, activity, earlier, check }) {
  const kbBefore = before?.window?.keyboard;
  const kbAfter = after?.window?.keyboard;
  const expectedRoot = expected.nativeId;
  const sameModule = node(before, expectedRoot) && node(after, expectedRoot);
  const consumers = activity.filter(event => event.kind === 'reading.control-back-consumer');
  const transitions = activity.filter(event => event.kind === 'reading.control-transition-requested');
  const sequence = consumers.map(event => ({ seq:event.eventSeq, consumer:event.payload.consumer }));
  const systemImeConsumed = consumers.length === 0 && kbBefore?.visible === true && kbAfter?.visible === false;
  check('same-module-after-back', sameModule ? expectedRoot : null, expectedRoot, sameModule ? true : null);
  check('keyboard-visibility', [kbBefore?.visible, kbAfter?.visible], [true,false],
    [kbBefore?.visible,kbAfter?.visible].every(visible => typeof visible === 'boolean') ?
      kbBefore.visible === true && kbAfter.visible === false : null);
  check('panel-request', transitions.map(event => event.eventSeq), [], transitions.length === 0);
  if (expected.consumer) {
    check('back-consumer', sequence, expected.consumer,
      consumers.length ? consumers.length === 1 && consumers[0].payload.consumer === expected.consumer :
        expected.consumer === 'keyboard' && kbBefore?.visible === true && kbAfter?.visible === false ? true : null);
  }
  if (expected.modalEditor) checkModalEditorKeyboard({before,after,expected,activity,earlier,check});
  if (expected.editorId) {
    const editorBefore = node(before, {id:expected.editorId, ancestors:[expectedRoot]});
    const editorAfter = node(after, {id:expected.editorId, ancestors:[expectedRoot]});
    const mount = [editorBefore?.key, editorAfter?.key];
    check('native-editor-continuity', { focused:editorBefore?.focused, mount },
      'focused editor and the same native TextInput mount', mount.every(key => typeof key === 'string') ?
        editorBefore.focused === true && mount[0] === mount[1] : null);
    // Directory query input is enabled only at progress 1. The collapse
    // action is disabled while the inline editor owns input, even in Full.
    const editorEnabled = [editorBefore?.enabled, editorAfter?.enabled];
    check('same-full-form', editorEnabled, [true,true],
      editorEnabled.every(value => typeof value === 'boolean') ? editorEnabled.every(Boolean) : null);
    const directoryLayer = event => event.channel === 'business' && event.kind === 'reading.control-layer' &&
      event.payload.origin === expected.module && event.payload.inputKind === 'inlineEditor';
    const layer = earlier.filter(directoryLayer).at(-1)?.payload;
    const matchesLayer = owner => layer && owner && Number.isSafeInteger(layer.epoch) && Number.isSafeInteger(owner.epoch) ?
      layer.active === true && layer.epoch === owner.epoch &&
        (owner.generation === undefined || Number.isSafeInteger(owner.generation) &&
          owner.generation === layer.generation) &&
        owner.location?.module === expected.module && owner.location.directoryTab === expected.tab && owner.location.form === 'full' &&
        ['module','directoryTab','form'].every(field => owner.location[field] === layer.location?.[field]) : null;
    const releases = activity.filter(event => directoryLayer(event) && event.payload.active === false);
    const released = releases.length === 1 ? releases[0].payload : undefined;
    const linked = matchesLayer(released);
    if (expected.softImeHide === true) {
      check('native-soft-ime-hide-key', before?.imeHideKey, 'measured unique KeyHideKbd in the separate IME window',
        before?.imeHideKey?.keyId === 'KeyHideKbd' ? true : null);
      const focusAfter = editorAfter?.focused;
      const retained = releases.length === 0 && focusAfter === true ? matchesLayer(layer) : null;
      const retired = linked !== null && Number.isSafeInteger(released?.generation) ?
        linked && released.generation === layer.generation && focusAfter === false : null;
      check('directory-soft-hide-editor-state', {admission:layer, release:released, focusAfter},
        'same Full Directory editor retained focused, or released in the same generation',
        releases.length > 1 ? false : releases.length === 1 ? retired : retained);
    } else if (expected.editorLayerRelease === true) {
      check('directory-editor-layer-release', { admission:layer, release:released, hostConsumers:sequence },
        { module:expected.module, tab:expected.tab, form:'full', sameEpoch:true, sameGeneration:true },
        releases.length > 1 ? false : linked === null || !Number.isSafeInteger(released?.generation) ? null :
          linked && released.generation === layer.generation && consumers.length <= 1 &&
          consumers.every(event => ['keyboard','temporary-layer'].includes(event.payload.consumer)));
      check('editor-focus-released', editorAfter?.focused, false,
        typeof editorAfter?.focused === 'boolean' ? editorAfter.focused === false : null);
    } else {
      const owner = consumers[0]?.payload;
      const releasedOwner = !owner && systemImeConsumed && editorBefore.focused === true && editorAfter.focused === false &&
        releases.length === 1 ? {
          consumer:'native-ime',
          epoch:released.epoch,
          generation:released.generation,
          location:released.location,
        } : undefined;
      const effectiveOwner = owner ?? releasedOwner;
      check('directory-inline-editor-owner', { admission:layer, Back:effectiveOwner },
        { module:expected.module, tab:expected.tab, form:'full', sameEpoch:true }, matchesLayer(effectiveOwner));
    }
  }
  if (expected.requireSelectableDirectoryRow) checkDirectoryImeRows({before,after,expected,check});
}

function popupOwnerFromScroll(frame, nativeId) {
  const { popupOwner:owner, menu } = frame;
  return owner?.status === 'measured' && owner.type === 'Popup' && owner.relation === 'scroll-ancestor' &&
    Number.isSafeInteger(owner.uniqueId) && owner.uniqueId > 0 && menu?.id === nativeId && menu.mounted === true &&
    owner.scrollUniqueId === menu.uniqueId && menu.ancestors?.some(item => item.uniqueId === owner.uniqueId);
}

function checkPopupOwnerPath({ detected, earlier, expected, generation, check, renderOpen, renderClose, trigger, openState }) {
  const opening = expected.visible ? detected : earlier.find(event => event.channel === 'motion' &&
    event.payload.phase === 'trace' && event.payload.facts?.visible === true &&
    event.payload.facts.generation === generation)?.payload.facts.frames ?? [];
  const openIds = [...new Set(opening.filter(frame => popupOwnerFromScroll(frame,expected.nativeId))
    .map(frame => frame.popupOwner.uniqueId))];
  const [ownerId] = openIds;
  const observedOwner = frame => popupOwnerFromScroll(frame,expected.nativeId) ||
    (!expected.visible && frame.popupOwner?.relation === 'known-host' && frame.menu?.mounted === false);
  const point = value => finite(value?.x) && finite(value?.y);
  const eligible = frame => {
    const host = frame.popupOwner;
    return observedOwner(frame) && host.status === 'measured' && host.type === expected.nativeOwnerType &&
      host.uniqueId === ownerId && finite(frame.frameTimeNs) && finite(host.opacity) && host.opacity >= 0 &&
      host.opacity <= 1 && point(host.windowOriginVp) && point(host.parentOriginVp) &&
      finite(host.widthVp) && host.widthVp > 0 && finite(host.heightVp) && host.heightVp > 0 &&
      typeof host.clipToFrame === 'boolean' && Number.isSafeInteger(host.zIndex);
  };
  const frames = openIds.length === 1 ? detected.filter(eligible) : [];
  const first = detected.indexOf(frames[0]);
  const last = detected.indexOf(frames.at(-1));
  const missingBetween = frames.length ? last - first + 1 - frames.length : null;
  const differentOwner = detected.some(frame => observedOwner(frame) && frame.popupOwner.status === 'measured' &&
    frame.popupOwner.uniqueId !== ownerId);
  const gaps = detected.slice(1).map((frame, index) => (frame.frameTimeNs - detected[index].frameTimeNs) / 1e6);
  const sorted = gaps.filter(gap => finite(gap) && gap > 0).sort((a,b) => a - b);
  const cadence = sorted[Math.floor(sorted.length / 2)];
  const maximumGapMs = cadence * expected.cadenceGapFactor;
  const pathGaps = frames.length >= 3 ? gaps.slice(first,last) : [];
  const continuous = frames.length >= 3 && !differentOwner && missingBetween === 0 && sorted.length >= 3 &&
    pathGaps.every(gap => finite(gap) && gap > 0 && gap <= maximumGapMs);
  // The ArkUI trace still has to identify the native Popup ancestor and its
  // geometry. RenderService supplies only the independently presented alpha.
  const compositor = openIds.length === 1 && !differentOwner && opening.some(eligible) ?
    popupRenderPath(renderOpen,renderClose,expected,trigger) : null;
  let compositorBound = null;
  if (compositor) {
    const [menu] = visiblePopupNodes(openState,expected.nativeId);
    const nativeRect = menu?.rectPx;
    const pixelTolerance = openState.window?.density * expected.layoutToleranceVp;
    const edges = ['left','top','width','height'].map(key => nativeRect?.[key]);
    compositorBound = finite(pixelTolerance) && pixelTolerance > 0 && compositor.menuRect?.every(finite) &&
      edges.every(finite) ? compositor.menuRect.every((value,index) => near(value,edges[index],pixelTolerance)) : null;
    check('popup-compositor-binding', { menuRect:compositor.menuRect, nativeRect:edges, reason:compositor.reason },
      'the attached RenderService menu matches the stable native menu in the current window', compositorBound);
  }
  check('popup-frame-coverage', { ownerId, measuredSamples:frames.length, missingBetween, differentOwner,
    cadenceMs:cadence, maximumGapMs, largestPathGapMs:pathGaps.length ? Math.max(...pathGaps) : null,
    ...(compositor ? {compositor} : {}) },
  'contiguous samples of one Popup host across the measured motion interval',
  continuous || compositorBound === true && compositor.coverage === true ? true : null);

  const opacity = frames.map(frame => frame.popupOwner.opacity);
  const tolerance = expected.opacityTolerance;
  const intermediate = opacity.slice(1,-1).some(value => value > tolerance && value < 1 - tolerance);
  const trend = expected.visible ? 1 : -1;
  const changes = opacity.slice(1).map((value,i) => trend * (value - opacity[i]));
  const ordered = changes.every(change => change >= -tolerance);
  const moved = Math.max(...opacity) - Math.min(...opacity) > tolerance;
  const traveled = trend * (opacity.at(-1) - opacity[0]) > tolerance;
  const renderEndpoint = !expected.visible || opacity.at(-1) >= 1 - tolerance;
  const inspectorVerdict = continuous && intermediate && moved && renderEndpoint ? ordered && traveled : null;
  check('popup-native-path', { ownerIds:openIds, measuredSamples:frames.length, opacity,
    availableStates:[...new Set(detected.map(frame => frame.popupOwner?.status ?? 'not-recorded'))],
    ...(compositor ? {compositor} : {}) },
  'same native Popup host with measured geometry, clip, z-index and changing intermediate opacity',
  inspectorVerdict ?? (compositorBound === true ? compositor.path : null));
}

function visiblePopupNodes(sample, id) {
  return sample.nodes.filter(item => item.id === id && item.visible === true);
}

function popupTreeBox(sample, node) {
  const {density,rectPx:window} = sample.window;
  const rect = node?.rectPx;
  if (!finite(density) || density <= 0 || !finite(window?.left) || !finite(window?.top) ||
      !['left','top','width','height'].every(field => finite(rect?.[field]))) return null;
  return [(rect.left - window.left) / density,(rect.top - window.top) / density,rect.width / density,rect.height / density];
}

function checkStablePopup({before,after,expected,earlier,check,action,baseline,earlierAction}, trace) {
  const opening = expected.visible ? trace : earlier.find(event => event.channel === 'motion' &&
    event.payload.phase === 'trace' && event.payload.facts?.visible === true)?.payload.facts;
  const trigger = expected.visible ? action.targetId : earlierAction?.targetId;
  const openingTrigger = opening?.frames?.[0]?.trigger;
  const dispatched = {actionFrom:action.from,target:trigger,key:action.key,opening:opening?.layout,closing:trace?.layout};
  check('popup-stable-trigger-dispatch',dispatched,'the selected native More trigger and the same popup Back path',
    action.from && trigger && trace?.layout && opening?.layout && openingTrigger?.mounted === true &&
      (expected.visible || action.key && earlierAction?.instanceId === action.instanceId && earlierAction.op === 'click') ?
      action.from === baseline && expected.triggers.includes(trigger) &&
        opening.layout === trigger && openingTrigger.id === trigger && trace.layout === trigger &&
        (expected.visible || action.key === 'Back' && earlierAction.afterSeq <= before.beforeSeq) : null);

  const parentId = 'reader-control-module-' + expected.module;
  const complete = before.captureComplete === true && after.captureComplete === true;
  const retained = complete && trigger ? [before,after].map(sample => [parentId,trigger].map(id => visiblePopupNodes(sample,id))) : null;
  const identities = retained?.map(row => row.map(nodes => nodes.map(item => item.key ?? null)));
  const unique = identities?.every(row => row.every(keys => keys.length === 1));
  const comparable = unique && identities.every(row => row.every(([key]) => typeof key === 'string' && key.length > 0));
  check('popup-stable-parent-retention',identities,'the underlying Home and selected More trigger remain mounted',
    retained === null ? null : !unique ? false : comparable ? same(identities[0],identities[1]) : null);

  const openSample = expected.visible ? after : before;
  const captured = openSample.captureComplete === true;
  const menus = captured ? visiblePopupNodes(openSample,expected.nativeId) : [];
  const menu = menus.length === 1 ? menus[0] : null;
  const ancestors = menu ? ancestorsOf(openSample,menu).filter(item => item.type === expected.nativeOwnerType && item.visible === true) : [];
  const popup = ancestors.length === 1 ? ancestors[0] : null;
  const rows = menu ? expected.actions.map(name => visiblePopupNodes(openSample,`${expected.nativeId}-item-${name}`)) : [];
  const ownsRows = rows.every(items => items.length === 1 && items[0].type === 'Button' &&
    ancestorsOf(openSample,items[0]).includes(menu));
  const projection = menu?.type === 'Scroll' && !!popup && ownsRows;
  const paint = projection ? [popup,menu,...rows.map(items => items[0])].map(item =>
    [item.opacity,item.visibleRectPx?.width,item.visibleRectPx?.height]) : [];
  const measuredPaint = paint.every(values => values.every(finite));
  check('popup-stable-open-projection', {menus:menus.map(item => item.path),popup:popup?.path,
    rows:rows.map(items => items.map(item => item.path)),paint},
    'one visible menu Scroll under its platform Popup, with all required native Buttons inside',
    !captured ? null : !projection ? false : measuredPaint ? paint.every(values => values.every(value => value > 0)) : null);

  const finalMenu = opening?.frames?.at(-1)?.menu;
  const positionVp = position(finalMenu);
  const traceRect = positionVp && [positionVp[0],positionVp[1],finalMenu.layoutRectVp?.width,finalMenu.layoutRectVp?.height];
  const nativeRect = popupTreeBox(openSample,menu);
  check('popup-stable-layout-binding', {trace:traceRect,tree:nativeRect},'the settled native menu has the same window-local origin and size in both observations',
    traceRect?.every(finite) && nativeRect?.every(finite) ? finalMenu.id === expected.nativeId &&
      nativeRect[2] > 0 && nativeRect[3] > 0 && nativeRect.every((value,index) => near(value,traceRect[index],expected.layoutToleranceVp)) : null);

  if (!expected.visible) {
    const closed = after.captureComplete === true;
    const menusAfter = closed ? visiblePopupNodes(after,expected.nativeId) : [];
    const hostAfter = closed && popup?.key ? after.nodes.some(item => item.type === expected.nativeOwnerType &&
      item.key === popup.key && item.visible === true) : null;
    check('popup-stable-close-projection',{visibleMenus:menusAfter.length,visibleOpenedHost:hostAfter},
      'the specific opened Popup and its menus are absent after normal Back',
      closed && (menusAfter.length || hostAfter !== null) ? menusAfter.length === 0 && hostAfter === false : null);
  }
}

function checkPopup(observed) {
  const { before, after, expected, events, activity, earlier, check } = observed;
  const trace = events.find(event => event.payload.phase === 'trace')?.payload.facts;
  const nativeState = events.find(event => event.payload.phase === 'native-state' &&
    event.payload.facts?.visible === expected.visible)?.payload.facts;
  const requests = activity.filter(event => event.kind === 'reading.control-layer' &&
    event.payload.origin === 'more' && event.payload.active === expected.visible);
  const layer = requests.length === 1 ? requests[0].payload : null;
  const generation = layer?.generation;
  const idsValid = Number.isSafeInteger(generation) && trace?.generation === generation &&
    nativeState?.generation === generation && (!expected.nativeOwnerType || trace?.visible === expected.visible);
  check('popup-scope', { generation: generation ?? null, native: nativeState?.generation ?? null },
    'same requested menu and native visibility callback', idsValid ? true : requests.length > 1 ? false : null);
  const detected = trace?.frames ?? [];
  const start = detected[0]?.trigger;
  const final = detected.at(-1);
  const registeredAnchor = expected.triggers.includes(trace?.layout);
  const actualAnchor = trace && node(before, trace.layout);
  check('popup-anchor', registeredAnchor ? trace.layout : null, expected.triggers,
    actualAnchor && start?.mounted && start.id === trace.layout ? true : null);
  const descendants = final?.mountedActions;
  const mounted = final?.menu?.mounted;
  if (expected.visible) {
    check('popup-visible-content', descendants, expected.actions, mounted && descendants &&
      expected.actions.every(id => descendants.includes(id)) ? true : null);
    const finalMenu = final?.menu;
    const stableNative = node(after, expected.nativeId);
    check('popup-layout-endpoint', { windowActor: position(finalMenu), stableTree: stableNative?.rectPx ?? null },
      'native menu position in the normal window and same stable overlay',
      finalMenu?.clipToFrame === true && stableNative?.visible === true &&
      position(finalMenu) && finite(finalMenu.opacity) ? true : null);
  } else {
    check('popup-closed', { attached: mounted, opacity: final?.menu?.opacity ?? null }, false, final ?
      !mounted || finite(final.menu.opacity) && final.menu.opacity <= expected.opacityTolerance : null);
    if (expected.nativeOwnerType) {
      const stableMenu = node(after, expected.nativeId);
      const finalOwner = final?.popupOwner;
      check('popup-native-closed-endpoint', { stableContent:!!stableMenu, hostOpacity:finalOwner?.opacity },
        'no visible menu content and no observed visible platform host', after ?
          !stableMenu && (finalOwner?.status !== 'measured' ||
            finite(finalOwner.opacity) && finalOwner.opacity <= expected.opacityTolerance) : null);
    }
  }
  if (expected.nativeOwnerType) {
    if (expected.requireStablePopupProjection) checkStablePopup(observed,trace);
    const { action, earlierAction } = observed;
    checkPopupOwnerPath({detected, earlier, expected, generation, check,
      renderOpen:expected.visible ? action?.popupRender : earlierAction?.popupRender,
      renderClose:expected.visible ? undefined : action?.popupRender,
      trigger:expected.visible ? action?.targetId : earlierAction?.targetId,
      openState:expected.visible ? after : before});
    return;
  }
  const actualFrames = detected.filter(frame => frame.menu?.mounted && finite(frame.menu.opacity) &&
    position(frame.menu) && frame.menu.inspectorSource === 'FrameNode.getInspectorInfo');
  const opacity = actualFrames.map(frame => frame.menu.opacity);
  const changing = opacity.length >= 3 && Math.max(...opacity) - Math.min(...opacity) > expected.opacityTolerance;
  const trend = expected.visible ? 1 : -1;
  const ordered = actualFrames.every((frame, i) => i === 0 ||
    frame.frameTimeNs > actualFrames[i - 1].frameTimeNs && trend * (opacity[i] - opacity[i - 1]) >= -expected.opacityTolerance);
  check('popup-native-path', { attachedSamples: actualFrames.length, opacity }, 'readable intermediate native Popup animation',
    changing ? ordered : null);
}

function checkTemporary({ before, after, expected, events, activity, earlier, check }) {
  const moduleId = 'reader-control-module-' + expected.module;
  const matching = activity.filter(event => event.kind === 'reading.control-layer' &&
    event.payload.origin === expected.module && event.payload.active === expected.visible);
  const layer = matching.length === 1 ? matching[0].payload : null;
  const beforeNode = node(before, expected.nativeId);
  const afterNode = node(after, expected.nativeId);
  const beforeMounted = Boolean(beforeNode && beforeNode.opacity > expected.opacityTolerance);
  const afterMounted = Boolean(afterNode && afterNode.opacity > expected.opacityTolerance);
  check('module-retained', { before:node(before, moduleId)?.id, after:node(after, moduleId)?.id }, moduleId,
    node(before, moduleId) && node(after, moduleId) ? true : null);
  check('layer-business-endpoint', layer, { module:expected.module, active:expected.visible, inputKind:'modal' },
    layer ? layer.inputKind === 'modal' && layer.location?.module === expected.module && layer.location?.form === 'full' :
      matching.length > 1 ? false : null);
  check('layer-native-endpoint', { from:beforeMounted, to:afterMounted }, { from:!expected.visible, to:expected.visible },
    beforeMounted !== expected.visible && afterMounted === expected.visible ? true : null);
  if (expected.openAction) {
    const opening = earlier.find(event => event.kind === 'reading.control-layer' && event.payload.origin === expected.module &&
      event.payload.active === true)?.payload;
    const back = activity.find(event => event.kind === 'reading.control-back-consumer');
    check('layer-generation', layer?.generation, opening?.generation, layer && opening ?
      layer.generation === opening.generation && layer.epoch === opening.epoch : null);
    check('layer-back-consumer', back?.payload.consumer, 'temporary-layer',
      back ? back.payload.consumer === 'temporary-layer' : null);
  }
  if (expected.requireNoPanelRequest) {
    const requests = activity.filter(event => event.kind === 'reading.control-transition-requested');
    check('modal-only-back', requests.map(event => event.eventSeq), [], requests.length === 0);
  }
  if (expected.requiresFramePath !== true) return;
  const trace = events.find(event => event.payload.phase === 'trace' &&
    event.payload.facts?.opening === expected.visible)?.payload.facts;
  const observed = (trace?.frames ?? []).filter(frame => frame.actor?.mounted && finite(frame.timeNs) &&
    finite(frame.actor.layoutRectVp?.height) && frame.actor.inspectorSource === 'FrameNode.getInspectorInfo');
  const heights = observed.map(frame => frame.actor.layoutRectVp.height);
  const interior = heights.length >= 3 && heights.some(value =>
    !near(value, heights[0], expected.layoutToleranceVp) && !near(value, heights.at(-1), expected.layoutToleranceVp));
  const sign = expected.visible ? 1 : -1;
  const onPath = observed.every((frame, i) => frame.actor.clipToFrame === true && frame.actor.zIndex === expected.nativeZ &&
    (i === 0 || frame.timeNs > observed[i - 1].timeNs && sign * (heights[i] - heights[i - 1]) >= -expected.layoutToleranceVp));
  check('layer-trajectory', { heights, observedFrames:observed.length }, {
    direction:expected.visible ? 'expand' : 'collapse', intermediateSamples:true, clip:true, zIndex:expected.nativeZ,
  }, interior ? onPath : null);
}

function easeOut(t) {
  let left = 0, right = 1;
  for (let i = 0; i < 20; i += 1) {
    const n = (left + right) / 2;
    if (3 * .58 * (1 - n) * n ** 2 + n ** 3 < t) left = n;
    else right = n;
  }
  const n = (left + right) / 2;
  return t === 0 ? 0 : t === 1 ? 1 : n * n * (3 - 2 * n);
}

function checkFontTrace(run, expected, check) {
  const compareTrack = (track, target, anchor, progress) => {
    if (!position(target) || !position(anchor) || !finite(track?.from?.x) || !finite(track.from.y) ||
      !finite(track?.to?.x) || !finite(track.to.y)) return null;
    const positionVp = [track.from.x + (track.to.x - track.from.x) * progress,
      track.from.y + (track.to.y - track.from.y) * progress];
    const measured = [target.windowOriginVp.x - anchor.windowOriginVp.x,
      target.windowOriginVp.y - anchor.windowOriginVp.y];
    return { actual:measured, expected:positionVp, matched:positionVp.every((value, axis) =>
      near(measured[axis], value, expected.layoutToleranceVp)) && target.parentUniqueId === anchor.uniqueId };
  };
  const changed = run.tracks.filter(track => !same(track.from, track.to));
  const duration = run.type === 'shift' ? expected.shiftDurationMs : expected.settleDurationMs;
  check(run.type + '-sourced-duration', run.durationMs, duration, finite(run.durationMs) ? run.durationMs === duration : null);
  let interiorCount = 0;
  for (const frame of run.frames) {
    if (!finite(frame.tickMs) || !finite(run.fromTickMs)) continue;
    const t = Math.max(0, Math.min(1, (frame.tickMs - run.fromTickMs) / duration));
    const progress = easeOut(t);
    if (t > 0 && t < 1) interiorCount += 1;
    for (const track of changed) {
      const actual = frame.slots.find(slot => slot.id === track.id);
      const compared = compareTrack(track, actual, frame.grid, progress);
      const id = run.type + '-native-cell';
      check(id, compared ? { frame:frame.index, actor:track.id, point:compared.actual } : null,
        compared ? compared.expected : 'native grid-relative slot position', compared?.matched ?? null);
    }
  }
  check(run.type + '-interior', { frames:run.frames.length, interiorCount, dropped:run.omitted },
    'nonzero-duration samples with changing font tracks', interiorCount > 0 && run.omitted === 0 && changed.length > 0 ? true : null);
}

function nativeFontSlots(sample, expected) {
  if (sample?.captureComplete !== true) return null;
  const {gridId,targetId} = expected.fontSwap;
  const grid = node(sample,gridId);
  const slots = [node(sample,expected.nativeId),node(sample,targetId)];
  const density = sample.window?.density;
  const fields = ['left','top','width','height'];
  const hasBox = box => fields.every(field => finite(box?.[field])) && box.width > 0 && box.height > 0;
  if (!grid || slots.some(slot => !slot) || !hasBox(grid.rectPx) || !hasBox(grid.visibleRectPx) ||
      !finite(density) || density <= 0) return null;
  const owned = slots.every(slot => ancestorsOf(sample,slot).includes(grid));
  // The scroll viewport can clip the grid itself. Each measured card must be fully visible.
  const points = owned && slots.every(slot => slot.opacity > 0 && hasBox(slot.rectPx) &&
      hasBox(slot.visibleRectPx) && fields.every(field => slot.rectPx[field] === slot.visibleRectPx[field])) ?
    slots.map(slot => [(slot.rectPx.left - grid.rectPx.left) / density, (slot.rectPx.top - grid.rectPx.top) / density]) : null;
  return {owned,points,density,gridKey:grid.key,gridSize:[grid.rectPx.width / density,grid.rectPx.height / density]};
}

function compareFontSlots(before, after, exchanged, tolerance) {
  if (!before?.points || !after?.points || !before.gridKey || before.gridKey !== after.gridKey ||
      before.density !== after.density || before.gridSize.some((value,axis) => !near(value,after.gridSize[axis],tolerance))) return null;
  const distinct = before.points[0].some((value,axis) => Math.abs(value - before.points[1][axis]) > 2 * tolerance);
  if (!distinct) return null;
  const wanted = exchanged ? [before.points[1],before.points[0]] : before.points;
  return wanted.every((point,index) => point.every((value,axis) => near(value,after.points[index][axis],tolerance)));
}

function checkFontSwap({before,after,expected,check,action,baseline,original}, started, released, admitted) {
  check('font-drag-origin', {sample:action.from,target:action.targetId}, {sample:baseline,target:expected.nativeId},
    action.from && action.targetId ? action.from === baseline && action.targetId === expected.nativeId : null);

  const order = started?.order;
  if (Array.isArray(order) && Array.isArray(released?.order) && Array.isArray(admitted?.order)) {
    const from = order.indexOf(expected.font);
    const to = order.indexOf(expected.fontSwap.targetFont);
    const adjacent = from >= 0 && to >= 0 && Math.abs(from - to) === 1 && new Set(order).size === order.length;
    const wanted = order.slice();
    if (adjacent) [wanted[from],wanted[to]] = [order[to],order[from]];
    check('font-order-adjacent-swap', {before:order,released:released.order,admitted:admitted.order}, wanted,
      adjacent && same(released.order,wanted) && same(admitted.order,wanted));
  } else check('font-order-adjacent-swap', null, 'complete owner order before and after the adjacent swap', null);

  const first = nativeFontSlots(before,expected);
  const last = nativeFontSlots(after,expected);
  const initial = original ? nativeFontSlots(original,expected) : null;
  const ownership = [first,last,initial].map(sample => sample?.owned ?? null);
  check('native-font-grid-ownership', ownership, 'both visible native font cards belong to the selected grid',
    !ownership.includes(false));
  check('native-font-slot-exchange', {before:first,after:last}, 'the native System and Serif grid-relative origins exchange',
    compareFontSlots(first,last,true,expected.layoutToleranceVp));
  if (expected.restoreAction) {
    check('native-font-slot-restoration', {original:initial,after:last}, 'the native font cards return to their original grid-relative origins',
      compareFontSlots(initial,last,false,expected.layoutToleranceVp));
  }
}

function checkFontTraceOwnership(trace, expected, commands, check) {
  const [start,release] = commands.map(matches => matches[0]);
  const [shift,settle] = trace;
  const runs = trace.map(event => event?.payload.facts.run);
  const generations = [start?.payload.facts?.generation,...runs.map(run => run?.generation)];
  const order = release?.payload.facts?.order;
  check('font-trace-causal-owner', {generations,orders:runs.map(run => run?.order),
    sequence:[start?.eventSeq,shift?.eventSeq,release?.eventSeq,settle?.eventSeq]},
  'the selected drag shift and release settle use the requested order and advancing generations',
  start && release && shift && settle && generations.every(Number.isSafeInteger) &&
    Array.isArray(order) && runs.every(run => Array.isArray(run.order)) ?
    start.eventSeq < shift.eventSeq && shift.eventSeq < release.eventSeq && release.eventSeq < settle.eventSeq &&
      generations[0] < generations[1] && generations[1] < generations[2] &&
      runs.every(run => same(run.order,order)) : null);
  for (const [index,id] of [expected.fontSwap.targetId,expected.nativeId].entries()) {
    const run = runs[index];
    const moved = run?.tracks.filter(track => track.id === id && !same(track.from,track.to));
    check((index === 0 ? 'shift' : 'settle') + '-font-actor', run?.tracks.map(track => track.id),
      {moving:id,...(index === 0 ? {excluded:expected.nativeId} : {})},
      run ? moved.length === 1 && (index !== 0 || !run.tracks.some(track => track.id === expected.nativeId)) : null);
  }
}

function checkFont(observed) {
  const {before,after,expected,events,check,earlier,action} = observed;
  const phases = ['drag-started','drag-released','order-admitted'];
  const business = expected.fontSwap ? events.filter(event => event.channel === 'business' && event.eventSeq <= action.afterSeq) : events;
  const commands = phases.map(phase => business.filter(event => event.payload.phase === phase));
  const [started,released,admitted] = commands.map(matches => matches[0]?.payload.facts);
  if (expected.fontSwap) {
    const seqs = commands.map(matches => matches[0]?.eventSeq);
    check('font-drag-admission-sequence', commands.map(matches => matches.map(event => event.eventSeq)),
      'one drag start, release and view admission, in that order inside the selected normal drag',
      commands.some(matches => matches.length > 1) ? false : seqs.every(finite) ? seqs[0] < seqs[1] && seqs[1] < seqs[2] : null);
  }
  const traceEvents = events.filter(event => event.payload.phase === 'trace' &&
    (!expected.fontSwap || event.channel === 'motion' && event.eventSeq <= action.afterSeq) &&
    Array.isArray(event.payload.facts?.run?.frames) && Array.isArray(event.payload.facts.run.tracks));
  const shifts = traceEvents.filter(event => event.payload.facts.run.type === 'shift');
  const settles = traceEvents.filter(event => event.payload.facts.run.type === 'settle' && event.payload.facts.reason === 'completed');
  const shift = expected.fontSwap ? shifts.at(-1) : shifts.find(event => event.payload.facts.run.frames.length >= 3);
  const settle = expected.fontSwap ? settles.at(-1) : settles[0];
  check('font-reorder-command', { start:started?.font ?? null, changed:released?.changed ?? null },
    { start:expected.font, changed:true }, started && released ?
      started.font === expected.font && released.changed === true && released.commit === true : null);
  check('font-order-admitted', admitted?.order, released?.order,
    admitted && released ? same(admitted.order, released.order) && same(admitted.requested, released.order) &&
      !same(started?.order, admitted.order) : null);
  check('font-actor-endpoints', { start:node(before, expected.nativeId)?.id ?? null, end:node(after, expected.nativeId)?.id ?? null },
    expected.nativeId, node(before, expected.nativeId) && node(after, expected.nativeId) ? true : null);
  if (expected.restoreAction) {
    const earlierStarts = earlier.filter(event => event.payload.phase === 'drag-started' &&
      (!expected.fontSwap || event.channel === 'business'));
    const original = (!expected.fontSwap || earlierStarts.length === 1) ? earlierStarts[0]?.payload.facts?.order : null;
    check('restored-original-order', admitted?.order, original,
      Array.isArray(admitted?.order) && Array.isArray(original) ? same(admitted.order, original) : null);
  }
  if (expected.fontSwap) {
    checkFontSwap(observed,started,released,admitted);
    checkFontTraceOwnership([shift,settle],expected,commands,check);
  }
  for (const [phase, event] of [['shift', shift], ['settle', settle]]) {
    const run = event?.payload.facts.run;
    check(phase + '-trace', run?.frames.length, 'trajectory of affected native font cells',
      run && (phase !== 'shift' || run.frames.length >= 3) ? true : null);
    if (run) checkFontTrace(run, expected, check);
  }
}

export function evaluateControlEffect(assertion, context) {
  if (!supportedEffects.has(assertion.expected?.effect)) {
    throw new Error(`Unknown reading control effect ${assertion.expected?.effect}`);
  }
  const action = context.actions[assertion.action];
  const before = context.samples[assertion.baseline];
  const after = context.samples[assertion.sample];
  const expected = assertion.expected;
  const finding = [];
  let probeRead;
  const refs = new Map();
  for (const value of [action, before, after]) {
    for (const ref of value?.evidenceRefs ?? []) refs.set(ref.path, ref);
  }
  function check(field, actual, want, verdict) {
    if (verdict !== true) finding.push({ field, actual:diagnostic(actual), expected:diagnostic(want), missing:verdict == null });
  }
  const sources = [...new Set([assertion.source.split('#')[0], ...(expected.ownerSources ?? [])])];
  const sourceRefs = sources.map(path => {
    const source = context.candidate?.ownerSources?.[path];
    return { path, sha256: typeof source === 'string' ? source : source?.sha256 ?? null };
  });
  const ownersBound = sourceRefs.every(ref => /^[a-f0-9]{64}$/u.test(ref.sha256 ?? ''));
  const hasBaseline = action?.instanceId && action.instanceId === before?.instanceId && before.window?.id &&
    finite(action.beforeSeq) && finite(action.afterSeq) && action.beforeSeq < action.afterSeq && before.afterSeq <= action.beforeSeq;
  const boundary = hasBaseline && sameWindow(before, after) && action.afterSeq <= after.beforeSeq;
  // The selected launch journal is independently attributable even when its
  // later native endpoint capture crossed a semantic publication.
  const partialCapsuleLaunch = hasBaseline && after == null && expected.effect === 'capsule-launch' &&
    (!expected.openAction || expected.pauseAction);
  const partialDirectorySelection = hasBaseline && after == null && expected.effect === 'directory-selection';
  check('source-binding', sourceRefs, 'exact owner snapshot for the selected effect', ownersBound ? true : null);
  check('action-binding', action?.op, expected.op, boundary || partialCapsuleLaunch || partialDirectorySelection ? expected.op === action.op : null);
  if (expected.inlineSearchEditor && hasBaseline && action.op === expected.op &&
      before.captureComplete === true && after?.captureComplete === true && after.instanceId === action.instanceId &&
      after.window?.id && action.afterSeq <= after.beforeSeq) {
    check('search-editor-window-continuity',[before.window.id,after.window.id],
      'both complete native captures belong to the same Search window',sameWindow(before,after));
  }
  if (partialCapsuleLaunch) check('stable-capsule-endpoint', null, 'verified native endpoint after the launch action', null);
  if (expected.effect === 'search-results' && ownersBound) checkQuickSearchResults(assertion,context,check,refs);
  else if ((boundary || (partialCapsuleLaunch || partialDirectorySelection) && expected.op === action.op) && ownersBound) {
    const readingEntry = context.actions['enter-reading'];
    const ready = (context.events ?? []).filter(event => readingEntry && event.kind === 'reading.ready' &&
      event.instanceId === action.instanceId && event.eventSeq > readingEntry.beforeSeq && event.eventSeq <= readingEntry.afterSeq &&
      event.payload?.localBook === true);
    const readingId = ready.length === 1 ? ready[0].payload.readingId : null;
    check('reading-instance', readingId, 'same normal public reading opening', readingId ? true : null);
    if (readingId) {
      const activity = (context.events ?? []).filter(event => event.instanceId === action.instanceId &&
        event.payload?.readingId === readingId && event.eventSeq > action.beforeSeq && event.eventSeq <= (boundary ? after.beforeSeq : action.afterSeq));
      for (const event of activity) for (const ref of event.evidenceRefs ?? []) refs.set(ref.path, ref);
      const forEffect = event => event.kind === 'reading.control-effect' && event.payload.kind === expected.effect;
      const precedingActionId = expected.restoreAction ?? expected.openAction;
      const earlierAction = precedingActionId && context.actions[precedingActionId];
      const earlier = earlierAction ? (context.events ?? []).filter(event => event.instanceId === action.instanceId &&
        event.payload?.readingId === readingId && event.eventSeq > earlierAction.beforeSeq &&
        event.eventSeq <= earlierAction.afterSeq &&
        (forEffect(event) || event.kind === 'reading.control-layer')) : [];
      for (const event of earlier) for (const ref of event.evidenceRefs ?? []) refs.set(ref.path, ref);
      const observed = { before, after, expected, activity, check, earlier, context,
        events:activity.filter(forEffect) };
      if (expected.effect === 'directory-scroll') checkScroll(observed, action, assertion.baseline);
      else if (expected.effect === 'directory-selection') {
        const chapter = ready[0].payload.chapterIndex;
        check('directory-starting-chapter',chapter,'normal public reading entered at Chapter 01',
          Number.isSafeInteger(chapter) && chapter >= 0 ? chapter === 0 : null);
        for (const ref of ready[0].evidenceRefs ?? []) refs.set(ref.path,ref);
        checkDirectorySelection(observed,action,assertion.baseline);
      }
      else if (expected.effect === 'keyboard-back') {
        checkKeyboard(observed);
        if (expected.inlineSearchEditor) {
          const prior = earlierAction?.instanceId === action.instanceId ? (context.events ?? []).filter(event =>
            event.instanceId === action.instanceId && event.payload?.readingId === readingId &&
            event.eventSeq > earlierAction.beforeSeq && event.eventSeq <= before.beforeSeq &&
            event.kind === 'reading.control-layer') : [];
          for (const value of [earlierAction,...prior]) {
            for (const ref of value?.evidenceRefs ?? []) refs.set(ref.path,ref);
          }
          checkSearchEditorKeyboard(observed,{action,baseline:assertion.baseline,focus:earlierAction,prior});
        }
      }
      else if (expected.effect === 'more-popup') {
        if (expected.requireStablePopupProjection) {
          for (const ref of earlierAction?.evidenceRefs ?? []) refs.set(ref.path,ref);
        }
        checkPopup({...observed,action,baseline:assertion.baseline,earlierAction});
      }
      else if (expected.effect === 'font-reorder') {
        const initial = expected.fontSwap && expected.restoreAction ? context.samples[earlierAction?.from] : null;
        const original = initial && earlierAction.instanceId === action.instanceId && earlierAction.op === 'drag' &&
          earlierAction.targetId === expected.nativeId && initial.afterSeq <= earlierAction.beforeSeq &&
          earlierAction.beforeSeq < earlierAction.afterSeq && earlierAction.afterSeq <= before.beforeSeq &&
          sameWindow(initial,before) ? initial : null;
        for (const value of original ? [original,earlierAction] : []) {
          for (const ref of value.evidenceRefs ?? []) refs.set(ref.path,ref);
        }
        checkFont({...observed,action,baseline:assertion.baseline,original});
      }
      else if (expected.effect === 'capsule-launch' && expected.pauseAction) {
        const pause = context.actions[expected.pauseAction];
        const pausedEvents = (context.events ?? []).filter(event => pause && event.instanceId === action.instanceId &&
          event.payload?.readingId === readingId && event.eventSeq > pause.beforeSeq &&
          event.eventSeq <= pause.afterSeq && event.channel === 'business' && forEffect(event));
        for (const value of [earlierAction, pause, ...pausedEvents]) {
          for (const ref of value?.evidenceRefs ?? []) refs.set(ref.path, ref);
        }
        checkCapsuleHandoff(observed, {action,launch:earlierAction,pause,pausedEvents,baseline:assertion.baseline});
      }
      else if (expected.effect === 'capsule-launch' && expected.op === 'clickThenReaderCenter') checkLaunchInterruption(observed,action);
      else if (expected.effect === 'capsule-launch') {
        if (expected.openAction) checkCapsulePause(observed);
        else probeRead = checkCapsuleLaunch(observed);
      }
      else if (['temporary-overlay','appearance-selector'].includes(expected.effect)) checkTemporary(observed);
    }
  }
  const failure = finding.find(item => !item.missing);
  const gap = finding.find(item => item.missing);
  const earliest = failure ?? gap;
  return { actual:{ actionId:action?.actionId ?? null, sourceRefs, findings:finding, ...(probeRead ? {probeRead} : {}) }, expected,
    verdict:failure ? 'FAIL' : gap ? 'NOT_RUN' : 'PASS', observationsComplete:!gap,
    reason:earliest ? earliest.field + (earliest.missing ? ' lacks comparable evidence' : ' observed deviation') : null,
    evidenceRefs:[...refs.values()] };
}
