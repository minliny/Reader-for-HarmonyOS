import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const declarations = await readFile(
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.graphics.text.d.ts',
  'utf8',
);
const textDeclarations = await readFile(
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/declarations/text.d.ts',
  'utf8',
);
assert.match(declarations, /interface ParagraphStyle/);
assert.match(declarations, /class ParagraphBuilder/);
assert.match(declarations, /getGlobalInstance\(\): FontCollection/);
assert.match(declarations, /layoutSync\(width: number\): void/);
assert.match(declarations, /paint\(canvas: drawing\.Canvas, x: number, y: number\): void/);
assert.match(declarations, /getLineMetrics\(\): Array<LineMetrics>/);
assert.match(textDeclarations, /getLayoutManager\(\): LayoutManager/);

const probeUrl = new URL('../evidence/2026-09-20-seamless-entry-implementation/prototype/ReaderPlatformParagraphProbe.ts', import.meta.url);
const probe = await readFile(
  probeUrl,
  'utf8',
);
assert.match(probe, /new text\.ParagraphBuilder/);
assert.match(probe, /fontSizePx/);
assert.match(probe, /lineHeightPx/);
assert.match(probe, /letterSpacingPx/);
assert.match(probe, /indentPx/);
assert.match(probe, /paragraph\.layoutSync/);
assert.match(probe, /paragraph\.paint/);

const sdkRoot = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets';
const ts = createRequire(import.meta.url)(`${sdkRoot}/build-tools/ets-loader/node_modules/typescript`);
const adapterPath = probeUrl.pathname;
const options = { noEmit: true, allowJs: false, skipLibCheck: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext, types: [], baseUrl: '/', paths: {
    '@ohos.graphics.text': [`${sdkRoot}/api/@ohos.graphics.text.d.ts`],
    '@ohos.graphics.drawing': [`${sdkRoot}/api/@ohos.graphics.drawing.d.ts`],
  } };
const program = ts.createProgram([adapterPath,
  `${sdkRoot}/api/@ohos.graphics.text.d.ts`, `${sdkRoot}/api/@ohos.graphics.drawing.d.ts`], options);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(diagnostics.length, 0, diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
console.log('platform paragraph installed-SDK semantic adapter: PASS; API23 target support reviewed separately; renderer admission: NOT CLAIMED');
