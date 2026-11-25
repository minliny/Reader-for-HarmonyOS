import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"mounted-debug-scanner": {"description": "实际开发诊断FrameNode扫描/绘制/关闭", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const {default: assert} = await import('node:assert/strict');
const {default: fs} = await import('node:fs');
const {default: path} = await import('node:path');
const { fileURLToPath } = await import('node:url');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Execute the ordinary production scanner and painter against the public
// FrameNode seam. These cases cover the omissions the old screenshot exposed,
// without treating a local tree fixture as compositor/device evidence.
const clearedTimers = [];
let reporterAttachments = 0;
let reporterDetachments = 0;
let timerCount = 0;
const Owner = selectedProductionMethods(path.join(root,
  'entry/src/main/ets/app/composition/ReaderLayoutDebugOverlay.ets'), 'ReaderLayoutDebugOverlay',
['scanFrameTree', 'collectFrameBounds', 'intersectBounds', 'paintOutline', 'paintFrameBounds',
  'onDeveloperModeChanged', 'aboutToDisappear', 'markFrameScanIncomplete', 'debugNodeLabel'], {
  FRAME_NODE_SCAN_LIMIT: 4000,
  FRAME_NODE_CHILD_QUERY_LIMIT: 2048,
  CHILD_INDEX_PROBE_WINDOW: 16,
  CHILD_INDEX_PROBE_MISS_LIMIT: 4,
  ExpandMode: { NOT_EXPAND: 0 },
  ReaderUIVerificationProbe: {
    attachSourceImportToastWindowReporter(reporter) {
      assert.equal(typeof reporter, 'function');
      reporterAttachments++;
      return () => { reporterDetachments++; };
    },
  },
  setInterval: () => ++timerCount,
  clearInterval: handle => clearedTimers.push(handle),
});
const owner = new Owner();
const rectangles = [];
const opacities = [];
const labels = [];
const strokeClips = [];
const savedClips = [];
let activeClips = [];
let currentPath = [];
const queriedParents = new Set();
let childQueries = 0;
let nextNodeId = 0;
function node(id, type, x, y, width, height, children = [], geometryMissing = false) {
  const uniqueId = ++nextNodeId;
  return {
    parent: null, id, x, y, children, visible: true, opacity: 1, clipped: false, properties: {},
    getId: () => id,
    getNodeType: () => type,
    getUniqueId: () => uniqueId,
    getParent() { return this.parent; },
    isVisible() { return this.visible; },
    getOpacity() { return this.opacity; },
    getCustomProperty(key) { return this.properties[key]; },
    isClipToFrame() { return this.clipped; },
    getPositionToWindowWithTransform() { return { x: this.x, y: this.y }; },
    getMeasuredSize() {
      if (geometryMissing) throw new Error('virtual node has no rectangle');
      return { width: width * 3, height: height * 3 };
    },
    getFirstChildIndexWithoutExpand: () => children.length ? 0 : -1,
    getLastChildIndexWithoutExpand: () => children.length - 1,
    getChild(index, mode) {
      assert.equal(mode, 0, 'the production scanner never expands virtual list items');
      childQueries++;
      queriedParents.add(id);
      return children[index] ?? null;
    },
  };
}
const textNode = node('title', 'Text', 23, 80, 30, 15);
const divider = node('divider', 'Divider', 15, 110, 100, 1);
const virtual = node('', '__Common__', 0, 0, 0, 0, [textNode, divider], true);
const hidden = node('hidden', 'Column', 0, 0, 100, 100,
  [node('hidden-title', 'Text', 0, 0, 10, 10)]);
hidden.visible = false;
const transparent = node('retained-navigation', 'Stack', 45, 480, 88, 96,
  [node('retained-button', 'Button', 45, 490, 45, 44)]);
transparent.opacity = 0;
const overlayNode = node('reader-layout-debug-overlay', 'Stack', 5, 40, 390, 700,
  [node('overlay-canvas', 'Canvas', 0, 0, 390, 700)]);
const rootNode = node('root', 'Stack', 0, 0, 390, 844, [virtual, hidden, transparent, overlayNode]);
overlayNode.parent = rootNode;
const context = {
  getAttachedFrameNodeById: id => {
    assert.equal(id, 'reader-layout-debug-overlay');
    return overlayNode;
  },
  px2vp: value => value / 3,
  getPageRootNode: () => { throw new Error('API 24 must not be used on API 23'); },
};
Object.assign(owner, {
  developerModeEnabled: true, canvasReady: true, frameScanHandle: -1,
  appForeground: true,
  opaqueHeaders: new Map(),
  getUIContext: () => context,
  reportWindowSample() {},
  drawingContext: {
    width: 390, height: 700,
    clearRect: () => {
      rectangles.length = 0; opacities.length = 0; labels.length = 0; strokeClips.length = 0;
    },
    save() { savedClips.push(activeClips); activeClips = [...activeClips]; },
    restore() { activeClips = savedClips.pop(); },
    beginPath() { currentPath = []; },
    rect(...bounds) { currentPath.push(bounds); },
    clip(rule) { activeClips.push({ rule, path: currentPath }); },
    strokeRect(...values) {
      rectangles.push(values); opacities.push(this.globalAlpha); strokeClips.push(activeClips);
    },
    fillText: (...values) => labels.push(values),
  },
});
owner.scanFrameTree();
assert.equal(owner.frameCount, 3, 'root and both visible children of the unmeasurable wrapper are retained');
assert.deepEqual(rectangles.find(rect => rect[2] === 30), [18, 40, 30, 15],
  'window vp coordinates subtract the overlay origin once, while measured px become vp');
assert.ok(rectangles.some(rect => rect[3] === 1), 'one-vp Divider gets a complete boundary');
assert.equal(labels.some(label => /overlay|hidden/.test(label[0])), false,
  'hidden children and the diagnostic subtree never enter the border set');
assert.deepEqual(queriedParents, new Set(['root', '']), 'hidden, transparent and diagnostic children are not traversed');
assert.ok(childQueries <= 6 + 2 * 4, 'lane enumeration limits the recovery queries past the declared range');
assert.equal(owner.excludedTransparentBranches, 1);
assert.equal(owner.frameScanTruncated, false);
assert.ok(!rectangles.some(rect => rect[2] === 88 || rect[2] === 45), 'a mounted transparent branch contributes no pixels');
transparent.opacity = 0.2;
transparent.children[0].opacity = 0.5;
owner.scanFrameTree();
assert.ok(rectangles.some(rect => rect[2] === 88) && rectangles.some(rect => rect[2] === 45),
  'a visible actor and its descendants return as it fades in');
assert.equal(opacities[rectangles.findIndex(rect => rect[2] === 88)], 0.32 * 0.2);
assert.equal(opacities[rectangles.findIndex(rect => rect[2] === 45)], 0.32 * 0.2 * 0.5,
  'a retained child inherits both parent and own opacity');
transparent.opacity = 0.000011;
owner.scanFrameTree();
assert.ok(opacities[rectangles.findIndex(rect => rect[2] === 45)] < 0.00001,
  'a nearly transparent retained branch cannot draw a full-strength border');
transparent.opacity = NaN;
owner.scanFrameTree();
assert.equal(owner.frameScanTruncated, true, 'unreadable native visibility marks the sample incomplete');
transparent.opacity = 0;
textNode.x = 33;
owner.scanFrameTree();
assert.deepEqual(rectangles.find(rect => rect[2] === 30), [28, 40, 30, 15],
  'scroll/layout movement repaints a stable node rather than retaining an old ForEach object');

virtual.children.splice(0, virtual.children.length,
  ...Array.from({ length: 1601 }, (_, index) => node(`entry-${index}`, 'Text', 10, 50, 10, 1)));
owner.scanFrameTree();
assert.equal(owner.frameCount, 1602, 'ordinary pages are not silently limited to the old 1500 drawn nodes');
assert.equal(owner.frameScanTruncated, false);

const fullyCovered = node('covered-row', 'Text', 24, 59, 24, 10);
const partlyCovered = node('crossing-row', 'Text', 17, 60, 33, 32);
const belowHeader = node('other-row', 'Text', 17, 110, 35, 20);
const outsideList = node('off-list', 'Text', 17, 160, 36, 20);
const clipAtListEnd = node('last-row', 'Text', 17, 131, 34, 20);
const list = node('list', 'List', 14, 42, 95, 100,
  [fullyCovered, partlyCovered, belowHeader, outsideList, clipAtListEnd]);
list.clipped = true;
const body = node('body', 'Stack', 5, 40, 390, 700, [list]);
body.properties.readerLayoutDebugContentUnderHeader = 'one-scaffold';
const headerLabel = node('foreground-title', 'Text', 30, 58, 31, 12);
const header = node('solid-header', 'Column', 20, 45, 88, 35, [headerLabel]);
header.properties.readerLayoutDebugOpaqueHeader = 'one-scaffold';
const otherPage = node('independent-dialog', 'Text', 24, 59, 38, 10);
rootNode.children.splice(0, rootNode.children.length, body, header, otherPage, overlayNode);
owner.scanFrameTree();
assert.equal(owner.opaqueHeaders.size, 1);
assert.ok(!rectangles.some(rect => rect[2] === 24 || rect[2] === 36),
  'fully occluded and clipped rows do not draw');
assert.deepEqual(rectangles.find(rect => rect[2] === 33), [12, 20, 33, 32],
  'a partially covered row keeps its measured rectangle');
assert.deepEqual(strokeClips[rectangles.findIndex(rect => rect[2] === 33)], [
  { rule: 'evenodd', path: [[0, 0, 390, 700], [15, 5, 88, 35]] },
], 'the foreground header masks only its actual measured pixels');
assert.deepEqual(strokeClips[rectangles.findIndex(rect => rect[2] === 34)], [
  { rule: undefined, path: [[9, 2, 95, 100]] },
], 'the row at the end inherits the actual native clip');
for (const width of [31, 35, 38]) {
  const index = rectangles.findIndex(rect => rect[2] === width);
  assert.ok(index >= 0);
  assert.equal(strokeClips[index].length, 0, 'foreground labels, visible rows and another layer stay intact');
}
header.y = 85;
owner.scanFrameTree();
assert.ok(rectangles.some(rect => rect[2] === 24), 'the next scan uses the moved header geometry');
header.y = 45;
header.opacity = 0.8;
owner.scanFrameTree();
assert.ok(rectangles.some(rect => rect[2] === 24), 'a faded header cannot mask the still-visible content');
assert.equal(owner.opaqueHeaders.size, 0);
assert.equal(savedClips.length, 0, 'scoped canvas changes cannot leak into later outlines');
owner.onDeveloperModeChanged();
assert.equal(timerCount, 1);
owner.developerModeEnabled = false;
owner.onDeveloperModeChanged();
assert.deepEqual(clearedTimers, [1], 'disabling the persisted switch cancels the scanner');
assert.equal(reporterAttachments, 1);
assert.equal(reporterDetachments, 1, 'disabling also retires the active window reporter');
assert.equal(owner.frameCount, 0);
assert.equal(rectangles.length, 0);
owner.aboutToDisappear();
console.log('developer mode settings and full mounted-tree geometry overlay: PASS');

}
