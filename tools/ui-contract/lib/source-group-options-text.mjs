import { ancestorsOf, sourceGroupOptionsTextHead, sourceGroupOptionsTail } from './layout.mjs';
import { sourceTextPlacement } from './source-adaptation.mjs';
import { evaluateSourceGroupOptionsScroll, sourceGroupScrollFrame } from './source-group-options-scroll.mjs';
import { effectiveAppearance } from './structure.mjs';

export const sourceGroupTextScope = 'group-menu';
export const sourceGroupTextEvent = 'source.surface-text-layout';

const groupTextSamples = [
  {sample:'panel-before',role:'group/option-head',phase:'initial',target:sourceGroupOptionsTextHead},
  {sample:'panel-tail',role:'group/option-tail',phase:'settled',target:sourceGroupOptionsTail},
];
const keys = ['left','top','width','height'];
const box = value=>keys.every(key=>Number.isFinite(value?.[key])) && value.width > 0 && value.height > 0;
const sameBox = (a,b)=>box(a) && box(b) && keys.every(key=>a[key] === b[key]);
const contains = (outer,inner)=>box(outer) && box(inner) && inner.left >= outer.left && inner.top >= outer.top &&
  inner.left+inner.width <= outer.left+outer.width && inner.top+inner.height <= outer.top+outer.height;
const near = (a,b,tolerance)=>Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance;
const positive = value=>Number.isSafeInteger(value) && value > 0;
const ownerIs = (a,b)=>positive(a?.generation) && Number.isSafeInteger(a?.mounting) && a.mounting >= 0 &&
  a.generation === b?.generation && a.mounting === b?.mounting;

function fontProof(sample,initial,revision) {
  const window = sample?.window;
  const font = window?.nativeFont;
  if (sample?.captureComplete !== true || window?.source !== 'window-metrics' || window?.keyboard?.visible !== false ||
      window.orientation !== 'portrait' || window.id !== initial?.window?.id || window.revision !== initial?.window?.revision ||
      window.density !== initial?.window?.density || !Number.isFinite(window.density) || window.density <= 0 ||
      !sameBox(window.rectPx,initial.window.rectPx) || !sameBox(window.visibleRectPx,initial.window.visibleRectPx) ||
      !near(window.fontScale,1,.01) || font?.followsSystemFontScale !== true ||
      !near(font.effectiveScale,window.fontScale,.01) || !near(font.vpPixels,window.density,.01) ||
      !near(font.fpPixels / font.vpPixels,font.effectiveScale,.01) ||
      (font.maxFontScale !== null && !(font.maxFontScale >= .99))) return null;
  const widthVp = window.rectPx.width / window.density;
  if (widthVp < 319.6 || widthVp > 366.4) return null;
  return {widthVp,scale:font.effectiveScale,nativeFont:font,textProjectionRevision:revision};
}

function currentGroupMeasurement(event,opening,projection,sample,frame) {
  const data = event?.payload;
  const state = projection?.payload;
  const window = sample.window;
  return Boolean(data && state && event.eventSeq > opening.eventSeq && frame.selectionId === opening.payload.selectionId &&
    data.selectionId === frame.selectionId && ownerIs(state.owner,data.owner) && ownerIs(state.owner,opening.payload.owner) &&
    event.windowRevision === window.revision && data.windowRevision === window.revision &&
    positive(state.textProjectionRevision) && data.textProjectionRevision === state.textProjectionRevision &&
    positive(state.readGeneration) && data.readGeneration === state.readGeneration && positive(state.filterRevision) &&
    data.filterRevision === state.filterRevision && positive(state.firstAnchor) && data.rowAnchor === state.firstAnchor &&
    near(data.widthVp,window.rectPx.width / window.density,1 / window.density) &&
    near(data.heightVp,window.rectPx.height / window.density,1 / window.density) && near(data.density,window.density,.01) &&
    near(data.fontScale,window.nativeFont.effectiveScale,.01) && near(data.systemFontScale,window.fontScale,.01) &&
    Array.isArray(data.labels) && data.labels.length === 1 && positive(data.revision));
}

function optionText(sample,frame,target,role,measurement) {
  const incomplete = reason=>({verdict:'NOT_RUN',reason,actual:null});
  const failed = reason=>({verdict:'FAIL',reason,actual:null});
  const buttons = sample.nodes.filter(node=>node.alias === target && node.type === 'Button');
  const [button] = buttons;
  if (buttons.length !== 1 || !ancestorsOf(sample,button).includes(frame.scroll) ||
     `source-group:${button.groupSelectionGeneration}` !== frame.selectionId)
    return incomplete(`${role} has no unique native public Button in the current group Scroll`);
  if (!contains(frame.scroll.visibleRectPx,button.rectPx) || !sameBox(button.rectPx,button.visibleRectPx))
    return incomplete(`${role} was not fully revealed in the current group Scroll`);
  const buttonVisible = effectiveAppearance(sample,button).visible;
  if (buttonVisible === null) return incomplete(`${role} native Button visibility is unavailable`);
  if (!buttonVisible) return failed(`${role} native Button is hidden inside the measured viewport`);
  const labels = sample.nodes.filter(node=>node.type === 'Text' && node.path.startsWith(button.path + '/'));
  if (labels.length === 0) return failed(`${role} is missing its native Text in the fully revealed Button`);
  if (labels.length !== 1 || labels[0].publicGroupOptionText === null || labels[0].publicGroupOptionText === undefined)
    return incomplete(`${role} lacks a unique native public Text readback`);
  if (!labels[0].publicGroupOptionText) return failed(`${role} rendered a different public option label`);
  if (!box(labels[0].rectPx)) return incomplete(`${role} lacks a measured native Text box`);
  if (!contains(button.rectPx,labels[0].rectPx)) return failed(`${role} native Text exceeds the original Button`);
  const [label] = measurement.labels;
  if (label?.role !== role) return incomplete(`${role} lacks a scoped current TextController result`);
  if (label.utf16Length !== 16) return failed(`${role} has the wrong mounted UTF-16 length`);
  return sourceTextPlacement(role,label,labels[0],sample.window,{tolerancePx:1});
}

export function evaluateSourceGroupOptionsText(assertion,context) {
  const samples = context.samples;
  const actions = context.actions;
  const base = samples['source-ready'];
  const roles = {};
  const sampleProofs = {};
  const evidenceRefs = [];
  const report = (verdict,reason,observationsComplete = verdict === 'PASS')=>{
    const observedFailure = verdict === 'NOT_RUN' && Object.values(roles).find(role=>role.verdict === 'FAIL');
    return {verdict:observedFailure ? 'FAIL' : verdict,reason:observedFailure ? observedFailure.reason : reason,
      expected:assertion.expected,actual:{sampleId:assertion.sample,textScope:sourceGroupTextScope,
        ...sampleProofs[assertion.sample],sampleProofs,roles},evidenceRefs,observationsComplete};
  };
  const append = (...items)=>evidenceRefs.push(...items.flatMap(item=>item?.evidenceRefs ?? []));
  const flow = evaluateSourceGroupOptionsScroll({...assertion,scrollAction:assertion.action,
    action:'select-tail-option',sample:'selected-tail'},context);
  append(flow);
  if (flow.verdict !== 'PASS') return report('NOT_RUN','The matching normal group Scroll and choice were not independently proven');
  const trace = context.events.filter(event=>event.instanceId === base.instanceId && event.channel === 'business');
  const before = samples[assertion.baseline];
  const projection = trace.findLast(event=>event.kind === 'source.projection' && event.eventSeq <= base.beforeSeq);
  const opening = trace.findLast(event=>event.kind === 'source.overlay' && event.payload.overlay === 'group' &&
    event.payload.phase === 'open' && event.eventSeq > actions[assertion.openAction].beforeSeq && event.eventSeq <= before.beforeSeq);
  const revision = projection?.payload.textProjectionRevision;
  const last = samples[assertion.sample];
  if (!opening || !positive(revision) || trace.some(event=>event.kind === 'source.projection' &&
      event.eventSeq > projection.eventSeq && event.eventSeq <= last.beforeSeq))
    return report('NOT_RUN','The current menu opening did not retain the original Source text projection');
  if (!fontProof(base,base,revision)) return report('NOT_RUN','The normal Source page lacks the chosen compact system-font readback');
  append(opening,projection);

  let glyphRevision = 0;
  for (const {sample:id,role,phase,target} of groupTextSamples) {
    const sample = samples[id];
    const proof = fontProof(sample,base,revision);
    const frame = sourceGroupScrollFrame(sample);
    const start = phase === 'initial' ? opening.eventSeq : actions[assertion.action].beforeSeq;
    const event = trace.findLast(item=>item.kind === sourceGroupTextEvent && item.payload.scope === sourceGroupTextScope &&
      item.payload.phase === phase && item.eventSeq > start && item.eventSeq <= sample.beforeSeq);
    append(sample,event);
    if (!proof || !frame || !currentGroupMeasurement(event,opening,projection,sample,frame) ||
        event.payload.revision <= glyphRevision)
      return report('NOT_RUN','Missing a fresh same-opening group TextController read and verified native font for the current sample');
    glyphRevision = event.payload.revision;
    const measured = optionText(sample,frame,target,role,event.payload);
    sampleProofs[id] = proof;
    roles[role] = {...measured,actual:{...measured.actual,sampleId:id}};
  }
  const values = Object.values(roles);
  const failure = values.find(result=>result.verdict === 'FAIL');
  const gap = values.find(result=>result.verdict === 'NOT_RUN');
  if (failure) return report('FAIL',failure.reason,!gap && values.every(result=>result.observationsComplete !== false));
  if (gap) return report('NOT_RUN',gap.reason);
  return report('PASS','');
}
