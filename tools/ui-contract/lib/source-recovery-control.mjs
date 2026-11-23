import { ancestorsOf } from './layout.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';
import { sourceReadObservation } from './source-read.mjs';

const branches = {original:['reconcile','continue','expand'], unknown:['reconcile','expand']};
const overlay = 'reader-source-pending-recovery';
const signs = ['canReconcile','canContinue','busy'];

export function sourceRecoveryControl(target) {
  const match = /^reader-source-(original|unknown)-(reconcile|continue|expand)$/u.exec(target);
  if (!match || !branches[match[1]].includes(match[2])) return undefined;
  const [,branch,control] = match;
  return {branch,control,host:`reader-source-${branch}-recovery`};
}

export function evaluateSourceRecoveryControl(assertion, context) {
  const {target} = assertion.expected;
  const {branch,control,host} = sourceRecoveryControl(target);
  const opening = sourceReadObservation(assertion, context);
  const {sample,entry,current} = opening ?? {};
  const window = sample?.window;
  const projection = current?.payload;
  const facts = projection?.recovery;
  let title;
  const report = (verdict,reason,applicability,actual = {}) => ({
    verdict,reason,expected:assertion.expected,
    actual:{applicability,branch,control,...actual},
    evidenceRefs:[...sample?.evidenceRefs ?? [], ...context.actions?.[assertion.action]?.evidenceRefs ?? [],
      ...[entry,current,title].flatMap(event => event?.evidenceRefs ?? [])],
  });
  const unknown = reason => report('NOT_RUN',reason,'UNKNOWN');
  if (!projection || typeof projection.readFact !== 'string' || projection.readFact.length === 0 ||
      sample?.captureComplete !== true || !Array.isArray(sample.nodes) || window?.source !== 'window-metrics' ||
      window.keyboard?.visible !== false || window.keyboard.revision !== window.revision ||
      context.problems?.length || context.sampleReadiness?.[assertion.sample]) {
    return unknown('No complete settled Source opening and native window with IME hidden');
  }
  const recovery = projection.state === 'recovery';
  if (recovery !== (facts !== undefined) || (recovery &&
      (!facts || !Object.hasOwn(branches,facts.branch) || !Number.isSafeInteger(facts.generation) ||
       facts.generation <= 0 || !signs.every(key => typeof facts[key] === 'boolean')))) {
    return unknown('The current Source opening has no exact recovery branch and generation');
  }
  if (!recovery && (projection.state === 'loading' || projection.readFact === 'idle')) {
    return unknown('Source opening has not settled its pending-operation state');
  }

  let eligible = false;
  let allowDisabled = false;
  if (recovery && facts.branch === branch) {
    if (control === 'expand') {
      title = (context.events ?? []).findLast(event => event.kind === 'source.recovery-title' &&
        event.channel === 'business' && event.instanceId === sample.instanceId &&
        event.eventSeq > entry.eventSeq && event.eventSeq <= sample.beforeSeq);
      const payload = title?.payload;
      if (title?.windowRevision !== window.revision || payload?.branch !== branch ||
          payload?.generation !== facts.generation || payload?.owner?.mounting !== projection.owner.mounting ||
          payload.owner.generation !== projection.owner.generation || !['clipped','fits'].includes(payload?.title)) {
        return unknown('No current native title measurement for this recovery and window');
      }
      eligible = payload.title === 'clipped';
    } else {
      const allowed = control === 'continue' ? facts.canContinue : facts.canReconcile;
      eligible = allowed && !facts.busy;
      allowDisabled = facts.busy && (control === 'reconcile' || allowed);
    }
  }
  const native = sample.nodes.filter(node => node.source === 'native-tree' && node.id === target);
  const [node] = native;
  const ancestors = node ? ancestorsOf(sample,node) : [];
  const hosts = ancestors.filter(parent => parent.id === host);
  const overlays = ancestors.filter(parent => parent.id === overlay);
  const scoped = native.length === 1 && node.type === 'Button' && hosts.length === 1 && overlays.length === 1 &&
    ancestors.indexOf(hosts[0]) < ancestors.indexOf(overlays[0]);

  if (!eligible) {
    if (!node || allowDisabled && scoped && node.enabled === false)
      return report('NOT_RUN','This recovery control did not apply in the verified native opening','DOES_NOT_APPLY');
    if (allowDisabled && scoped && typeof node.enabled !== 'boolean')
      return unknown('The busy native recovery control has no enabled state');
    return report('FAIL','An unavailable recovery control was present or enabled in the native opening','APPLIES');
  }
  if (!scoped) {
    return report('FAIL','The applicable native recovery Button is missing, duplicated or outside its owning notice','APPLIES');
  }
  const measured = measureSourceNativeControl(sample,target);
  return report(measured.verdict,measured.reason,'APPLIES',{sampleId:sample.sampleId,nativeTouchTarget:measured.actual});
}
