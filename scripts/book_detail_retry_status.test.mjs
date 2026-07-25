import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Book Detail state host uses only the current Figma RetryStatus states', async () => {
  const stateHost = await source('entry/src/main/ets/ui/slots/StateHost.ets');
  const detail = await source('entry/src/main/ets/ui/components/BookDetailComponents.ets');
  const tokens = await source('entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets');

  for (const marker of [
    "@StorageProp('reader.displayedRouteId') routeId",
    "return this.routeId === 'book-detail';",
    "FigmaBookDetailRetryStatus({ state: 'loading' })",
    "FigmaBookDetailRetryStatus({ state: 'error' })",
    "FigmaBookDetailRetryStatus({ state: 'offline' })",
  ]) {
    assert.ok(stateHost.includes(marker), `missing Figma Book Detail state binding: ${marker}`);
  }
  for (const marker of [
    'export struct FigmaBookDetailRetryStatus',
    "'loading' | 'error' | 'offline'",
    '正在加载章节',
    '章节加载失败',
    '当前处于离线状态',
    '目录正在同步，请稍候。',
    '暂时无法获取目录，请稍后重试。',
    '可继续阅读已缓存内容，联网后刷新目录。',
    'FigmaReadingVisualTokens.detailRetryStatusWidth',
    'FigmaReadingVisualTokens.detailRetryStatusHeight',
    'FigmaReadingVisualTokens.detailRetryStatusActionHeight',
    "ReaderUiStore.dispatch({ type: 'retry-last-operation' })",
    'ReaderUiStore.requestSourceSwitchOpen()',
  ]) {
    assert.ok(detail.includes(marker), `missing direct RetryStatus source: ${marker}`);
  }
  for (const marker of [
    'detailRetryStatusWidth: number = 352',
    'detailRetryStatusHeight: number = 180',
    'detailRetryStatusRadius: number = 12',
    "detailRetryStatusSurface: string = '#EBFFFCF8'",
    "detailRetryStatusBorder: string = '#57B4A697'",
  ]) {
    assert.ok(tokens.includes(marker), `missing Figma RetryStatus token: ${marker}`);
  }
});

test('Book Detail RecoveryAction retains Figma presentation states without adding a route', async () => {
  const detail = await source('entry/src/main/ets/ui/components/BookDetailComponents.ets');
  const tokens = await source('entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets');

  for (const marker of [
    'export struct FigmaBookDetailRecoveryAction',
    "'default' | 'pressed' | 'focus' | 'disabled' | 'loading' | 'selected'",
    'detailRecoveryActionWidth',
    'detailRecoveryActionHeight',
    'detailRecoveryActionPressedSurface',
    'detailRecoveryActionFocusBorder',
    'detailRecoveryActionSelectedSurface',
    '.opacity(this.renderedOpacity())',
  ]) {
    assert.ok(`${detail}\n${tokens}`.includes(marker), `missing Figma RecoveryAction source: ${marker}`);
  }
  assert.equal(detail.includes("type: 'route-push', id: 'source-switch'"), false,
    'RecoveryAction visuals must not infer a replacement source-switch route');
});

test('Book Detail RetryStatus uses direct Figma-exported 28px semantic icons', async () => {
  const detail = await source('entry/src/main/ets/ui/components/BookDetailComponents.ets');
  const loading = await source('entry/src/main/resources/base/media/figma_book_detail_retry_loading.svg');
  const error = await source('entry/src/main/resources/base/media/figma_book_detail_retry_error.svg');
  const offline = await source('entry/src/main/resources/base/media/figma_book_detail_retry_offline.svg');

  for (const marker of [
    'app.media.figma_book_detail_retry_loading',
    'app.media.figma_book_detail_retry_error',
    'app.media.figma_book_detail_retry_offline',
  ]) {
    assert.ok(detail.includes(marker), `missing Figma icon resource: ${marker}`);
  }
  for (const svg of [loading, error, offline]) {
    assert.ok(svg.includes('viewBox="0 0 28 28"'));
    assert.ok(svg.includes('stroke="#1F1B17"'));
  }
});
