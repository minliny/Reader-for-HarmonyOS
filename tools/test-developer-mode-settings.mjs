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
let timerCount = 0;
const Owner = selectedProductionMethods(path.join(root,
  'entry/src/main/ets/features/common/ReaderLayoutDebugOverlay.ets'), 'ReaderLayoutDebugOverlay',
['scanFrameTree', 'collectFrameBounds', 'paintFrameBounds', 'onDeveloperModeChanged', 'aboutToDisappear'], {
  FRAME_NODE_SCAN_LIMIT: 10000,
  ExpandMode: { NOT_EXPAND: 0 },
  setInterval: () => ++timerCount,
  clearInterval: handle => clearedTimers.push(handle),
});
const owner = new Owner();
const rectangles = [];
const labels = [];
let childQueries = 0;
function node(id, type, x, y, width, height, children = [], geometryMissing = false) {
  return {
    parent: null, id, x, y, children, visible: true,
    getId: () => id,
    getNodeType: () => type,
    getUniqueId: () => id.length,
    getParent() { return this.parent; },
    isVisible() { return this.visible; },
    getPositionToWindow() { return { x: this.x, y: this.y }; },
    getMeasuredSize() {
      if (geometryMissing) throw new Error('virtual node has no rectangle');
      return { width: width * 3, height: height * 3 };
    },
    getFirstChildIndexWithoutExpand: () => children.length ? 0 : -1,
    getLastChildIndexWithoutExpand: () => children.length - 1,
    getChild(index, mode) {
      assert.equal(mode, 0, 'the production scanner never expands virtual list items');
      childQueries++;
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
const overlayNode = node('reader-layout-debug-overlay', 'Stack', 5, 40, 390, 700,
  [node('overlay-canvas', 'Canvas', 0, 0, 390, 700)]);
const rootNode = node('root', 'Stack', 0, 0, 390, 844, [virtual, hidden, overlayNode]);
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
  getUIContext: () => context,
  drawingContext: {
    width: 390, height: 700,
    clearRect: () => { rectangles.length = 0; labels.length = 0; },
    strokeRect: (...values) => rectangles.push(values),
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
assert.equal(childQueries, 5, 'hidden and diagnostic children are not traversed');
textNode.x = 33;
owner.scanFrameTree();
assert.deepEqual(rectangles.find(rect => rect[2] === 30), [28, 40, 30, 15],
  'scroll/layout movement repaints a stable node rather than retaining an old ForEach object');

virtual.children.splice(0, virtual.children.length,
  ...Array.from({ length: 1601 }, (_, index) => node(`entry-${index}`, 'Text', 10, 50, 10, 1)));
owner.scanFrameTree();
assert.equal(owner.frameCount, 1602, 'ordinary pages are not silently limited to the old 1500 drawn nodes');
assert.equal(owner.frameScanTruncated, false);
owner.onDeveloperModeChanged();
assert.equal(timerCount, 1);
owner.developerModeEnabled = false;
owner.onDeveloperModeChanged();
assert.deepEqual(clearedTimers, [1], 'disabling the persisted switch cancels the scanner');
assert.equal(owner.frameCount, 0);
assert.equal(rectangles.length, 0);
owner.aboutToDisappear();
console.log('developer mode settings and full mounted-tree geometry overlay: PASS');

}
