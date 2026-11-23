import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { diagnostic, digest, safePath } from './lib.mjs';
import { checkContractReceipt, checkContractReceiptGroup, sourceE2AdmissionGap, sourceE3AdmissionGap } from './receipt-evidence.mjs';
import { isSourceE3Claim } from './source-e3-admission.mjs';
import { isSourceE2Claim } from './source-e2-admission.mjs';
import { candidateIdentity, captureRecord, nativeBounds, normalReaderWindowRoots, pngSize, requireEvidence, sha256 } from '../lib/native-ui-evidence.mjs';

const layoutTag = 'READER_DEVELOPER_LAYOUT';

function readEvidence(reference) {
  const data = readFileSync(safePath(reference.path));
  const hash = sha256(data);
  requireEvidence(hash === reference.sha256, `Changed evidence bytes: ${reference.path}`);
  return data;
}

function verifyCandidate(page, manifestRef, deploymentRef) {
  const manifest = JSON.parse(readEvidence(manifestRef));
  const deployment = JSON.parse(readEvidence(deploymentRef));
  const snapshot = JSON.parse(readFileSync(safePath(join(dirname(manifestRef.path), 'source-snapshot.json')), 'utf8'));
  const { sources } = candidateIdentity(manifest, deployment, snapshot);
  for (const input of [page.source, ...(page.sourceInputs ?? [])]) {
    if (!input.path.startsWith('entry/src/')) continue;
    requireEvidence(sources.get(input.path) === input.sha256 && digest(input.path) === input.sha256,
      `Deployed source does not match current registration: ${input.path}`);
  }
  return deployment;
}

function verifyCapture(session, reference, primitive) {
  return captureRecord(session, reference, readEvidence(reference), primitive);
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
  return {
    ...pngSize(picture),
    windowWidth: Math.round(m.windowRect.width * m.densityPixels),
    windowHeight: Math.round(m.windowRect.height * m.densityPixels),
  };
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
  for (const node of normalReaderWindowRoots(tree)) {
    const a = node.attributes;
    const bounds = nativeBounds(a.origBounds);
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
    const bounds = nativeBounds(a.bounds);
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
export function checkNormalPageEvidence(page, model, selection, sourceE2ReceiptGroup) {
  const diagnostics = [];
  const checked = new Map();
  const claims = [
    ...Object.entries(page.layers).map(([layer, result]) => [layer, `layers.${layer}`, result]),
    ...Object.entries(page.invariants).map(([id, result]) =>
      [model.invariants.find(rule => rule.id === id)?.layer, `invariants.${id}`, result]),
  ].filter(([, , record]) => record.result === 'PASS');
  for (const [layer, claim, record] of claims) {
    const gap = sourceE2AdmissionGap(page, claim, model) ?? sourceE3AdmissionGap(page, claim, model);
    if (gap) {
      diagnostics.push(diagnostic('NORMAL_PAGE_EVIDENCE', page.pageId, layer, claim, gap));
      continue;
    }
    const sourceE3 = isSourceE3Claim(page, claim);
    const sourceE2 = isSourceE2Claim(page,claim);
    let failure = sourceE3 ? 'Source E3 PASS requires the model-owned grouped native matrix receipt' :
      sourceE2 ? 'Source E2 PASS requires a model-owned native receipt covering the complete interaction claim' :
      'PASS requires same-scene full screenshot, native tree and Developer Mode parameters';
    let admitted = false;
    const requiresContractReceipt = sourceE2 || (model.receiptAdmissions ?? []).some(mapping =>
      mapping.pageId === page.pageId && mapping.claim === claim);
    const registered = record.evidence ?? [];
    const evidenceList = selection ? registered.filter(evidence => evidence.kind === 'device' &&
      evidence.result === 'PASS' && evidence.symbol === 'ui-contract-receipt' &&
      evidence.rootSha256 === selection.rootSha256) : registered;
    // 分组证据跨用例或窗口，旧 normal-page 报告也不绑定所选回执的根。两者仍可用于原有单项准入。
    if (selection && (evidenceList.length !== 1 || sourceE2 || sourceE3)) {
      diagnostics.push(diagnostic('PAGE_RECEIPT_BINDING', page.pageId, layer, claim,
        'Page composition requires exactly one registered single receipt for the selected root', 'NOT_RUN'));
      continue;
    }
    for (const evidence of evidenceList) {
      if (evidence.kind !== 'device' || evidence.result !== 'PASS') continue;
      if ((sourceE3 || sourceE2) && evidence.symbol !== 'ui-contract-receipt-group') continue;
      if (sourceE2 && sourceE2ReceiptGroup && (evidence.path !== sourceE2ReceiptGroup.path ||
          evidence.rootSha256 !== sourceE2ReceiptGroup.sha256)) continue;
      if (evidence.symbol === 'ui-contract-receipt' || evidence.symbol === 'ui-contract-receipt-group') {
        try {
          const verifyReceipt = evidence.symbol === 'ui-contract-receipt-group' ? checkContractReceiptGroup : checkContractReceipt;
          verifyReceipt(page, model, claim, evidence, selection);
          admitted = true;
          break;
        } catch (error) {
          failure = error.message;
          continue;
        }
      }
      if (requiresContractReceipt || evidence.symbol !== 'normal-page') continue;
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
