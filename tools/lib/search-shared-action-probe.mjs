import assert from 'node:assert/strict';
import { searchAttachmentFixture } from './search-index-action-attachment-probe.mjs';

// Reuse the complete production Index -> SearchPage -> shared-control SDK
// composition. The finite presentation DTO is the controlled domain boundary;
// the parent Builders, regular callbacks, control Props and native handlers are
// the actual production implementations, not reconstructed action lambdas.
export function searchSharedActionFixture(presentation = {}, options = {}) {
  const fixture = searchAttachmentFixture(options);
  const page = fixture.first;
  page.presentation = { ...page.presentation, history: [], keyword: '原关键词', results: [],
    searching: false, stopped: false, completedSourceCount: 3, totalSourceCount: 7,
    failedSourceCount: 2, searchedSourceCount: 7, localSearchFailed: true,
    sourceListFailed: false, localSearchError: '原本地失败', ...presentation };
  function action(specId, label) {
    const actor = [...page.children.values()].findLast(child => child.specId === specId && (label === undefined || child.label === label));
    assert.ok(actor instanceof fixture.controls.dependencies.ReaderButton, specId + ' is the actual shared ReaderButton');
    const native = fixture.controls.nodes(actor).find(node => typeof node.onClick === 'function');
    assert.ok(native, specId + ' has an actual native physical action');
    return { actor, native, click: native.onClick };
  }
  return { ...fixture, page, action };
}

export function updateActualReaderButton(fixture, actor, changes) {
  // ArkUI V1 updates every decorated Prop in the real parent payload. Omitting
  // a Prop resets it, so preserve the full production contract for this test.
  const names = ['scheme', 'specId', 'label', 'primary', 'actionEnabled', 'layout', 'isBusy', 'availableWidth', 'actionAccessibilityLabel'];
  actor.updateStateVars({ ...Object.fromEntries(names.map(name => [name, actor[name]])), ...changes });
  fixture.controls.properties.flush();
}
