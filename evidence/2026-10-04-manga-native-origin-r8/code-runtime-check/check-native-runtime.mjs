import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

// File-only business evidence adapter. No device, image, cache, subprocess or
// transport ports. Run only after Root supplies the bounded runtime evidence.
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--manifest', '--session', '--a', '--b', '--d', '--metadata', '--validator', '--output'].includes(key) ||
      !process.argv[i + 1] || args.has(key)) throw Error('Expected unique declared --key path pairs');
  args.set(key, resolve(process.argv[i + 1]));
}
for (const key of ['--manifest', '--session', '--a', '--b', '--d', '--metadata', '--validator'])
  if (!args.has(key)) throw Error(`Required argument ${key}`);
const bytes = path => readFileSync(path);
const json = path => JSON.parse(bytes(path).toString('utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const result = (status, reason, detail = {}) => ({ status, reason, ...detail });
const combine = checks => checks.some(c => c.status === 'FAIL') ? 'FAIL' :
  checks.some(c => c.status === 'OPEN') ? 'OPEN' : 'PASS';
const meta = json(args.get('--metadata'));
if (!Number.isSafeInteger(meta.pid) || meta.pid <= 0 || !finite(meta.guestEpochStartSeconds) ||
    meta.guestEpochStartSeconds <= 0 || typeof meta.manifestRunId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(meta.signedHapSha256 ?? '')) throw Error('Fixed PID/guest epoch/run/HAP metadata is required');

const manifestPath = args.get('--manifest'), manifest = json(manifestPath);
const signed = manifest.artifacts?.find(a => a.kind === 'signed');
const snapshotName = manifest.source?.buildInputs?.snapshot;
if (snapshotName !== 'source-snapshot.json') throw Error('Canonical source-snapshot.json required');
const snapshotPath = join(dirname(manifestPath), snapshotName), snapshot = json(snapshotPath);
const validatorPath = args.get('--validator'), validatorBytes = bytes(validatorPath);
const validatorRelative = 'entry/src/main/ets/features/manga/MangaImageOriginGeometry.ts';
const validatorRecord = snapshot.files?.find(f => f.path === validatorRelative);
const manifestCheck = manifest.schemaVersion === 2 && manifest.name === 'reader-harmonyos-hap-run' &&
  manifest.runId === meta.manifestRunId && signed?.sha256 === meta.signedHapSha256 &&
  signed?.signature?.status === 'signed' && signed.signature.verified === true && manifest.gates?.arktsTypeCheck === 'PASS' &&
  snapshot.fingerprint === manifest.source.buildInputs.fingerprint && validatorRecord?.type === 'file' &&
  validatorRecord.sha256 === sha(validatorBytes) && validatorRecord.bytes === validatorBytes.length ?
  result('PASS', 'manifest-and-production-validator-bound') : result('FAIL', 'manifest-or-validator-binding-mismatch');
// Execute the actual production function; never use the reported destinationStatus
// as the verdict. The TS module is imported only if it is bound to this manifest.
let checkGeometry;
if (manifestCheck.status === 'PASS') {
  const production = await import(pathToFileURL(validatorPath).href + `?sha256=${sha(validatorBytes)}`);
  checkGeometry = production.checkMangaImageOriginGeometry;
  if (typeof checkGeometry !== 'function') throw Error('Production geometry validator export missing');
}

const rect = text => {
  const m = typeof text === 'string' && text.match(/^\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]$/);
  if (!m) return undefined;
  const r = m.slice(1).map(Number);
  return r.every(finite) && r[2] > r[0] && r[3] > r[1] ? r : undefined;
};
const sameRect = (a, b, tolerance = 0.5) => Boolean(a && b && a.every((v, i) => Math.abs(v - b[i]) <= tolerance));
const actor = a => a.hashcode || (a.accessibilityId ? `${a.hostWindowId ?? ''}:${a.accessibilityId}` : undefined);
function inspectTree(path) {
  const tree = json(path), nodes = [];
  function walk(node, parents = []) {
    if (!node || typeof node !== 'object') return;
    const a = node.attributes ?? {};
    nodes.push({ a, parents });
    for (const child of node.children ?? []) walk(child, [...parents, a]);
  }
  walk(tree);
  const roots = nodes.filter(n => n.a.type === 'root' && n.a.bundleName === 'io.reader.minliny' &&
    n.a.pagePath === 'pages/Index' && n.a.abilityName === 'EntryAbility');
  if (!roots.length) return { check: result('FAIL', 'reader-bundle-page-root-missing'), rows: [] };
  if (roots.length !== 1) return { check: result('OPEN', 'reader-root-not-unique'), rows: [] };
  const root = roots[0], top = tree.attributes ?? {};
  // The empty UITest wrapper is the independent screen frame in these raw
  // dumps. Reader-root bounds itself may be clipped under visible controls.
  const wrapperFrame = top.type === '' && root.parents.includes(top) ? rect(top.bounds) : undefined;
  const window = wrapperFrame && wrapperFrame[0] === 0 && wrapperFrame[1] === 0 ? wrapperFrame : undefined;
  const originalRoot = rect(root.a.origBounds);
  const visibleWindow = rect(tree.attributes?.bounds), visibleReaderRoot = rect(root.a.bounds);
  const frames = { window, windowFrameSource: window ? 'empty-UITest-wrapper-bounds' : undefined,
    originalReaderRoot: originalRoot, visibleWindow, visibleReaderRoot };
  if (!window || !originalRoot) return { check: result('OPEN', 'independent-wrapper-or-reader-original-geometry-missing'), rows: [], ...frames };
  if (!sameRect(window, originalRoot) || window[0] !== 0 || window[1] !== 0)
    return { check: result('FAIL', 'reader-original-window-not-full'), rows: [], ...frames };
  const rows = nodes.filter(n => n.parents.includes(root.a) && n.a.type === 'Image' && n.a.visible === 'true' && Number(n.a.opacity) > 0 &&
    n.parents.some(p => p.type === 'ListItem')).map(n => {
    const list = [...n.parents].reverse().find(p => p.type === 'List');
    const scroll = [...n.parents].reverse().find(p => p.type === 'Scroll');
    const item = [...n.parents].reverse().find(p => p.type === 'ListItem');
    return { id: actor(n.a), original: rect(n.a.origBounds), visibleBounds: rect(n.a.bounds),
      itemId: actor(item ?? {}), item: rect(item?.origBounds),
      listId: actor(list ?? {}), list: rect(list?.origBounds), scrollId: actor(scroll ?? {}), scroll: rect(scroll?.origBounds) };
  }).filter(r => r.original && r.original[3] > window[1] && r.original[1] < window[3]);
  if (!rows.length || rows.some(r => !r.id || !r.item || !r.list || !r.scroll))
    return { check: result('OPEN', 'image-or-ancestor-original-geometry-missing'), rows, ...frames };
  rows.sort((a, b) => a.original[1] - b.original[1]);
  if (rows.some(r => !sameRect(r.list, window) || !sameRect(r.scroll, window) || !sameRect(r.item, r.original)))
    return { check: result('FAIL', 'image-row-or-scroll-list-layout-mismatch'), rows, ...frames };
  let covered = window[1];
  for (const row of rows) {
    const r = row.original;
    if (r[0] > window[0] + 0.5 || r[2] < window[2] - 0.5 || r[1] > covered + 0.5)
      return { check: result('FAIL', 'image-original-layout-gap'), rows, ...frames };
    covered = Math.max(covered, r[3]);
  }
  if (covered < window[3] - 0.5) return { check: result('FAIL', 'bottom-tile-does-not-cover-window'), rows, ...frames };
  return { check: result('PASS', 'image-original-layout-covers-full-window'), rows, ...frames,
    first: rows[0], bottom: rows.find(r => r.original[1] < window[3] && r.original[3] >= window[3] - 0.5) };
}
const trees = Object.fromEntries(['a', 'b', 'd'].map(label => [label, inspectTree(args.get(`--${label}`))]));
// In immersive A/D, visible edge coverage is an additional geometry claim.
// B's system-control clipping is kept in the report and cannot mean reflow.
const immersiveVisibleEdges = Object.fromEntries(['a', 'd'].map(label => {
  const t = trees[label];
  if (t.check.status !== 'PASS' || !t.first?.visibleBounds || !t.bottom?.visibleBounds)
    return [label, result('OPEN', 'immersive-visible-edge-geometry-missing')];
  const covers = (r, y) => r[0] <= t.window[0] + 0.5 && r[2] >= t.window[2] - 0.5 &&
    r[1] <= y + 0.5 && r[3] >= y - 0.5;
  return [label, covers(t.first.visibleBounds, t.window[1]) && covers(t.bottom.visibleBounds, t.window[3]) ?
    result('PASS', 'immersive-visible-image-edges-cover-window') : result('FAIL', 'immersive-visible-image-edge-gap')];
}));
let stable = result('OPEN', 'tree-layout-incomplete');
if (Object.values(trees).every(t => t.check.status === 'PASS')) {
  const baseline = trees.a;
  const mismatches = [];
  for (const label of ['b', 'd']) {
    const current = trees[label];
    if (!sameRect(current.window, baseline.window)) mismatches.push(`${label}:window`);
    if (current.rows.length !== baseline.rows.length) mismatches.push(`${label}:visible-row-count`);
    for (const row of baseline.rows) {
      const found = current.rows.find(r => r.id === row.id);
      if (!found || !sameRect(found.original, row.original) || found.itemId !== row.itemId ||
          found.listId !== row.listId || found.scrollId !== row.scrollId) mismatches.push(`${label}:actor-or-original-layout`);
    }
  }
  stable = mismatches.length ? result('FAIL', 'A-B-D-image-original-layout-changed', { mismatches }) :
    result('PASS', 'same-image-row-list-scroll-actors-and-original-layout-A-B-D');
}

const native = [], ignored = { otherPidOrUnparsedPrefix: 0, beforeStart: 0, baseline: 0,
  outsideProbe: 0, duplicate: 0, malformed: 0 };
const seen = new Set(), requests = [], baseline = new Set(), observedPids = [], observedEpochs = [];
let currentOperation, stopBeforeStart = false, probeStarts = 0, probeActive = false, baselineLogRequested = false;
for (const line of bytes(args.get('--session')).toString('utf8').split(/\r?\n/)) {
  if (line.startsWith('{')) {
    try {
      const command = JSON.parse(line);
      if (command.operation) {
        requests.push(command); currentOperation = command.operation.op;
        if (currentOperation === 'log' && probeStarts === 0) baselineLogRequested = true;
        if (currentOperation === 'stop') {
          if (probeStarts === 0) stopBeforeStart = true;
          else probeActive = false;
        }
        if (currentOperation === 'startProbe') { probeStarts++; probeActive = probeStarts === 1; }
      }
    } catch {}
  }
  if (probeActive && /^\d+$/.test(line.trim())) {
    if (currentOperation === 'readerPid') observedPids.push(Number(line.trim()));
    if (currentOperation === 'guestEpoch') observedEpochs.push(Number(line.trim()));
  }
  const marker = 'READER_MANGA_GEOMETRY ', at = line.indexOf(marker);
  if (at < 0) continue;
  // Default HiLog prefix: MM-DD HH:mm:ss.mmm PID TID LEVEL TAG. Do not
  // infer a PID from arbitrary message numbers or accept unknown formats.
  const prefix = line.slice(0, at).match(/\b\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+(\d+)\s+\d+\s+[DIEWF]\b.*\bMangaGeometry\b/);
  if (!prefix) { ignored.otherPidOrUnparsedPrefix++; continue; }
  let record;
  try { record = JSON.parse(line.slice(at + marker.length)); } catch { ignored.malformed++; continue; }
  const baselineIdentity = `${Number(prefix[1])}:${JSON.stringify(record)}`;
  if (probeStarts === 0) {
    if (currentOperation === 'log') baseline.add(baselineIdentity);
    continue;
  }
  if (!probeActive) { ignored.outsideProbe++; continue; }
  if (Number(prefix[1]) !== meta.pid) { ignored.otherPidOrUnparsedPrefix++; continue; }
  if (baseline.has(baselineIdentity)) { ignored.baseline++; continue; }
  if (!finite(record.observedAtMs) || record.observedAtMs < meta.guestEpochStartSeconds * 1000) { ignored.beforeStart++; continue; }
  if (finite(meta.guestEpochEndSeconds) && record.observedAtMs > meta.guestEpochEndSeconds * 1000) { ignored.beforeStart++; continue; }
  const identity = `${record.sequence}:${record.observedAtMs}:${record.ordinal}:${record.tileIndex}`;
  if (seen.has(identity)) { ignored.duplicate++; continue; }
  seen.add(identity);
  const event = Object.fromEntries(['width', 'height', 'componentWidth', 'componentHeight', 'loadingStatus',
    'contentWidth', 'contentHeight', 'contentOffsetX', 'contentOffsetY'].map(k =>
    [k, record[k === 'width' ? 'nativeWidth' : k === 'height' ? 'nativeHeight' : k]]));
  const fresh = record.retainedReceipt === 0 && integer(record.receiptGeneration) && record.receiptGeneration > 0 &&
    integer(record.stateGeneration) && record.receiptStateGeneration === record.stateGeneration;
  const check = !checkGeometry ? result('OPEN', 'production-validator-not-bound') : !fresh ?
    result('OPEN', 'retained-or-generation-incomplete-receipt') : checkGeometry(event);
  const density = finite(record.densityPixels) && record.densityPixels > 0 ? record.densityPixels : undefined;
  const areasCurrent = record.imageAreaStateGeneration === record.stateGeneration &&
    record.viewportAreaStateGeneration === record.stateGeneration &&
    [record.imageGlobalXVp, record.imageGlobalYVp, record.imageAreaWidthVp, record.imageAreaHeightVp,
      record.viewportGlobalXVp, record.viewportGlobalYVp, record.viewportWidthVp, record.viewportHeightVp].every(finite);
  const area = density && areasCurrent ? [record.imageGlobalXVp, record.imageGlobalYVp,
    record.imageGlobalXVp + record.imageAreaWidthVp, record.imageGlobalYVp + record.imageAreaHeightVp].map(v => v * density) : undefined;
  const viewport = density && areasCurrent ? [record.viewportGlobalXVp, record.viewportGlobalYVp,
    record.viewportGlobalXVp + record.viewportWidthVp, record.viewportGlobalYVp + record.viewportHeightVp].map(v => v * density) : undefined;
  const phases = {};
  for (const label of ['a', 'b', 'd']) {
    const window = meta.phaseWindows?.[label], tree = trees[label];
    if (!window || !finite(window.startMs) || !finite(window.endMs) || window.endMs < window.startMs)
      phases[label] = result('OPEN', 'guest-phase-window-missing');
    else if (record.observedAtMs < window.startMs || record.observedAtMs > window.endMs)
      phases[label] = result('OPEN', 'record-outside-phase-window');
    else if (check.status !== 'PASS' || !area || !viewport || tree.check.status !== 'PASS')
      phases[label] = result('OPEN', 'fresh-destination-current-area-or-tree-missing');
    else {
      const matches = tree.rows.filter(row => sameRect(row.original, area, 1));
      phases[label] = sameRect(viewport, tree.window, 1) && matches.length === 1 ?
        result('PASS', 'fresh-numeric-area-matches-unique-UI-image', { actor: matches[0].id,
          firstImage: matches[0].id === tree.first.id, bottomImage: matches[0].id === tree.bottom.id }) :
        result('OPEN', 'native-area-UI-association-not-established');
    }
  }
  native.push({ sequence: record.sequence, observedAtMs: record.observedAtMs, ordinal: record.ordinal,
    tileIndex: record.tileIndex, controls: record.controls, stateGeneration: record.stateGeneration,
    receiptGeneration: record.receiptGeneration, receiptStateGeneration: record.receiptStateGeneration,
    retainedReceipt: record.retainedReceipt, densityPixels: density, event, check,
    imageAreaPhysicalFromVp: area, viewportPhysicalFromVp: viewport, phases });
}
const freshChecks = native.filter(n => n.check.reason !== 'retained-or-generation-incomplete-receipt');
const destination = freshChecks.some(n => n.check.status === 'FAIL') ? result('FAIL', 'fresh-native-destination-failed') :
  freshChecks.some(n => n.check.status === 'PASS') ? result('PASS', 'production-validator-accepted-fresh-native-destination-any-sample') :
    result('OPEN', 'no-valid-fresh-decoded-native-destination');
const phaseChecks = Object.fromEntries(['a', 'b', 'd'].map(label => [label,
  native.some(n => n.phases[label].status === 'PASS' && n.phases[label].firstImage === true) ?
    result('PASS', 'fresh-phase-first-UI-image-association') : result('OPEN', 'no-fresh-phase-associated-first-image-receipt')]));
const treeRequests = Object.fromEntries(['a', 'b', 'd'].map(label => {
  const path = args.get(`--${label}`), stem = basename(path, '.json');
  const labels = label === 'a' ? ['a', 'aSettled'] : [label];
  return [label, labels.includes(stem) && requests.some(r => r.operation?.op === 'recvTree' &&
    r.operation.label === stem && r.args?.at(-1) === path) ? 'REQUEST_RECORDED' : 'NOT_ESTABLISHED'];
}));
const runtimeProvenance = baselineLogRequested && stopBeforeStart && probeStarts === 1 &&
  observedPids.includes(meta.pid) && observedEpochs.includes(meta.guestEpochStartSeconds) ?
  result('PASS', 'baseline-cold-start-observed-PID-and-guest-epoch-bound', { baselineNumericRecords: baseline.size,
    observedPids, observedEpochs }) : result('OPEN', 'baseline-cold-start-PID-or-guest-epoch-unestablished', {
    baselineLogRequested, stopBeforeStart, probeStarts, baselineNumericRecords: baseline.size, observedPids, observedEpochs });
const report = {
  schemaVersion: 1, scope: 'bounded current-process numeric destination and UI original layout; no submitted-paint or source-pixel proof',
  inputHashes: Object.fromEntries([...args].filter(([key]) => key !== '--output').map(([key, path]) =>
    [key.slice(2), { path, sha256: sha(bytes(path)) }])), sourceSnapshotSha256: sha(bytes(snapshotPath)),
  binding: { pid: meta.pid, guestEpochStartSeconds: meta.guestEpochStartSeconds,
    runId: manifest.runId, signedHapSha256: signed?.sha256, productionValidatorSha256: sha(validatorBytes) },
  manifest: manifestCheck, runtimeProvenance, ui: trees, originalLayoutStability: stable, immersiveVisibleEdges, nativeDestination: destination,
  nativePhaseAssociation: phaseChecks, treeRequestLink: treeRequests, nativeRecords: native, ignored,
  acceptanceStatus: combine([manifestCheck, runtimeProvenance, stable, destination, ...Object.values(trees).map(t => t.check),
    ...Object.values(immersiveVisibleEdges), ...Object.values(phaseChecks)]),
  boundaries: { submittedPaint: 'OPEN', sourceFirstPixelColor: 'NOT_READ', sourceImageOrCache: 'NOT_READ',
    visibleBoundsMayClipUnderControls: 'reported separately; never used to infer original image reflow',
    nativeEventUnits: 'component/content compared together by production validator; not converted to vp',
    areaUnits: 'vp converted only with density from that same logged record' },
};
const output = JSON.stringify(report, null, 2) + '\n';
if (args.has('--output')) writeFileSync(args.get('--output'), output);
else process.stdout.write(output);
process.exitCode = report.acceptanceStatus === 'FAIL' ? 1 : report.acceptanceStatus === 'OPEN' ? 2 : 0;
