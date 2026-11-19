import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { diagnostic, digest, safePath } from './lib.mjs';

const layoutTag = 'READER_DEVELOPER_LAYOUT';

function requireEvidence(condition, message) {
  if (!condition) throw new Error(message);
}

function readEvidence(reference) {
  const data = readFileSync(safePath(reference.path));
  const hash = createHash('sha256').update(data).digest('hex');
  requireEvidence(hash === reference.sha256, `Changed evidence bytes: ${reference.path}`);
  return data;
}

function verifyCandidate(page, manifestRef, deploymentRef) {
  const manifest = JSON.parse(readEvidence(manifestRef));
  const deployment = JSON.parse(readEvidence(deploymentRef));
  const signed = manifest.artifacts?.find(item => item.kind === 'signed');
  const expected = manifest.expectedVersion;
  const installed = deployment.postInstall?.appVersion;
  requireEvidence(manifest.schemaVersion === 2 && signed?.signature?.verified === true &&
    deployment.install === 'PASS' && deployment.launch === 'PASS' && deployment.appVersionCheck === 'PASS' &&
    deployment.postInstall?.bundleName === 'io.reader.minliny' &&
    deployment.runId === manifest.runId && deployment.artifact?.sha256 === signed.sha256 &&
    typeof expected?.appBuildId === 'string' && installed?.appBuildId === expected.appBuildId &&
    installed.appContentHash === expected.appContentHash && typeof deployment.targetRef === 'string',
  'Deployment does not bind the signed Reader candidate');

  const descriptor = manifest.source?.buildInputs;
  requireEvidence(descriptor?.snapshot === 'source-snapshot.json', 'Manifest has no registered source snapshot');
  const snapshot = JSON.parse(readFileSync(safePath(join(dirname(manifestRef.path), descriptor.snapshot)), 'utf8'));
  const hash = createHash('sha256');
  for (const file of snapshot.files) hash.update(JSON.stringify(file)).update('\n');
  requireEvidence(snapshot.files.length === descriptor.fileCount && hash.digest('hex') === descriptor.fingerprint,
    'Source snapshot differs from the deployed manifest');
  const sources = new Map(snapshot.files.map(file => [file.path, file.sha256]));
  for (const input of [page.source, ...(page.sourceInputs ?? [])]) {
    if (!input.path.startsWith('entry/src/')) continue;
    requireEvidence(sources.get(input.path) === input.sha256 && digest(input.path) === input.sha256,
      `Deployed source does not match current registration: ${input.path}`);
  }
  return deployment;
}

function verifyCapture(session, reference, primitive) {
  const bytes = readEvidence(reference);
  const entry = session.findIndex(record => record.event === 'capture-integrity' &&
    basename(record.path) === basename(reference.path) && record.sha256 === reference.sha256 &&
    record.bytes === bytes.length);
  requireEvidence(entry > 1, `No matching device capture: ${reference.path}`);
  const transfer = session[entry - 1];
  const remote = transfer.args?.[2];
  requireEvidence(transfer.ok === true && transfer.args?.slice(0, 2).join(' ') === 'file recv' &&
    typeof remote === 'string' && basename(remote) === basename(reference.path) &&
    transfer.args[3] === session[entry].path, `No matching native readback: ${reference.path}`);
  const capture = session.slice(0, entry - 1).findLastIndex(record => record.ok === true &&
    record.args?.join(' ') === `shell uitest ${primitive} -p ${remote}`);
  requireEvidence(capture > 0, `No successful native ${primitive} for ${reference.path}`);
  return { bytes, entry, capture };
}

const rectKeys = ['left', 'top', 'width', 'height'];
const insetKeys = ['left', 'top', 'right', 'bottom'];
const insetNames = ['systemInsets', 'cutoutInsets', 'gestureInsets', 'navigationInsets', 'keyboardInsets'];
const near = (actual, expected) =>
  Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= 0.01;
const matches = (actual, expected, keys) => keys.every(key => near(actual?.[key], expected?.[key]));

function verifyWindow(report, expected, picture) {
  const m = report.metrics;
  const effectiveFontScale = report.fpPixels / report.vpPixels;
  const keyboardRects = m?.keyboardArea?.rects;
  const values = [m?.windowRect?.width, m?.windowRect?.height, m?.densityPixels, report.vpPixels,
    effectiveFontScale, m?.systemFontScale, report.canvasWidthVp, report.canvasHeightVp];
  requireEvidence(m?.ready === true && report.frameTreeReady === true && report.frameScanTruncated === false &&
    Number.isSafeInteger(m.revision) && m.revision > 0 &&
    typeof report.followsSystemFontScale === 'boolean' &&
    m.keyboardArea?.available === true && typeof m.keyboardArea.visible === 'boolean' &&
    Array.isArray(keyboardRects) && m.keyboardArea.visible === (keyboardRects.length > 0) &&
    keyboardRects.every(rect => rectKeys.every(key => Number.isFinite(rect?.[key])) && rect.width > 0 && rect.height > 0) &&
    insetNames.every(name => insetKeys.every(key => Number.isFinite(m[name]?.[key]) && m[name][key] >= 0)) &&
    Number.isFinite(m.statusBarHeight) && m.statusBarHeight >= 0 && near(m.statusBarHeight, m.statusBarRect?.height) &&
    values.every(value => Number.isFinite(value) && value > 0),
  'Developer mode reports missing, abnormal or incomplete runtime parameters');
  requireEvidence(near(m.windowRect.width, expected.widthVp) && near(m.windowRect.height, expected.heightVp) &&
    near(m.densityPixels, expected.density) && near(report.vpPixels, expected.density) &&
    near(effectiveFontScale, expected.fontScale) &&
    near(m.systemFontScale, expected.systemFontScale ?? expected.fontScale) &&
    m.keyboardArea.visible === expected.keyboardVisible,
  'Actual window, font or keyboard state differs from the selected scenario');
  requireEvidence(insetNames.every(name => matches(m[name], expected[name], insetKeys)) &&
    matches(m.statusBarRect, expected.statusBarRect, rectKeys) &&
    Array.isArray(expected.keyboardRects) && keyboardRects.length === expected.keyboardRects.length &&
    keyboardRects.every((rect, index) => matches(rect, expected.keyboardRects[index], rectKeys)),
  'Actual safe areas, status bar or keyboard rectangles differ from the selected scenario');
  requireEvidence(picture.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    picture.length >= 24 && picture.toString('ascii', 12, 16) === 'IHDR',
  'Native screenshot does not contain the whole window');
  return {
    width: picture.readUInt32BE(16),
    height: picture.readUInt32BE(20),
    windowWidth: Math.round(m.windowRect.width * m.densityPixels),
    windowHeight: Math.round(m.windowRect.height * m.densityPixels),
  };
}

function boundsOf(value) {
  return /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(value)?.slice(1).map(Number);
}

function verifyDeveloperBadge(node, metrics) {
  // The overlay's own Text can be clipped out during keyboard avoidance.
  // When UITest exposes the badge, it must agree with the sampled log.
  for (const child of node.children ?? []) {
    const a = child.attributes;
    const label = a?.originalText || a?.text || '';
    if (a?.type !== 'Text' || a.visible === 'false' || !label.startsWith('开发者模式 ')) continue;
    const badge = /^开发者模式 (\d+)×(\d+)vp d(\d+\.\d{2}) f(\d+\.\d{2}) IME ([开关])(?=\s|$)[\s\S]* · r(\d+)$/u.exec(label);
    requireEvidence(badge && Number(badge[1]) === Math.round(metrics.windowRect.width) &&
      Number(badge[2]) === Math.round(metrics.windowRect.height) &&
      badge[3] === metrics.densityPixels.toFixed(2) && badge[4] === metrics.systemFontScale.toFixed(2) &&
      (badge[5] === '开') === metrics.keyboardArea.visible && Number(badge[6]) === metrics.revision,
    'Native Developer Mode badge disagrees with the sampled window, font, keyboard or revision');
  }
}

function verifyTree(data, anchor, viewport, metrics) {
  const tree = JSON.parse(data);
  requireEvidence(anchor && (anchor.id || anchor.text), 'Expected normal page anchor is missing');
  const nodes = [];
  const windows = new Set();
  for (const node of tree.children ?? []) {
    const a = node.attributes;
    if (a?.type !== 'root' || a.bundleName !== 'io.reader.minliny' || a.abilityName !== 'EntryAbility' ||
      a.pagePath !== 'pages/Index' || !a.hostWindowId) continue;
    const bounds = boundsOf(a.origBounds);
    if (bounds && bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] <= viewport.width && bounds[3] <= viewport.height &&
      bounds[2] - bounds[0] === viewport.windowWidth && bounds[3] - bounds[1] === viewport.windowHeight) {
      nodes.push(node);
      windows.add(a.hostWindowId);
    }
  }
  requireEvidence(windows.size > 0, 'Screenshot and tree do not contain the complete normal Reader window');
  const foreground = new Set();
  const matched = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const a = node.attributes;
    const opacity = Number(a?.opacity);
    if (a?.visible === 'false' || (a?.opacity && (!Number.isFinite(opacity) || opacity <= 0))) continue;
    for (const child of node.children ?? []) nodes.push(child);
    if (a?.visible !== 'true' || !Number.isFinite(opacity) || opacity <= 0 || !windows.has(a.hostWindowId)) continue;
    if (a.id === 'reader-layout-debug-overlay') {
      verifyDeveloperBadge(node, metrics);
      foreground.add(a.hostWindowId);
    }
    if ((anchor.id && a.id !== anchor.id) || (anchor.text && ![a.text, a.originalText].includes(anchor.text))) continue;
    const bounds = boundsOf(a.bounds);
    if (bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1] && a.bounds === a.origBounds) matched.push(a);
  }
  requireEvidence(matched.some(node => foreground.has(node.hostWindowId)),
    'Expected uncut page anchor and active Developer Mode are missing from the same native window');
}

function verifyCaptureInterval(session, image, layout, metricsIndex) {
  const first = Math.min(image.capture, layout.capture, metricsIndex);
  const last = Math.max(image.entry, layout.entry, metricsIndex);
  const start = Date.parse(session[first].startedAt);
  const end = Date.parse(session[last].recordedAt);
  requireEvidence(Number.isFinite(start) && Number.isFinite(end) && start <= end,
    'Missing capture command timing');
  requireEvidence(!session.some((event, index) => {
    if (event.event === 'command') {
      const command = event.args?.slice(0, 3).join(' ');
      if (command === 'shell uitest screenCap' || command === 'shell uitest dumpLayout' ||
        event.args?.slice(0, 2).join(' ') === 'file recv' || command === 'shell hilog -x') return false;
      // A sampled touch command may be recorded after the screenshot, when
      // its asynchronous child exits. Use command times as well as receipt order.
      return (index >= first && index <= last) ||
        (Date.parse(event.startedAt) < end && Date.parse(event.recordedAt) > start);
    }
    return index >= first && index <= last &&
      ['sample-trigger', 'touch-execute-admitted', 'touch-helper-event'].includes(event.event);
  }), 'A UI action split the screenshot, tree and parameters across different states');
}

function verifyReport(page, path) {
  const report = JSON.parse(readFileSync(safePath(path), 'utf8'));
  requireEvidence(report.pageId === page.pageId && report.routeContractRef === page.routeContractRef &&
    report.result === 'PASS' && Array.isArray(report.claims) && report.samples?.length > 0,
  'Device evidence does not identify this registered normal page and its covered claims');
  const deployment = verifyCandidate(page, report.manifest, report.deployment);
  const session = readEvidence(report.session).toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const captureStartedAt = Date.parse(session[0]?.recordedAt);
  requireEvidence(session[0]?.event === 'ready' && session.at(-1)?.event === 'closed' &&
    session.every(entry => entry.targetRef === deployment.targetRef && entry.ok !== false) &&
    captureStartedAt >= Date.parse(deployment.completedAt) &&
    !session.some(entry => entry.args?.slice(0, 3).join(' ') === 'shell aa start' &&
      entry.args.some(arg => arg.startsWith('--p'))),
  'Session is incomplete, uses a diagnostic launch or belongs to another deployment');
  for (const sample of report.samples) {
    const image = verifyCapture(session, sample.screenshot, 'screenCap');
    const layout = verifyCapture(session, sample.layout, 'dumpLayout');
    const line = session[sample.metricsEvent - 1];
    requireEvidence(Number.isInteger(sample.metricsEvent) && line?.ok === true &&
      line.args?.join(' ') === `shell hilog -x -e ${layoutTag}`, 'Missing Developer Mode sampling command');
    const marker = `${layoutTag} `;
    const raw = line.stdout.trimEnd().split('\n').at(-1);
    requireEvidence(raw.includes(marker), 'Developer Mode command returned no runtime parameters');
    verifyCaptureInterval(session, image, layout, sample.metricsEvent - 1);
    const developer = JSON.parse(raw.slice(raw.indexOf(marker) + marker.length));
    const viewport = verifyWindow(developer, sample.expectedWindow, image.bytes);
    verifyTree(layout.bytes, sample.pageAnchor, viewport, developer.metrics);
  }
  return report.claims;
}

/** A source, SDK or isolated fixture report can never close a native page layer. */
export function checkNormalPageEvidence(page, model) {
  const diagnostics = [];
  const checked = new Map();
  const claims = [
    ...Object.entries(page.layers).map(([layer, result]) => [layer, `layers.${layer}`, result]),
    ...Object.entries(page.invariants).map(([id, result]) =>
      [model.invariants.find(rule => rule.id === id)?.layer, `invariants.${id}`, result]),
  ].filter(([, , record]) => record.result === 'PASS');
  for (const [layer, claim, record] of claims) {
    let failure = 'PASS requires same-scene full screenshot, native tree and Developer Mode parameters';
    let admitted = false;
    for (const evidence of record.evidence ?? []) {
      if (evidence.kind !== 'device' || evidence.result !== 'PASS' || evidence.symbol !== 'normal-page') continue;
      try {
        if (!checked.has(evidence.path)) checked.set(evidence.path, verifyReport(page, evidence.path));
        if (checked.get(evidence.path).includes(claim)) { admitted = true; break; }
        failure = `Device evidence does not cover ${claim}`;
      } catch (error) {
        failure = error.message;
      }
    }
    if (!admitted) diagnostics.push(diagnostic('NORMAL_PAGE_EVIDENCE', page.pageId, layer, claim, failure));
  }
  return diagnostics;
}
