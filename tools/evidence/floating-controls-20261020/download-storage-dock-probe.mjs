// Explicit issue-local evidence: the actual storage Builder and its direct
// helpers only. This records SDK-emitted properties, not native rendering.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
}});
const {createReaderBuilderProbe} = await import('../../lib/reader-control-builder-probe.mjs');
const visual = await import('../../../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
const metrics = await import('../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const pagePath = 'entry/src/main/ets/features/downloads/SharedDownloadPage.ets';
const source = readFileSync(new URL('../../../' + pagePath, import.meta.url), 'utf8');
const viewport = metrics.createDefaultReaderWindowMetrics();
viewport.windowRect = {left:0, top:0, width:320, height:800};
const members = ['storageDock', 'totalBytesLabel', 'visualIcon', 'fontScale', 'currentMetrics',
  'recordDockHeight', 'contentBottom', 'bottomInset', 'syncStoragePolicy'];
for (const scheme of ['day', 'night']) {
  for (const scale of [1, 2]) {
    viewport.systemFontScale = scale;
    for (const books of [[], [{bytes:1048576}], [{}]]) {
      const {owner} = createReaderBuilderProbe(source, members, {
        ...visual, ...metrics,
        ButtonType:{Normal:'Normal'},
        ReaderWindowCoordinator:{metrics:()=>viewport},
      }, {componentName:'SharedDownloadPage'});
      Object.assign(owner, {books, appThemeScheme:scheme, dockMeasuredHeight:68,
        storagePolicyDraftChanged:true, storagePolicy:{capacityBytes:1048576, expiryDays:7}, sheet:''});
      owner.storageDock();
      const nodes = [...owner.nodes.values()];
      const texts = nodes.filter(node=>node.type==='Text');
      const unknown = books.some(book=>book.bytes===undefined);
      assert.deepEqual(texts.map(node=>node.create), unknown ? ['已下载内容', '容量暂未统计完整'] :
        [books.length ? '已下载 1 MB' : '已下载 0 MB']);
      assert.ok(texts.every(node=>node.height===undefined), 'copy keeps native natural line/wrap height');
      const copy = nodes.find(node=>node.type==='Column');
      assert.equal(copy.layoutWeight,1);
      assert.equal(copy.alignItems,'HorizontalAlign.Start');
      assert.equal(copy.constraintSize.minWidth,0);
      const button = nodes.find(node=>node.type==='Button');
      assert.equal(button.width,44); assert.equal(button.height,44);
      assert.equal(button.responseRegion,undefined,'hit target is the real allocated icon slot');
      assert.equal(button.accessibilityText,'存储管理');
      const image = nodes.find(node=>node.type==='Image');
      assert.equal(image.width,18); assert.equal(image.height,18);
      assert.match(image.create,scheme==='night' ? /storage_theme_night$/ : /storage$/);
      const row = nodes.find(node=>node.type==='Row');
      assert.equal(row.alignItems,'VerticalAlign.Center');
      row.onAreaChange({}, {height:96});
      assert.equal(owner.dockMeasuredHeight,96);
      assert.ok(owner.contentBottom(0)>=96+visual.DOWNLOAD_VISUAL.dockBottom*2,
        'natural dock growth continues to reserve scrollable tail room');
      button.onClick();
      assert.equal(owner.sheet,'settings');
      assert.equal(owner.storagePolicyDraftChanged,false);
      assert.equal(owner.cacheLimitMb,1); assert.equal(owner.cleanupAfterDays,7);
    }
  }
}
const baseline = execFileSync('git', ['show', '8a8328822d9002a8f6fb044ed508a7cc6b000bac:' + pagePath],
  {encoding:'utf8', cwd:new URL('../../../', import.meta.url)});
for (const method of ['selectionDock', 'actionButton', 'quickSelectChapters', 'captureSelection', 'sendAction']) {
  const take = text => {
    const start = text.indexOf(`private ${method}(`); assert.ok(start>=0);
    const ends = [text.indexOf('\n  private ',start+1), text.indexOf('\n  @Builder',start+1)].filter(n=>n>=0);
    return text.slice(start,Math.min(...ends)).replaceAll('.clip(true)','').trim();
  };
  assert.equal(take(source),take(baseline),method+' keeps the existing chapter layout and actions');
}
console.log('PASS issue-local storage dock SDK properties: 12 content/theme/font-scale inputs, 44vp slot, settings action, measured tail, unchanged selection');
