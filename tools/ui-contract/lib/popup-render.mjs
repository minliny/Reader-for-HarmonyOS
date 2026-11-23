const caseId = 'reading.control-more-popup';
const menuName = 'reader-control-more-menu';
const homeName = 'reader-control-module-home';
const triggerNames = ['reader-control-more','reader-control-more-short'];
// The normal input can take about 166 ms to return. Retain enough slots to
// cover both its dispatch latency and the transition through its endpoint.
const sampleCount = 37;

// The read-only preflight streams the original service response. The probe
// journal preserves only node lines whose actual RenderService PID matches.
export const popupRenderBaselineArgs = Object.freeze(['shell', [
  'set -eu',
  'pid=$(pidof io.reader.minliny)',
  'case "$pid" in ""|*[!0-9]*) exit 30;; esac',
  'printf "RS_POPUP_PID %s\\nRS_SAMPLE 0 BEGIN\\n" "$pid"',
  'hidumper -s RenderService -a RSTree',
  'test "$(pidof io.reader.minliny)" = "$pid"',
  'printf "RS_SAMPLE 0 END\\nRS_POPUP_END %s\\n" "$pid"',
].join('\n')]);

export function popupRenderOperation(contract, step, input) {
  if (contract.id !== caseId) return input;
  if (step.id === 'open-more' && input.op === 'click') return {op:'popupRenderOpen',x:input.x,y:input.y};
  if (step.id === 'close-more' && input.op === 'keyEvent' && input.key === 'Back') return {op:'popupRenderClose'};
  return input;
}

export function popupRenderArgs(operation) {
  let input;
  if (operation.op === 'popupRenderOpen' &&
    [operation.x,operation.y].every(value => Number.isInteger(value) && value >= 0 && value <= 16384)) {
    input = 'uitest uiInput click ' + operation.x + ' ' + operation.y;
  } else if (operation.op === 'popupRenderClose') input = 'uitest uiInput keyEvent Back';
  else return null;
  const {renderPid,renderSurface,renderDepth} = operation;
  if (!/^[1-9]\d{0,8}$/u.test(renderPid ?? '') || !/^[1-9]\d{0,19}$/u.test(renderSurface ?? '') ||
    (BigInt(renderSurface) >> 32n) !== BigInt(renderPid) ||
    !Number.isSafeInteger(renderDepth) || renderDepth < 1 || renderDepth > 512) return null;
  // Stream each service response to the same HDC stdout that produced the
  // admitted baseline. Only the normal input's acknowledgement is spooled,
  // so it cannot interleave with a native render slot.
  const script = [
    'set -eu',
    'pid=$(pidof io.reader.minliny)',
    'test "$pid" = '+renderPid+' || exit 32',
    'umask 077',
    'work=$(mktemp -d /data/local/tmp/reader-popup.XXXXXXXX)',
    'trap \'rm -f "$work/action"; rmdir "$work"\' EXIT',
    'printf "RS_POPUP_PID %s\\n" "$pid"',
    'printf "RS_POPUP_SURFACE %s %s\\n" '+renderSurface+' '+renderDepth,
    'take() { printf "RS_SAMPLE %s BEGIN\\n" "$1"; '+
      'hidumper -s RenderService -a RSTree || printf "RS_SAMPLE %s UNAVAILABLE\\n" "$1"; '+
      'printf "RS_SAMPLE %s END\\n" "$1"; }',
    'printf "RS_ACTION BEGIN "; date +%s%N',
    '('+input+'; printf "RS_ACTION END "; date +%s%N) > "$work/action" & action=$!',
    ...Array.from({length:sampleCount-1},(_,index)=>'take '+(index+1)),
    'wait "$action"',
    'cat "$work/action"',
    'test "$(pidof io.reader.minliny)" = "$pid"',
    'printf "RS_POPUP_END %s\\n" "$pid"',
  ].join('\n');
  return ['shell',script];
}

/** Journal only raw Reader lines and the same command's original boundaries. */
export function popupRenderJournal(stdout) {
  if (typeof stdout !== 'string') return '';
  const pid = /^RS_POPUP_PID ([1-9]\d{0,8})\r?\n/u.exec(stdout)?.[1];
  if (!pid) return '';
  const owner = BigInt(pid);
  return stdout.split(/\r?\n/u).filter(line => {
    const node = /^\s*(?:\| )?\w+_NODE\[(\d+)\]/u.exec(line);
    if (node) return (BigInt(node[1]) >> 32n) === owner;
    return /^(?:RS_POPUP_(?:PID|END) [1-9]\d{0,8}|RS_POPUP_SURFACE [1-9]\d{0,19} [1-9]\d{0,2}|RS_POPUP_BASELINE_UNAVAILABLE|RS_SAMPLE \d+ (?:BEGIN|END|UNAVAILABLE)|RS_ACTION (?:BEGIN|END) \d{19}|No Error)$/u.test(line);
  }).join('\n')+'\n';
}

function propertyNumber(text,key) {
  const match = new RegExp('\\b'+key+'\\[([^\\]]+)\\]','u').exec(text);
  return match && /^\d+(?:\.\d+)?$/u.test(match[1]) ? Number(match[1]) : undefined;
}

function parseTree(lines,pid) {
  const stack = [];
  const nodes = [];
  for (const line of lines) {
    const node = /^( +)\| (\w+)_NODE\[(\d+)\], instanceRootNodeId\[(\d+)\].*?VsyncId: (\d+).*?Properties: (.*?)RSUIContextToken: \[\s*([\d ]+)\s*\], nodeName: \[([^\]]*)\]/u.exec(line);
    if (!node) continue;
    const [,indent,type,id,root,vsync,properties,token,name] = node;
    if ((BigInt(id) >> 32n) !== BigInt(pid) || !token.trim().split(/ +/u).includes(root)) return null;
    while (stack.length && stack.at(-1).depth >= indent.length) stack.pop();
    const alpha = propertyNumber(properties,'Alpha');
    if (properties.includes('Alpha[') && (alpha === undefined || alpha > 1)) return null;
    // The native property printer omits the default. Use it only when this
    // node's original Reader modifier explicitly identifies the value as 1.
    const defaultAlpha = new RegExp('pid:'+pid+'->Alpha:\\[1(?:\\.0+)?\\]','u').test(line) ? 1 : undefined;
    const bounds = /Bounds\[(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)\]/u.exec(properties)?.slice(1).map(Number);
    const layout = /\bFrame\[(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)\]/u.exec(properties)?.slice(1).map(Number);
    const observed = {id, root, type, name, depth:indent.length, vsync:Number(vsync), alpha:alpha ?? defaultAlpha,
      alphaExplicit:alpha !== undefined, bounds, layout, clipped:/ClipTo(?:Frame|Bounds)\[True\]/u.test(properties),
      parent:stack.at(-1)?.id ?? null,
      readerSurface:type === 'SURFACE' && /abilityState: foreground\b.*?, Name \[minliny\d*\].*?\bVisible: 1,/u.test(line)};
    if (!Number.isSafeInteger(observed.vsync) || observed.vsync < 0) return null;
    nodes.push(observed);
    stack.push(observed);
  }
  if (!nodes.length || new Set(nodes.map(node => node.id)).size !== nodes.length) return null;
  return nodes;
}

function menuLayout(menu,root,byId) {
  if (!menu.layout?.every(Number.isFinite)) return undefined;
  const rect = [0,0,menu.layout[2],menu.layout[3]];
  let node = menu;
  // Compare layout to layout. innerAbsDrawRect also contains compositor
  // translation and clipping, and therefore belongs to a different space.
  while (node && node.id !== root.id) {
    if (!node.layout?.every(Number.isFinite)) return undefined;
    rect[0] += node.layout[0];
    rect[1] += node.layout[1];
    node = byId.get(node.parent);
  }
  return node?.id === root.id ? rect : undefined;
}

function popupSample(lines,pid) {
  const nodes = parseTree(lines,pid);
  if (!nodes) return null;
  const surfaces = nodes.filter(node => node.readerSurface && node.id === node.root && node.parent === null);
  const [surface] = surfaces;
  if (surfaces.length !== 1) return null;
  const roots = nodes.filter(node => node.type === 'ROOT' && node.parent === surface.id);
  const [root] = roots;
  const homes = nodes.filter(node => node.name === homeName && node.root === surface.id);
  const triggers = nodes.filter(node => triggerNames.includes(node.name) && node.root === surface.id);
  if (roots.length !== 1 || homes.length !== 1 || triggers.length !== 1) return null;
  const base = {surface:surface.id, root:root.id, home:homes[0].id, trigger:triggers[0].id,
    triggerName:triggers[0].name, surfaceVsync:surface.vsync, surfaceDepth:surface.depth};
  const menus = nodes.filter(node => node.name === menuName);
  if (menus.length === 0) return {...base,menu:null,host:null};
  const [menu] = menus;
  if (menus.length !== 1 || menu.root !== surface.id || !menu.clipped ||
      !menu.bounds?.slice(2).every(value => Number.isFinite(value) && value > 0)) return null;
  const byId = new Map(nodes.map(node => [node.id,node]));
  let host = menu;
  while (host && host.parent !== root.id) host = byId.get(host.parent);
  if (!host || host === menu || host.type !== 'CANVAS' || !host.clipped || host.alpha === undefined ||
    !host.bounds?.slice(2).every(value => Number.isFinite(value) && value > 0) ||
    !root.bounds || host.bounds[2] !== root.bounds[2] || host.bounds[3] !== root.bounds[3]) return null;
  for (let branch of [homes[0],triggers[0]]) {
    while (branch && branch.parent !== root.id) branch = byId.get(branch.parent);
    if (!branch || branch === host) return null;
  }
  return {...base,menu:menu.id,host:host.id,alpha:host.alpha,alphaExplicit:host.alphaExplicit,
    hostVsync:host.vsync,menuRect:menuLayout(menu,root,byId)};
}

function popupRenderEnvelope(stdout) {
  if (typeof stdout !== 'string') return undefined;
  const text = stdout.trim().split(/\r?\n/u);
  const pid = /^RS_POPUP_PID ([1-9]\d{0,8})$/u.exec(text.shift())?.[1];
  if (!pid || text.pop() !== 'RS_POPUP_END '+pid) return undefined;
  return {pid,text};
}

function readSlot(text,index) {
  if (text.shift() !== 'RS_SAMPLE '+index+' BEGIN') return undefined;
  const end = text.indexOf('RS_SAMPLE '+index+' END');
  if (end < 0) return undefined;
  const lines = text.splice(0,end);
  text.shift();
  return lines;
}

export function popupRenderBaselineAcknowledged(stdout) {
  const envelope = popupRenderEnvelope(stdout);
  return Boolean(envelope && readSlot(envelope.text,0) && envelope.text.length === 0);
}

export function preparePopupRender(stdout,input) {
  const envelope = popupRenderEnvelope(stdout);
  const lines = envelope && readSlot(envelope.text,0);
  if (!lines || envelope.text.length) return {reason:'RenderService did not return a complete pre-action baseline envelope'};
  if (!lines.length) return {reason:'RenderService baseline has no nodes for the exact live Reader process'};
  const sample = popupSample(lines,envelope.pid);
  if (!sample) return {reason:'RenderService baseline lacks a unique native foreground Reader surface, root, Home/More, or Popup host'};
  if (input.op === 'popupRenderOpen' ? sample.menu !== null :
    !sample.menu || !sample.host || !(sample.alpha >= .98)) {
    return {reason:'RenderService baseline does not show the required closed or fully presented Popup before this input'};
  }
  return {sample,operation:{...input,renderPid:envelope.pid,renderSurface:sample.surface,renderDepth:sample.surfaceDepth}};
}

function readActionBounds(text) {
  const surface = /^RS_POPUP_SURFACE ([1-9]\d{0,19}) ([1-9]\d{0,2})$/u.exec(text.shift())?.slice(1);
  const started = /^RS_ACTION BEGIN (\d{19})$/u.exec(text.shift())?.[1];
  const ended = /^RS_ACTION END (\d{19})$/u.exec(text.pop())?.[1];
  if (!surface || !started || !ended || text.pop() !== 'No Error' ||
    BigInt(ended) <= BigInt(started) || BigInt(ended)-BigInt(started) > 2_000_000_000n ||
    text.some(line=>line.startsWith('RS_ACTION ') || line === 'No Error')) return undefined;
  return surface;
}

/** Replays the retained preflight and real compositor samples from the action. */
export function readPopupRender(stdout, operation, baseline) {
  if (!popupRenderArgs(operation) || baseline?.surface !== operation.renderSurface) return null;
  const envelope = popupRenderEnvelope(stdout);
  if (envelope?.pid !== operation.renderPid) return null;
  const {pid,text} = envelope;
  const surface = readActionBounds(text);
  if (surface?.[0] !== operation.renderSurface || Number(surface[1]) !== operation.renderDepth) return null;
  const samples = [baseline];
  for (let index=1;index<sampleCount;index++) {
    const lines = readSlot(text,index);
    if (!lines) return null;
    // A failing read may still print a partial tree. Preserve the raw lines
    // but count that slot as unavailable even if they resemble a full sample.
    samples.push(lines.includes('RS_SAMPLE '+index+' UNAVAILABLE') ? null : popupSample(lines,pid));
  }
  return text.length ? null : {pid,samples,direction:operation.op === 'popupRenderOpen' ? 'open' : 'close'};
}

export function popupRenderAcknowledged(stdout) {
  const envelope = popupRenderEnvelope(stdout);
  return Boolean(envelope && readActionBounds(envelope.text));
}

const identityFields = ['surface','root','home','trigger','triggerName'];
const sameContext = (left,right) => identityFields.every(field => left?.[field] === right?.[field]);
const samePopup = (left,right) => sameContext(left,right) && left.menu === right.menu && left.host === right.host;

export function popupRenderPath(open,close,expected,trigger) {
  const capture = expected.visible ? open : close;
  if (!capture || !open || open.direction !== 'open' || (!expected.visible && close.direction !== 'close')) return null;
  const source = open.samples[0];
  const opened = open.samples.findLast(sample => sample?.menu);
  const baseline = capture.samples[0];
  if (!source || !opened?.menu || !opened.host || !baseline) return null;
  if (open.pid !== capture.pid || source.triggerName !== trigger || source.menu !== null ||
    !capture.samples.every(sample => !sample || sameContext(sample,opened)) ||
    !open.samples.every(sample => !sample || sameContext(sample,opened)) ||
    (!expected.visible && (!samePopup(baseline,opened) || baseline.alpha < 1-expected.opacityTolerance))) {
    return {coverage:null,path:false,reason:'compositor-owner-mismatch'};
  }
  // The stable pre-action tree establishes ownership. Its cached VSync must
  // not stand in for a presented frame collected after the normal input.
  const first = capture.samples.findIndex((sample,index) => index > 0 && sample?.menu);
  const last = capture.samples.findLastIndex(sample => sample?.menu);
  if (first < 0) return null;
  const mounted = capture.samples.slice(first,last+1);
  const hostChanged = mounted.some(sample => sample?.menu && !samePopup(sample,opened));
  if (hostChanged) return {coverage:null,path:false,reason:'compositor-popup-replaced'};
  const measured = mounted.filter(sample => sample && samePopup(sample,opened));
  const frames = measured.filter((sample,index) => index === 0 || sample.hostVsync !== measured[index-1].hostVsync);
  const vl = frames.map(sample => sample.hostVsync);
  const gaps = vl.slice(1).map((value,index) => value-vl[index]);
  const opacity = frames.map(sample => sample.alpha);
  const tolerance = expected.opacityTolerance;
  const trend = expected.visible ? 1 : -1;
  const moves = opacity.slice(1).map((value,index) => trend*(value-opacity[index]));
  const end = opacity.at(-1);
  const terminal = capture.samples.at(-1);
  const hasEndpoint = expected.visible ? Boolean(terminal?.menu && samePopup(terminal,opened) && end >= 1-tolerance) :
    end <= tolerance && terminal?.menu === null;
  const stableSameFrame = measured.every((sample,index) => index === 0 ||
    sample.hostVsync !== measured[index-1].hostVsync || sample.alpha === measured[index-1].alpha);
  const scoped = capture.samples.filter(Boolean);
  const orderedSurface = scoped.every((sample,index) => index === 0 || sample.surfaceVsync >= scoped[index-1].surfaceVsync);
  const coverage = frames.length >= 3 && mounted.length === measured.length && stableSameFrame &&
    orderedSurface && gaps.every(gap => gap > 0 && gap <= expected.cadenceGapFactor);
  const provesMotion = coverage && hasEndpoint && opacity.slice(1,-1).some(alpha => alpha > tolerance && alpha < 1-tolerance) &&
    Math.max(...opacity)-Math.min(...opacity) > tolerance;
  return {coverage:coverage ? true : null,path:provesMotion ? moves.every(move => move >= -tolerance) &&
      trend*(end-opacity[0]) > tolerance : null, actor:opened.host, menu:opened.menu, vsyncIds:vl, gaps,
    opacity, explicitOpacity:frames.map(frame => frame.alphaExplicit), endpoint:hasEndpoint, stableSameFrame,
    orderedSurface, missingSlots:capture.samples.flatMap((sample,index) => sample ? [] : [index]),
    measuredSamples:frames.length, menuRect:opened.menuRect};
}
