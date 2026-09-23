import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingChapterWindow } from '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { materializeReadingDocument } = await import('../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts');
const base = '../entry/src/main/ets/features/reading/';
const file = name => new URL(`${base}${name}`, import.meta.url);
const document = width => ({ content: '甲😀\n\uFFFC\n乙', blocks: [
  { kind: 'text', text: '甲😀\n', startScalar: 0, endScalar: 3 },
  { kind: 'image', source: 'reader-local-epub://book/logo', startScalar: 3, endScalar: 4,
    ...(width === undefined ? {} : { imageWidthBasisPoints: width }) },
  { kind: 'text', text: '\n乙', startScalar: 4, endScalar: 6 },
] });
const project = width => materializeReadingDocument(document(width), 'local', undefined, {});
const full = await project(undefined), logo = await project(3000), explicitFull = await project(10000);
assert.equal(full.content, logo.content, 'relative layout must not alter canonical Unicode or image anchors');
assert.deepEqual(logo.images.map(i => [i.startScalar, i.endScalar]), [[3, 4]]);
assert.equal(logo.images[0].imageWidthBasisPoints, 3000);
assert.notEqual(full.contentVersion, logo.contentVersion, 'changed image geometry invalidates pagination');
assert.equal(full.contentVersion, explicitFull.contentVersion, 'legacy full-width identity stays stable');
for (const invalid of [0, -1, 10001, 1.5, NaN, '3000'])
  await assert.rejects(project(invalid), /relative layout contract/);

const chapter = { sourceId: 'local', bookId: 'book', chapterIndex: 0, chapterTitle: 'chapter',
  content: logo.content, contentVersion: logo.contentVersion, images: logo.images, extractionVia: 'local' };
const window = new ReadingChapterWindow();
window.configure('local', 'book', [0]); window.setCurrent(chapter);
assert.equal(window.get(0).images[0].imageWidthBasisPoints, 3000, 'chapter defensive copies preserve layout');

const Resolver = productionMotionMethods(file('ReadingSessionFlowGateway.ts'), ['resolveReadingImage', 'failedReadingImage'],
  { errorMessageOf: String, diagnosticCodeOf: String });
const resolver = Object.assign(new Resolver(), { sourceId: 'local', bookId: 'book', source: { kind: 'local' },
  runtimeOwner: { async loadReadingImage() { return { width: 357, height: 359, fileUri: 'file:///logo', revision: 'r1' }; } } });
const ready = await resolver.resolveReadingImage(chapter, logo.images[0]);
assert.equal(ready.imageWidthBasisPoints, 3000, 'native decode cannot discard Core CSS width');
const Owner = productionMotionMethods(file('LocalReadingExperience.ets'), ['scaledReadingImageHeight']);
const owner = Object.assign(new Owner(), { measurementTextWidth: () => 100 });
assert.ok(Math.abs(owner.scaledReadingImageHeight(ready, 500) - 30 * 359 / 357) < 1e-9);
assert.ok(Math.abs(owner.scaledReadingImageHeight({ ...ready, imageWidthBasisPoints: undefined }, 500) - 100 * 359 / 357) < 1e-9);
assert.equal(owner.scaledReadingImageHeight(ready, 20), 20, 'page image height bound remains enforced');

const surface = readFileSync(file('ReadingSurface.ets'), 'utf8');
const fragmentSource = surface.slice(surface.indexOf('export class ReadingSurfacePageFragment'), surface.indexOf('/** Shared scalar-aware'));
const Fragment = new Function(`${stripTypeScriptTypes(fragmentSource).replace('export ', '')}; return ReadingSurfacePageFragment;`)();
assert.equal(new Fragment('legacy', '', true).imageWidthBasisPoints, 10000);
assert.equal(new Fragment('logo', '', true, 3, 4, undefined, 30, 'file:///logo', 30, 3000).imageWidthBasisPoints, 3000);
for (const source of [surface, readFileSync(file('ReaderContinuousReadingStage.ets'), 'utf8')])
  assert.equal((source.match(/\.width\(`\$\{fragment.imageWidthBasisPoints \/ 100\}%`\)/g) ?? []).length, 2,
    'paged and continuous file/PixelMap branches use the same Core image width');
console.log('PASS real projection, chapter ownership, native payload handoff, image sizing and paged/continuous width wiring; no pixel acceptance claim');
