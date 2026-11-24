import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'bookmark-pill-paint': {
    description: 'Actual bookmark pill keeps its native target and scheme paint through admitted add/remove and the settled state',
    resources: [],
  },
};

function bookmarkPillPaint(source, path) {
  for (const appScheme of ['day', 'night']) {
    const icon = 'reader_directory_marker_bookmark_active' + (appScheme === 'night' ? '_theme_night' : '');
    const svg = readFileSync(new URL('../entry/src/main/resources/base/media/' + icon + '.svg', import.meta.url), 'utf8');
    const copper = '#' + readerAppColor('TOK_ACCENT', appScheme).slice(-6);
    assert.ok(svg.toUpperCase().includes(copper.toUpperCase()), 'generated glyph owns the copper imprint');
    for (const pageBookmarkStatus of ['unknown', 'empty', 'bookmarked']) {
      const { owner } = createReaderBuilderProbe(source, ['chapterBookmarkRow']);
      const selected = pageBookmarkStatus === 'bookmarked';
      const enabled = pageBookmarkStatus !== 'unknown';
      let actions = 0, inputCurrent = true;
      Object.assign(owner, { appScheme, pageBookmarkStatus, pageBookmarkEnabled: enabled,
        pageBookmarkFill: selected ? 1 : 0, pageBookmarkTuck: 1, reduceMotion: false,
        readableChapterPosition: 3, presentedHomeTotalChapters: () => 12, bookmarkLaneHeight: () => 32,
        progressInputEnabled: () => inputCurrent, controlActionHandler: callback => callback,
        onTogglePageBookmark() { actions += 1; } });
      owner.chapterBookmarkRow();
      const nodes = [...owner.nodes.values()];
      const hit = nodes.find(node => node.id === 'novel-bookmark-pill');
      const paint = nodes.find(node => node.type === 'Row' && node.width === 86 && node.height === 22);
      const label = nodes.find(node => node.type === 'Text' && node.create === (selected ? '已加书签' : '加书签'));
      assert.deepEqual([hit.width, hit.height, hit.enabled], [86, 44, enabled]);
      assert.equal(paint.borderRadius, 11);
      assert.equal(paint.backgroundColor, readerAppColor(selected ? 'TOK_READ_ACTIVE_SOFT' : 'TOK_SURFACE_PANEL_SOFT', appScheme));
      assert.deepEqual(paint.border, { width: 1, color: readerAppColor(selected ? 'TOK_READ_PRIMARY' : 'app.border.readerConfig', appScheme) });
      assert.equal(label.fontColor, readerAppColor(selected ? 'TOK_READ_PRIMARY' : 'TOK_READ_INK', appScheme));
      const fill = nodes.find(node => node.type === 'Column' && node.width === 12 && node.clip === true);
      assert.equal(fill.height, selected ? 12 : 0);
      assert.ok(nodes.some(node => node.type === 'Image' && node.create === 'app.media.' + icon));
      hit.onClick();
      inputCurrent = false;
      hit.onClick();
      assert.equal(actions, enabled ? 1 : 0, 'the painted state cannot bypass the host bookmark and input gates');
    }
  }

  const Panel = selectedProductionMethods(path, 'ReaderControlPanel', ['onPageBookmarkStatusChanged'], productionReaderMotionSdk());
  for (const reduceMotion of [false, true]) {
    const animation = [];
    const panel = Object.assign(new Panel(), { pageBookmarkStatus: 'empty', pageBookmarkFill: 0,
      reduceMotion, runtimeMounted: true, runtimeLifecycle: 1, pageBookmarkTuck: 1,
      getUIContext: () => ({ animateTo(params, update) { animation.push(params); update(); } }) });
    panel.pageBookmarkStatus = 'bookmarked';
    panel.onPageBookmarkStatusChanged();
    assert.equal(panel.pageBookmarkFill, 1);
    assert.equal(panel.pageBookmarkTuck, reduceMotion ? 1 : 1.025);
    animation[0].onFinish?.();
    assert.equal(panel.pageBookmarkTuck, 1);
    panel.pageBookmarkStatus = 'empty';
    panel.onPageBookmarkStatusChanged();
    assert.equal(panel.pageBookmarkFill, 0);
    assert.deepEqual(animation.map(params => params.duration), reduceMotion ? [120, 120] : [240, 160]);
  }
}

const path = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url);
for (const id of selectContractCases(definitions)) {
  bookmarkPillPaint(readFileSync(path, 'utf8'), path);
  recordContractCasePass(id);
}
