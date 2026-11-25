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
  const minimumDimension = (value, minimum) => typeof value === 'number' ? Math.max(value, minimum ?? 0) : value ?? minimum ?? null;
  const scalarFrame = (nodes, label) => {
    const frame = nodes.find(node => typeof node.onClick === 'function');
    const text = nodes.find(node => node.type === 'Text' && node.create === label);
    assert.ok(frame && text, `actual hit and text carrier for ${label}`);
    return { width: minimumDimension(frame.width, frame.constraintSize?.minWidth),
      height: minimumDimension(frame.height, frame.constraintSize?.minHeight),
      minHeight: frame.constraintSize?.minHeight ?? null,
      fontSize: text.fontSize, minFontScale: text.minFontScale ?? null,
      maxFontScale: text.maxFontScale ?? null, maxLines: text.maxLines ?? null,
      responseRegion: frame.responseRegion ?? null, layoutWeight: frame.layoutWeight ?? null };
  };
  function button(specId, label, { layout = 'intrinsic', variant, visualSize } = {}) {
    const actor = new foundation.button.Component(undefined, {
      specId, label, layout, variant, visualSize, availableWidth: width, scheme: 'day', primary: false,
      actionEnabled: true, isBusy: false, onAction() {},
    });
    actor.aboutToAppear(); actor.initialRender();
    const nodes = foundation.nodes(actor);
    const frame = scalarFrame(nodes, label);
    if (variant !== undefined) {
      const capsule = nodes.find(node => node.type === 'Row' && node.borderRadius === 999);
      assert.ok(capsule, `actual matrix capsule for ${label}`);
      frame.height = Math.max(frame.height, capsule.constraintSize.minHeight);
    }
    return frame;
  }
  function icon(specId, label, fillWidth = false) {
    const actor = new labeled.component(undefined, {
      specId, label, fillWidth, icon: 'source-layout-fixture-icon', scheme: 'day',
      actionEnabled: true, isDanger: false, showDivider: false, onAction() {},
    });
    actor.aboutToAppear(); actor.initialRender();
    const nodes = labeled.nodes(actor), frame = scalarFrame(nodes, label);
    frame.rowHeight = nodes.find(node => node.type === 'Row')?.height ?? null;
    frame.iconWidth = nodes.find(node => node.type === 'Image')?.width ?? null;
    return frame;
  }
  return { width, scale, targets: {
    detect: button('source-management-detect', '检测中', { variant: 'tonal', visualSize: 'small' }),
    login: button('source-management-login', '登录', { variant: 'subtle', visualSize: 'small' }),
    statusCompact: button('source-management-status-compact', '全部', { variant: 'tonal', visualSize: 'small' }),
    statusWide: button('source-management-status-wide', '未检测', { variant: 'subtle', visualSize: 'small' }),
    category: button('source-management-category', '全部类型', { variant: 'tonal', visualSize: 'small' }),
    manage: button('source-management-manage', '批量管理', { layout: 'full', variant: 'tonal', visualSize: 'large' }),
    add: icon('source-management-add', '新增书源', true),
  }, unchanged: {
    compact: button('source-compact', '普通操作'),
    rssFeed: icon('rss-feed', '原RSS动作'),
  } };
}
