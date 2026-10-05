import assert from 'node:assert/strict';
import {localBookDetailSdk} from './lib/local-book-detail-sdk-probe.mjs';
import {ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
let metrics;
const {Component, Header} = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}});
// Execute the actual approved detail/header SDK actors. These are emitted
// attributes and owner callbacks, not a simulation of native layout/pixels.
for (const viewport of [320, 390, 800]) for (const count of [0, 1, 3, 20])
  for (const safeBottom of [0, 24, 48]) for (const safeTop of [0, 32]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, viewport, 900), undefined,
    new ReaderInsetsVp(0, safeTop, 0, safeBottom));
  const owner = new Component(); const calls = [];
  Object.assign(owner, {appThemeScheme: 'day', readerWindowMetricsRevision: 1, viewportWidth: 0,
    book: {sourceId: 'local', bookId: 'layout', title: 'Book', author: 'Author', contentKind: 'text'},
    toc: Array.from({length: count}, (_, index) => ({index, title: `第${index + 1}章`})),
    shelfMessage: '加入书架失败，请重试', inBookshelf: true, removalEnabled: true,
    removing: false, adding: false, cancellingAdd: false, readingEnabled: true,
    admissionIdentity: 'original-detail', loadingMessage: '', readingBlockedReason: '',
    collapsedGroups: [], introExpanded: false, onContinue: () => calls.push('continue'),
    onRemove: identity => calls.push(['remove', identity]), onBack: () => calls.push('back')});
  owner.initialRender();
  const nodes = [...owner.nodes.values()], root = nodes[0];
  assert.equal(root.type, 'Stack'); assert.equal(root.create.alignContent, 'Alignment.Top');
  assert.equal(root.height, '100%'); assert.equal(root.width, '100%');
  const scroll = nodes.find(n => n.type === 'Scroll');
  assert.equal(scroll.height, '100%'); assert.equal(scroll.width, '100%');
  assert.equal(scroll.layoutWeight, undefined); assert.equal(scroll.padding, undefined,
    'safe offsets and dock clearance do not shrink the full-viewport scroll actor');
  const contentWidth = Math.min(720, viewport - 40), contentEdge = (viewport - contentWidth) / 2;
  const content = nodes.find(n => n.type === 'Column' && n.width === contentWidth && n.padding?.top === safeTop + 76);
  assert.ok(content); assert.deepEqual(content.margin, {left: contentEdge, right: contentEdge});
  assert.deepEqual(content.padding, {top: safeTop + 76, bottom: safeBottom + 104});
  assert.equal(nodes.filter(n => n.type === 'Row' && n.constraintSize?.minHeight === 58).length, count,
    'the bounded preview shares the page scroll and retains every current chapter row');
  assert.equal(nodes.filter(n => n.type === 'Scroll').length, 1, 'no nested directory preview scroll');
  const footer = nodes.find(n => n.type === 'Stack' && n.create.alignContent === 'Alignment.Bottom');
  assert.deepEqual([footer.width, footer.height], ['100%', '100%']);
  assert.equal(footer.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(footer.padding, undefined); assert.equal(footer.align, undefined,
    'the full-viewport footer owner places the centered dock without moving the page scroll');
  const dock = nodes.find(n => n.type === 'Stack' && n.height === 68);
  assert.equal(dock.create.alignContent, 'Alignment.Center');
  assert.equal(dock.width, Math.min(680, viewport - 60)); assert.equal(dock.padding, 9);
  assert.deepEqual(dock.margin, {bottom: safeBottom + 12});
  assert.equal(content.padding.bottom - (dock.height + dock.margin.bottom), 24,
    'last content clears the actual dock and its live bottom margin with 24vp spare');
  const actions = nodes.find(n => n.type === 'Row' && n.height === 48);
  assert.equal(actions.width, '100%'); assert.equal(actions.create.space, 12);
  const buttons = nodes.filter(n => n.type === 'Text' && n.height === 48);
  assert.equal(buttons.length, 2); assert.equal(buttons[0].layoutWeight, 1);
  assert.equal(buttons[1].width, 94); assert.ok(dock.width - 18 - 12 - 94 > 0,
    'the primary action retains positive available width on the narrow viewport');
  assert.deepEqual(buttons.map(n => n.borderRadius), [16, 16]);
  buttons[0].onClick(); buttons[1].onClick();
  assert.deepEqual(calls, ['continue', ['remove', 'original-detail']]);
  const error = nodes.find(n => n.type === 'Text' && n.create === owner.shelfMessage);
  assert.ok(error.id > content.id && error.id < footer.id,
    'shelf error remains in scroll content before the floating overlay');
  const header = [...owner.children.values()].find(c => c instanceof Header);
  assert.ok(header.id > scroll.id && header.id < footer.id);
  assert.equal(header.floating, true); assert.equal(header.centered, true);
  const headerRow = [...header.nodes.values()].find(n => n.type === 'Row' && n.height === 52);
  assert.ok(headerRow); assert.equal(headerRow.hitTestBehavior, 'HitTestMode.Transparent');
  const headerOwner = nodes.find(n => n.type === 'Row' && n.align === 'Alignment.Top');
  assert.deepEqual(headerOwner.padding, {left: 16, right: 16, top: safeTop + 8});
  assert.equal(content.padding.top - (headerOwner.padding.top + headerRow.height), 16,
    'first content clears the actual floating header without shrinking the viewport');
  const back = [...header.nodes.values()].find(n => n.type === 'Stack' && n.width === 44 && n.onClick);
  assert.ok(back); back.onClick(); assert.equal(calls.at(-1), 'back');
  for (const scheme of ['night', 'day']) {owner.appThemeScheme = scheme; owner.replay();}
}
console.log('PASS actual SDK detail/header: 0/1/3/20 chapters, 320/390/800vp width, safe top/bottom, one full scroll, in-content errors, positive action width and captured callbacks; native geometry remains unverified');
