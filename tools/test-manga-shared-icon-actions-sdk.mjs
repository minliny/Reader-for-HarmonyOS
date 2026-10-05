import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';

const source = readFileSync('entry/src/main/ets/features/manga/MangaReadingSurface.ets', 'utf8');
const shelf = readFileSync('entry/src/main/ets/features/bookshelf/BookshelfShell.ets', 'utf8');
assert.match(shelf, /specId: 'floating-more',[\s\S]*?accessibilityLabel: '更多'/);
assert.doesNotMatch(shelf, /ReaderIconButton\(\{[\s\S]*?(?:boxSize|iconSize|radius):/);
let checks = 0;
for (const scheme of ['day', 'night']) {
  const floating = iconButtonControls(); let more = 0;
  const moreActor = new floating.icon.Component(undefined, { icon: 'dots', specId: 'floating-more', accessibilityLabel: '更多', onTap: () => more++ });
  moreActor.appThemeScheme = scheme; moreActor.aboutToAppear(); moreActor.initialRender();
  const moreHit = floating.nodes(moreActor).find(node => node.onClick), moreImage = floating.nodes(moreActor).find(node => node.type === 'Image');
  assert.deepEqual([moreHit.width, moreHit.height, moreImage.width, moreImage.height], [44, 44, 24, 24]);
  assert.equal(floating.resolveReaderIconButtonSpec('floating-more').radius, 0);
  assert.equal(moreHit.enabled, true); assert.equal(moreHit.accessibilityText, '更多'); moreHit.onClick(); assert.equal(more, 1);
  for (const label of ['返回', '更多']) {
    const actual = iconButtonControls(); let taps = 0;
    const owner = actual.consumer(source, ['iconAction']);
    owner.appThemeScheme = scheme; owner.iconAction('manga-icon', label, () => taps++);
    const actor = actual.walk(owner).find(child => child instanceof actual.icon.Component); assert.ok(actor);
    assert.equal(actor.specId, 'manga-reader-action'); assert.equal(actor.accessibilityLabel, label);
    const hit = actual.nodes(actor).find(node => node.onClick), image = actual.nodes(actor).find(node => node.type === 'Image');
    assert.deepEqual([hit.width, hit.height, image.width, image.height], [44, 44, 22, 22]);
    assert.equal(actual.resolveReaderIconButtonSpec(actor.specId).radius, 22);
    assert.equal(hit.enabled, true); assert.equal(hit.focusable, true); assert.equal(hit.accessibilityText, label);
    assert.equal(hit.accessibilityRole, 'AccessibilityRoleType.BUTTON'); hit.onClick(); assert.equal(taps, 1);
    actor.aboutToDisappear(); hit.onClick(); assert.equal(taps, 1, 'retired physical action cannot invoke the old manga callback');
    checks++;
  }
}
// Reproduce the integration defect by removing the actual semantic Prop.
// An outer native accessibility modifier cannot populate the child's eligibility.
const removed = source.replace("accessibilityLabel: label, onTap: action", 'onTap: action');
assert.notEqual(removed, source);
const negative = iconButtonControls(); let taps = 0;
const owner = negative.consumer(removed, ['iconAction']); owner.iconAction('manga-icon', '返回', () => taps++);
const child = negative.walk(owner).find(actor => actor instanceof negative.icon.Component), hit = negative.nodes(child).find(node => node.onClick);
assert.equal(hit.enabled, false); hit.onClick(); assert.equal(taps, 0, 'missing real accessible-name Prop reproduces disabled manga controls');
console.log(`PASS approved manga/floating icon SDK: ${checks} day/night real manga Builder→shared icon actions, finite retained dimensions/radii, names/eligibility, retired callbacks and missing-Prop negative. Native focus/layout/device remain separate.`);
