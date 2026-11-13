import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';

const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + name + '.ets', import.meta.url), 'utf8');
for (const id of selectContractCases({ recipe: { description: 'Actual shared reading-bookmark state recipe retains approved16/9/23 spacing,92x44 actions and original callbacks', resources: [] } })) {
  for (const name of ['ReaderBookmarkEmptyState', 'ReaderBookmarkErrorState']) {
    const sdk = boundedSurfaceSdk(), calls = [];
    const source = read(name);
    const owner = sdk.consumer(source, boundedMembers(source), {}, {
      onReturnToDirectory: () => calls.push('directory'), onRetry: () => calls.push('retry')
    });
    owner.aboutToAppear?.(); owner.initialRender(); sdk.properties.flush();
    const state = sdk.walk(owner).find(actor => actor instanceof sdk.deps.ReaderPageState);
    assert.equal(state.variant, 'readingBookmark');
    const nodes = sdk.nodes(owner);
    const title = nodes.find(node => node.type === 'Text' && ['暂无书签', '书签载入失败'].includes(node.create));
    assert.equal(title.fontSize, 17);
    const message = nodes.find(node => node.type === 'Text' && ['在阅读页面下拉，收藏当前位置。', '请稍后重试。'].includes(node.create));
    assert.deepEqual(message.margin, { top: 9 });
    const actions = nodes.find(node => node.type === 'Flex');
    assert.deepEqual(actions.margin, { top: 23 });
    const button = nodes.find(node => node.type === 'Button' && ['返回目录', '重试'].includes(node.accessibilityText));
    assert.equal(button.constraintSize.minWidth, 92);
    assert.equal(button.constraintSize.minHeight, 44);
    button.onClick();
    assert.deepEqual(calls, [name === 'ReaderBookmarkEmptyState' ? 'directory' : 'retry']);
    if (name === 'ReaderBookmarkEmptyState') {
      const icon = nodes.find(node => node.type === 'Image');
      assert.equal(icon.width, 28); assert.equal(icon.height, 28);
      assert.deepEqual(icon.margin, { bottom: 16 });
    } else assert.equal(nodes.filter(node => node.type === 'Image').length, 0);
  }
  const sdk = boundedSurfaceSdk();
  const normal = new sdk.deps.ReaderPageState(undefined, { title: '普通页面', message: '默认配方', actionLabel: '重试' });
  normal.initialRender();
  assert.equal([...normal.nodes.values()].find(node => node.type === 'Column').create.space, 12);
  assert.equal(sdk.nodes(normal).find(node => node.type === 'Button').constraintSize.minWidth, 44);
  recordContractCasePass(id);
}
