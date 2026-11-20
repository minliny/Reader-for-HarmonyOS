import assert from 'node:assert/strict';
import { foundationControls } from './reader-foundation-control-probe.mjs';
import { labeledIconControls } from './reader-labeled-icon-action-probe.mjs';

// Actual installed-SDK component/modifier carriers. The returned numbers are
// layout attributes, not native measured glyph boxes or composited pixels.
export function runSourceLayoutControlProbe(width, scale) {
  assert.ok(Number.isFinite(width) && width > 0, 'explicit available content width');
  assert.ok(Number.isFinite(scale) && scale >= 1, 'explicit system font scale');
  const metrics = () => ({ systemFontScale: scale, windowRect: { width, height: 844 } });
  const foundation = foundationControls({ windowMetrics: metrics });
  const labeled = labeledIconControls({ foundation });
  const scalarFrame = (nodes, label) => {
    const frame = nodes.find(node => typeof node.onClick === 'function');
    const text = nodes.find(node => node.type === 'Text' && node.create === label);
    assert.ok(frame && text, `actual hit and text carrier for ${label}`);
    return { width: frame.width ?? null, height: frame.height ?? null,
      minHeight: frame.constraintSize?.minHeight ?? null,
      fontSize: text.fontSize, minFontScale: text.minFontScale ?? null,
      maxFontScale: text.maxFontScale ?? null, maxLines: text.maxLines ?? null,
      responseRegion: frame.responseRegion ?? null, layoutWeight: frame.layoutWeight ?? null };
  };
  function button(specId, label, layout = 'intrinsic') {
    const actor = new foundation.button.Component(undefined, {
      specId, label, layout, availableWidth: width, scheme: 'day', primary: false,
      actionEnabled: true, isBusy: false, onAction() {},
    });
    actor.aboutToAppear(); actor.initialRender();
    return scalarFrame(foundation.nodes(actor), label);
  }
  function icon(specId, label) {
    const actor = new labeled.component(undefined, {
      specId, label, icon: 'source-layout-fixture-icon', scheme: 'day',
      actionEnabled: true, isDanger: false, showDivider: false, onAction() {},
    });
    actor.aboutToAppear(); actor.initialRender();
    const nodes = labeled.nodes(actor), frame = scalarFrame(nodes, label);
    frame.rowHeight = nodes.find(node => node.type === 'Row')?.height ?? null;
    frame.iconWidth = nodes.find(node => node.type === 'Image')?.width ?? null;
    return frame;
  }
  return { width, scale, targets: {
    detect: button('source-management-detect', '检测中'),
    login: button('source-management-login', '登录'),
    statusCompact: button('source-management-status-compact', '全部'),
    statusWide: button('source-management-status-wide', '未检测'),
    category: button('source-management-category', '全部类型'),
    manage: button('source-management-manage', '批量管理', 'equal'),
    add: icon('source-management-add', '新增书源'),
  }, unchanged: {
    compact: button('source-compact', '普通操作'),
    rssFeed: icon('rss-feed', '原RSS动作'),
  } };
}
