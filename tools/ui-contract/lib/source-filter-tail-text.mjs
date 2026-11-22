import {sourceReadObservation} from './source-read.mjs';
import {sourceTextPlacement} from './source-adaptation.mjs';
import {sourceFilterScrollFrame, sourceFilterScrollLanes} from './source-filter-scroll.mjs';

const initialSlice = {sample:'source-ready',action:'open-sources'};
export const sourceFilterTextLanes = {
  status:{
    roleLengths:{all:2,enabled:2,error:2,unchecked:3,custom:3},
    slices:[initialSlice,{sample:'status-middle-first',action:'scroll-status-first'},
      {sample:'status-middle-last',action:'scroll-status-second'},{sample:'status-tail',action:'scroll-status-third'}],
    endpoints:{320:.35,366:.35},
  },
  category:{
    roleLengths:{all:4,novel:2,comic:2,music:5,download:5,external:7,other:5},
    slices:[initialSlice,...[1,2,3,4,5,6].map(step=>({
      sample:step === 6 ? 'category-tail' : `category-shift-${step}`,action:`scroll-category-${step}`,
    }))],
    endpoints:{320:.51,366:.58},
  },
};
export const sourceFilterTextCases = Object.fromEntries(Object.keys(sourceFilterTextLanes).flatMap(lane=>
  [320,366].map(widthVp=>[`source-management.layout-${lane}-glyph-tail-${widthVp}-font-200`, {lane,widthVp}])));

export const sourceFilterTextDragPath = ({lane,widthVp})=>({
  from:[.85,.5],to:[sourceFilterTextLanes[lane].endpoints[widthVp],.5],speed:300,
});

const positive = value => Number.isSafeInteger(value) && value > 0;
const near = (a,b,tolerance) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const rectKeys = ['left','top','width','height'];
const rect = value => rectKeys.every(key=>Number.isFinite(value?.[key])) && value.width > 0 && value.height > 0;
const sameRect = (a,b) => rect(a) && rect(b) && rectKeys.every(key=>a[key] === b[key]);
const right = box => box.left + box.width;
const fullyInside = (outer,inner) => rect(outer) && rect(inner) && outer.left <= inner.left && outer.top <= inner.top &&
  right(inner) <= right(outer) && inner.top + inner.height <= outer.top + outer.height;
const sameOwner = (left,right) => Number.isSafeInteger(left?.mounting) && left.mounting >= 0 && positive(left.generation) &&
  left.mounting === right?.mounting && left.generation === right?.generation;

export function sourceFilterTextDragDispatch(step,operation,probeSeq) {
  if (operation.op !== 'drag') return null;
  const lane = Object.keys(sourceFilterTextLanes).find(name=>step.target === sourceFilterScrollLanes[name].viewport &&
    sourceFilterTextLanes[name].slices.slice(1).some(slice=>slice.action === step.id));
  if (!lane) return null;
  const {fromX,fromY,toX,toY,velocity} = operation;
  return {lane,fromX,fromY,toX,toY,velocity,probeSeq};
}

function provenDrag(action,before,after,lane,path) {
  const dispatch = action?.filterTextDrag;
  const viewport = before.frame.viewport.visibleRectPx;
  const point = ([x,y])=>[Math.floor(viewport.left + x * viewport.width),Math.floor(viewport.top + y * viewport.height)];
  const [fromX,fromY] = point(path.from);
  const [toX,toY] = point(path.to);
  return action?.op === 'drag' && action.targetId === sourceFilterScrollLanes[lane].viewport && action.from === before.id &&
    action.instanceId === before.sample.instanceId &&
    [before.sample.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(positive) &&
    before.sample.afterSeq <= action.beforeSeq && action.beforeSeq < action.afterSeq && action.afterSeq <= after.beforeSeq &&
    positive(dispatch?.probeSeq) && dispatch.lane === lane && fromX > toX &&
    dispatch.fromX === fromX && dispatch.fromY === fromY && dispatch.toX === toX && dispatch.toY === toY &&
    dispatch.velocity === path.speed;
}

function matchingText(event,projection,window) {
  const data = event?.payload;
  if (!data) return false;
  const state = projection.payload;
  return event?.eventSeq > projection.eventSeq && event.windowRevision === window.revision && data.windowRevision === window.revision &&
    sameOwner(state.owner,data.owner) && data.readGeneration === state.readGeneration &&
    data.filterRevision === state.filterRevision && data.textProjectionRevision === state.textProjectionRevision &&
    data.rowAnchor === state.firstAnchor && near(data.density,window.density,.01) &&
    near(data.systemFontScale,window.fontScale,.01) && near(data.fontScale,window.nativeFont.effectiveScale,.01) &&
    near(data.widthVp,window.rectPx.width / window.density,1 / window.density) &&
    near(data.heightVp,window.rectPx.height / window.density,1 / window.density) && Array.isArray(data.labels);
}

function fullWindow(sample,initial,expected) {
  const window = sample?.window;
  return sample?.captureComplete === true && sample.instanceId === initial?.instanceId &&
    sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) && sample.evidenceRefs.some(ref=>ref.path.endsWith('.json')) &&
    window?.source === 'window-metrics' && window.orientation === 'portrait' && window.keyboard?.visible === false &&
    window.id === initial.window.id && window.revision === initial.window.revision && window.density === initial.window.density &&
    Number.isFinite(window.density) && window.density > 0 && sameRect(window.rectPx,initial.window.rectPx) &&
    near(window.rectPx.width / window.density,expected.widthVp,.4) && near(window.fontScale,2,.01) &&
    window.nativeFont?.followsSystemFontScale === true && near(window.nativeFont.effectiveScale,2,.01) &&
    near(window.nativeFont.effectiveScale,window.fontScale,.01) &&
    (window.nativeFont.maxFontScale === null || window.nativeFont.maxFontScale >= 1.99);
}

function observeRole(sample,frame,chip,labels,lane,length) {
  const role = lane + '/' + chip;
  const button = frame.chips[chip];
  if (!button || button.visible !== true || !(button.opacity > 0)) return null;
  const viewport = frame.viewport.visibleRectPx;
  const revealed = fullyInside(viewport,button.rectPx) && sameRect(button.rectPx,button.visibleRectPx);
  const readings = labels.filter(label=>label?.role === role);
  const textNodes = sample.nodes.filter(node=>node.type === 'Text' && node.path.startsWith(button.path + '/'));
  if (!revealed) {
    const measurement = readings[0];
    if (textNodes.length === 1 && readings.length === 1 && measurement.complete === true && measurement.utf16Length === length &&
        Array.isArray(measurement.rangeRects) &&
        measurement.rangeRects.some(box=>Number.isFinite(box?.rightPx) && Number.isFinite(box?.leftPx) &&
          box.rightPx - box.leftPx > viewport.width + 1)) {
      return {verdict:'FAIL',reason:`${role} measured glyph range is wider than its entire native viewport`,
        actual:{viewportPx:viewport,buttonPx:button.rectPx}};
    }
    return null;
  }
  if (!textNodes.length) return {verdict:'FAIL',reason:`${role} is absent from its fully revealed native Button`,actual:null};
  if (textNodes.length !== 1 || !rect(textNodes[0].rectPx)) return null;
  if (!fullyInside(button.rectPx,textNodes[0].rectPx))
    return {verdict:'FAIL',reason:`${role} native Text exceeds the original Button`,actual:{buttonPx:button.rectPx,textPx:textNodes[0].rectPx}};
  if (readings.length !== 1) return null;
  if (readings[0].utf16Length !== length)
    return {verdict:'FAIL',reason:`${role} has the wrong mounted public Text length`,actual:{utf16Length:readings[0].utf16Length}};
  return sourceTextPlacement(role,readings[0],textNodes[0],sample.window,{tolerancePx:1});
}

export function evaluateSourceFilterTailText(assertion,context) {
  const {expected} = assertion;
  const lane = expected.lane;
  const {roleLengths,slices} = sourceFilterTextLanes[lane];
  const path = sourceFilterTextDragPath(expected);
  const seen = [];
  const roles = {};
  const sampleProofs = {};
  const refs = [];
  const report = (verdict,reason,observationsComplete = verdict === 'PASS')=>{
    const failure = verdict === 'NOT_RUN' && Object.values(roles).find(role=>role.verdict === 'FAIL');
    return {verdict:failure ? 'FAIL' : verdict,reason:failure ? failure.reason : reason,expected,
      actual:{sampleId:assertion.sample,textScope:lane+'-filter',...sampleProofs[assertion.sample],sampleProofs,slices:seen,roles},
      evidenceRefs:refs,observationsComplete};
  };
  const appendRefs = (...observations)=>refs.push(...observations.flatMap(item=>item?.evidenceRefs ?? []));
  const opening = sourceReadObservation({action:'open-sources',sample:'source-ready',expected:{state:'rows'}},context);
  const initial = opening?.sample;
  const projection = opening?.current;
  const state = projection?.payload;
  appendRefs(opening?.entry,projection);
  if (!fullWindow(initial,initial,expected) || state?.state !== 'rows' || state.readFact !== 'current' ||
      !positive(state.count) || state.projected !== state.count || state.queryLength !== 0 ||
      state.status !== 'all' || state.category !== 'all' || state.groupIndex !== 0 || state.allGroups !== true ||
      !positive(state.readGeneration) || !positive(state.filterRevision) || !positive(state.textProjectionRevision) ||
      !positive(state.firstAnchor)) return report('NOT_RUN','No normal populated Source opening with the selected system font and width');
  const policy = sourceFilterScrollLanes[lane];
  const events = context.events.filter(event=>event.channel === 'business' && event.instanceId === initial.instanceId);
  const observed = (kind,through,after)=>events.filter(event=>event.kind === kind &&
    event.eventSeq > after && event.eventSeq <= through);
  let previous;
  for (const slice of slices) {
    const sample = context.samples[slice.sample];
    const action = context.actions[slice.action];
    appendRefs(action,sample);
    if (!fullWindow(sample,initial,expected) || previous && !provenDrag(action,previous,sample,lane,path))
      return report('NOT_RUN','No exact drag between complete Source samples in the same verified system-font window');
    if (observed('source.route',sample.beforeSeq,opening.entry.eventSeq).length ||
        observed('source.overlay',sample.beforeSeq,initial.beforeSeq).length ||
        observed('source.projection',sample.beforeSeq,projection.eventSeq).length)
      return report('NOT_RUN','The Source route, overlay or catalogue projection changed during the measured filter sequence');
    const phase = previous ? 'settled' : 'initial';
    const reading = observed('source.filter-text-layout',sample.beforeSeq,previous ? action.beforeSeq : projection.eventSeq)
      .findLast(event=>event.payload.lane === lane && event.payload.phase === phase);
    const defaultText = previous ? undefined : observed('source.text-layout',sample.beforeSeq,projection.eventSeq).at(-1);
    appendRefs(reading,defaultText);
    if (!matchingText(reading,projection,sample.window) || !positive(reading.payload.revision) ||
        previous && reading.payload.revision <= previous.revision || !previous && !matchingText(defaultText,projection,sample.window))
      return report('NOT_RUN','No fresh native filter Text layout from the measured current opening and drag');
    if (reading.payload.labels.length > policy.chips.length-1)
      return report('NOT_RUN','The verified Text role snapshot is malformed');
    const frame = sourceFilterScrollFrame(sample,policy);
    if (!frame) return report('NOT_RUN','Current filter Scroll, content Row or native chip carrier cannot be identified');
    const viewport = frame.viewport.rectPx;
    const row = frame.row.rectPx;
    const overflow = right(row) - right(viewport);
    const delta = previous ? previous.frame.row.rectPx.left - row.left : 0;
    if (!previous && (Math.abs(row.left - viewport.left) > 1 || overflow <= 1))
      return report('NOT_RUN','The filter sequence did not begin at the demonstrably overflowing head');
    if (previous && (!sameRect(previous.frame.viewport.rectPx,viewport) || previous.frame.viewport.key !== frame.viewport.key ||
        previous.frame.row.key !== frame.row.key || ['top','width','height'].some(key=>previous.frame.row.rectPx[key] !== row[key]) ||
        delta < -1 || delta > previous.overflow + 1 || previous.overflow > 1 && delta <= 1))
      return report('FAIL','A verified drag failed to move the original overflowing filter content within its unchanged Scroll');
    if (previous && delta > 1) {
      const common = policy.chips.filter(chip=>previous.frame.chips[chip] && frame.chips[chip]);
      if (!common.length) return report('NOT_RUN','No common native filter Button can corroborate the measured drag displacement');
      if (common.some(chip=>{
        const before = previous.frame.chips[chip];
        const after = frame.chips[chip];
        return before.key !== after.key || ['top','width','height'].some(key=>before.rectPx[key] !== after.rectPx[key]) ||
          !near(before.rectPx.left - after.rectPx.left,delta,1);
      })) return report('FAIL','The native filter Buttons did not translate with their original Row');
    }
    sampleProofs[slice.sample] = {widthVp:sample.window.rectPx.width / sample.window.density,
      scale:sample.window.nativeFont.effectiveScale,nativeFont:sample.window.nativeFont,textProjectionRevision:state.textProjectionRevision};
    seen.push({sample:slice.sample,deltaPx:delta,overflowPx:overflow,windowWidthVp:sample.window.rectPx.width / sample.window.density,
      fontScale:sample.window.nativeFont.effectiveScale,textSeq:reading.eventSeq,dispatch:action.filterTextDrag ?? null});
    for (const chip of policy.chips) {
      const name = lane + '/' + chip;
      const labels = chip === 'all' ? defaultText?.payload.labels : reading.payload.labels;
      if (!labels) continue;
      const proof = observeRole(sample,frame,chip,labels,lane,roleLengths[chip]);
      if (!proof || proof.verdict === 'NOT_RUN') continue;
      const terminalTail = chip === policy.tail && slice.sample === assertion.sample;
      if (!Object.hasOwn(roles,name) || proof.verdict === 'FAIL' || terminalTail && roles[name].verdict === 'PASS')
        roles[name] = {...proof,sample:slice.sample,actual:{...proof.actual,sampleId:slice.sample}};
    }
    previous = {id:slice.sample,sample,frame,overflow,revision:reading.payload.revision};
  }
  const failure = Object.values(roles).find(role=>role.verdict === 'FAIL');
  if (failure) return report('FAIL',failure.reason,Object.keys(roles).length === policy.chips.length);
  if (previous.overflow > 1 || roles[lane+'/'+policy.tail]?.sample !== assertion.sample)
    return report('NOT_RUN','The bounded native drags did not establish a complete native glyph range at the terminal filter Button');
  const missing = policy.chips.map(chip=>lane+'/' + chip).filter(role=>!Object.hasOwn(roles,role));
  if (missing.length) return report('NOT_RUN',`Whole native glyph ranges remain unobserved for ${missing.join(', ')}`);
  return report('PASS','');
}
