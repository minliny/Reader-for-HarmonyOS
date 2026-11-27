export const LAYOUT_MARKER = 'READER_LAYOUT_INVARIANTS ';
export const TRANSITION_MARKER = 'READER_TRANSITION_INVARIANTS ';
export const FRAME_MARKER = 'READER_TRANSITION_FRAMES ';
const TRANSITION_BEGIN_MARKER = 'READER_TRANSITION_BEGIN ';
export const SHARE_MARKER = 'READER_JOURNEY_SHARE ';

export function verticalSwipeLane(viewport, fromY, toY, obstructions) {
  const [left, , right] = viewport;
  const middle = Math.round((left + right) / 2);
  const top = Math.min(fromY, toY);
  const bottom = Math.max(fromY, toY);
  const margin = 4;
  const start = left + margin;
  const end = right - margin;
  if (start > end) return undefined;
  const blocked = obstructions.filter(box => box[1] <= bottom && box[3] >= top)
    .map(box => [Math.max(start, box[0] - margin), Math.min(end, box[2] + margin)])
    .filter(([first, last]) => first <= last)
    .sort((a, b) => a[0] - b[0]);
  if (!blocked.some(([first, last]) => first <= middle && middle <= last)) return middle;

  let cursor = start;
  let bestWidth = 0;
  let lane;
  for (const [first, last] of [...blocked, [end + 1, end + 1]]) {
    const width = first - cursor;
    if (width > bestWidth) {
      bestWidth = width;
      lane = Math.floor(cursor + (width - 1) / 2);
    }
    cursor = Math.max(cursor, last + 1);
  }
  return lane;
}

export const supportedVmDimensions = {
  material: { values: ['native', 'performance'], control: 'Reader settings', observe: 'effective material policy' },
  motion: { values: ['standard', 'reduced'], control: 'Reader settings', observe: 'effective motion preference' },
  scheme: { values: ['day', 'night'], control: 'Reader settings', observe: 'effective App scheme' },
  readingMode: { values: ['paged', 'continuous'], control: 'reading settings', observe: 'native stage identity' },
  fontScale: { values: ['actual', '1.6', '2.0'], control: 'requires provisioned VM or physical device', observe: 'native metrics' },
  window: { values: ['actual', 'portrait', 'landscape', 'narrow'], control: 'requires provisioned VM or physical device', observe: 'native metrics' },
};

export function vmJourneyMatrix(values) {
  const options = new Map([
    ['material', values.material], ['motion', values.motion], ['scheme', values.scheme],
    ['readingMode', values['reading-mode']], ['fontScale', values['font-scale']], ['window', values.window],
  ]);
  let profiles = [{}];
  for (const [dimension, option] of options) {
    if (option === undefined) continue;
    const choices = [...new Set(option.split(',').map(value => value.trim()))];
    if (choices.some(value => !supportedVmDimensions[dimension].values.includes(value))) {
      throw Error(`Invalid ${dimension} matrix values: ${option}`);
    }
    profiles = profiles.flatMap(profile => choices.map(value => ({ ...profile, [dimension]: value })));
    if (profiles.length > 32) throw Error('Select at most 32 VM matrix profiles per invocation');
  }
  return profiles.map(dimensions => ({
    id: Object.entries(dimensions).map(([name, value]) => `${name}-${value}`).join('_') || 'observed-default',
    dimensions,
  }));
}

export function matchesVmEnvironment(profile, report) {
  const expected = profile.dimensions;
  const environment = report.environment;
  if (!environment || !Number.isFinite(environment.fontScale) || !Number.isFinite(environment.widthVp) ||
    !Number.isFinite(environment.heightVp) || environment.widthVp <= 0 || environment.heightVp <= 0 ||
    typeof environment.reducedMotion !== 'boolean' || !['native', 'fallback', 'performance'].includes(environment.material) ||
    !['day', 'night'].includes(report.scheme)) return ['缺少完整的原生环境回执'];
  const mismatches = [];
  if (expected.material && expected.material !== environment.material) mismatches.push('材质模式');
  if (expected.motion && (expected.motion === 'reduced') !== environment.reducedMotion) mismatches.push('减弱动效');
  if (expected.scheme && expected.scheme !== report.scheme) mismatches.push('应用主题');
  if (expected.fontScale && expected.fontScale !== 'actual' &&
    Math.abs(Number(expected.fontScale) - environment.fontScale) > .05) mismatches.push('系统字号需要对应配置的 VM 或真机');
  const { widthVp, heightVp } = environment;
  const windowMatches = expected.window === 'portrait' ? heightVp >= widthVp :
    expected.window === 'landscape' ? widthVp > heightVp : expected.window === 'narrow' ? widthVp <= 320 : true;
  if (!windowMatches) mismatches.push('窗口尺寸需要对应配置的 VM 或真机');
  return mismatches;
}

export function records(text, marker) {
  return String(text).split(/\r?\n/).flatMap(line => {
    const index = line.indexOf(marker);
    const pid = index < 0 ? undefined : /\s(\d+)\s+\d+\s+[VDIWEF]\s/u.exec(line.slice(0, index))?.[1];
    return pid ? [{ pid, line, payload: line.slice(index + marker.length) }] : [];
  });
}

function parse(payload) {
  try { return JSON.parse(payload); } catch { return undefined; }
}

export function layoutReports(text, pid) {
  return records(text, LAYOUT_MARKER).filter(row => row.pid === pid).map(row => parse(row.payload))
    .filter(row => row?.schemaVersion === 2 && Number.isSafeInteger(row.sequence) && row.sequence > 0)
    .sort((a, b) => a.sequence - b.sequence);
}

/** Includes recordings already in flight when a new action is about to dispatch. */
export function transitionWatermark(text, pid, reports) {
  let sequence = reports.at(-1)?.sequence ?? 0;
  for (const row of records(text, TRANSITION_BEGIN_MARKER)) {
    if (row.pid !== pid || !/^[1-9]\d*$/.test(row.payload)) continue;
    const begin = Number(row.payload);
    if (Number.isSafeInteger(begin)) sequence = Math.max(sequence, begin);
  }
  return sequence;
}

export function shareReports(text, pid) {
  return records(text, SHARE_MARKER).filter(row => row.pid === pid).flatMap(row => {
    const match = /^([1-9]\d*) (presented|dismissed|shown|unavailable|unsafe)$/u.exec(row.payload.trim());
    if (!match || !Number.isSafeInteger(Number(match[1]))) return [];
    return [{ operationId: Number(match[1]), state: match[2] }];
  });
}

export function transitionReports(text, pid) {
  const chunks = new Map();
  for (const row of records(text, FRAME_MARKER).filter(row => row.pid === pid)) {
    const match = /^(\d+)\/(\d+)\/(\d+) ([\s\S]*)$/u.exec(row.payload);
    if (!match) continue;
    const sequence = Number(match[1]);
    const index = Number(match[2]);
    const count = Number(match[3]);
    if (count < 1 || count > 512 || index < 0 || index >= count) continue;
    const entry = chunks.get(sequence) ?? { count, parts: new Map(), inconsistent: false };
    if (entry.count !== count || (entry.parts.has(index) && entry.parts.get(index) !== match[4])) entry.inconsistent = true;
    entry.parts.set(index, match[4]);
    chunks.set(sequence, entry);
  }
  return records(text, TRANSITION_MARKER).filter(row => row.pid === pid).map(row => parse(row.payload))
    .filter(row => row?.schemaVersion === 1 && Number.isSafeInteger(row.sequence) && row.sequence > 0)
    .map(row => {
      const entry = chunks.get(row.sequence);
      const frameReport = !entry || entry.inconsistent || entry.parts.size !== entry.count ? undefined :
        parse(Array.from({ length: entry.count }, (_, index) => entry.parts.get(index)).join(''));
      return { ...row, frames: frameReport?.sequence === row.sequence && Array.isArray(frameReport.frames) ? frameReport.frames : [] };
    }).sort((a, b) => a.sequence - b.sequence);
}

export function matchingTransitions(reports, afterSequence, expected) {
  return reports.filter(row => row.sequence > afterSequence &&
    (expected.kind === undefined || expected.kind === row.kind) &&
    (expected.action === undefined || expected.action === row.action) &&
    (expected.subject === undefined || expected.subject === row.subject) &&
    (expected.route === undefined || expected.route === row.route));
}

export function transitionReceiptProblem(receipt, requiredRules) {
  if (receipt.status !== 'measured' || !Array.isArray(receipt.missing) || receipt.missing.length ||
    !Array.isArray(receipt.violations) || receipt.violations.length) return '原生逐帧回执存在违规或缺失';
  if (!Array.isArray(receipt.frames) || receipt.frames.length < 2 || receipt.frames.length !== receipt.frameCount) return '逐帧分片不完整';
  if (receipt.frames.some((frame, index) => !Number.isFinite(frame?.atMs) || frame.atMs < 0 ||
    !Array.isArray(frame.nodes) || !Array.isArray(frame.unreadableIds) ||
    (index > 0 && frame.atMs < receipt.frames[index - 1].atMs))) return '逐帧样本格式或采样顺序无效';
  if (!Array.isArray(receipt.observedRules) || requiredRules.some(rule => !receipt.observedRules.includes(rule))) {
    return '逐帧回执未观察到要求的 T 规则';
  }
  return '';
}

export function layoutReceiptProblem(receipt, outcome) {
  if (receipt?.status !== 'measured' || !Array.isArray(receipt.violations) || receipt.violations.length ||
    !Array.isArray(receipt.missing) || receipt.missing.length) return '原生布局回执存在违规或缺失';
  const rules = outcome.requiredRules ?? [];
  if (!Array.isArray(receipt.observedRules) || rules.some(rule => !receipt.observedRules.includes(rule))) return '缺少要求的 R 规则';
  if (rules.includes('R13') && receipt.nativeAudit?.complete !== true) return '缺少已完成的原生树扫描';
  const features = outcome.features ?? [];
  if (features.length && (!Array.isArray(receipt.features) ||
    features.some(id => !receipt.features.some(feature => feature.id === id && feature.state === 'pass')))) {
    return '缺少要求的原生功能强断言';
  }
  return '';
}
